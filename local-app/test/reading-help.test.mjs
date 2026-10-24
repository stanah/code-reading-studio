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
 assert.equal(Object.keys(data.contexts).length,24);
 for(const [id,c] of Object.entries(data.contexts)){
  assert.equal(createHash('sha256').update(c.source.code).digest('hex'),c.source.hash,id);
  for(const line of c.lines)assert.ok(c.source.code.split('\n')[line.line-c.source.start]?.includes(line.match),id+' L'+line.line);
  assert.equal(help.context(id,'wrong-commit'),undefined);
  assert.equal(help.forSource(c.source.path,c.source.start,data.commit),id);
 }
 assert.equal(help.forSource('unknown.rs',1,data.commit),undefined);
});

test('RPC hint explains its one question mark, and the two-error explanation is specific to queue code',()=>{
 const rpc=data.contexts['tx:rpc'],queue=data.contexts['tx:queue'];
 assert.ok(rpc.lines.some(l=>l.match==='.await?'&&l.explanation.includes('?が1個')));
 assert.ok(queue.lines.some(l=>l.match==='response_rx.await??'&&l.explanation.includes('?が2個')));
 const rpcHtml=help.render('tx:rpc',data.commit,{openCode:true});
 assert.match(rpcHtml,/data-rh-line="0"/);assert.match(rpcHtml,/data-code-line="921"/);
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
