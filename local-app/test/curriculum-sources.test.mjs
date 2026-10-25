import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile,mkdtemp,mkdir,writeFile,copyFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,dirname} from 'node:path';
import vm from 'node:vm';
import {measure,projectRoot} from '../../scripts/measure-reading.mjs';

async function snapshot(){
 const root=await mkdtemp(join(tmpdir(),'curriculum-sources-'));
 for(const file of ['reading-target.json','dist/reth-data.js','dist/atlas-data.js','dist/drill-data.js','dist/reading-help-data.js','local-app/annotations.json','local-app/startup-guide.json','ui/area-readings.json','ui/area-source-excerpts.json','ui/reading-help-content.json','ui/lesson-code-links.json','ui/journey-code-links.json','ui/file-role-code-links.json','ui/component-code-links.json','ui/operation-code-links.json']){
  await mkdir(dirname(join(root,file)),{recursive:true});await copyFile(join(projectRoot,file),join(root,file));
 }
 const ctx={window:{}};vm.runInNewContext(await readFile(join(root,'dist/reading-help-data.js'),'utf8'),ctx);
 return {root,data:ctx.window.READING_HELP_DATA};
}
const publish=(root,data)=>writeFile(join(root,'dist/reading-help-data.js'),'window.READING_HELP_DATA = '+JSON.stringify(data)+';\n');

test('a valid crate hash cannot make a continuation source belong to the wrong crate',async()=>{
 const {root,data}=await snapshot();try{
  assert.equal((await measure({root})).metrics.invalidEvidence,0);
  // This continuation is not the lesson's old representative context.
  data.sourceOwners['area:send-pool-limit']=data.sourceOwners['tx:rpc'];
  await publish(root,data);
  const result=await measure({root});
  assert.ok(result.metrics.invalidEvidence>0,'ownership must be checked for every displayed source, not only one entry per lesson');
  assert.equal(result.gates.find(g=>g.id==='FR-READ-002').status,'unmet');
 }finally{await rm(root,{recursive:true,force:true});}
});

test('a journey with matching authored metadata still fails when a required source is missing',async()=>{
 const {root,data}=await snapshot();try{
  data.journeyLinks[0].readings[0].context='area:missing-source';
  // Keep authored and generated descriptions equal so the reference check is exercised.
  await writeFile(join(root,'ui/journey-code-links.json'),JSON.stringify(data.journeyLinks));
  await publish(root,data);
  const result=await measure({root});
  assert.ok(result.metrics.invalidEvidence>0,'a matching title or description is not source evidence');
  assert.equal(result.gates.find(g=>g.id==='FR-READ-002').status,'unmet');
 }finally{await rm(root,{recursive:true,force:true});}
});

test('omitting a startup file role cannot shrink the actual merged role denominator',async()=>{
 const {root,data}=await snapshot();try{
  data.fileRoleLinks=data.fileRoleLinks.filter(row=>row.path!=='crates/engine/tree/src/chain.rs');
  await writeFile(join(root,'ui/file-role-code-links.json'),JSON.stringify(data.fileRoleLinks));
  await publish(root,data);
  const result=await measure({root});
  assert.ok(result.metrics.invalidEvidence>0,'matching authored/generated subsets must still be checked against annotations plus startup roles');
 }finally{await rm(root,{recursive:true,force:true});}
});

test('a valid source outside the canonical send path cannot replace an operation continuation',async()=>{
 const {root,data}=await snapshot();try{
  const operation=data.operationLinks.find(row=>row.id==='recover');
  operation.contexts=['area:storage'];operation.connections={};
  await writeFile(join(root,'ui/operation-code-links.json'),JSON.stringify(data.operationLinks));
  await publish(root,data);
  const result=await measure({root});
  assert.ok(result.metrics.invalidEvidence>0,'a valid unrelated source is not canonical operation evidence');
 }finally{await rm(root,{recursive:true,force:true});}
});
