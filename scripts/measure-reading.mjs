import {readFile,writeFile,mkdir,readdir} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import vm from 'node:vm';
import {indexRepository,git,digest} from '../local-app/core.mjs';

export const projectRoot=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const hash=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const json=async file=>JSON.parse(await readFile(file,'utf8'));
async function optional(file,fallback){try{return await json(file)}catch(e){if(e.code==='ENOENT')return fallback;throw e}}
export function policyHash(policy){return hash({...policy,acceptance_criteria:policy.acceptance_criteria.map(({tests,status,...criterion})=>criterion)});}
export async function runtimeHash(root=projectRoot){
 const files=[];for(const folder of ['dist','local-app/public'])for(const name of (await readdir(resolve(root,folder))).sort())if(/\.(js|html|css)$/.test(name)&&name!=='reading-coverage-data.js')files.push([folder+'/'+name,digest(await readFile(resolve(root,folder,name),'utf8'))]);
 for(const name of ['local-app/core.mjs','local-app/server.mjs','local-app/annotations.json','local-app/startup-guide.json','reading-target.json'])files.push([name,digest(await readFile(resolve(root,name),'utf8'))]);
 return hash(files);
}
export async function measure({root=projectRoot,evidenceDir,depth=0}={}){
 const target=await json(resolve(root,'reading-target.json')),policy=await json(resolve(projectRoot,'docs/requirements.json'));
 if(policy.evaluation.personas.join(',')!=='a,b,c'||policy.scope.areas.length!==11||policy.evaluation.tasks.length!==11||new Set(policy.evaluation.tasks.map(t=>t.id)).size!==11||!policy.scope.areas.every(id=>policy.evaluation.tasks.some(t=>t.id===id)))throw Error('Evaluation denominator changed');
 if(policy.targetCommit!==target.commit)throw Error('Acceptance target changed');
 const index=await indexRepository(resolve(projectRoot,'targets/reth'),target.commit),context={window:{}};
 for(const name of ['reth-data','atlas-data','reading-help-data'])vm.runInNewContext(await readFile(resolve(root,'dist',name+'.js'),'utf8'),context);
 const {RETH_PACK:pack,RETH_ATLAS:atlas,READING_HELP_DATA:help}=context.window;
 const startup=await json(resolve(root,'local-app/startup-guide.json'));
 for(const data of [pack,atlas,help,startup])if(data.commit!==target.commit)throw Error('Data uses another commit');
 const authoredAreas=await optional(resolve(root,'ui/area-readings.json'),[]),fullReviews=await optional(resolve(root,'ui/full-file-reviews.json'),[]);
 const areaByPath=new Map(atlas.files.map(f=>[f.path,f.area])),ranges=new Map(),sourceCache=new Map(),verifiedAnchors=new WeakSet(),validHints=new Map();let invalidEvidence=0;
 const source=async path=>{if(!sourceCache.has(path))sourceCache.set(path,(await git(index.repo,'show',target.commit+':'+path)).split('\n'));return sourceCache.get(path)};
 const anchors=[...pack.steps,...pack.details,...startup.steps.map(x=>x.source),...startup.loops.map(x=>x.source),...Object.values(help.contexts).map(x=>x.source)];
 for(const a of anchors){
  if(!index.paths.includes(a.path)){invalidEvidence++;continue;}
  const lines=await source(a.path),code=lines.slice(a.start-1,a.end).join('\n');
  if(!Number.isInteger(a.start)||!Number.isInteger(a.end)||a.start<1||a.end>lines.length||a.end<a.start||digest(code)!==(a.hash||a.contentHash)||(a.code!==undefined&&a.code!==code)){invalidEvidence++;continue;}verifiedAnchors.add(a);
  if(!ranges.has(a.path))ranges.set(a.path,new Map());ranges.get(a.path).set(a.start+':'+a.end,{start:a.start,end:a.end});
 }
 for(const [id,c] of Object.entries(help.contexts)){
  let valid=verifiedAnchors.has(c.source);
  for(const line of c.lines)if(!Number.isInteger(line.line)||line.line<c.source.start||line.line>c.source.end||!c.source.code.split('\n')[line.line-c.source.start]?.includes(line.match)){invalidEvidence++;valid=false;}
  for(const term of c.terms)if(!help.terms[term]){invalidEvidence++;valid=false;}
  for(const [line,tokens] of Object.entries(c.tokenHints||{}))for(const [token,term] of Object.entries(tokens))if(!c.source.code.split('\n')[Number(line)-c.source.start]?.includes(token)||!help.terms[term]){invalidEvidence++;valid=false;}
  validHints.set(id,valid);
 }
 const reviewed=new Set();
 for(const review of fullReviews){
  if(!areaByPath.has(review.path)||review.commit!==target.commit||!review.reviewer||review.scope!=='whole-file'||review.allItemsChecked!==true||!review.operations?.length||!review.branches?.length||review.sourceHash!==digest((await source(review.path)).join('\n'))){invalidEvidence++;continue;}
  reviewed.add(review.path);
 }
 const inventory=index.entries.map(entry=>{
  const rust=entry.path.endsWith('.rs'),area=areaByPath.get(entry.path)||null;
  if(rust&&!area)invalidEvidence++;
  const kind=rust?(/(^|\/)(tests?|test_utils|test-utils|benches)(\/|\.rs$)/.test(entry.path)?'rust-test-or-bench':entry.path.startsWith('examples/')?'rust-example':'rust-source'):entry.path.endsWith('Cargo.toml')?'cargo-manifest':/\.(md|mdx|rst|txt)$/.test(entry.path)?'documentation':'other-tracked-file';
  return {path:entry.path,blob:entry.oid,bytes:entry.size,kind,area,classification:'path-based',learningScope:rust?'rust':'supporting-file',evidence:[...(ranges.get(entry.path)?.values()||[])],status:reviewed.has(entry.path)?'whole-file-reviewed':ranges.has(entry.path)?'excerpt-only':'unexplained'};
 });
 const guidedAreas=[];
 if(JSON.stringify(authoredAreas)!==JSON.stringify(help.areaReadings||[]))invalidEvidence++;
 for(const area of atlas.areas){
  const reading=authoredAreas.find(r=>r.area===area.id),c=reading&&help.contexts[reading.context];
  if(c&&validHints.get(reading.context)&&(!reading.extraContext||validHints.get(reading.extraContext))&&areaByPath.get(c.source.path)===area.id&&['question','role','input','output','boundary'].every(k=>typeof reading[k]==='string'&&reading[k].trim())&&c.lines.length&&c.terms.length)guidedAreas.push(area.id);
 }
 const evalReports=[];let evidenceBuild=null,adjudications=[];
 if(evidenceDir){
  evidenceBuild=await optional(resolve(evidenceDir,'round.json'),null);
  if(!evidenceBuild||evidenceBuild.policyHash!==policyHash(policy))throw Error('Evaluation uses different acceptance criteria');
  if(evidenceBuild.buildHash!==await runtimeHash(root))throw Error('Evaluation does not match the application build');
  adjudications=await optional(resolve(evidenceDir,'source-adjudication.json'),[]);
  for(const persona of policy.evaluation.personas){const report=await optional(resolve(evidenceDir,'persona-'+persona,'report.json'),null);if(report)evalReports.push({persona,report});}
 }
 let passingTasks=0,retentionPassed=0;const taskResults=[];
 for(const persona of policy.evaluation.personas){
  const report=evalReports.find(r=>r.persona===persona)?.report;
  for(const task of policy.evaluation.tasks){
   const records=(report?.tasks||[]).filter(t=>t.id===task.id),r=records[0];
   const notMeasured=!r||r.status==='not-measured';
   const complete=!notMeasured&&records.length===1&&r.reachedSource===true&&r.inPlaceHints===true&&Number.isInteger(r.clicks)&&r.clicks>0&&r.clicks<=policy.evaluation.maxClicks&&policy.evaluation.requiredFacts.every(k=>typeof r.facts?.[k]==='string'&&r.facts[k].trim())&&r.pass===true&&Array.isArray(r.blockers);
   let sourceValid=false;if(r?.source?.path&&index.paths.includes(r.source.path)){const lines=await source(r.source.path);sourceValid=Number.isInteger(r.source.start)&&r.source.start>0&&Number.isInteger(r.source.end)&&r.source.end>=r.source.start&&r.source.end<=lines.length;}
   const grades=adjudications.filter(g=>g.persona===persona&&g.task===task.id);const grade=grades[0];
   const passed=!!(complete&&sourceValid&&grades.length===1&&grade.reviewer&&grade.factsSupported===true&&grade.sourceMatchesTask===true&&grade.remainingBlockers===0);if(passed)passingTasks++;
   taskResults.push({persona,task:task.id,status:notMeasured?'not-measured':!grade?'not-reviewed':passed?'pass':'fail',clicks:r?.clicks??null,sourceReviewed:!!grade?.reviewer,remainingBlockers:grade?.remainingBlockers??null});
  }
  if(['url','line','hint','noteDraft'].every(k=>(report?.retention?.[k]===true||report?.retention?.[k]?.retained===true)))retentionPassed++;
 }
 let verifiedHumanTasks=0,humanParticipants=0,humanVerified=false;
 if(evidenceDir){
  const study=await optional(resolve(evidenceDir,'human-study.json'),null);
  if(study?.kind==='human-observation'&&study.attestedBy&&study.commit===target.commit&&study.policyHash===policyHash(policy)&&study.buildHash===await runtimeHash(root)){
   const identities=new Set();let valid=true;
   for(const persona of policy.evaluation.personas){
    const participants=(study.participants||[]).filter(p=>p.persona===persona&&p.kind==='human'&&p.pseudonym&&p.observedBy);
    if(participants.length!==1||identities.has(participants[0]?.pseudonym)){valid=false;continue;}
    const participant=participants[0];identities.add(participant.pseudonym);humanParticipants++;
    for(const task of policy.evaluation.tasks){const rows=(participant.tasks||[]).filter(r=>r.id===task.id),r=rows[0];
     let anchored=false;if(r?.source&&index.paths.includes(r.source.path)){const lines=await source(r.source.path);anchored=Number.isInteger(r.source.start)&&Number.isInteger(r.source.end)&&r.source.start>0&&r.source.end>=r.source.start&&r.source.end<=lines.length;}
     if(rows.length===1&&anchored&&r.helpClosed===true&&r.criticalMisconceptions===0&&policy.evaluation.requiredFacts.every(k=>r.rubric?.[k]===1&&typeof r.answers?.[k]==='string'&&r.answers[k].trim())&&r.sourceSupported===true)verifiedHumanTasks++;
    }
   }
   humanVerified=valid&&verifiedHumanTasks===policy.evaluation.personas.length*policy.evaluation.tasks.length;
  }
 }
 const rustRows=inventory.filter(f=>f.learningScope==='rust');
 const metrics={inventoryAccounted:inventory.filter(r=>r.blob&&r.kind&&r.status&&(r.learningScope!=='rust'||r.area)).length,totalTracked:index.entries.length,totalRust:rustRows.length,anchoredRustFiles:rustRows.filter(r=>r.evidence.length).length,fullyReviewedRustFiles:reviewed.size,guidedAreas:guidedAreas.length,totalAreas:atlas.areas.length,invalidEvidence,passingPersonaTasks:passingTasks,totalPersonaTasks:policy.evaluation.tasks.length*policy.evaluation.personas.length,retentionChecksPassed:retentionPassed,totalRetentionChecks:policy.evaluation.personas.length,humanStudy:humanVerified?'verified':humanParticipants>0?'not-met':'not-verified',verifiedHumanTasks,humanParticipants,totalHumanTasks:policy.evaluation.tasks.length*policy.evaluation.personas.length,functionAndBranchCoverage:'not-measured'};
 let consecutivePassingRounds=passingTasks===metrics.totalPersonaTasks&&retentionPassed===metrics.totalRetentionChecks?1:0;
 if(consecutivePassingRounds&&evidenceBuild?.previousRound&&depth<8&&/^round-\d+$/.test(evidenceBuild.previousRound)){const previousDir=resolve(evidenceDir,'..',evidenceBuild.previousRound),meta=await optional(resolve(previousDir,'round.json'),null);if(meta?.buildHash===evidenceBuild.buildHash&&meta?.policyHash===evidenceBuild.policyHash){const previous=await measure({root,evidenceDir:previousDir,depth:depth+1});consecutivePassingRounds+=previous.metrics.consecutivePassingRounds;}}
 metrics.consecutivePassingRounds=consecutivePassingRounds;
 const checks=[metrics.inventoryAccounted===metrics.totalTracked,metrics.anchoredRustFiles===metrics.totalRust,metrics.fullyReviewedRustFiles===metrics.totalRust,metrics.guidedAreas===metrics.totalAreas,metrics.invalidEvidence===0,passingTasks===metrics.totalPersonaTasks&&consecutivePassingRounds>=policy.evaluation.roundPassesRequired,retentionPassed===metrics.totalRetentionChecks,humanVerified];
 if(policy.acceptance_criteria.map(x=>x.id).join(',')!=='FR-COV-001,FR-COV-002,FR-COV-003,FR-READ-001,FR-READ-002,FR-EVAL-001,FR-EVAL-002,FR-EVAL-003')throw Error('Acceptance gate schema changed');
 const gates=policy.acceptance_criteria.map((criterion,i)=>({id:criterion.id,description:criterion.description,metric:criterion.metric,target:criterion.target,status:checks[i]?'pass':i===7&&humanParticipants===0?'not-verified':'unmet'}));
 const areaResults=atlas.areas.map(a=>({id:a.id,name:a.name,totalRust:rustRows.filter(f=>f.area===a.id).length,anchoredRustFiles:rustRows.filter(f=>f.area===a.id&&f.evidence.length).length,guided:guidedAreas.includes(a.id)}));
 return {target,measurementEngineHash:digest(await readFile(fileURLToPath(import.meta.url),'utf8')),policyHash:policyHash(policy),metrics,gates,areas:areaResults,taskResults,productComplete:gates.every(g=>g.status==='pass'),inventory,evaluation:evidenceBuild};
}

export function summary(result){const m=result.metrics;return `# Reth読解の達成状況\n\n対象は${result.target.version}、${result.target.commit}。全体の完了判定は${result.productComplete?'達成':'未達'}です。\n\n| 計測対象 | 現在値 | 完了条件 |\n| --- | --- | --- |\n| 全追跡ファイルの台帳 | ${m.inventoryAccounted}/${m.totalTracked} | 100% |\n| 一部分に解説があるRustファイル | ${m.anchoredRustFiles}/${m.totalRust} | 100% |\n| 全体をレビュー済みのRustファイル | ${m.fullyReviewedRustFiles}/${m.totalRust} | 100% |\n| 同じページで読める領域の入口 | ${m.guidedAreas}/${m.totalAreas} | 100% |\n| 原文と不一致の根拠 | ${m.invalidEvidence} | 0 |\n| AIペルソナの課題 | ${m.passingPersonaTasks}/${m.totalPersonaTasks} | 全課題、8クリック以内、根拠付き4項目 |\n| URL・行・ヒント・下書きの保持 | ${m.retentionChecksPassed}/${m.totalRetentionChecks} | 全ペルソナ |\n| 全課題と保持を連続して達成した回数 | ${m.consecutivePassingRounds} | ${2}回以上 |\n| 人間の理解検証 | ${m.verifiedHumanTasks}/${m.totalHumanTasks}課題・${m.humanParticipants}/3人 | 各ペルソナの実在の学習者が全11課題で、補助を閉じて根拠付き4項目を再説明 |\n\n抜粋の解説をファイル全体のレビューとして数えません。関数・分岐の全数に対する網羅率は未計測です。AIの操作と回答は、人間の理解度を示しません。\n\n## 領域別の対応\n\n| 領域 | Rustファイル | 一部に解説あり | 読解入口 |\n| --- | --- | --- | --- |\n${result.areas.map(a=>`| ${a.name} | ${a.totalRust} | ${a.anchoredRustFiles} | ${a.guided?'あり':'未対応'} |`).join('\n')}\n\n## 未達条件\n\n${result.gates.filter(g=>g.status!=='pass').map(g=>`- ${g.id}: ${g.description}`).join('\n')}\n`;}

async function main(){
 const args=process.argv.slice(2),arg=name=>args.includes(name)?args[args.indexOf(name)+1]:undefined;
 const root=arg('--root')||projectRoot;let evidenceDir=arg('--evidence');
 if(!evidenceDir&&resolve(root)===projectRoot){const latest=await optional(resolve(projectRoot,'evaluations/reading-loop/latest.json'),null);if(latest&&/^round-\d+$/.test(latest.round)){const dir=resolve(projectRoot,'evaluations/reading-loop',latest.round),meta=await optional(resolve(dir,'round.json'),null),policy=await json(resolve(projectRoot,'docs/requirements.json'));if(meta?.buildHash===await runtimeHash(root)&&meta?.policyHash===policyHash(policy))evidenceDir=dir;}}
 const result=await measure({root,evidenceDir});
 const out=resolve(arg('--output')||resolve(projectRoot,'work/measurement'));await mkdir(out,{recursive:true});
 await writeFile(resolve(out,'measurement.json'),JSON.stringify(result,null,2)+'\n');await writeFile(resolve(out,'summary.md'),summary(result));
 if(args.includes('--reconcile')){const policy=await json(resolve(projectRoot,'docs/requirements.json'));for(const c of policy.acceptance_criteria){c.status=result.gates.find(g=>g.id===c.id).status;c.tests=[];for(const file of await readdir(resolve(projectRoot,'local-app/test'))){if(file.endsWith('.test.mjs')&&(await readFile(resolve(projectRoot,'local-app/test',file),'utf8')).includes('['+c.id+']'))c.tests.push('local-app/test/'+file);}}await writeFile(resolve(projectRoot,'docs/requirements.json'),JSON.stringify(policy,null,2)+'\n');}
 if(args.includes('--publish')){
  await writeFile(resolve(projectRoot,'docs/coverage-ledger.json'),JSON.stringify({commit:result.target.commit,files:result.inventory},null,2)+'\n');
  await writeFile(resolve(projectRoot,'docs/reading-status.json'),JSON.stringify({...result,inventory:undefined},null,2)+'\n');
  await writeFile(resolve(projectRoot,'docs/reading-status.md'),summary(result));
  const data={commit:result.target.commit,metrics:result.metrics,areas:result.areas};for(const dir of ['dist','local-app/public'])await writeFile(resolve(projectRoot,dir,'reading-coverage-data.js'),'window.READING_COVERAGE_DATA = '+JSON.stringify(data)+';\n');
 }
 console.log(JSON.stringify({metrics:result.metrics,gates:result.gates.map(({id,status})=>({id,status})),productComplete:result.productComplete,output:out}));
 if(args.includes('--require-complete')&&!result.productComplete)process.exitCode=2;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))await main();
