import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
const read=p=>readFile(new URL(p,import.meta.url),'utf8');
const scripts=await Promise.all(['atlas-data','drill-data','reth-data'].map(n=>read('../../dist/'+n+'.js')));
const zoom=await read('../../dist/zoom.js');
const annotations=JSON.parse(await read('../annotations.json')),startup=JSON.parse(await read('../startup-guide.json'));
function data(){const ctx={};ctx.window=ctx;for(const script of scripts)vm.runInNewContext(script,ctx);return ctx;}

test('static and local role producers expose the same 19 descriptions at the same commit',()=>{
 const ctx=data();assert.equal(ctx.RETH_DRILL.commit,ctx.RETH_ATLAS.commit);
 assert.equal(ctx.RETH_DRILL.commit,startup.commit);
 assert.deepEqual(JSON.parse(JSON.stringify(ctx.RETH_DRILL.roles)),{...annotations.roles,...startup.roles});
 for(const path of Object.keys(ctx.RETH_DRILL.roles))assert.ok(ctx.RETH_DRILL.seed[path],path+' cannot depend on a remote fetch for its known function catalog');
});

function route(path,fetcher){
 const ctx=data(),elements=new Map(),mounted=[];
 const node=id=>{if(!elements.has(id))elements.set(id,{id,innerHTML:'',textContent:'',value:'',dataset:{},append(){},remove(){},querySelectorAll(){return []}});return elements.get(id)};
 const group=Object.entries(ctx.RETH_DRILL.components).flatMap(([area,cs])=>cs.map(c=>({area,c}))).find(({c})=>c.files.includes(path));
 assert.ok(group,path+' has an actual component route');
 delete ctx.RETH_DRILL.seed[path];delete ctx.RETH_ATLAS.seed[path];
 const search='?'+new URLSearchParams({area:group.area,c:group.c.id,f:path});
 Object.assign(ctx,{URLSearchParams,AbortController,location:{search},history:{replaceState(){}},setTimeout:()=>1,clearTimeout(){},fetch:fetcher,
  document:{getElementById:node,querySelectorAll(){return []},createElement:()=>node('temporary')},
  ReadingHelp:{mount(el){mounted.push(el.innerHTML)}}});
 ctx.window=ctx;const pending=vm.runInNewContext(zoom,ctx);
 return {elements,mounted,pending};
}

test('every published static role mounts its reading path before an optional source fetch completes',()=>{
 const roles=data().RETH_DRILL.roles;
 for(const path of Object.keys(roles)){
  let fetched=false;const view=route(path,()=>{fetched=true;return new Promise(()=>{});});
  assert.equal(fetched,true);
  assert.ok(view.mounted.some(html=>html.includes('data-file-role-reading="'+path+'"')),path+' must not be gated by function-catalog retrieval');
  assert.match(view.elements.get('zoom-children').innerHTML,/role-function-catalog/);
 }
});

test('failure of the optional static function catalog does not replace the authored source path',async()=>{
 const path='bin/reth/src/main.rs',view=route(path,async()=>{throw Error('offline')});
 await view.pending;
 assert.ok(view.elements.get('zoom-children').innerHTML.includes('data-file-role-reading="'+path+'"'));
 assert.match(view.elements.get('function-catalog').innerHTML,/offline/);
});
