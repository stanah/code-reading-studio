// Logic smoke tests only; this is not a browser layout or BroadcastChannel integration test.
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const base = path.resolve(__dirname, '../dist');
const source = fs.readFileSync(path.join(base, 'app.js'), 'utf8');
const data = fs.readFileSync(path.join(base, 'reth-data.js'), 'utf8');
function setup(search = '', saved = {}) {
  const els = new Map();
  const storage = new Map(Object.entries(saved));
  const messages = [];
  const el = id => {
    if (!els.has(id)) els.set(id, {
      textContent: '', innerHTML: '', value: '', dataset: {},
      classList: {toggle() {}, add() {}, remove() {}}, style: {setProperty() {}},
      scrollTop: 0, offsetTop: 0, scrollIntoView() {}, showModal() {this.open = true},
      close() {this.open = false}, click() {},
    });
    return els.get(id);
  };
  class Channel {postMessage(value) {messages.push(value)}}
  const ctx = {
    URLSearchParams, location: {search, pathname: '/'},
    localStorage: {getItem: k => storage.get(k), setItem: (k, v) => storage.set(k, v)},
    document: {getElementById: el, querySelectorAll: () => [], querySelector: () => null,
      documentElement: el('root'), body: el('body'), addEventListener() {}},
    window: {}, BroadcastChannel: Channel, setTimeout, clearTimeout, console,
  };
  vm.createContext(ctx);
  vm.runInContext(data, ctx);
  vm.runInContext(source, ctx);
  return {run: code => vm.runInContext(code, ctx), storage, el, messages};
}
const app = setup();
assert.equal(app.run('steps.length'), 6);
assert.equal(app.run('current().id'), 'rpc');
for (let i = 0; i < 6; i++) {
  app.run(`navigate(${i}); detour(current().related); render(); back()`);
  assert.equal(app.run('state.pos'), i);
  assert.equal(app.el('body').dataset.readingStep, app.run('current().id'));
}
app.run("navigate(2); state.selected=111; state.tab='language'; state.expanded=[39]; detour('forward'); back()");
assert.equal(app.run('state.pos'), 2);
assert.equal(app.run('state.selected'), 111);
assert.equal(app.run('state.tab'), 'language');
assert.equal(app.run('state.expanded[0]'), 39);
app.run("detour('forward'); state.order.push(current().id); navigate(state.order.length-1)");
assert.equal(app.run('current().id'), 'forward');
assert.ok(app.el('related').textContent);
app.run("navigate(2); state.expanded=[]; renderCode()");
assert.ok(app.el('code').innerHTML.includes('L39–L86'));
assert.ok(app.el('code').innerHTML.includes('data-line="111"'));
app.run('state.expanded=[39,88]; renderCode()');
assert.ok(app.el('code').innerHTML.includes('data-line="39"'));
assert.ok(app.el('code').innerHTML.includes('data-line="102"'));
app.run("state.notes.submit='private note'; state.questions=['private question']; save()");
const key = app.run('KEY');
const publicState = JSON.parse(app.storage.get(key + '-public'));
assert.equal(publicState.notes, undefined);
assert.equal(publicState.questions, undefined);
assert.equal(JSON.stringify(app.messages).includes('private note'), false);
const share = setup('?present=1', Object.fromEntries(app.storage));
share.run('navigate(3)');
assert.equal(JSON.parse(share.storage.get(key)).notes.submit, 'private note');
assert.equal(share.run('Object.keys(state.notes).length'), 0);
assert.equal(share.run('state.questions.length'), 0);
const reload = setup('', Object.fromEntries(app.storage));
assert.equal(reload.run('state.pos'), 2);
assert.equal(reload.run('state.notes.submit'), 'private note');
for (const s of app.run('Object.values(catalog)')) {
  assert.equal(s.code.split('\n').length, s.end - s.start + 1);
  assert.ok(s.lines[0] >= s.start && s.lines[1] <= s.end);
  assert.equal(crypto.createHash('sha256').update(s.code).digest('hex'), s.contentHash);
  assert.ok(s.sourceUrl.endsWith(`#L${s.start}-L${s.end}`));
}
console.log('PASS: 6 steps, 5 detours, appended detour navigation, original line numbers, folded source, persistence, presenter data isolation, 11 source hashes');
