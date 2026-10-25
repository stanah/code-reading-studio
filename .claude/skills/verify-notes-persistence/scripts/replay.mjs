#!/usr/bin/env node
// Replays the TLA+ model's scenarios against the real local-app/server.mjs, with faults injected into
// node:fs/promises. Each scenario prints PASS or FAIL in the model's terms; the exit code is the
// number of scenarios whose result differs from expected.json.
import {createRequire, syncBuiltinESMExports} from 'node:module';
import {execFileSync} from 'node:child_process';
import {mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join, dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '../../../..');
const require = createRequire(import.meta.url);
const fsp = require('node:fs/promises');
const realWriteFile = fsp.writeFile;

// Fault plan for the next writeFile calls into a scenario's data directory: 'ok', 'fail', or a delay in ms.
// Matching on the directory, not a file name, keeps the plan working if save() renames its temp file.
let plan = [];
const work = mkdtempSync(join(tmpdir(), 'notes-persistence-'));
fsp.writeFile = async (file, ...rest) => {
  if (String(file).startsWith(join(work, 'data-'))) {
    const step = plan.shift() ?? 'ok';
    if (step === 'fail') throw Object.assign(Error('injected ENOSPC'), {code: 'ENOSPC'});
    if (typeof step === 'number') await new Promise(r => setTimeout(r, step));
  }
  return realWriteFile(file, ...rest);
};
syncBuiltinESMExports();
const {createStudio} = await import(join(repoRoot, 'local-app/server.mjs'));

const repo = join(work, 'repo');
mkdirSync(join(repo, 'src'), {recursive: true});
writeFileSync(join(repo, 'Cargo.toml'), '[package]\nname = "demo"\n');
writeFileSync(join(repo, 'src/lib.rs'), Array.from({length: 20}, (_, i) => `fn f${i}() {}`).join('\n') + '\n');
const git = (...args) => execFileSync('git', ['-C', repo, '-c', 'user.email=v@example.invalid', '-c', 'user.name=verify', ...args]);
git('init', '-q'); git('add', '.'); git('commit', '-qm', 'fixture');

async function server(dataDir) {
  const app = await createStudio({repo, dataDir, port: 0});
  const base = `http://127.0.0.1:${app.server.address().port}`;
  const call = async (path, body) => {
    const res = await fetch(base + '/api/' + path, {method: body ? 'POST' : 'GET', headers: {'x-studio-token': app.token, 'content-type': 'application/json'}, body: body ? JSON.stringify(body) : undefined});
    return {status: res.status, body: await res.json()};
  };
  const add = note => call('item', {path: 'src/lib.rs', start: 1, end: 2, note});
  const notes = async () => (await call('state')).body.items.map(i => i.note).sort();
  return {add, call, notes, close: () => new Promise(r => app.server.close(r))};
}

const scenarios = {
  // AckedSurvives: two adds whose first write is slow. Both are acknowledged, so both must survive a restart.
  async 'AckedSurvives-slow-first-write'(dataDir) {
    plan = [80, 'ok'];
    let s = await server(dataDir);
    const [a, b] = await Promise.all([s.add('A'), s.add('B')]);
    await s.close(); s = await server(dataDir);
    const after = await s.notes(); await s.close();
    const acked = [a.status === 200 && 'A', b.status === 200 && 'B'].filter(Boolean);
    return {ok: acked.every(n => after.includes(n)), detail: {acked, afterRestart: after}};
  },
  // AckedDeleteSticks: a delete acknowledged after a slow add write must not be undone by that write.
  async 'AckedDeleteSticks-slow-add-write'(dataDir) {
    plan = ['ok', 120, 'ok'];
    let s = await server(dataDir);
    const a = await s.add('A');
    const pendingB = s.add('B');
    await new Promise(r => setTimeout(r, 20));
    const del = await s.call('delete', {id: a.body.id});
    await pendingB;
    await s.close(); s = await server(dataDir);
    const after = await s.notes(); await s.close();
    return {ok: del.status !== 200 || !after.includes('A'), detail: {deleteStatus: del.status, afterRestart: after}};
  },
  // NoSkippedSave: one failed write must not make the next, healthy save fail without being attempted.
  async 'NoSkippedSave-after-one-failure'(dataDir) {
    plan = ['fail'];
    const s = await server(dataDir);
    const a = await s.add('A');
    const b = await s.add('B');
    await s.close();
    return {ok: b.status === 200, detail: {firstStatus: a.status, firstError: a.body.error, secondStatus: b.status, secondError: b.body.error}};
  },
  // IdleMatchesDisk: with no write pending, the notebook the server shows equals what a restart loads.
  async 'IdleMatchesDisk-after-one-failure'(dataDir) {
    plan = ['fail'];
    let s = await server(dataDir);
    const a = await s.add('A');
    const shown = await s.notes();
    await s.close(); s = await server(dataDir);
    const after = await s.notes(); await s.close();
    return {ok: JSON.stringify(shown) === JSON.stringify(after), detail: {addStatus: a.status, shownBeforeRestart: shown, afterRestart: after}};
  },
};

const expected = JSON.parse(readFileSync(join(here, '../expected.json'), 'utf8')).replay;
let unexpected = 0;
for (const [name, run] of Object.entries(scenarios)) {
  const dataDir = join(work, 'data-' + name);
  const {ok, detail} = await run(dataDir).catch(e => ({ok: false, detail: {error: e.message}}));
  const result = ok ? 'PASS' : 'FAIL', want = expected[name];
  if (result !== want) unexpected++;
  console.log(`${result === want ? '  ' : '!!'} ${name}: ${result} (expected ${want}) ${JSON.stringify(detail)}`);
}
rmSync(work, {recursive: true, force: true});
process.exit(unexpected);
