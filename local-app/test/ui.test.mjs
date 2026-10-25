import {test} from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';
test('annotated functions retain their explanation and source bridge, and repository text stays inert',async()=>{
 const elements=new Map();const node=id=>{if(!elements.has(id))elements.set(id,{innerHTML:'',textContent:'',value:'',content:'token',classList:{toggle(){}},querySelectorAll(){return []}});return elements.get(id)};
 const document={querySelector:node,body:{classList:{toggle(){},contains(){return false}}}};
 const path='crates/rpc/src/lib.rs',location={hash:'#area=rpc&crate=crates%2Frpc%2FCargo.toml&path='+encodeURIComponent(path)+'&fn=3'};
 const index={commit:'abc',rust:[path],crates:[{id:'crates/rpc/Cargo.toml',directory:'crates/rpc/',name:'rpc',area:'rpc',files:[path]}],areas:['rpc'],roles:{},steps:[{path,symbol:'Api::send',start:1,end:4,input:'Bytes',output:'Hash',summary:'Decode',detail:'Then submit',side:'Pool',branch:'Error',subtitle:'Stages'}]};
 const fetch=async url=>({ok:true,json:async()=>url.endsWith('/index')?index:{path,source:'//! doc\n/// send\nfn send() {\n}',functions:[{name:'send',line:3,start:2,end:4,signature:'fn send()',docs:'<script>bad</script>'}],docs:'<script>bad</script>'}});
 const code=await readFile(new URL('../public/app.js',import.meta.url),'utf8');const run=new (Object.getPrototypeOf(async function(){}).constructor)('document','location','fetch','addEventListener',code+'\nreturn {render};');const app=await run(document,location,fetch,()=>{});
 assert.match(node('#view').innerHTML,/処理の流れ/);assert.match(node('#view').innerHTML,/入力/);assert.match(node('#view').innerHTML,/data-reading-operation/);assert.doesNotMatch(node('#view').innerHTML,/<pre class="code">/);
 location.hash='#area=rpc&crate=crates%2Frpc%2FCargo.toml&path='+encodeURIComponent(path);await app.render();assert.match(node('#view').innerHTML,/&lt;script&gt;/);assert.doesNotMatch(node('#view').innerHTML,/<script>/);
 location.hash+="&code=1&start=1&end=4";await app.render();assert.match(node('#view').innerHTML,/<pre class="code">/);assert.match(node('#view').innerHTML,/fn send/);
});
