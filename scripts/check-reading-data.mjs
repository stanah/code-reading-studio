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
for(const data of [pack,atlas,lenses,annotations,startup])assert.equal(data.commit,target.commit,'Stale data commit');
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
for(const c of Object.values(help.contexts)){
 await anchor(c.source,c.source.hash,c.source.url,c.source.code);
 for(const line of c.lines)assert.ok(c.source.code.split('\n')[line.line-c.source.start]?.includes(line.match),'Stale inline hint');
}
const lessonConfig=JSON.parse(await read('ui/lesson-code-links.json'));
vm.runInNewContext(await read('ui/learning-content.js'),context);
assert.equal(help.lessonLinks.length,context.window.READING_COURSE.lessons.length);
assert.deepEqual(plain(help.lessonLinks.map(({area,crate,...r})=>r)),lessonConfig);
for(const ref of help.lessonLinks){
 const c=help.contexts[ref.context],crate=index.crates.find(k=>k.id===ref.crate.id);
 assert.ok(crate?.files.includes(c.source.path),'Lesson must link to the crate that owns the source');
 assert.equal(ref.crate.name,(await source(ref.crate.id)).split('[package]')[1]?.split(/\n\[/)[0]?.match(/^name\s*=\s*"([^"]+)"/m)?.[1]);assert.equal(ref.area,annotations.pathAreas[c.source.path]);
 assert.equal(ref.crate.hash,digest(await source(ref.crate.id)),'Crate manifest hash');
 assert.equal(ref.crate.url,`https://github.com/${target.repository}/tree/${target.commit}/${ref.crate.id.replace(/\/Cargo\.toml$/,'')}`);
}
const ids=new Set(startup.steps.map(s=>s.id));assert.equal(ids.size,startup.steps.length);
for(const stage of startup.stages)for(const id of stage.steps)assert.ok(ids.has(id),'Unknown stage step: '+id);
for(const s of [...startup.steps,...startup.loops]){
 await anchor(s.source,s.source.hash,s.source.url);
 for(const id of s.next||[])assert.ok(ids.has(id),'Unknown next step: '+id);
}
for(const data of [atlas,drill])for(const [path,text] of Object.entries(data.seed))assert.equal(text,await source(path),'Stale seed '+path);
console.log(JSON.stringify({result:'PASS',version:target.version,commit:target.commit,rustFiles:index.rust.length,crateGroups:index.crates.length,transactionAnchors:pack.steps.length+pack.details.length,helpContexts:Object.keys(help.contexts).length,lessonCodeLinks:help.lessonLinks.length,lineHints:Object.values(help.contexts).reduce((n,c)=>n+c.lines.length,0),startupSteps:startup.steps.length,loopAnchors:startup.loops.length,seedFiles:cache.size}));
