import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile,mkdtemp,mkdir,writeFile,rm,copyFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import vm from 'node:vm';
import {measure,policyHash,runtimeHash,projectRoot} from '../../scripts/measure-reading.mjs';

test('[FR-COV-001] [FR-COV-002] [FR-COV-003] all files stay in the denominator and excerpts never count as full-file reviews',async()=>{
 const result=await measure();assert.equal(result.metrics.totalTracked,1872);assert.equal(result.inventory.length,1872);assert.equal(new Set(result.inventory.map(f=>f.path)).size,1872);
 assert.equal(result.metrics.totalRust,1283);assert.equal(result.metrics.anchoredRustFiles,23);assert.equal(result.metrics.fullyReviewedRustFiles,0);
 assert.ok(result.inventory.some(f=>f.kind==='rust-example'));assert.ok(result.inventory.some(f=>f.kind==='rust-test-or-bench'));
 assert.ok(result.inventory.filter(f=>f.status==='excerpt-only').every(f=>f.evidence.length));assert.equal(result.productComplete,false);
 for(const id of ['FR-COV-002','FR-COV-003','FR-EVAL-003'])assert.notEqual(result.gates.find(g=>g.id===id).status,'pass');
});

test('[FR-READ-001] [FR-READ-002] every area points to a source-backed operation and inert in-place hints',async()=>{
 const c={};c.window=c;vm.runInNewContext(await readFile(join(projectRoot,'dist/reading-help-data.js'),'utf8'),c);vm.runInNewContext(await readFile(join(projectRoot,'ui/area-reading.js'),'utf8'),c);
 const result=await measure();assert.equal(result.metrics.guidedAreas,11);assert.equal(result.metrics.invalidEvidence,0);
 const d=c.READING_HELP_DATA;for(const r of d.areaReadings){const h=c.ReadingAreas.render(r.area,d.commit);assert.match(h,/受け取るもの/);assert.match(h,/失敗・待ち/);assert.ok(h.includes('data-reading-help="'+r.context+'"'));assert.ok(d.contexts[r.context]);if(r.extraContext)assert.ok(d.contexts[r.extraContext]);}
 assert.equal(c.ReadingAreas.render('rpc','wrong-commit'),'');assert.equal(c.ReadingAreas.render('unknown',d.commit),'');
 const original=d.areaReadings[0].input;d.areaReadings[0].input='<img src=x onerror=alert(1)>';assert.doesNotMatch(c.ReadingAreas.render(d.areaReadings[0].area,d.commit),/<img/);d.areaReadings[0].input=original;
});

test('[FR-EVAL-001] [FR-EVAL-002] missing tasks, self-declared success, duplicates, and stale builds cannot satisfy evaluation',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'reading-measure-'));try{
  const policy=JSON.parse(await readFile(join(projectRoot,'docs/requirements.json'),'utf8'));
  await writeFile(join(dir,'round.json'),JSON.stringify({policyHash:policyHash(policy),buildHash:await runtimeHash()}));
  const noReports=await measure({evidenceDir:dir});assert.equal(noReports.metrics.passingPersonaTasks,0);assert.equal(noReports.taskResults.length,33);assert.equal(noReports.metrics.retentionChecksPassed,0);
  await mkdir(join(dir,'persona-a'));const task={id:'rpc',clicks:2,reachedSource:true,inPlaceHints:true,source:{path:'crates/rpc/rpc-eth-api/src/core.rs',start:920,end:924},facts:{role:'role',input:'input',output:'output',boundary:'boundary'},blockers:[],pass:true};
  await writeFile(join(dir,'persona-a/report.json'),JSON.stringify({tasks:[task],retention:{url:true,line:true,hint:true,noteDraft:null}}));
  assert.equal((await measure({evidenceDir:dir})).metrics.passingPersonaTasks,0,'self-reported facts need source adjudication');
  await writeFile(join(dir,'source-adjudication.json'),JSON.stringify([{persona:'a',task:'rpc',reviewer:'test-fixture',factsSupported:true,sourceMatchesTask:true,remainingBlockers:0}]));
  assert.equal((await measure({evidenceDir:dir})).metrics.passingPersonaTasks,1);
  task.blockers=['recovered detour recorded in the raw log'];
  await writeFile(join(dir,'persona-a/report.json'),JSON.stringify({tasks:[task]}));assert.equal((await measure({evidenceDir:dir})).metrics.passingPersonaTasks,1,'recovered observations are not remaining blockers');
  await writeFile(join(dir,'source-adjudication.json'),JSON.stringify([{persona:'a',task:'rpc',reviewer:'test-fixture',factsSupported:true,sourceMatchesTask:true,remainingBlockers:1}]));assert.equal((await measure({evidenceDir:dir})).metrics.passingPersonaTasks,0,'a remaining blocker cannot pass');
  task.status='not-measured';await writeFile(join(dir,'persona-a/report.json'),JSON.stringify({tasks:[task]}));assert.equal((await measure({evidenceDir:dir})).taskResults.find(t=>t.persona==='a'&&t.task==='rpc').status,'not-measured');delete task.status;
  await writeFile(join(dir,'source-adjudication.json'),JSON.stringify([{persona:'a',task:'rpc',reviewer:'test-fixture',factsSupported:true,sourceMatchesTask:true,remainingBlockers:0}]));
  await writeFile(join(dir,'persona-a/report.json'),JSON.stringify({tasks:[task,task]}));assert.equal((await measure({evidenceDir:dir})).metrics.passingPersonaTasks,0);
  await writeFile(join(dir,'round.json'),JSON.stringify({policyHash:policyHash(policy),buildHash:'another-build'}));await assert.rejects(measure({evidenceDir:dir}),/application build/);
 }finally{await rm(dir,{recursive:true,force:true});}
});

test('[FR-EVAL-003] AI evidence labelled as simulation is never accepted as a human study',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'reading-human-'));try{
  const policy=JSON.parse(await readFile(join(projectRoot,'docs/requirements.json'),'utf8')),buildHash=await runtimeHash();
  await writeFile(join(dir,'round.json'),JSON.stringify({policyHash:policyHash(policy),buildHash}));
  await writeFile(join(dir,'human-study.json'),JSON.stringify({kind:'ai-simulation',attestedBy:'test-fixture',commit:policy.targetCommit,policyHash:policyHash(policy),buildHash,participants:[]}));
  const result=await measure({evidenceDir:dir});assert.equal(result.metrics.humanParticipants,0);assert.equal(result.metrics.verifiedHumanTasks,0);assert.equal(result.metrics.humanStudy,'not-verified');
 }finally{await rm(dir,{recursive:true,force:true});}
});

test('[FR-READ-002] a correct hash with a different displayed excerpt cannot count as valid teaching coverage',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'reading-source-'));try{
  for(const name of ['reading-target.json','dist/reth-data.js','dist/atlas-data.js','dist/reading-help-data.js','local-app/startup-guide.json','ui/area-readings.json']){await mkdir(join(dir,name.substring(0,name.lastIndexOf('/'))||'.'),{recursive:true});await copyFile(join(projectRoot,name),join(dir,name));}
  const c={window:{}};vm.runInNewContext(await readFile(join(dir,'dist/reading-help-data.js'),'utf8'),c);c.window.READING_HELP_DATA.contexts['area:foundation'].source.code='not the pinned excerpt';
  await writeFile(join(dir,'dist/reading-help-data.js'),'window.READING_HELP_DATA = '+JSON.stringify(c.window.READING_HELP_DATA)+';');
  const result=await measure({root:dir});assert.ok(result.metrics.invalidEvidence>0);assert.equal(result.metrics.guidedAreas,10);assert.equal(result.metrics.anchoredRustFiles,22);assert.equal(result.gates.find(g=>g.id==='FR-READ-002').status,'unmet');
 }finally{await rm(dir,{recursive:true,force:true});}
});

test('[FR-EVAL-003] automated success cannot mark human comprehension verified',async()=>{
 const result=await measure();assert.equal(result.metrics.humanStudy,'not-verified');assert.equal(result.gates.find(g=>g.id==='FR-EVAL-003').status,'not-verified');assert.equal(result.productComplete,false);
});

test('[FR-EVAL-001] one successful round cannot satisfy the two-round stopping rule',async()=>{
 const base=await mkdtemp(join(tmpdir(),'reading-rounds-'));try{
  const policy=JSON.parse(await readFile(join(projectRoot,'docs/requirements.json'),'utf8'));
  const buildHash=await runtimeHash(),pHash=policyHash(policy);
  const tasks=policy.evaluation.tasks.map(t=>({id:t.id,clicks:3,reachedSource:true,inPlaceHints:true,source:{path:'crates/rpc/rpc-eth-api/src/core.rs',start:920,end:924},facts:{role:'fixture',input:'fixture',output:'fixture',boundary:'fixture'},blockers:[],pass:true}));
  for(const round of ['round-1','round-2']){
   const dir=join(base,round);await mkdir(dir);await writeFile(join(dir,'round.json'),JSON.stringify({policyHash:pHash,buildHash,...(round==='round-2'?{previousRound:'round-1'}:{})}));
   for(const persona of ['a','b','c']){await mkdir(join(dir,'persona-'+persona));await writeFile(join(dir,'persona-'+persona,'report.json'),JSON.stringify({tasks,retention:{url:true,line:true,hint:true,noteDraft:true}}));}
   await writeFile(join(dir,'source-adjudication.json'),JSON.stringify(['a','b','c'].flatMap(persona=>tasks.map(t=>({persona,task:t.id,reviewer:'test-fixture',factsSupported:true,sourceMatchesTask:true,remainingBlockers:0})))));
  }
  const one=await measure({evidenceDir:join(base,'round-1')});assert.equal(one.metrics.passingPersonaTasks,33);assert.equal(one.metrics.consecutivePassingRounds,1);assert.equal(one.gates.find(g=>g.id==='FR-EVAL-001').status,'unmet');
  const two=await measure({evidenceDir:join(base,'round-2')});assert.equal(two.metrics.consecutivePassingRounds,2);assert.equal(two.gates.find(g=>g.id==='FR-EVAL-001').status,'pass');assert.equal(two.productComplete,false);
 }finally{await rm(base,{recursive:true,force:true});}
});

test('[FR-READ-001] a cold entry waits for the shared reading UI rather than silently showing the older navigation',async()=>{
 const elements=new Map(),events=new Map();const node=id=>{if(!elements.has(id))elements.set(id,{innerHTML:'',textContent:'',content:'token',classList:{toggle(){}},querySelectorAll(){return []}});return elements.get(id)};
 const document={readyState:'interactive',querySelector:node,body:{classList:{toggle(){}}},addEventListener(name,cb){events.set(name,cb)}};
 const index={commit:'test',rust:[],crates:[],areas:['rpc'],areaDetails:[]},runtime={};
 const fetch=async()=>({ok:true,json:async()=>index});const code=await readFile(join(projectRoot,'local-app/public/app.js'),'utf8');
 const run=new (Object.getPrototypeOf(async function(){}).constructor)('document','location','fetch','addEventListener','globalThis',code);
 const ready=run(document,{hash:''},fetch,()=>{},runtime);assert.equal(node('#view').innerHTML,'');
 runtime.ReadingAreas={find:()=>({question:'Visible reading question',role:'Plain role'}),coverage:()=>''};events.get('reading-areas-ready')();await ready;
 assert.match(node('#view').innerHTML,/Visible reading question/);
});
