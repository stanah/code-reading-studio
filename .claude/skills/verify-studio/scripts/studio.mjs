#!/usr/bin/env node
// Verification harness for Code Reading Studio: one isolated server + one headless Chromium per run.
// Every command prints JSON on stdout and exits non-zero on failure.
import {spawn, execFileSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {createServer} from 'node:net';
import {openSync, existsSync, readFileSync, writeFileSync, mkdirSync, rmSync} from 'node:fs';
import {join, resolve, dirname, isAbsolute} from 'node:path';
import {fileURLToPath} from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..');
const runsRoot = join(repoRoot, 'outputs/verify-studio');
const target = JSON.parse(readFileSync(join(repoRoot, 'reading-target.json'), 'utf8'));
const require = createRequire(import.meta.url);

const [command, ...rest] = process.argv.slice(2);
const args = {_: []};
for (let i = 0; i < rest.length; i++) {
  if (rest[i].startsWith('--')) {
    const key = rest[i].slice(2);
    args[key] = rest[i + 1] === undefined || rest[i + 1].startsWith('--') ? true : rest[++i];
  } else args._.push(rest[i]);
}

const out = value => console.log(JSON.stringify(value, null, 2));
const fail = (message, extra = {}) => { out({ok: false, error: message, ...extra}); process.exit(1); };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const runId = () => args.run || (existsSync(join(runsRoot, 'current')) ? readFileSync(join(runsRoot, 'current'), 'utf8').trim() : null);
const runDir = id => join(runsRoot, id);
const loadRun = () => {
  const id = runId();
  if (!id || !existsSync(join(runDir(id), 'run.json'))) fail('No active run. Start one with: node .claude/skills/verify-studio/scripts/studio.mjs launch');
  return JSON.parse(readFileSync(join(runDir(id), 'run.json'), 'utf8'));
};
const saveRun = run => writeFileSync(join(run.dir, 'run.json'), JSON.stringify(run, null, 2));
const evidencePath = (run, path) => isAbsolute(path) ? path : join(run.dir, 'evidence', path);

// Only signal a pid whose command line carries a flag this harness set for this run, so a reused pid or a shell
// whose command merely mentions the run directory is never killed.
function commandOf(pid) {
  try { return execFileSync('ps', ['-p', String(pid), '-o', 'command='], {encoding: 'utf8'}).trim(); } catch { return ''; }
}
const markers = run => [`--verify-run=${run.dir}`, `--user-data-dir=${join(run.dir, 'chromium-profile')}`];
// A marker must be a whole argument: run `proof` must not claim run `proof2`, whose flag starts with the same text.
const escape = text => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const carries = (command, run) => markers(run).some(m => new RegExp(`(^|\\s)${escape(m)}(\\s|$)`).test(command));
const owns = (pid, run) => !!pid && carries(commandOf(pid), run);

function freePort() {
  return new Promise((ok, no) => { const s = createServer(); s.on('error', no); s.listen(0, '127.0.0.1', () => { const {port} = s.address(); s.close(() => ok(port)); }); });
}

async function waitFor(check, timeoutMs, label) {
  const deadline = Date.now() + timeoutMs;
  let last;
  while (Date.now() < deadline) {
    try { const value = await check(); if (value) return value; } catch (e) { last = e; }
    await sleep(200);
  }
  throw Error(`${label} not ready after ${timeoutMs} ms${last ? ': ' + last.message : ''}`);
}

async function startServer(run) {
  const log = openSync(join(run.dir, 'server.log'), 'a');
  const child = spawn(process.execPath, [join(repoRoot, 'local-app/server.mjs'), join(repoRoot, 'targets/reth'), target.commit, `--verify-run=${run.dir}`], {
    cwd: repoRoot, detached: true, stdio: ['ignore', log, log],
    env: {...process.env, PORT: String(run.port), READING_DATA_DIR: run.dataDir, AI_BASE_URL: '', AI_MODEL: '', AI_API_KEY: ''},
  });
  child.unref();
  run.serverPid = child.pid;
  // Ready means the guide for the pinned commit is served, not merely that the port answers.
  run.token = await waitFor(async () => {
    const html = await (await fetch(`${run.base}/startup`)).text();
    const token = html.match(/name="studio-token" content="([a-f0-9]{48})"/)?.[1];
    if (!token) return null;
    const index = await (await fetch(`${run.base}/api/index`, {headers: {'x-studio-token': token}})).json();
    return index.commit === target.commit && index.startupReady ? token : null;
  }, 60000, 'Studio server');
}

async function startBrowser(run) {
  const {chromium} = require('playwright');
  const log = openSync(join(run.dir, 'chromium.log'), 'a');
  const child = spawn(chromium.executablePath(), [
    '--headless=new', '--no-first-run', '--no-default-browser-check', '--remote-debugging-port=0',
    '--disable-background-networking', '--disable-component-update', '--disable-sync', '--disable-features=Translate',
    `--user-data-dir=${join(run.dir, 'chromium-profile')}`, '--window-size=1440,1000',
    // Chromium refuses to start as root with its sandbox on, which is the norm in containers.
    ...(process.getuid?.() === 0 ? ['--no-sandbox'] : []), 'about:blank',
  ], {detached: true, stdio: ['ignore', 'ignore', log]});
  child.unref();
  run.browserPid = child.pid;
  run.cdp = await waitFor(() => {
    const port = readFileSync(join(run.dir, 'chromium-profile/DevToolsActivePort'), 'utf8').split('\n')[0];
    return port ? `http://127.0.0.1:${port}` : null;
  }, 30000, 'Chromium');
}

async function page(run) {
  const {chromium} = require('playwright');
  const browser = await chromium.connectOverCDP(run.cdp);
  const context = browser.contexts()[0];
  const p = context.pages()[0] || await context.newPage();
  p.setDefaultTimeout(Number(args.timeout || 10000));
  return p;
}

const locate = (p) => {
  if (args.selector) return p.locator(args.selector).first();
  if (args.role) return p.getByRole(args.role, {name: args.name, exact: !!args.exact}).first();
  if (args.label) return p.getByLabel(args.label, {exact: !!args.exact}).first();
  if (args.text) return p.getByText(args.text, {exact: !!args.exact}).first();
  fail('Pass --role R --name N, --label L, --text T, or --selector CSS');
};

async function settle(p) { await p.waitForLoadState('networkidle', {timeout: 10000}).catch(() => {}); }

async function api(run, method, path, body) {
  const res = await fetch(run.base + path, {method, headers: {'x-studio-token': run.token, 'content-type': 'application/json'}, body: body ? JSON.stringify(body) : undefined});
  return {status: res.status, body: await res.json().catch(() => null)};
}

const commands = {
  async launch() {
    const id = args.run || `run-${new Date().toISOString().replace(/[-:]/g, '').replace(/\..+/, '')}-${process.pid}`;
    const dir = runDir(id);
    if (existsSync(join(dir, 'run.json'))) fail(`Run ${id} already exists. Clean it up or pick another --run.`);
    if (!existsSync(join(repoRoot, 'targets/reth/.git'))) fail('targets/reth is missing. Run: git submodule update --init --filter=blob:none targets/reth');
    mkdirSync(join(dir, 'evidence'), {recursive: true});
    const port = Number(args.port || await freePort());
    const run = {id, dir, port, base: `http://127.0.0.1:${port}`, dataDir: join(dir, 'data'), commit: target.commit, startedAt: new Date().toISOString()};
    saveRun(run);
    writeFileSync(join(runsRoot, 'current'), id);
    try { await startServer(run); saveRun(run); await startBrowser(run); saveRun(run); }
    catch (e) { saveRun(run); fail(e.message, {hint: `Inspect ${join(dir, 'server.log')}, then run cleanup`, run: id}); }
    out({ok: true, run: id, base: run.base, dataDir: run.dataDir, evidence: join(dir, 'evidence')});
  },

  async doctor() {
    const run = loadRun(), checks = {};
    checks.serverProcess = owns(run.serverPid, run);
    checks.browserProcess = owns(run.browserPid, run);
    try {
      const index = await api(run, 'GET', '/api/index');
      checks.tokenAccepted = index.status === 200;
      checks.commit = index.body?.commit === target.commit ? target.commit : `MISMATCH ${index.body?.commit}`;
      checks.version = index.body?.version;
      checks.startupReady = index.body?.startupReady === true;
      checks.aiConfigured = index.body?.aiReady;
    } catch (e) { checks.http = 'unreachable: ' + e.message; }
    checks.serverOwnsPort = existsSync(join(run.dir, 'server.log')) && readFileSync(join(run.dir, 'server.log'), 'utf8').includes(`http://127.0.0.1:${run.port}`);
    checks.dataDir = run.dataDir;
    try { checks.cdp = (await (await fetch(run.cdp + '/json/version')).json()).Browser; } catch { checks.cdp = false; }
    const ok = checks.serverProcess && checks.browserProcess && checks.tokenAccepted && checks.commit === target.commit && checks.startupReady && checks.serverOwnsPort && !!checks.cdp;
    out({ok, run: run.id, base: run.base, checks});
    if (!ok) process.exit(1);
  },

  // Restart only the server, keeping this run's data directory, to prove persistence.
  async restart() {
    const run = loadRun();
    if (owns(run.serverPid, run)) { process.kill(run.serverPid, 'SIGTERM'); await waitFor(() => !owns(run.serverPid, run), 10000, 'Server stop'); }
    await startServer(run); saveRun(run);
    out({ok: true, run: run.id, base: run.base, serverPid: run.serverPid});
  },

  async browser() {
    const run = loadRun(), [action, value] = args._, p = await page(run);
    const errors = [];
    p.on('pageerror', e => errors.push(e.message));
    // Console errors without a URL are reported as-is; failed responses carry the URL instead.
    p.on('console', m => { if (m.type() === 'error' && !m.text().startsWith('Failed to load resource')) errors.push(m.text()); });
    // The server ships no favicon, so the browser's automatic /favicon.ico request is expected to 404.
    p.on('response', r => { if (r.status() >= 400 && new URL(r.url()).pathname !== '/favicon.ico') errors.push(`${r.status()} ${r.url().replace(run.base, '')}`); });
    let result = {};
    // goto is always a fresh document load: a hash-only change would keep a page whose token died with a restarted server.
    if (action === 'goto') { await p.goto('about:blank'); await p.goto(run.base + (value || '/startup')); await settle(p); }
    else if (action === 'click') { await locate(p).click(); await settle(p); }
    else if (action === 'fill') { await locate(p).fill(String(args.value ?? '')); }
    else if (action === 'press') { await p.keyboard.press(args.key || value); await settle(p); }
    else if (action === 'wait') { await locate(p).waitFor({state: 'visible'}); }
    else if (action === 'text') result.text = await (args.selector || args.role || args.label || args.text ? locate(p) : p.locator('main').first()).innerText();
    else if (action === 'count') result.count = await p.locator(args.selector).count();
    else if (action === 'snapshot') {
      const file = evidencePath(run, args.path || `snapshot-${Date.now()}.aria.txt`);
      mkdirSync(dirname(file), {recursive: true}); writeFileSync(file, await p.locator('body').ariaSnapshot()); result.file = file;
    }
    else if (action === 'screenshot') {
      const file = evidencePath(run, args.path || `screenshot-${Date.now()}.png`);
      mkdirSync(dirname(file), {recursive: true}); await p.screenshot({path: file, fullPage: !!args.full}); result.file = file;
    }
    else if (action !== 'url') fail(`Unknown browser action ${action}. Use goto, click, fill, press, wait, text, count, snapshot, screenshot, url.`);
    await sleep(100);
    out({ok: errors.length === 0, url: p.url().replace(run.base, ''), title: await p.title(), ...result, ...(errors.length ? {pageErrors: errors} : {})});
    process.exit(errors.length ? 1 : 0);
  },

  async api() {
    const run = loadRun(), [method, path, body] = args._;
    const res = await api(run, (method || 'GET').toUpperCase(), path || '/api/index', body ? JSON.parse(body) : undefined);
    if (args.save) { const file = evidencePath(run, args.save); mkdirSync(dirname(file), {recursive: true}); writeFileSync(file, JSON.stringify(res, null, 2)); res.file = file; }
    out({ok: res.status < 400, ...res});
    if (res.status >= 400) process.exit(1);
  },

  // Stops what this run started and removes scratch state. evidence/ and the logs stay.
  async cleanup() {
    const run = loadRun(), stopped = [];
    for (const pid of [run.serverPid, run.browserPid]) {
      if (owns(pid, run)) { try { process.kill(-pid, 'SIGTERM'); } catch { process.kill(pid, 'SIGTERM'); } stopped.push(pid); }
    }
    // Chromium's helper processes exit after the main one; wait for every process that carries this run's flags.
    const leftovers = () => execFileSync('ps', ['-eo', 'pid=,command='], {encoding: 'utf8'}).split('\n')
      .filter(line => carries(line, run)).map(line => Number(line.trim().split(/\s+/)[0])).filter(pid => pid && pid !== process.pid);
    await waitFor(() => leftovers().length === 0, 5000, 'Process stop').catch(() => {
      for (const pid of leftovers()) { try { process.kill(pid, 'SIGKILL'); } catch {} }
    });
    rmSync(run.dataDir, {recursive: true, force: true});
    rmSync(join(run.dir, 'chromium-profile'), {recursive: true, force: true});
    rmSync(join(run.dir, 'run.json'), {force: true});
    if (existsSync(join(runsRoot, 'current')) && readFileSync(join(runsRoot, 'current'), 'utf8').trim() === run.id) rmSync(join(runsRoot, 'current'));
    out({ok: true, run: run.id, stopped, evidence: join(run.dir, 'evidence')});
  },
};

if (!commands[command]) fail('Usage: studio.mjs launch|doctor|browser|api|restart|cleanup [--run ID]');
await commands[command]().catch(e => fail(e.message));
