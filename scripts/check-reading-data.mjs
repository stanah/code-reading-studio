// Verify every authored source anchor against the selected Git commit.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {dirname,resolve} from 'node:path';
import vm from 'node:vm';
import {git,digest,indexRepository} from '../local-app/core.mjs';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const read=name=>readFile(resolve(root,name),'utf8');
const target=JSON.parse(await read('reading-target.json'));
const repo=resolve(root,'targets/reth');
assert.equal((await git(repo,'rev-parse','HEAD')).trim(),target.commit,'Submodule must use the declared target');
const index=await indexRepository(repo,target.commit);
const context={window:{}};
for(const file of ['reth-data.js','atlas-data.js','drill-data.js','lenses-pack.js','reading-help-data.js'])vm.runInNewContext(await read('dist/'+file),context);
const {RETH_PACK:pack,RETH_ATLAS:atlas,RETH_DRILL:drill,LENSES_PACK:lenses}=context.window;
const annotations=JSON.parse(await read('local-app/annotations.json'));
const startup=JSON.parse(await read('local-app/startup-guide.json'));
for(const data of [pack,atlas,drill,lenses,annotations,startup])assert.equal(data.commit,target.commit,'Stale data commit');
assert.equal(startup.version,target.version);
// JSON-normalize values created in a separate VM realm before deep comparison.
const plain=value=>JSON.parse(JSON.stringify(value));
assert.deepEqual(annotations.steps,plain(pack.steps.map(({code,...step})=>step)),'Local transaction explanations must match the static pack');
assert.deepEqual(annotations.areas,plain(atlas.areas),'Local area explanations must match the atlas');
assert.deepEqual(annotations.roles,plain(drill.roles),'Local module explanations must match the drill data');
assert.deepEqual(annotations.pathAreas,plain(Object.fromEntries(atlas.files.map(f=>[f.path,f.area]))),'Local area mapping must match the atlas');
assert.deepEqual(plain(lenses.steps.map(({structureUrl,...step})=>step)),annotations.steps,'Lens explanations must match the local reader');
assert.equal(await read('dist/lenses.js'),await read('local-app/public/lenses.js'),'Static and local Rust lessons must match');
assert.deepEqual([...atlas.files.map(f=>f.path)].sort(),[...index.rust].sort(),'Static file index must match Git');
const readerHtml=await read('dist/reader.html'),zoomHtml=await read('dist/zoom.html');
assert.ok(readerHtml.includes(`id="snapshot-link" href="https://github.com/${target.repository}/commit/${target.commit}"`),'Reader badge must link to the selected commit');
assert.ok(readerHtml.match(/id="snapshot-link"[^>]*>([^<]+)/)?.[1].startsWith(target.commit.slice(0,12)),'Reader badge text must match the selected commit');
assert.ok(zoomHtml.includes(`id="zoom-reference">参照：${target.commit.slice(0,12)}`),'Structure footer must show the selected commit');
const cache=new Map();
async function source(path){assert.ok(index.paths.includes(path),path);if(!cache.has(path))cache.set(path,await git(repo,'show',target.commit+':'+path));return cache.get(path);}
for(const [path,role] of Object.entries(startup.roles))assert.deepEqual(plain(drill.roles[path]),role,'Static startup role must share the local producer: '+path);
for(const path of Object.keys(annotations.roles))assert.equal(drill.seed[path],await source(path),'Every published role needs its full pinned offline declaration source: '+path);
async function anchor(s,hash,url,code){
 const lines=(await source(s.path)).split('\n');
 assert.ok(Number.isInteger(s.start)&&s.start>0&&s.end>=s.start&&s.end<=lines.length,s.path);
 const snippet=lines.slice(s.start-1,s.end).join('\n');assert.equal(digest(snippet),hash,s.path+' anchor hash');
 if(code!==undefined)assert.equal(snippet,code,s.path+' excerpt');
 assert.equal(url,`https://github.com/${target.repository}/blob/${target.commit}/${s.path}#L${s.start}-L${s.end}`);
}
for(const s of [...pack.steps,...pack.details])await anchor(s,s.contentHash,s.sourceUrl,s.code);
for(const s of annotations.steps)await anchor(s,s.contentHash,s.sourceUrl);
const help=context.window.READING_HELP_DATA;assert.equal(help.commit,target.commit);
const authoredHelp=JSON.parse(await read('ui/reading-help-content.json')),areaSources=JSON.parse(await read('ui/area-source-excerpts.json'));
assert.deepEqual(Object.keys(help.contexts).sort(),Object.keys(authoredHelp.contexts).sort(),'Published helper contexts must match the authored denominator');
for(const [id,c] of Object.entries(help.contexts)){
 await anchor(c.source,c.source.hash,c.source.url,c.source.code);
 for(const line of c.lines)assert.ok(c.source.code.split('\n')[line.line-c.source.start]?.includes(line.match),'Stale inline hint');
 const [kind,key]=id.split(':'),item=kind==='startup'?startup.steps.find(s=>s.id===key):kind==='tx'?([...pack.steps,...pack.details].find(s=>s.id===key)||areaSources[key]):areaSources[key],expected=item?.source||item;
 assert.ok(expected,'Context needs an authored source '+id);
 assert.deepEqual(plain({path:c.source.path,start:c.source.start,end:c.source.end,hash:c.source.hash,url:c.source.url}),{path:expected.path,start:expected.start,end:expected.end,hash:expected.hash||expected.contentHash,url:expected.url||expected.sourceUrl},'Published source must match its authored scope '+id);
 const {title,source,...hints}=c;assert.deepEqual(plain(hints),authoredHelp.contexts[id],'Published comments must match authoring '+id);
}
const lessonConfig=JSON.parse(await read('ui/lesson-code-links.json'));
vm.runInNewContext(await read('ui/learning-content.js'),context);
assert.equal(help.lessonLinks.length,context.window.READING_COURSE.lessons.length);
assert.deepEqual(plain(help.lessonLinks.map(({area,crate,...r})=>r)),lessonConfig);
assert.deepEqual(Object.keys(help.sourceOwners||{}).sort(),Object.keys(help.contexts).sort(),'Every displayed context needs a verified source owner');
for(const [id,owner] of Object.entries(help.sourceOwners||{})){
 const c=help.contexts[id],crate=index.crates.find(k=>k.id===owner.crate.id);
 assert.ok(crate?.files.includes(c.source.path),'Context must link to its actual owning crate: '+id);
 assert.equal(owner.crate.name,(await source(owner.crate.id)).split('[package]')[1]?.split(/\n\[/)[0]?.match(/^name\s*=\s*"([^"]+)"/m)?.[1]);
 assert.equal(owner.area,annotations.pathAreas[c.source.path]);
 assert.equal(owner.crate.hash,digest(await source(owner.crate.id)),'Crate manifest hash');
 assert.equal(owner.crate.url,`https://github.com/${target.repository}/tree/${target.commit}/${owner.crate.id.replace(/\/Cargo\.toml$/,'')}`);
}
for(const ref of help.lessonLinks){
 assert.deepEqual(plain({area:ref.area,crate:ref.crate}),plain(help.sourceOwners[ref.context]));
 assert.ok(Array.isArray(ref.readings)&&ref.readings.length>=2,'Lesson purpose requires a reading path: '+ref.lesson);
 assert.equal(new Set(ref.readings.map(r=>r.context)).size,ref.readings.length,'Do not repeat the same source as a new learning stage');
 for(const reading of ref.readings){
  assert.ok(help.contexts[reading.context]&&help.sourceOwners[reading.context],'Missing lesson stage source');
  assert.ok(['title','purpose','connection'].every(k=>typeof reading[k]==='string'&&reading[k].trim()),'Stage purpose and connection must be explicit');
 }
}
const journeyConfig=JSON.parse(await read('ui/journey-code-links.json'));
assert.deepEqual(plain(help.journeyLinks),journeyConfig,'Published journeys must match authored reading paths');
assert.equal(new Set(help.journeyLinks.map(j=>j.id)).size,help.journeyLinks.length,'Journey IDs must be unique');
for(const journey of help.journeyLinks){
 assert.ok(['id','title','goal','scope'].every(k=>typeof journey[k]==='string'&&journey[k].trim()),'Journey purpose and boundary must be explicit');
 assert.ok(journey.readings.length>=2,'Journey needs a source reading path');
 assert.equal(new Set(journey.readings.map(r=>r.context)).size,journey.readings.length,'Journey source must not be repeated as a new stage');
 for(const reading of journey.readings){assert.ok(help.contexts[reading.context]&&help.sourceOwners[reading.context]);assert.ok(['title','purpose','connection'].every(k=>typeof reading[k]==='string'&&reading[k].trim()));}
}
const checkReadingPath=(row,label)=>{
 assert.ok(['goal','scope'].every(k=>typeof row[k]==='string'&&row[k].trim()),'Missing goal/scope '+label);
 assert.ok(Array.isArray(row.readings)&&row.readings.length,'Missing source path '+label);
 assert.equal(new Set(row.readings.map(s=>s.context)).size,row.readings.length,'Repeated source '+label);
 for(const s of row.readings){assert.ok(help.contexts[s.context]&&help.sourceOwners[s.context],'Missing source '+label);assert.ok(['title','purpose','connection'].every(k=>typeof s[k]==='string'&&s[k].trim()),'Missing source purpose/connection '+label);}
};
const areaConfig=JSON.parse(await read('ui/area-readings.json'));
assert.deepEqual(plain(help.areaReadings),areaConfig,'Published area source paths must match authoring');
for(const row of areaConfig)for(const part of [row,row.followup])if(part?.readings)checkReadingPath({goal:part.question,scope:part.boundary,readings:part.readings},'area:'+row.area);
const fileRoleConfig=JSON.parse(await read('ui/file-role-code-links.json'));
assert.deepEqual(plain(help.fileRoleLinks),fileRoleConfig,'Published file roles must match authoring');
assert.deepEqual(fileRoleConfig.map(r=>r.path).sort(),Object.keys({...annotations.roles,...startup.roles}).sort(),'Every actual merged file role needs a source path');
for(const row of fileRoleConfig){checkReadingPath(row,row.path);assert.ok(row.readings.some(s=>help.contexts[s.context].source.path===row.path),'File role must use its actual file '+row.path);}
const componentConfig=JSON.parse(await read('ui/component-code-links.json'));
assert.deepEqual(plain(help.componentLinks),componentConfig,'Published component sources must match authoring');
assert.deepEqual(componentConfig.map(r=>r.area+':'+r.component).sort(),['interface','helpers','implementation','integration'].map(id=>'rpc:'+id).sort());
for(const row of componentConfig){checkReadingPath(row,row.component);const group=drill.components[row.area]?.find(c=>c.id===row.component);assert.ok(group&&row.readings.some(s=>group.files.includes(help.contexts[s.context].source.path)),'Component source must include a file in the actual group '+row.component);}
const operationConfig=JSON.parse(await read('ui/operation-code-links.json'));
assert.deepEqual(plain(help.operationLinks),operationConfig,'Published operation references must match authoring');
assert.deepEqual(operationConfig.map(r=>r.id).sort(),['rpc','recover','submit','queue','batch','pool'].sort());
const canonicalSend=new Set(help.lessonLinks.find(l=>l.lesson==='send').readings.map(r=>r.context));
for(const row of operationConfig){
 assert.ok(['title','scope'].every(k=>typeof row[k]==='string'&&row[k].trim()));
 assert.ok(Array.isArray(row.contexts)&&row.contexts.length);assert.equal(new Set(row.contexts).size,row.contexts.length);
 for(const id of row.contexts)assert.ok(canonicalSend.has(id)&&help.contexts[id],'Operation must reuse a canonical send source '+row.id);
 assert.ok(row.connections&&!Array.isArray(row.connections));for(const [id,value] of Object.entries(row.connections))assert.ok(row.contexts.includes(id)&&typeof value==='string'&&value.trim(),'Invalid operation connection');
}
for(const row of fileRoleConfig)for(const operation of operationConfig)if(help.contexts['tx:'+operation.id]?.source.path===row.path)for(const id of operation.contexts)assert.ok(row.readings.some(s=>s.context===id),'File role must include complete operation evidence '+row.path+'/'+operation.id);
const startupScopes=startup.readingScopes;
assert.deepEqual(Object.keys(startupScopes.steps).sort(),startup.steps.map(s=>s.id).sort());assert.deepEqual(Object.keys(startupScopes.loops).sort(),startup.loops.map((_,i)=>String(i+1)).sort());assert.equal(startupScopes.staticStartup.length,7);assert.equal(startupScopes.staticRuntime.length,4);
for(const rows of [...Object.values(startupScopes.steps),...Object.values(startupScopes.loops),...startupScopes.staticStartup.map(s=>s.readings),...startupScopes.staticRuntime.map(s=>s.readings)]){
 assert.ok(rows.length);assert.equal(new Set(rows.map(r=>r.context)).size,rows.length);
 for(const row of rows)assert.ok(help.contexts[row.context]&&help.sourceOwners[row.context]&&typeof row.purpose==='string'&&row.purpose.trim(),'Startup scope needs a source and purpose');
 for(let i=0;i<rows.length;i++)for(let j=i+1;j<rows.length;j++){const a=help.contexts[rows[i].context].source,b=help.contexts[rows[j].context].source;assert.ok(a.path!==b.path||a.start>b.end||b.start>a.end,'Startup must not repeat original source lines');}
}
const ids=new Set(startup.steps.map(s=>s.id));assert.equal(ids.size,startup.steps.length);
for(const stage of startup.stages)for(const id of stage.steps)assert.ok(ids.has(id),'Unknown stage step: '+id);
for(const s of [...startup.steps,...startup.loops]){
 await anchor(s.source,s.source.hash,s.source.url);
 for(const id of s.next||[])assert.ok(ids.has(id),'Unknown next step: '+id);
}
for(const data of [atlas,drill])for(const [path,text] of Object.entries(data.seed))assert.equal(text,await source(path),'Stale seed '+path);
console.log(JSON.stringify({result:'PASS',version:target.version,commit:target.commit,rustFiles:index.rust.length,crateGroups:index.crates.length,transactionAnchors:pack.steps.length+pack.details.length,helpContexts:Object.keys(help.contexts).length,lessonCodeLinks:help.lessonLinks.length,lessonReadingStages:help.lessonLinks.reduce((n,l)=>n+l.readings.length,0),sourceOwners:Object.keys(help.sourceOwners).length,journeyReadingStages:help.journeyLinks.reduce((n,j)=>n+j.readings.length,0),fileRolePaths:fileRoleConfig.length,componentPaths:componentConfig.length,operationPaths:operationConfig.length,lineHints:Object.values(help.contexts).reduce((n,c)=>n+c.lines.length,0),startupSteps:startup.steps.length,loopAnchors:startup.loops.length,seedFiles:cache.size}));
