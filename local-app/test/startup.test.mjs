import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {mount, noteUrl, renderConnections, renderLoops, renderOverview, renderSidebar, renderStage, renderStep, resolveView, sourceUrl, startupUrl} from '../public/startup.js';

const guide = JSON.parse(await readFile(new URL('../startup-guide.json', import.meta.url), 'utf8'));

test('startup overview leads through stage and explanation before opening code', () => {
  const overview = renderOverview(guide);
  assert.doesNotMatch(overview, /href="\/files\?/);
  for (const stage of guide.stages) {
    assert.ok(overview.includes(startupUrl({stage:stage.id})));
    const stageView = resolveView(guide, new URL(startupUrl({stage:stage.id}), 'http://localhost').search);
    assert.equal(stageView.kind, 'stage');
    const stageHtml = renderStage(guide, stageView.stage);
    for (const id of stage.steps) {
      assert.ok(stageHtml.includes(startupUrl({step:id})));
      const view = resolveView(guide, new URL(startupUrl({step:id}), 'http://localhost').search);
      assert.equal(view.kind, 'step');
      assert.equal(view.stage.id, stage.id);
      const html = renderStep(guide, view);
      assert.match(html, /入力 \/ 受け取るもの/);
      assert.match(html, /出力 \/ 次へ渡すもの/);
      assert.match(html, /<details class="startup-details"><summary>Rustの補足/);
      assert.match(html, /<details><summary>答えを確認する/);
      const source = new URL(sourceUrl(view.step.source), 'http://localhost');
      assert.equal(source.pathname, '/files');
      assert.equal(source.searchParams.get('path'), view.step.source.path);
      assert.equal(source.searchParams.get('line'), String(view.step.source.start));
      assert.equal(source.searchParams.get('end'), String(view.step.source.end));
      const note = new URL(noteUrl(view.step), 'http://localhost');
      assert.equal(new URLSearchParams(note.hash.slice(1)).get('code'), '1');
    }
  }
});

test('source-to-guide return selects the correct range within a shared file and identifies nearest matches', () => {
  for (const step of guide.steps) {
    const view = resolveView(guide, new URLSearchParams({path:step.source.path, line:step.source.start}).toString());
    assert.equal(view.step.id, step.id);
    assert.equal(view.origin.exact, true);
  }
  assert.equal(resolveView(guide, '?path=crates%2Fnode%2Fbuilder%2Fsrc%2Flaunch%2Fengine.rs&line=150').step.id, 'services');
  assert.equal(resolveView(guide, '?path=crates%2Fnode%2Fbuilder%2Fsrc%2Flaunch%2Fengine.rs&line=350').step.id, 'orchestrator');
  const near = resolveView(guide, '?path=bin%2Freth%2Fsrc%2Fmain.rs&line=1');
  assert.equal(near.step.id, 'entry');
  assert.equal(near.origin.exact, false);
  assert.match(renderStep(guide, near), /最も近い読みどころ/);
  assert.equal(resolveView(guide, '?path=Cargo.toml').kind, 'overview');
  assert.equal(resolveView(guide, '?step=unknown').kind, 'missing');
  assert.equal(resolveView(guide, '?stage=unknown').kind, 'missing');
});

test('call, task start, channel and exit wait are distinguished from the reading order', () => {
  for (const [stepId, label] of [['entry','呼び出し'], ['components','タスク起動'], ['orchestrator','チャネル'], ['supervisor','終了待機']]) {
    const step = guide.steps.find(item => item.id === stepId);
    assert.ok(renderConnections(guide, step).includes(label));
  }
  const loops = renderLoops(guide);
  assert.match(loops, /待機と反復処理の分担/);
  assert.match(loops, /必要なときだけ走る同期処理/);
  assert.match(loops, /CLIの終了監視/);
  assert.match(loops, /排他的な同期モード/);
});

test('guide text, paths, connection labels and identifiers remain inert HTML', () => {
  const dirty = structuredClone(guide), attack = '"><script>alert(1)</script>';
  dirty.title = attack;
  dirty.stages[0].title = attack;
  dirty.steps[0].title = attack;
  dirty.steps[0].summary = attack;
  dirty.steps[0].rust.term = attack;
  dirty.steps[0].check.answer = attack;
  dirty.steps[0].source.path = 'docs/' + attack + '.rs';
  dirty.edges[0].label = attack;
  const view = resolveView(dirty, '?step=entry');
  for (const html of [renderOverview(dirty), renderStage(dirty, dirty.stages[0]), renderStep(dirty, view), renderSidebar(dirty, view)]) {
    assert.doesNotMatch(html, /<script>/);
    assert.match(html, /&lt;script&gt;/);
  }
  const encoded = new URL(sourceUrl(dirty.steps[0].source), 'http://localhost');
  assert.equal(encoded.pathname, '/files');
  assert.equal(encoded.searchParams.get('path'), dirty.steps[0].source.path);
});

test('browser navigation and popstate render the selected overview, stage or step without losing URL state', async () => {
  const nodes = new Map(), handlers = {}, requests = [], stack = [];
  const node = id => {
    if (!nodes.has(id)) nodes.set(id, {innerHTML:'', textContent:'', content:'test-token', classList:{add() {}}});
    return nodes.get(id);
  };
  const document = {querySelector:node, body:{dataset:{}}, title:'',
    addEventListener(name, handler) { handlers[name] = handler; }, dispatchEvent() {}};
  const location = new URL('http://localhost/startup');
  const updateUrl = href => { location.href = new URL(href, location).href; };
  await mount({document, location,
    fetch:async (url, options) => { requests.push({url, options}); return {ok:true, json:async () => guide}; },
    history:{pushState(state, title, href) { stack.push(location.href); updateUrl(href); }},
    addEventListener(name, handler) { handlers[name] = handler; }, scrollTo() {}, Event:class {}});
  assert.equal(requests.length, 1);
  assert.equal(requests[0].options.headers['X-Studio-Token'], 'test-token');
  assert.match(node('#startup-content').innerHTML, /startup-overview-flow/);
  const follow = href => {
    let prevented = false;
    handlers.click({button:0, target:{closest:() => ({href:new URL(href, location).href, hasAttribute:() => false})},
      preventDefault() { prevented = true; }});
    return prevented;
  };
  assert.equal(follow('/startup?stage=prepare'), true);
  assert.equal(location.search, '?stage=prepare');
  assert.match(node('#startup-content').innerHTML, /startup-step-cards/);
  assert.equal(follow('/startup?step=context'), true);
  assert.equal(document.body.dataset.startupStep, 'context');
  assert.match(node('#startup-content').innerHTML, /入力 \/ 受け取るもの/);
  updateUrl(stack.pop()); handlers.popstate();
  assert.equal(location.search, '?stage=prepare');
  assert.match(node('#startup-content').innerHTML, /startup-step-cards/);
  updateUrl(stack.pop()); handlers.popstate();
  assert.equal(location.search, '');
  assert.match(node('#startup-content').innerHTML, /startup-overview-flow/);
  assert.equal(follow('/files?path=Cargo.toml'), false, 'source navigation is a normal page navigation');
  assert.equal(requests.length, 1, 'guide navigation reuses the same commit-pinned data');
});


test('shared runtime source references open ancestor loops and return without rebuilding source or selection', async () => {
  const nodes = new Map(), handlers = {};
  const node = id => {
    if (!nodes.has(id)) nodes.set(id, {innerHTML:'', textContent:'', content:'test-token', classList:{add() {}}});
    return nodes.get(id);
  };
  const ownerLoop={tagName:'DETAILS',open:false,parentElement:null};
  const source={open:false,selectedLine:476,commentsEnabled:false};
  const returnButton={hidden:true,dataset:{startupBack:''}};
  let focused='',scrolled='';
  const owner={parentElement:ownerLoop,scrollIntoView(){scrolled='owner';},querySelector(selector){return selector==='.rh-source'?source:selector==='[data-startup-back]'?returnButton:selector==='.rh-source > summary'?{focus(){focused='source';}}:null;}};
  const originLoop={tagName:'DETAILS',open:false,parentElement:null};
  const origin={parentElement:originLoop,scrollIntoView(){scrolled='origin';},querySelector(){return {focus(){focused='origin';}};}};
  const document={querySelector:node,getElementById(id){return {owner,origin}[id];},body:{dataset:{}},addEventListener(name,handler){handlers[name]=handler;},dispatchEvent(){}};
  const location=new URL('http://localhost/startup?stage=run');
  await mount({document,location,fetch:async()=>({ok:true,json:async()=>guide}),history:{pushState(){throw Error('reference must not change URL');}},addEventListener(){},scrollTo(){},Event:class{}});
  const previousHtml=node('#startup-content').innerHTML;
  handlers.click({target:{closest(selector){return selector==='[data-startup-read]'?{dataset:{startupRead:'owner',startupRefOrigin:'origin'}}:null;}}});
  assert.equal(ownerLoop.open,true);assert.equal(source.open,true);assert.equal(scrolled,'owner');assert.equal(focused,'source');
  assert.equal(returnButton.hidden,false);assert.equal(returnButton.dataset.startupBack,'origin');
  handlers.click({target:{closest(selector){return selector==='[data-startup-back]'?returnButton:null;}}});
  assert.equal(originLoop.open,true);assert.equal(scrolled,'origin');assert.equal(focused,'origin');
  assert.equal(source.selectedLine,476);assert.equal(source.commentsEnabled,false);assert.equal(node('#startup-content').innerHTML,previousHtml);
  assert.equal(location.href,'http://localhost/startup?stage=run');
});
