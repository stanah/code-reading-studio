import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,mkdtempSync,mkdirSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import vm from 'node:vm';
const require=createRequire(import.meta.url),root=fileURLToPath(new URL('../../',import.meta.url));
const m=require('../../scripts/reading-consumer-inventory.cjs'),{buildRouteRegistry}=require('../../scripts/reading-route-registry.cjs');
const read=p=>readFileSync(new URL('../../'+p,import.meta.url),'utf8'),clone=x=>JSON.parse(JSON.stringify(x));
const x={};x.window=x;vm.createContext(x);vm.runInContext(read('dist/reading-help-data.js'),x);vm.runInContext(read('dist/reth-data.js'),x);
const help=clone(x.READING_HELP_DATA),pack=clone(x.RETH_PACK),guide=JSON.parse(read('local-app/startup-guide.json')),script=read('local-app/public/lenses.js');
const rustTopics=m.deriveRustTopics({script,contexts:help.contexts,commit:help.commit}),legacyDetails=m.deriveLegacyDetails({pack,contexts:help.contexts,commit:help.commit});
const reviewInputs=m.readReviewInputs(root),sites=m.discoverConsumerSites(m.productionFiles(root)),baseline=JSON.parse(read('ui/reading-consumer-sites.json'));
const registry=buildRouteRegistry({...help,guide,rustTopics,legacyDetails});
const verify=(changes={})=>m.verifyConsumerInventory({contexts:help.contexts,rustTopics,legacyDetails,sites,baseline,registry,reviewInputs,...changes});

test('outside-in footprint and reverse consumers close without declaring semantic/UI approval',()=>{
 const report=verify();assert.equal(report.genericContexts,Object.keys(help.contexts).length);assert.equal(report.legacyOwners,pack.details.length);
 assert.equal(report.rustTopics,Object.keys(x.READING_HELP_DATA.rustTopics).length);
 assert.equal(report.semantic,'not-approved-by-this-check');assert.equal(report.displayEquivalence,'not-measured');
 for(const [id,c]of Object.entries(help.contexts))assert.ok(registry.files[c.source.path].contexts.includes(id),id);
});
test('all Rust wording, TS contrast and context claims derive unchanged from one authoring module',()=>{
 const source={};source.globalThis=source;vm.runInNewContext(script,source);
 for(const [topic,t]of Object.entries(rustTopics)){
  assert.deepEqual(t.lesson,clone(source.ReadingLenses.lessons[topic]));
  for(const row of t.readings)assert.deepEqual(t.claimsByContext[row.context],clone(source.ReadingLenses.rustContextClaims(topic,row.context)));
  for(const step of t.lesson.steps){const route=registry.routes.find(r=>r.id==='rust:'+topic+':'+step);assert.equal(route.readings[0].context,'tx:'+step);assert.equal(route.readings.length,t.readings.length);}
 }
});
test('legacy typed routes retain every original explanation field rather than only source bytes',()=>{
 for(const detail of legacyDetails){const route=registry.routes.find(r=>r.id==='legacy-detail:'+detail.id);assert.deepEqual(route.legacy,{title:detail.title,...detail.explanation});for(const key of ['input','output','detail','side','branch'])assert.equal(route.legacy[key],pack.details.find(d=>d.id===detail.id)[key]);}
});
test('a new consumer in an unrelated production file fails before registry can exclude it',()=>{
 const files=m.productionFiles(root);files['dist/new-consumer.js']='const h = ReadingHelp; h.mount(node); node.innerHTML = `<div data-reading-help="tx:pool-test"></div>`;';
 assert.throws(()=>verify({sites:m.discoverConsumerSites(files)}),/inventory requires independent review: sites/);
});
test('discovery does not restrict itself to today\'s output folder names',()=>{
 const dir=mkdtempSync(join(tmpdir(),'reading-consumer-fixture-'));
 try{mkdirSync(join(dir,'new-served-folder'));writeFileSync(join(dir,'new-served-folder','entry.html'),'<div data-reading-help="tx:pool-test"></div>');
 const found=m.productionFiles(dir);assert.ok(found['new-served-folder/entry.html']);
 assert.throws(()=>verify({sites:m.discoverConsumerSites(found)}),/inventory requires independent review: sites/);
 }finally{rmSync(dir,{recursive:true,force:true});}
});
test('reusing an existing alias in the same file is detected by the content review boundary',()=>{
 const files=m.productionFiles(root);files['dist/alias.js']='const h=ReadingHelp; h.mount(one);';
 const first=m.discoverConsumerSites(files),reviewed={...baseline,sites:first.sites,fileDigests:first.fileDigests,metadataFiles:first.metadataFiles};
 files['dist/alias.js']+=' h.mount(two);';const second=m.discoverConsumerSites(files);
 assert.deepEqual(second.sites,first.sites,'this was the failed regex-only negative case');
 assert.throws(()=>verify({sites:second,baseline:reviewed}),/independent review: fileDigests/);
 const reviewedSecond={...reviewed,fileDigests:second.fileDigests};
 assert.throws(()=>verify({sites:first,baseline:reviewedSecond}),/independent review: fileDigests/,'deleting an existing alias mount also requires review');
});
test('an executable consumer named course-data.js is not excluded by its suffix',()=>{
 const dir=mkdtempSync(join(tmpdir(),'reading-data-suffix-fixture-'));
 try{mkdirSync(join(dir,'new-served-folder'));writeFileSync(join(dir,'new-served-folder','course-data.js'),'ReadingHelp.mount(node);');
 const files=m.productionFiles(dir),sites=m.discoverConsumerSites(files);assert.ok(files['new-served-folder/course-data.js']);assert.ok(sites.fileDigests['new-served-folder/course-data.js']);
 assert.throws(()=>verify({sites}),/inventory requires independent review/);
 }finally{rmSync(dir,{recursive:true,force:true});}
});
test('pure generated JSON validity is separate from consumer code and avoids a self-digest cycle',()=>{
 const a=m.discoverConsumerSites({'dist/reading-help-data.js':'window.READING_HELP_DATA = {"consumerInventory":{"sites":1}};'});
 const b=m.discoverConsumerSites({'dist/reading-help-data.js':'window.READING_HELP_DATA = {"consumerInventory":{"sites":999}};'});
 assert.deepEqual(a,b,'metadata classification is not semantic or byte-equivalence approval');assert.equal(a.metadataFiles.length,1);assert.equal(Object.keys(a.fileDigests).length,0);
 const code=m.discoverConsumerSites({'dist/reading-help-data.js':'window.READING_HELP_DATA = {}; ReadingHelp.mount(node);'});
 assert.equal(code.metadataFiles.length,0);assert.ok(code.fileDigests['dist/reading-help-data.js']);
});
test('an unknown literal context is distinct from a reviewed generic source and is rejected',()=>{
 const files=m.productionFiles(root);files['dist/new-consumer.js']='<div data-reading-help="tx:not-authored"></div>';
 assert.throws(()=>verify({sites:m.discoverConsumerSites(files)}),/Unknown literal consumer context/);
});
test('a new Rust purpose cannot silently inherit generic-source approval',()=>{
 const changed=clone(rustTopics);changed.newPurpose={...clone(changed.borrow),topic:'newPurpose'};
 assert.throws(()=>verify({rustTopics:changed}),/inventory requires independent review: rustTopics/);
});
test('a changed claim on an existing source requires review even when its line anchor still matches',()=>{
 const changed=clone(rustTopics);changed.borrow.claimHash='new authored purpose';
 assert.throws(()=>verify({rustTopics:changed}),/inventory requires independent review: rustTopics/);
});
test('dropping one generic range, one legacy route, or one Rust start variant fails inverse coverage',()=>{
 const a=clone(registry),c=help.contexts['area:rpc-recovery'];a.files[c.source.path].contexts=a.files[c.source.path].contexts.filter(id=>id!=='area:rpc-recovery');assert.throws(()=>verify({registry:a}),/Generic consumer missing/);
 const b=clone(registry);b.routes=b.routes.filter(r=>r.id!=='legacy-detail:pool-test');assert.throws(()=>verify({registry:b}),/Legacy consumer missing/);
 const z=clone(registry);z.routes=z.routes.filter(r=>r.id!=='rust:trait:recover');assert.throws(()=>verify({registry:z}),/Rust purpose consumer missing/);
});
test('a generic Rust route with lost topic claims fails even if source rows are identical',()=>{
 const changed=clone(registry),route=changed.routes.find(r=>r.id==='rust:borrow');delete route.readings[0].claims;
 assert.throws(()=>verify({registry:changed}),/Rust purpose consumer missing/);
});
test('losing a purpose type or its language/TS metadata fails even with all original sources',()=>{
 const wrongKind=clone(registry);wrongKind.routes.find(r=>r.id==='rust:borrow').kind='operation';assert.throws(()=>verify({registry:wrongKind}),/Rust purpose consumer missing/);
 const lostLesson=clone(registry);delete lostLesson.routes.find(r=>r.id==='rust:borrow').lesson.ts;assert.throws(()=>verify({registry:lostLesson}),/Rust purpose consumer missing/);
 const lostLegacy=clone(registry);delete lostLegacy.routes.find(r=>r.id==='legacy-detail:pool-test').legacy.language;assert.throws(()=>verify({registry:lostLegacy}),/Legacy consumer missing/);
});
test('old route goals and stage purposes cannot bypass the generated-metadata review boundary',()=>{
 const changed=clone(registry);changed.routes.find(r=>r.kind==='file-role').goal='unreviewed file-role claim';changed.routes.find(r=>r.kind==='lesson').readings[0].purpose='unreviewed lesson claim';
 assert.throws(()=>verify({registry:changed}),/independent review: routePayloads/);
 const inputChange={...reviewInputs,'local-app/startup-guide.json':'unreviewed action claim'};
 assert.throws(()=>verify({reviewInputs:inputChange}),/independent review: reviewInputs/);
});
test('invalid source input rejection is separate from consumer completeness',()=>{
 assert.throws(()=>m.validateSource({source:{path:'fake.rs',start:1,end:1,code:'fake',hash:'not-a-hash'}},'fake'),/Invalid source descriptor/);
 const c=clone(help.contexts['tx:rpc']);c.source.code='not the pinned body';c.source.start=1;c.source.end=1;c.source.hash=m.hash(c.source.code);c.lines=[];
 assert.throws(()=>m.verifyPinnedContexts({contexts:{fake:c},commit:help.commit,readSource:()=> 'actual pinned source'}),/Pinned source differs/);
});
test('processor Future/output and both Pending branches remain in every relevant source consumer',()=>{
 for(const id of ['tx:batch-runner','area:send-receive']){
  const c=help.contexts[id];assert.ok(c.source.start<=108&&c.source.end>=136,id+' whole Future impl');
  assert.match(c.source.code,/impl<Pool> Future for BatchTxProcessor<Pool>/);assert.match(c.source.code,/type Output = \(\);/);
  assert.ok(c.lines.some(h=>h.line===119&&h.explanation.includes('その場')||h.line===119&&h.explanation.includes('この行')));
  assert.ok(c.lines.some(h=>h.line===133&&h.explanation.includes('Ready')&&h.explanation.includes('buf')));
 }
 const claim=rustTopics.future.claimsByContext['tx:batch-runner'].find(h=>h.line===114).text;
 for(const token of ['L119','ready!','Pending','buf','L133'])assert.ok(claim.includes(token));
});
test('body fetching shows its Future alias, concrete Output and the distinct comparison impl',()=>{
 const c=help.contexts['area:journey-sync-fetch-client'];assert.ok(c.source.start<=78&&c.source.end>=125);
 for(const token of ['type FetchClientFuture<T>','HeadersClient for FetchClient','BodiesClient for FetchClient','type Output = FetchClientFuture','Either::Right(future::err(RequestError::ChannelClosed))'])assert.ok(c.source.code.includes(token));
 assert.ok(c.lines.some(h=>h.line===80&&h.explanation.includes('比較')));assert.ok(c.lines.some(h=>h.line===122&&h.explanation.includes('Future')));
});
