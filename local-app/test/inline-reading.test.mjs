import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
const read=p=>readFile(new URL(p,import.meta.url),'utf8');
const ctx={};ctx.window=ctx;
vm.runInNewContext(await read('../../dist/reading-help-data.js'),ctx);
vm.runInNewContext(await read('../../ui/reading-help.js'),ctx);
const help=ctx.ReadingHelp,data=ctx.READING_HELP_DATA;
const decode=s=>s.replace(/<[^>]*>/g,'').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&amp;/g,'&');

test('every explanation is attached to its actual source line, and the original code is preserved',()=>{
 for(const [id,c] of Object.entries(data.contexts)){
  const html=help.codeHtml(c);
  const original=[...html.matchAll(/<code>([\s\S]*?)<\/code>/g)].map(m=>decode(m[1])).join('\n');
  assert.equal(original,c.source.code,id+' source');
  for(const hint of c.lines){
   const row=html.indexOf(`data-code-line="${hint.line}"`);
   const comment=html.lastIndexOf(`data-comment-for="${hint.line}"`,row);
   assert.ok(comment>=0 && comment<row,id+' L'+hint.line+' has an adjacent supplemental comment');
   if(hint.line>c.source.start)assert.ok(comment>html.indexOf(`data-code-line="${hint.line-1}"`),id+' comment must not float away from its line');
   assert.ok(html.includes(hint.explanation.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#39;')),id+' preserves the explanation');
  }
  const rendered=help.render(id,data.commit,{openCode:true});
  assert.doesNotMatch(rendered,/class="rh-line-steps"|class="rh-line-answer"/,id+' does not repeat the comment in a separate explanation panel');
 }
});

test('supplemental comments are inert text and are distinct from upstream code',()=>{
 const html=help.codeHtml({source:{start:5,code:'fn work() {}'},lines:[{line:5,label:'説明',explanation:'<script>bad()</script> & "text"'}]});
 assert.doesNotMatch(html,/<script>/);
 assert.match(html,/補助コメント/);
 assert.match(html,/&lt;script&gt;bad\(\)&lt;\/script&gt;/);
 assert.equal((html.match(/<code>/g)||[]).length,1);
});

test('in-page implementation links are attached to reviewed call sites and preserve the source',()=>{
 for(const route of help.callRoutes){
  const from=data.contexts[route.from],to=data.contexts[route.to];
  assert.ok(from&&to,route.from+' -> '+route.to);
  assert.ok(from.source.code.split('\n')[route.line-from.source.start]?.includes(route.match),route.from+' L'+route.line);
  assert.ok(to.source.code.split('\n').some(line=>line.match(route.kind==='macro'?/\bmacro_rules!\s+([A-Za-z_][A-Za-z_0-9]*)/:/\bfn\s+([A-Za-z_][A-Za-z_0-9]*)/)?.[1]===route.targetFn),route.to+' defines '+route.targetFn);
  const declaration=to.source.start+to.source.code.split('\n').findIndex(line=>line.match(route.kind==='macro'?/\bmacro_rules!\s+([A-Za-z_][A-Za-z_0-9]*)/:/\bfn\s+([A-Za-z_][A-Za-z_0-9]*)/)?.[1]===route.targetFn);
  assert.ok(to.lines.some(hint=>hint.line===declaration),route.to+' target declaration has an adjacent contract comment');
  const lesson=data.lessonLinks.find(r=>r.readings?.some(x=>x.context===route.from)&&r.readings.some(x=>x.context===route.to));
  assert.ok(lesson,route.from+' call and implementation are on the same page');
  const html=help.render(route.from,data.commit,{lesson:lesson.lesson});
  const row=html.split(`data-code-line="${route.line}"`)[1].split('</code>')[0];
  assert.ok(row.includes(`data-reading-jump="${route.to}"`),route.from+' links the actual call line');
  const original=[...html.matchAll(/<code>([\s\S]*?)<\/code>/g)].map(m=>decode(m[1])).join('\n');
  assert.equal(original,from.source.code,route.from+' original text with links');
 }
});

// A narrow page can follow an already-reviewed implementation without changing pages.
test('reviewed call targets stay available on narrow operations and standalone excerpts',()=>{
 const html=help.render('tx:recover',data.commit,{operation:'recover'});
 assert.match(html,/data-reading-jump="tx:submit"/);
 const standalone=help.render('startup:network',data.commit);
 assert.match(standalone,/data-reading-jump="area:network-budget"/);
 assert.match(standalone,/マクロ定義を読む/);
});
