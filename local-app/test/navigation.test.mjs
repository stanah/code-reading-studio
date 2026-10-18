import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';

const read = path => readFile(new URL(path, import.meta.url), 'utf8');

test('shared navigation retains the source step from hash, query and reader changes', async () => {
  const script = await read('../../ui/studio.js');
  for (const href of [
    'http://localhost/#path=core.rs&code=1&step=queue',
    'http://localhost/reader.html?step=queue',
    'http://localhost/lenses.html#lens=rust&step=queue&topic=future',
  ]) {
    const location = new URL(href), handlers = {}, body = {dataset: {}};
    const links = ['structure', 'flow', 'rust'].map(view => ({
      dataset: {view}, href: new URL('lenses.html#lens=' + view, location).href,
      setAttribute() {}, removeAttribute() {},
    }));
    vm.runInNewContext(script, {
      URL, URLSearchParams, location,
      addEventListener: (name, handler) => { handlers[name] = handler; },
      document: {body, querySelectorAll: () => links,
        addEventListener: (name, handler) => { handlers[name] = handler; }},
    });
    const steps = () => links.map(link => new URLSearchParams(new URL(link.href, location).hash.slice(1)).get('step'));
    assert.deepEqual(steps(), ['queue', 'queue', 'queue']);
    body.dataset.readingStep = 'batch';
    handlers['reading-context-change']();
    assert.deepEqual(steps(), ['batch', 'batch', 'batch']);
    delete body.dataset.readingStep;
    location.search = ''; location.hash = '#lens=flow';
    handlers.hashchange();
    assert.deepEqual(steps(), [null, null, null]);
  }
});

test('static guide returns to its original Rust topic or flow group after viewing source', async () => {
  const script = await read('../../ui/lenses-page.js');
  assert.equal(await read('../../dist/lenses-page.js'), script);
  for (const hash of ['#lens=rust&step=queue&topic=future', '#lens=flow&group=dispatch&step=queue', '#lens=rust&topic=future']) {
    let data;
    vm.runInNewContext(script, {
      URLSearchParams, location: {hash}, LENSES_PACK: {},
      document: {querySelector() { return {}; }}, addEventListener() {},
      ReadingLenses: {render(root, config) { data = config; }},
    });
    const source = new URL(data.sourceUrl({id: 'queue'}), 'http://localhost/');
    assert.equal(source.searchParams.get('step'), 'queue');
    const origin = new URL(source.searchParams.get('from'), source);
    assert.deepEqual(Object.fromEntries(new URLSearchParams(origin.hash.slice(1))), Object.fromEntries(new URLSearchParams(hash.slice(1))));
  }
});

test('local guide carries its selected step and original view through source and module links', async () => {
  const elements = new Map();
  const node = id => {
    if (!elements.has(id)) elements.set(id, {innerHTML: '', textContent: '', value: '', content: 'token',
      classList: {toggle() {}}, querySelectorAll: () => []});
    return elements.get(id);
  };
  const document = {querySelector: node, body: {classList: {toggle() {}, contains() { return false; }}}};
  const origin = '#lens=rust&step=queue&topic=future';
  const location = {hash: origin};
  const step = {id: 'queue', path: 'crates/rpc/src/core.rs', start: 1, end: 2, title: '要求チャネル', symbol: 'Queue::queue'};
  const index = {commit: 'abc', steps: [step], rust: [step.path], roles: {}, areas: ['rpc'],
    crates: [{id: 'crates/rpc/Cargo.toml', area: 'rpc', name: 'rpc', files: [step.path]}]};
  const fetch = async url => ({ok: true, json: async () => url.endsWith('/index') ? index : {source: 'fn queue() {\n}',
    functions: [{name: 'queue', line: 1, start: 1, end: 2, signature: 'fn queue()'}]}});
  let guide;
  const AsyncFunction = Object.getPrototypeOf(async function() {}).constructor;
  const run = new AsyncFunction('document', 'location', 'fetch', 'addEventListener', 'globalThis',
    await read('../public/app.js') + '\nreturn {render};');
  const app = await run(document, location, fetch, () => {}, {ReadingLenses: {render(root, data) { guide = data; }}});
  for (const href of [guide.sourceUrl(step), guide.structureUrl(step)]) {
    const params = new URLSearchParams(href.slice(1));
    assert.equal(params.get('step'), 'queue');
    assert.equal(params.get('from'), origin);
  }
  location.hash = guide.sourceUrl(step);
  await app.render();
  assert.match(node('#view').innerHTML, /fn queue/);
  assert.match(node('#crumb').innerHTML, /href="#lens=rust&amp;step=queue&amp;topic=future">元のガイドへ戻る/);
  const links = id => [...node(id).innerHTML.matchAll(/href="([^"]+)"/g)].map(match => match[1].replaceAll('&amp;', '&'));
  const params = href => new URLSearchParams(href.slice(1));
  const follow = async href => {
    assert.ok(href, 'the next same-file link exists');
    assert.equal(params(href).get('step'), 'queue');
    assert.equal(params(href).get('from'), origin);
    location.hash = href;
    await app.render();
  };
  await follow(links('#crumb').find(href => params(href).get('path') === step.path));
  assert.match(node('#view').innerHTML, /04 \/ FUNCTIONS/);
  await follow(links('#results').find(href => params(href).get('fn') === '1'));
  assert.match(node('#view').innerHTML, /04 \/ PROCESS/);
  const functionLinks = links('#view');
  const backToModule = functionLinks.find(href => params(href).get('path') === step.path && !params(href).has('code'));
  assert.equal(params(backToModule).get('step'), 'queue');
  assert.equal(params(backToModule).get('from'), origin);
  await follow(functionLinks.find(href => params(href).get('code') === '1'));
  assert.match(node('#view').innerHTML, /05 \/ SOURCE/);
  assert.match(node('#crumb').innerHTML, /href="#lens=rust&amp;step=queue&amp;topic=future">元のガイドへ戻る/);

  location.hash = '#path=' + encodeURIComponent(step.path);
  await app.render();
  for (const href of [...links('#view'), ...links('#results')]) {
    if (params(href).get('path') !== step.path) continue;
    assert.equal(params(href).has('step'), false, 'unrelated entry does not acquire a guide step');
    assert.equal(params(href).has('from'), false, 'unrelated entry does not acquire a guide origin');
  }
});
