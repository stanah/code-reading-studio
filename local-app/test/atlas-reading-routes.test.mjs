import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),{buildRouteRegistry}=require('../../scripts/reading-route-registry.cjs');
const read=p=>readFile(new URL(p,import.meta.url),'utf8');
const [helpScript,atlasData,atlasScript,sharedScript,html,guideText]=await Promise.all([
 read('../../dist/reading-help-data.js'),read('../../dist/atlas-data.js'),read('../../dist/atlas.js'),read('../../ui/reading-help.js'),read('../../dist/explore.html'),read('../startup-guide.json')
]);
const initial={};initial.window=initial;vm.runInNewContext(helpScript,initial);
const help=JSON.parse(JSON.stringify(initial.READING_HELP_DATA)),guide=JSON.parse(guideText);
const registry=buildRouteRegistry({...help,guide});
const ids=rows=>rows.map(r=>r.context),normal=value=>JSON.parse(JSON.stringify(value));

test('public availability covers every actual consumer, including scalar areas and all guide scopes',()=>{
 assert.deepEqual(help.routeRegistry,normal(registry),'published registry must be regenerated from the actual current consumers');
 assert.throws(()=>buildRouteRegistry({...help,guide:{...guide,commit:'other'}}),/commit differs/);
 const byId=new Map(registry.routes.map(r=>[r.id,r]));
 assert.equal(byId.size,registry.routes.length);
 const expect=(id,rows)=>assert.deepEqual(ids(byId.get(id)?.readings||[]),ids(rows),id);
 for(const r of help.lessonLinks)expect('lesson:'+r.lesson,r.readings);
 for(const r of help.journeyLinks)expect('journey:'+r.id,r.readings);
 for(const r of help.fileRoleLinks)expect('file-role:'+r.path,r.readings);
 for(const r of help.componentLinks)expect('component:'+r.area+':'+r.component,r.readings);
 for(const r of help.operationLinks)assert.deepEqual(ids(byId.get('operation:'+r.id).readings),r.contexts);
 for(const r of help.areaReadings){
  for(const [part,value] of [['main',r],['followup',r.followup]])if(value){
   const expected=value.readings?.length?ids(value.readings):r.area==='pool'&&part==='main'?help.operationLinks.find(o=>o.id==='pool').contexts:[value.context];
   assert.deepEqual(ids(byId.get('area:'+r.area+':'+part).readings),expected);
  }
  if(r.extraContext)assert.deepEqual(ids(byId.get('area:'+r.area+':extra').readings),[r.area==='pool'?'area:send-stateless':r.extraContext]);
 }
 for(const [id,rows] of Object.entries(guide.readingScopes.steps))expect('guide:step:'+id,rows);
 for(const [id,rows] of Object.entries(guide.readingScopes.loops))expect('guide:loop:'+id,rows);
 for(const name of ['staticStartup','staticRuntime'])guide.readingScopes[name].forEach((r,i)=>expect('guide:'+name+':'+(i+1),r.readings));
 // The last preflight failure was a scalar area omitted from six other bindings.
 const budgetOwners=registry.routes.filter(r=>ids(r.readings).includes('startup:network'));
 assert.equal(budgetOwners.length,7);for(const r of budgetOwners)assert.equal(ids(r.readings).filter(id=>id==='area:network-budget').length,1,r.id);
});

test('file availability includes generic contexts but never implies whole-file explanation',()=>{
 const consumerIds=new Set(registry.routes.flatMap(r=>ids(r.readings)));
 assert.deepEqual(Object.keys(registry.files).sort(),[...new Set([...consumerIds].map(id=>help.contexts[id].source.path))].sort());
 for(const [path,file] of Object.entries(registry.files)){
  assert.ok(file.contexts.length);
  for(const id of file.contexts)assert.equal(help.contexts[id].source.path,path);
  for(const id of file.routes)assert.ok(registry.routes.find(r=>r.id===id).readings.some(r=>help.contexts[r.context].source.path===path),path+' / '+id);
 }
 assert.ok(registry.files['crates/net/network/src/budget.rs'],'new non-tour support must be discoverable');
 assert.ok(registry.files['bin/reth/src/main.rs'],'startup must be discoverable');
 for(const [id,c]of Object.entries(help.contexts))assert.ok(registry.files[c.source.path].contexts.includes(id),'generic source consumer '+id);
 assert.throws(()=>buildRouteRegistry({...help,guide,contexts:{...help.contexts,'area:invalid':{source:{path:'crates/unreviewed/src/fragment.rs',start:1,end:5},title:'invalid descriptor'}}}),/Invalid source descriptor/);
 assert.doesNotMatch(atlasScript,/const explained=new Set\(annotations/);
 assert.doesNotMatch(atlasScript,/送信経路の抜粋あり|送信経路の抜粋解説なし/);
 assert.match(atlasScript,/全ファイル・全関数の解説数ではありません/);
 assert.ok(html.indexOf('id="atlas-explanation-preview"')<html.indexOf('id="source-original"'));
 assert.ok(html.indexOf('id="reading-question"')>html.indexOf('</details></div><aside'));
});

function app({late=false,fetcher=()=>new Promise(()=>{}),path='bin/reth/src/main.rs'}={}){
 const context={};context.window=context;vm.createContext(context);vm.runInContext(atlasData,context);
 const originalData=normal({...help,routeRegistry:registry});context.READING_HELP_DATA=originalData;
 vm.runInContext(sharedScript,context);const realApi=context.ReadingHelp;
 if(late){delete context.READING_HELP_DATA;delete context.ReadingHelp;}
 const elements=new Map(),events=new Map(),windowEvents=new Map(),mounts=[],writes=[];
 const node=id=>{
  if(elements.has(id))return elements.get(id);
  const listeners=new Map(),el={id,innerHTML:'',textContent:'',value:'',hidden:false,open:false,disabled:false,checked:false,dataset:{},style:{},classList:{toggle(){},add(){},remove(){}},
   addEventListener(type,fn){listeners.set(type,[...(listeners.get(type)||[]),fn]);},
   emit(type,event={}){for(const fn of listeners.get(type)||[])fn({target:el,...event});},
   showModal(){el.open=true;},close(){el.open=false;el.emit('close');},scrollTop:0,focused:false,focus(options){el.focused=true;el.focusOptions=options;},scrollIntoView(){el.scrolledIntoView=true;},getBoundingClientRect(){return {top:Number(el.dataset.sourceLine||0)*18,height:18};},querySelectorAll(selector){
    if(selector!=='[data-reading-help]')return [];
    // Parse actual shared-renderer markup at the DOM boundary. Do not mock
    // source-range coverage or the Atlas selection decision itself.
    return [...el.innerHTML.matchAll(/data-reading-help="([^"]*)"/g)].map(match=>({getAttribute(name){return name==='data-reading-help'?match[1]:null;},dataset:{readingHelp:match[1]}}));
   },querySelector(selector){if(selector==='summary')return node(id+'-summary');const n=selector.match(/^\[data-source-line="(\d+)"\]$/)?.[1];return n?sourceRows().find(row=>row.dataset.sourceLine===n)||null:null;}
  };elements.set(id,el);return el;
 };
 const sourceRows=()=>[...node('source-lines').innerHTML.matchAll(/data-source-line="(\d+)"/g)].map(match=>{const row=node('raw-row-'+match[1]);row.dataset.sourceLine=match[1];return row;});
 const api={...realApi,mount(el){mounts.push(el.innerHTML);},focusContext(id,line){mounts.push({focus:id,line});}};
 Object.assign(context,{URLSearchParams,AbortController,location:{search:'',pathname:'/explore.html'},setTimeout:()=>1,clearTimeout(){},fetch:fetcher,
  localStorage:{getItem(){return null;},setItem(k,v){writes.push([k,v]);}},
  document:{getElementById:node,querySelectorAll(selector){return selector==='[data-source-line]'?sourceRows():[];},addEventListener(type,fn){events.set(type,[...(events.get(type)||[]),fn]);}},
  addEventListener(type,fn){windowEvents.set(type,[...(windowEvents.get(type)||[]),fn]);}
 });
 if(!late)context.ReadingHelp=api;
 delete context.RETH_ATLAS.seed[path];
 vm.runInContext(atlasScript,context);
 return {context,node,mounts,writes,path,open:selection=>context.openFile(path,selection),read:expression=>vm.runInContext(expression,context),ready(){context.READING_HELP_DATA=originalData;context.ReadingHelp=api;for(const fn of events.get('reading-help-ready')||[])fn({type:'reading-help-ready'});},event(type,event){for(const fn of events.get(type)||[])fn(event);}};
}

test('actual Atlas mounts same-page explanations before remote raw source completes',()=>{
 const a=app();a.open([42,42]);
 assert.equal(a.node('source-dialog').open,true);
 assert.ok(a.mounts.length>0);
 assert.match(a.node('atlas-explanation-preview').innerHTML,/data-reading-help="startup:entry"/);
 assert.match(a.node('source-lines').innerHTML,/取得しています/);
 assert.equal(a.node('source-original').open,false,'raw whole-file code is optional when help exists');
 a.read('state.status="explained"');const found=normal(a.read('filterFiles().map(f=>f.path)'));
 assert.ok(found.includes('crates/net/network/src/budget.rs'));
 assert.equal(found.length,Object.keys(registry.files).length);
});

test('every registered lesson, operation, role, component, area and guide route is reachable in the real Atlas adapter',()=>{
 for(const route of registry.routes){
  const first=help.contexts[route.readings[0].context].source,a=app({path:first.path});
  a.open([first.start,first.start]);a.node('reading-question').value='切替前の未保存の問い';
  const picker=a.node('atlas-explanation-picker');assert.ok(picker.innerHTML.includes('route|'+route.id),route.id+' option');
  picker.value='route|'+route.id;picker.onchange({target:picker});
  for(const reading of route.readings)assert.ok(a.node('atlas-explanation-preview').innerHTML.includes('data-reading-help="'+reading.context+'"'),route.id+' / '+reading.context);
  assert.equal(a.node('reading-question').value,'切替前の未保存の問い',route.id+' draft');
  assert.equal(a.context.location.search,'',route.id+' URL');
 }
});

test('a stale or mismatched help commit cannot label current files as explained',()=>{
 const a=app();a.context.READING_HELP_DATA={...a.context.READING_HELP_DATA,commit:'wrong-commit'};
 a.event('reading-help-ready',{});a.open([42,42]);
 assert.match(a.node('atlas-explanation-preview').innerHTML,/参照版が異なる/);
 assert.equal(a.node('atlas-explanation-picker').hidden,true);
 a.read('state.status="explained"');assert.equal(a.read('filterFiles().length'),0);
});

test('raw fetch failure and retry preserve the mounted route, question draft, selection and URL',async()=>{
 let fail;const first=new Promise((_,reject)=>{fail=reject;});let attempt=0;
 const a=app({fetcher:()=>++attempt===1?first:Promise.resolve({ok:true,headers:{get(){return null;}},text:async()=>Array.from({length:180},(_,i)=>'line '+(i+1)).join('\n')})});
 const pending=a.open([42,42]);a.node('reading-question').value='保存しない試験用の問い';
 a.node('atlas-explanation-picker').value='route|lesson:startup';a.node('atlas-explanation-picker').onchange({target:a.node('atlas-explanation-picker')});
 const preview=a.node('atlas-explanation-preview').innerHTML;
 fail(Error('offline'));await pending;
 assert.equal(a.node('atlas-explanation-preview').innerHTML,preview);
 assert.equal(a.node('reading-question').value,'保存しない試験用の問い');
 assert.match(a.node('source-status').textContent,/取得に失敗/);
 await a.node('retry-source').onclick();
 assert.equal(a.node('atlas-explanation-preview').innerHTML,preview);
 assert.equal(a.node('reading-question').value,'保存しない試験用の問い');
 assert.deepEqual(normal(a.read('source.selection')),[42,42]);
 assert.equal(a.node('atlas-explanation-picker').value,'route|lesson:startup');
 assert.equal(a.context.location.search,'');
 assert.ok(a.writes.every(([key,value])=>!key.includes('note')&&!value.includes('保存しない試験用の問い')),'draft must not silently become a saved note or queue item');
});

test('late registry/API arrival updates availability and preview without resetting a manual raw panel or draft',()=>{
 const a=app({late:true});a.open([42,42]);a.node('reading-question').value='後着中の未保存の問い';
 const summary=a.node('source-original-summary');a.node('source-original').emit('click',{target:{closest:()=>summary}});a.node('source-original').open=true;
 a.ready();assert.ok(a.mounts.length>0);assert.equal(a.node('reading-question').value,'後着中の未保存の問い');
 assert.equal(a.node('source-original').open,true);
 assert.deepEqual(normal(a.read('source.selection')),[42,42]);
 assert.equal(a.node('reading-file-count').textContent,String(Object.keys(registry.files).length));
 const before=a.mounts.length;a.ready();assert.equal(a.mounts.length,before,'ready notifications do not remount an unchanged preview subtree');
});

test('file changes and closing preserve per-file drafts; unrelated files are not claimed as explained',async()=>{
 const a=app();a.open([42,42]);a.node('reading-question').value='元ファイルの未保存';
 const other=a.context.RETH_ATLAS.files.find(f=>!registry.files[f.path]).path;
 a.context.RETH_ATLAS.seed[other]='unreviewed source';await a.context.openFile(other);
 assert.match(a.node('atlas-explanation-preview').innerHTML,/補助はまだありません/);
 assert.equal(a.node('source-original').open,true);a.node('reading-question').value='別ファイルの未保存';
 a.node('source-dialog').close();a.open();
 assert.equal(a.node('reading-question').value,'元ファイルの未保存');
 assert.deepEqual(normal(a.read('source.selection')),[42,42]);
 assert.equal(a.context.location.search,'');
});

// Append to the real Atlas adapter suite after improving only the fixture's DOM host lookup.
test('an explicitly requested existing explanation range opens its own original, not the previous role',()=>{
 const path='crates/rpc/rpc/src/eth/helpers/transaction.rs',a=app({path});
 a.open([365,365]);
 assert.equal(a.read('source.choice'),'context|tx:pool-test');
 assert.match(a.node('atlas-explanation-preview').innerHTML,/data-reading-help="tx:pool-test"/);
 assert.equal(a.node('source-original').open,false);
 assert.ok(a.mounts.some(m=>m?.focus==='tx:pool-test'&&m.line===365));
 a.node('atlas-explanation-picker').value='route|operation:submit';
 a.node('atlas-explanation-picker').onchange({target:a.node('atlas-explanation-picker')});
 assert.equal(a.node('source-original').open,true,'a different preview cannot hide the requested test line');
 a.open([365,365]);
 assert.equal(a.read('source.choice'),'context|tx:pool-test','an explicit new request overrides a remembered unrelated preview');
});

test('uncovered points and partially covered ranges keep the original open and explain why',()=>{
 const path='crates/rpc/rpc/src/eth/helpers/transaction.rs';
 for(const interval of [[200,200],[110,120]]){
  const a=app({path});a.open(interval);
  assert.equal(a.node('source-original').open,true,JSON.stringify(interval));
  assert.equal(a.node('atlas-selection-status').hidden,false);
  assert.ok(a.node('atlas-selection-status').textContent.includes('L'+interval[0]+'–L'+interval[1]));
  assert.deepEqual(normal(a.read('source.selection')),interval);
 }
});

test('route focus uses a displayed containing context instead of a smaller unrelated global excerpt',()=>{
 const path='crates/transaction-pool/src/validate/eth.rs',a=app({path});
 a.open([592,598]);
 const picker=a.node('atlas-explanation-picker');picker.value='route|operation:pool';picker.onchange({target:picker});
 assert.equal(a.node('source-original').open,false);
 assert.equal(a.node('atlas-selection-status').hidden,true);
 assert.ok(a.mounts.some(m=>m?.focus==='area:send-stateless'&&m.line===592));
});

// DOM geometry and row identity are fixture boundaries; coverage and selection
// transitions remain the real Atlas code.
test('uncovered initial lines get raw row focus after fetch, and raw clicks refresh coverage without closing it',async()=>{
 const path='crates/rpc/rpc/src/eth/helpers/transaction.rs',fetcher=()=>Promise.resolve({ok:true,headers:{get(){return null;}},text:async()=>Array.from({length:500},(_,i)=>'line '+(i+1)).join('\n')});
 const a=app({path,fetcher});await a.open([200,200]);
 assert.equal(a.node('source-original').open,true);assert.equal(a.node('atlas-selection-status').hidden,false);
 assert.equal(a.node('raw-row-200').focused,true);assert.ok(a.node('source-lines').scrollTop>0);
 await a.open([42,42]);assert.equal(a.node('atlas-selection-status').hidden,true);
 a.node('source-original').emit('click',{target:{closest:()=>a.node('source-original-summary')}});a.node('source-original').open=true;
 a.node('raw-row-10').onclick({shiftKey:false});assert.deepEqual(normal(a.read('source.selection')),[10,10]);assert.equal(a.node('atlas-selection-status').hidden,false);assert.equal(a.node('source-original').open,true);
 a.node('raw-row-42').onclick({shiftKey:false});assert.equal(a.node('atlas-selection-status').hidden,true);assert.equal(a.node('source-original').open,true,'actively used raw code remains open after selecting a covered row');
});

// Real Atlas adapter regression; consume the registry and shared HTML, not a label stub.
test('Rust topic/start variants have distinct labels and show the selected starting original',()=>{
 for(const topic of Object.keys(help.rustTopics)){
  const variants=registry.routes.filter(r=>r.kind==='rust-topic'&&r.topic===topic);
  const first=help.contexts[variants[0].readings[0].context].source,a=app({path:first.path});a.open([first.start,first.start]);
  const picker=a.node('atlas-explanation-picker');
  const labels=variants.map(r=>{const option=picker.innerHTML.split('value="route|'+r.id+'"')[1];assert.ok(option,r.id);return option.split('>')[1].split('</option')[0];});
  assert.equal(new Set(labels).size,variants.length,topic+' options must identify different starting points');
  assert.ok(labels.some(label=>label.includes('テーマ全体')));
  const variant=variants.find(r=>r.selectedStep&&r.readings[0].context!==variants[0].readings[0].context);
  assert.ok(variant,topic+' has a non-default starting point');
  picker.value='route|'+variant.id;picker.onchange({target:picker});
  assert.match(a.node('atlas-explanation-preview').innerHTML,/最初に読む原文/);
  assert.equal(a.mounts.at(-1).focus,variant.readings[0].context,variant.id+' manual choice starts at the chosen original');
  assert.deepEqual(normal(a.read('source.selection')),[first.start,first.start],variant.id+' preserves the original raw selection');
 }
});
