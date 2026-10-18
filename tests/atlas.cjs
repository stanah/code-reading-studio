// Logic checks, not a browser rendering test.
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),path=require('node:path');
const base=path.resolve(__dirname,'../dist');
function setup(){
 const nodes=new Map(),saved=new Map();
 const node=id=>{if(!nodes.has(id))nodes.set(id,{innerHTML:'',textContent:'',value:'',style:{},classList:{toggle(){},add(){},remove(){}},open:false,showModal(){this.open=true},close(){this.open=false},addEventListener(){},scrollIntoView(){},focus(){}});return nodes.get(id)};
 const ctx={window:{},location:{search:''},URLSearchParams,AbortController,setTimeout,clearTimeout,console,document:{getElementById:node,querySelectorAll:()=>[]},localStorage:{getItem:k=>saved.get(k),setItem:(k,v)=>saved.set(k,v)},fetch:async()=>{throw Error('unexpected network')}};
 vm.createContext(ctx);for(const p of ['reth-data.js','atlas-data.js','atlas.js'])vm.runInContext(fs.readFileSync(path.join(base,p),'utf8'),ctx);
 return {run:s=>vm.runInContext(s,ctx),node,ctx};
}
(async()=>{
 const app=setup();assert.equal(app.run('atlas.files.length'),1283);assert.equal(app.run('new Set(atlas.files.map(f=>f.path)).size'),1283);assert.equal(app.run('atlas.areas.reduce((sum,a)=>sum+a.count,0)'),1283);
 for(const a of app.run('atlas.areas')){app.run(`state.area='${a.id}';state.topic=null;state.folder='';state.query='';state.status='all'`);assert.equal(app.run('filterFiles().length'),a.count)}
 app.run("state.area=null;state.query='transaction';state.status='all'");assert.ok(app.run('filterFiles().length')>10);
 app.run("state.query='';state.folder='crates/engine/';");assert.ok(app.run("filterFiles().every(f=>f.path.startsWith('crates/engine/'))"));
 app.run("state.folder='';state.topic='sync';");assert.ok(app.run('filterFiles().every(f=>topic().areas.includes(f.area))'));
 app.run("selectTopic('boot')");assert.ok(app.node('topic-banner').innerHTML.includes('href="startup.html"'));assert.ok(!app.node('topic-banner').innerHTML.includes('href="zoom.html?area=rpc"'));assert.ok(app.node('topics').innerHTML.includes('● 起動の資料あり'));
 app.run("selectTopic('transaction')");assert.ok(app.node('topic-banner').innerHTML.includes('href="zoom.html?area=rpc"'));assert.ok(!app.node('topic-banner').innerHTML.includes('href="startup.html"'));
 app.run("state.topic=null;state.status='explained';");assert.equal(app.run('filterFiles().length'),app.run('explained.size'));
 const sample='crates/rpc/rpc-eth-api/src/core.rs';await app.run(`openFile('${sample}')`);assert.ok(app.run('source.text.length')>1000);assert.equal(app.run('state.opened.length'),1);assert.ok(app.node('source-lines').innerHTML.includes('data-source-line="100"'));assert.ok(!app.node('source-lines').innerHTML.includes('data-source-line="101"'));
 app.run('source.offset=900;renderSource()');assert.ok(app.node('source-lines').innerHTML.includes('data-source-line="921"'));
 app.node('reading-question').value='失敗時の戻り値を知りたい';app.run('source.selection=[921,923];addQueue()');assert.equal(app.run('state.queue.length'),1);assert.equal(app.run('state.queue[0].lines[0]'),921);
 const uncached=app.run('atlas.files.find(f=>atlas.seed[f.path]===undefined).path');let requested='';app.ctx.fetch=async url=>{requested=url;return {ok:true,headers:{get:()=>null},text:async()=>'<script>alert(1)</script>\nsecond line\n'}};
 await app.run(`openFile(${JSON.stringify(uncached)})`);assert.ok(requested.includes(app.run('atlas.commit')));assert.ok(app.node('source-lines').innerHTML.includes('&lt;script&gt;'));assert.ok(!app.node('source-lines').innerHTML.includes('<script>'));
 const old=app.run('source.path');await app.run("openFile('../../not-in-index.rs')");assert.equal(app.run('source.path'),old);
 console.log('PASS: 1,283 unique indexed files, area partition, topic/path/status filters, startup/transaction topic routes, 100-line windows, queue ranges, pinned on-demand fetch, escaped source, path allowlist');
})().catch(e=>{console.error(e);process.exitCode=1});
