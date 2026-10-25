import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
const read=p=>readFile(new URL(p,import.meta.url),'utf8');
const annotations=JSON.parse(await read('../annotations.json'));
const startup=JSON.parse(await read('../startup-guide.json'));
const ctx={URLSearchParams};ctx.window=ctx;
vm.runInNewContext(await read('../../dist/reading-help-data.js'),ctx);
vm.runInNewContext(await read('../../ui/reading-help.js'),ctx);
const data=ctx.READING_HELP_DATA,help=ctx.ReadingHelp;
const stages=html=>[...html.matchAll(/data-reading-stage="([^"]+)"/g)].map(m=>m[1]);

test('the explanation inventory includes every role actually merged into the application index',async()=>{
 const roles={...annotations.roles,...startup.roles};
 const declared=new Set((data.fileRoleLinks||[]).map(r=>r.path));
 assert.deepEqual([...declared].sort(),Object.keys(roles).sort(),'startup roles must not disappear behind the transaction-only role list');
 const audit=JSON.parse(await read('../../docs/global-reading-audit.json'));
 for(const path of Object.keys(roles))assert.ok(audit.criteria.unitIds.includes('file-role:'+path),'unobserved authored role: '+path);
 for(const path of Object.keys(roles)){
  const html=help.fileRoleBridge(path,true),ids=stages(html);
  assert.ok(ids.length,path+' has same-page evidence');
  assert.equal(new Set(ids).size,ids.length,path+' repeats source contexts');
  for(const id of ids)assert.ok(data.contexts[id]&&data.sourceOwners[id],path+' source and owner: '+id);
 }
});

test('all six operations share their canonical source readings, with both request and reply evidence',()=>{
 const required={rpc:['tx:rpc','tx:recover','tx:recovery-hook'],recover:['tx:recover','tx:recovery-hook'],submit:['tx:submit','tx:queue','area:send-receive','tx:batch'],queue:['tx:queue','area:send-receive','tx:batch'],batch:['area:send-receive','tx:batch','tx:pool','area:send-validation-worker','area:send-stateless','area:send-stateful','area:send-pool-limit','area:send-pool-add'],pool:['tx:pool','area:send-validation-worker','area:send-stateless','area:send-stateful','area:send-nonce','area:pool-balance','area:send-pool-limit','area:send-pool-add']};
 for(const [id,expected] of Object.entries(required)){
  const html=help.operationBridge(id,true),ids=stages(html);
  for(const source of expected)assert.ok(ids.includes(source),id+' omits required behavior evidence: '+source);
  assert.equal(new Set(ids).size,ids.length,id+' repeats original contexts');
  const path=data.contexts['tx:'+id].source.path,roleIds=stages(help.fileRoleBridge(path,false));
  for(const source of ids)assert.ok(roleIds.includes(source),'static selected function '+id+' cannot refer to a file-role source list that omits '+source);
  for(const source of ids){
   const rendered=help.render(source,data.commit,{operation:id});
   for(const jump of rendered.matchAll(/data-reading-jump="([^"]+)"/g))assert.ok(ids.includes(jump[1]),id+' implementation jump has no target on this page');
  }
 }
});

test('all authored RPC component boundaries have a source path on their detail page',()=>{
 const ids=['interface','helpers','implementation','integration'];
 assert.deepEqual(Array.from(data.componentLinks||[]).filter(r=>r.area==='rpc').map(r=>r.component).sort(),ids.sort());
 for(const id of ids){const rendered=stages(help.componentBridge('rpc',id,false));assert.ok(rendered.length,'RPC component evidence: '+id);assert.equal(new Set(rendered).size,rendered.length,'RPC component source is not duplicated: '+id);}
});


test('shared reading paths cannot attach pinned Reth explanations to a different repository commit',()=>{
 assert.equal(help.fileRoleBridge(Object.keys(annotations.roles)[0],true,'another-commit'),'');
 assert.equal(help.operationBridge('pool',true,undefined,'another-commit'),'');
 assert.equal(help.journeyBridge('block',true,'another-commit'),'');
 assert.equal(help.componentBridge('rpc','interface',false,'another-commit'),'');
});

function checkSharedClaimSources(){
 const requireSources=(actual,required,label)=>{
  const available=new Set(actual);
  for(const context of required)assert.ok(available.has(context),label+' omits the same-page proof for '+context);
 };
 const boot=stages(help.lessonBridge('startup',true));
 for(const id of ['entry','dispatch','supervisor','database','context','components','services','orchestrator','network']){
  requireSources(boot,startup.readingScopes.steps[id].map(r=>r.context),'startup lesson / '+id);
 }
 const reth=stages(help.lessonBridge('reth',true));
 requireSources(reth,help.operationReadings('pool').map(r=>r.context),'Reth validation responsibility');
 requireSources(reth,['startup:components','area:startup-node-components','area:startup-component-choice','area:startup-network-builder','area:startup-network-start','area:startup-payload-spawn','area:startup-tree-spawn'],'Reth concrete components and task startup');
 requireSources(reth,['area:journey-block-executor','area:journey-block-execute','area:journey-block-postcheck','area:journey-block-postconditions','area:journey-block-save-worker','area:journey-block-save-write'],'Reth execution, state validation and commit');
 requireSources(stages(help.areaBridge('engine','main',true)),['area:startup-tree-spawn','startup:tree','area:startup-tree-pressure','area:startup-tree-wait'],'Engine area / same thread and waiting claims as startup guide');
 requireSources(stages(help.areaBridge('rpc','followup',true)),help.operationReadings('recover').map(r=>r.context),'RPC followup / same recovery claim as send');
}

test('a source correction reaches every teaching view that makes the same startup, validation or recovery claim',()=>{
 checkSharedClaimSources();
});

test('a learner route cannot stay at the old narrow excerpt while its detailed guide is corrected',()=>{
 const lesson=data.lessonLinks.find(r=>r.lesson==='startup'),original=lesson.readings;
 try{
  lesson.readings=original.filter(r=>r.context!=='area:startup-cli-entry');
  assert.throws(checkSharedClaimSources,/startup lesson.*startup-cli-entry/);
 }finally{lesson.readings=original;}
});
