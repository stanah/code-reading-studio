import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const read=p=>readFile(new URL(p,import.meta.url),'utf8');
const ctx={};ctx.window=ctx;let preferences={chain:'new',code:'first'};ctx.LearningStudio={preferences:()=>preferences};
vm.runInNewContext(await read('../public/reading-help-data.js'),ctx);vm.runInNewContext(await read('../../ui/reading-help.js'),ctx);
const help=ctx.ReadingHelp,data=ctx.READING_HELP_DATA;

test('every authored line hint is tied to the pinned excerpt, exact line and source hash',()=>{
 assert.ok(Object.keys(data.contexts).length>=36);
 for(const [id,c] of Object.entries(data.contexts)){
  assert.equal(createHash('sha256').update(c.source.code).digest('hex'),c.source.hash,id);
  for(const line of c.lines)assert.ok(c.source.code.split('\n')[line.line-c.source.start]?.includes(line.match),id+' L'+line.line);
  assert.equal(help.context(id,'wrong-commit'),undefined);
  const resolved=data.contexts[help.forSource(c.source.path,c.source.start,data.commit)];
  assert.equal(resolved.source.path,c.source.path);assert.ok(resolved.source.start<=c.source.start&&resolved.source.end>=c.source.start);assert.ok(resolved.source.end-resolved.source.start<=c.source.end-c.source.start);
 }
 assert.equal(help.forSource('unknown.rs',1,data.commit),undefined);
});

test('RPC hint explains its one question mark, and the two-error explanation is specific to queue code',()=>{
 const rpc=data.contexts['tx:rpc'],queue=data.contexts['tx:queue'];
 assert.ok(rpc.lines.some(l=>l.match==='.await?'&&l.explanation.includes('?が1個')));
 assert.ok(queue.lines.some(l=>l.match==='response_rx.await??'&&l.explanation.includes('?が2個')));
 const rpcHtml=help.render('tx:rpc',data.commit,{openCode:true});
 assert.match(rpcHtml,/data-comment-for="921"/);assert.match(rpcHtml,/data-code-line="921"/);
 assert.doesNotMatch(rpcHtml,/response_rx|TypeScript/);
 assert.match(rpcHtml,/data-rh-term="await"/);
});

test('word hints do not label comments, string contents or tracing ?field as error propagation',()=>{
 const html=help.codeHtml(data.contexts['tx:rpc']);
 const trace=html.split('data-code-line="922"')[1].split('data-code-line="923"')[0];
 assert.doesNotMatch(trace,/data-rh-term="question"/);assert.match(trace,/data-rh-term="logging"/);
 assert.match(html,/data-code-line="923"/);assert.match(html,/data-rh-term="question"/);
 const escaped=help.codeHtml({source:{start:1,code:'// fn ? Ok\n"<script>fn</script>"\nfn test() { work().await?; }'}});
 assert.doesNotMatch(escaped,/<script>/);assert.match(escaped,/&lt;script&gt;/);
 assert.equal((escaped.match(/data-rh-term="function"/g)||[]).length,1);
});

test('source remains the same while assistance defaults can be varied independently',()=>{
 preferences={chain:'known',code:'first'};const beginner=help.render('tx:rpc',data.commit,{openCode:true});
 preferences={chain:'known',code:'rust'};const expert=help.render('tx:rpc',data.commit,{openCode:true});
 assert.match(beginner,/data-rh-basics checked/);assert.match(expert,/class="rh-basics" hidden/);
 assert.equal(beginner.match(/<pre[\s\S]*?<\/pre>/)[0],expert.match(/<pre[\s\S]*?<\/pre>/)[0]);
 assert.equal(help.render('tx:rpc','another-commit'),'');
});

test('shared hint assets are identical in local and static versions',async()=>{
 assert.equal(await read('../public/reading-help.js'),await read('../../ui/reading-help.js'));
 for(const asset of ['reading-help.js','reading-help-data.js'])assert.equal(await read('../public/'+asset),await read('../../dist/'+asset));
});

test('the backfill Option question mark is explained as absence, not an error',()=>{
 const c=data.contexts['startup:backfill'];assert.match(c.source.code,/-> Option<BackfillEvent>/);
 const line=help.codeHtml(c).split('data-code-line="143"')[1].split('data-code-line="144"')[0];
 assert.match(line,/data-rh-term="option-question"/);assert.doesNotMatch(line,/data-rh-term="question"/);
 assert.match(data.terms['option-question'].meaning,/None/);
});

test('[FR-READ-002] the for in a Future implementation is not described as an iteration',()=>{
 const network=help.codeHtml(data.contexts['startup:network']).split('data-code-line="1135"')[0];
 assert.match(network,/data-rh-term="for-implementation"/);assert.doesNotMatch(network,/data-rh-term="for-loop"/);
 assert.match(help.codeHtml(data.contexts['area:execution']),/data-rh-term="for-loop"/);
 assert.match(help.codeHtml({source:{start:1,code:'impl Future for OtherType {}'}}),/data-rh-term="for-context"/);
 assert.doesNotMatch(help.codeHtml({source:{start:1,code:'impl Future for OtherType {}'}}),/data-rh-term="for-loop"/);
});

test('[FR-READ-002] every reading in each lesson links its pinned code, owner and originating lesson',()=>{
 ctx.URLSearchParams=URLSearchParams;
 assert.equal(data.lessonLinks.length,7);
 for(const r of data.lessonLinks){
  const readings=r.readings?.length?r.readings:[{context:r.context}],html=help.lessonBridge(r.lesson,true);
  const sections=[...html.matchAll(/<section class="learn-reading-stage"[^>]*data-reading-stage="([^"]+)"[^>]*>([\s\S]*?)<\/section>/g)];
  assert.equal(sections.length,readings.length,r.lesson);
  for(const [i,[,id,section]] of sections.entries()){
   assert.equal(id,readings[i].context);
   const c=data.contexts[id],owner=data.sourceOwners?.[id]||r;
   const links=[...section.matchAll(/href="([^"]+)"/g)].map(m=>m[1].replaceAll('&amp;','&'));
   assert.equal(links.length,2);const source=new URL(links[0],'http://localhost'),crate=new URL(links[1],'http://localhost'),s=new URLSearchParams(source.hash.slice(1)),p=new URLSearchParams(crate.hash.slice(1));
   assert.equal(source.pathname,'/reader');assert.equal(s.get('path'),c.source.path);assert.equal(Number(s.get('start')),c.source.start);assert.equal(Number(s.get('end')),c.source.end);assert.equal(s.get('lesson'),r.lesson);
   assert.equal(p.get('crate'),owner.crate.id);assert.equal(p.get('lesson'),r.lesson);assert.ok(c.source.path.startsWith(owner.crate.id.replace('Cargo.toml','')));
   assert.ok(section.includes('data-reading-help="'+id+'"'));
  }
  assert.match(html,/<details class="learn-core-code" open>/);assert.ok(html.includes(r.scope));
  const stat=help.lessonBridge(r.lesson,false);assert.equal((stat.match(/target="_blank"/g)||[]).length,2*readings.length);
 }
 assert.equal(help.lessonBridge('missing',true),'');
});

test('major paths retain every original and divide coherent reading flows without hiding required implementations',()=>{
 for(const id of ['reth','startup','send','reading']){
  const r=data.lessonLinks.find(x=>x.lesson===id),html=help.lessonBridge(id,true);
  assert.ok(r.phases.length>=3&&r.phases.length<=5,id);
  assert.equal((html.match(/data-reading-phase=/g)||[]).length,r.phases.length,id+' flow choices');
  assert.equal((html.match(/data-reading-stage=/g)||[]).length,r.readings.length,id+' preserves all sources');
  assert.deepEqual(Array.from(r.phases.flatMap(p=>p.contexts)),Array.from(r.readings.map(x=>x.context)),id+' no missing/duplicated phase stage');
  const first=r.phases[0];
  for(const item of r.readings){
   const stage=html.split(`data-reading-stage="${item.context}"`)[1].split('</section>')[0];
   const shouldOpen=first.essentialContexts.includes(item.context);
   assert.equal(stage.includes('data-help-open="true"'),shouldOpen,id+' initial preview '+item.context);
  }
  assert.match(html,/処理を選ぶとそのコードへ移動します/);
  assert.match(html,/もう一度表示/);
 }
});

test('registry preview and standalone contexts use the same pinned code and ownership',()=>{
 const r=data.lessonLinks.find(x=>x.lesson==='send');
 const html=help.routeBridge({...r,id:'lesson:send',key:'send'},true);
 assert.ok(html.includes('data-reading-stage="area:send-stateful"'));
 const standalone=help.contextBridge('startup:network',true);
 assert.ok(standalone.includes('data-reading-stage="startup:network"'));
 assert.ok(standalone.includes('data-reading-stage="area:network-budget"'));
 assert.equal(help.contextBridge('unknown',true),'');
});

test('macro optional repetition never uses the Result error propagation explanation',()=>{
 const c=data.contexts['area:network-budget'],html=help.codeHtml(c);
 for(const number of [41,55]){
  const row=html.split(`data-code-line="${number}"`)[1].split('</code>')[0];
  assert.match(row,/data-rh-term="macro-optional"/);
  assert.doesNotMatch(row,/data-rh-term="question"/);
 }
 const rendered=help.render('area:network-budget',data.commit);
 assert.doesNotMatch(rendered,/data-rh-term="question"/);
 assert.match(data.terms['macro-optional'].meaning,/0回または1回/);
});
