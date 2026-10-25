// Consumer discovery is independent of the public route list. This is a
// mechanical contract/inventory check, never semantic or human approval.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),crypto=require('node:crypto'),cp=require('node:child_process');
const normal=value=>JSON.parse(JSON.stringify(value));
const stable=value=>Array.isArray(value)?value.map(stable):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(key=>[key,stable(value[key])])):value;
const hash=value=>crypto.createHash('sha256').update(typeof value==='string'?value:JSON.stringify(stable(value))).digest('hex');
function validateSource(context,id){
 const s=context?.source;
 if(!s||typeof s.path!=='string'||!s.path.endsWith('.rs')||s.path.startsWith('/')||s.path.split('/').includes('..')||!Number.isInteger(s.start)||!Number.isInteger(s.end)||s.start<1||s.end<s.start||typeof s.code!=='string'||s.code.split('\n').length!==s.end-s.start+1||hash(s.code)!==s.hash)throw Error('Invalid source descriptor: '+id);
 for(const hint of context.lines||[])if(!Number.isInteger(hint.line)||hint.line<s.start||hint.line>s.end||!s.code.split('\n')[hint.line-s.start].includes(hint.match))throw Error('Invalid source hint: '+id);
}
function verifyPinnedContexts({contexts,commit,root,readSource}){
 if(!/^[0-9a-f]{40}$/.test(commit))throw Error('Invalid pinned commit');
 const cache=new Map(),get=p=>{if(!cache.has(p))cache.set(p,readSource?readSource(p,commit):cp.execFileSync('git',['-C',path.join(root,'targets/reth'),'show',commit+':'+p],{encoding:'utf8'}));return cache.get(p);};
 for(const [id,c]of Object.entries(contexts)){validateSource(c,id);const s=c.source,actual=get(s.path).split('\n').slice(s.start-1,s.end).join('\n');if(actual!==s.code)throw Error('Pinned source differs: '+id);}
 return {kind:'pinned-byte-and-anchor-check-only',commit,contexts:Object.keys(contexts).length,files:cache.size};
}
function deriveRustTopics({script,contexts,commit}){
 const sandbox={};sandbox.globalThis=sandbox;vm.runInNewContext(script,sandbox,{timeout:1500});
 const source=sandbox.ReadingLenses;if(!source?.lessons||!source.rustEvidence||!source.rustSupport)throw Error('Rust authoring exports missing');
 const topics={};
 for(const [topic,lessonValue]of Object.entries(source.lessons)){
  const lesson=normal(lessonValue),evidence=normal(source.rustEvidence[topic]||{}),support=normal(source.rustSupport[topic]||[]);
  if(!Array.isArray(lesson.steps)||!lesson.steps.length||new Set(lesson.steps).size!==lesson.steps.length||Object.keys(evidence).some(id=>!lesson.steps.includes(id)))throw Error('Invalid Rust topic steps: '+topic);
  const rows=lesson.steps.map(id=>({id,context:'tx:'+id,...evidence[id]})).concat(support.map(row=>({...row,context:'tx:'+row.id})));
  if(new Set(rows.map(row=>row.context)).size!==rows.length)throw Error('Repeated Rust topic source: '+topic);
  const claimsByContext={};
  for(const row of rows){
   const c=contexts[row.context];validateSource(c,row.context);
   if(!row.purpose?.trim()||!Array.isArray(row.claims)||!row.claims.length)throw Error('Missing Rust purpose/claims: '+topic+'/'+row.context);
   for(const claim of row.claims)if(!Number.isInteger(claim.line)||claim.line<c.source.start||claim.line>c.source.end||!claim.match?.trim()||!claim.text?.trim()||!c.source.code.split('\n')[claim.line-c.source.start].includes(claim.match))throw Error('Rust claim no longer matches pinned range: '+topic+'/'+row.context);
   // Same values as ReadingLenses.rustContextClaims; no paraphrase or generic substitution.
   claimsByContext[row.context]=normal(row.claims);
  }
  topics[topic]={topic,commit,lesson,claimsByContext,readings:rows.map(row=>({context:row.context,title:contexts[row.context].title,purpose:row.purpose,rustTopic:topic,claims:normal(row.claims)})),variants:[null,...lesson.steps],authoring:{path:'local-app/public/lenses.js',kind:'ReadingLenses.lessons/rustEvidence/rustSupport',scriptHash:hash(script)},claimHash:hash({lesson,rows}),reviewStatus:{sourceAnchors:'checked',semantic:'preserved-authoring-requires-independent-review',consumerFit:'pending',displayEquivalence:'not-measured'}};
 }
 return topics;
}
function deriveLegacyDetails({pack,contexts,commit}){
 if(pack.commit!==commit)throw Error('Legacy detail commit differs');
 const fields=['question','subtitle','summary','detail','input','output','side','branch','concept','language','compare','doc'];
 return pack.details.map(detail=>{
  const context='tx:'+detail.id,c=contexts[context];validateSource(c,context);
  if(c.source.path!==detail.path||c.source.start!==detail.start||c.source.end!==detail.end||c.source.hash!==detail.contentHash||c.source.code!==detail.code)throw Error('Legacy detail/source differs: '+detail.id);
  const explanation=Object.fromEntries(fields.filter(k=>detail[k]!==undefined).map(k=>[k,normal(detail[k])]));
  return {id:detail.id,context,title:detail.title,explanation,explanationHash:hash(explanation),reviewStatus:{sourceAnchors:'checked',semantic:'preserved-authoring-requires-independent-review',consumerFit:'pending',displayEquivalence:'not-measured'}};
 });
}
// Scan the production inputs/outputs, rather than consulting routeRegistry to
// decide what counts as a consumer. Exact site counts detect new/copied/dropped
// mounts too. The reviewed footprint is a separate acknowledgement boundary.
function productionFiles(root){
 const result={};
 // Exclude explicit non-production trees, not a closed allow-list of current
 // output folders. A new HTML/JS consumer in a new served folder is discovered.
 const ignored=new Set(['.git','node_modules','targets','work','outputs','test','tests','local-app/test','scripts']);
 const visit=dir=>{for(const e of fs.readdirSync(path.join(root,dir),{withFileTypes:true})){const rel=dir?dir+'/'+e.name:e.name;if(e.isDirectory()){if(!ignored.has(rel)&&!['.git','node_modules'].includes(e.name))visit(rel);}else if(/\.(?:html|js|mjs)$/.test(rel))result[rel]=fs.readFileSync(path.join(root,rel),'utf8');}};
 // Includes portable docs/reading-guide.html and its own copied renderer.
 visit('');
 return result;
}
function discoverConsumerSites(files){
 const counts=new Map(),literalContexts=new Set(),fileDigests={},metadataFiles=[];
 const add=(file,type,value)=>{const key=JSON.stringify([file,type,value]);counts.set(key,(counts.get(key)||0)+1);};
 for(const [file,text]of Object.entries(files)){
  // Only an entire, strict JSON assignment is pure metadata. A suffix is never
  // an exemption: adding executable code makes this a content-reviewed file.
  // Generated help carries this inventory report, so hashing its own complete
  // payload would create a self-reference/fixed-point requirement. Validate its
  // pure-data shape here; authored context/claim/route checks remain separate.
  const assignment=text.match(/^\s*window\.([A-Z][A-Z0-9_]*)\s*=\s*([\s\S]*);\s*$/);
  if(assignment){try{const value=JSON.parse(assignment[2]);metadataFiles.push({file,global:assignment[1],classification:'strict-json-assignment-only',payloadHash:assignment[1]==='READING_HELP_DATA'?'self-generated-help:checked-via-authored-inputs-contexts-and-routes':hash(value),semantic:'validated-separately-not-approved-here'});continue;}catch{}}
  // This catches reuse of an existing alias/computed consumer even if the
  // recognizable symbol/API sites below are unchanged.
  fileDigests[file]=hash(text);
  // Keep symbol references too: an aliased/computed API use must not disappear
  // merely because it is not the common ReadingHelp.mount(...) spelling.
  for(const m of text.matchAll(/\b(?:ReadingHelp|ReadingLenses)\b/g))add(file,'consumer-symbol',m[0]);
  for(const m of text.matchAll(/\bdata-(?:reading|help|lesson|file-role|component|area|guide|reference)[a-z-]*/g))add(file,'attribute',m[0]);
  for(const m of text.matchAll(/\bdataset\.((?:reading|help|lesson|fileRole|component|areaReading|guide|reference)[A-Za-z0-9]*)/g))add(file,'dataset',m[1]);
  for(const m of text.matchAll(/\bReadingHelp(?:\?\.)?\.?([A-Za-z_$][\w$]*)\s*(?:\?\.)?\s*\(/g))add(file,'help-api',m[1]);
  for(const m of text.matchAll(/\bReadingLenses(?:\?\.)?\.?(render|rustContextClaims)\s*(?:\?\.)?\s*\(/g))add(file,'rust-api',m[1]);
  for(const m of text.matchAll(/data-reading-help=["']([a-z][\w-]*:[\w:-]+)["']/g)){literalContexts.add(m[1]);add(file,'literal-context',m[1]);}
  if(/forSource\(/.test(text))add(file,'lookup','forSource');
  if(/pack\.details|P\.details/.test(text))add(file,'lookup','pack.details');
  if(/rustEvidence|rustSupport|rustContextClaims/.test(text))add(file,'lookup','rust-authoring-or-overlay');
 }
 return {version:2,sites:[...counts].sort(([a],[b])=>a.localeCompare(b)).map(([key,count])=>{const [file,type,value]=JSON.parse(key);return {file,type,value,count};}),literalContexts:[...literalContexts].sort(),fileDigests:Object.fromEntries(Object.entries(fileDigests).sort(([a],[b])=>a.localeCompare(b))),metadataFiles:metadataFiles.sort((a,b)=>a.file.localeCompare(b.file))};
}
function readReviewInputs(root){
 // These are the actual meaning-bearing JSON contracts read by build-help,
 // including fields that are not copied into a route's short introduction.
 // The inventory boundary itself is deliberately not one of its own inputs.
 const files=['reading-target.json','ui/reading-help-content.json','ui/area-source-excerpts.json','ui/lesson-code-links.json','ui/journey-code-links.json','ui/operation-code-links.json','ui/file-role-code-links.json','ui/component-code-links.json','ui/area-readings.json','local-app/startup-guide.json','local-app/annotations.json'];
 return Object.fromEntries(files.map(file=>{const text=fs.readFileSync(path.join(root,file),'utf8');JSON.parse(text);return [file,hash(text)];}));
}
function inventoryFingerprint({contexts,rustTopics,legacyDetails,sites,registry,reviewInputs}){
 if(!registry||!reviewInputs)throw Error('Purpose payload and review inputs are required');
 return {version:3,kind:'proposed-review-boundary-not-approval',sites:sites.sites,fileDigests:sites.fileDigests,metadataFiles:sites.metadataFiles,reviewInputs,routePayloads:Object.fromEntries(registry.routes.map(row=>[row.id,hash(row)]).sort(([a],[b])=>a.localeCompare(b))),contexts:Object.fromEntries(Object.entries(contexts).sort(([a],[b])=>a.localeCompare(b)).map(([id,c])=>[id,{sourceHash:c.source.hash,authoredHelpHash:hash(Object.fromEntries(Object.entries(c).filter(([k])=>k!=='source')))}])),rustTopics:Object.fromEntries(Object.entries(rustTopics).map(([id,t])=>[id,hash({claimHash:t.claimHash,lesson:t.lesson,readings:t.readings,claimsByContext:t.claimsByContext,variants:t.variants})])),legacyDetails:Object.fromEntries(legacyDetails.map(row=>[row.id,hash(row.explanation)]))};
}
function verifyConsumerInventory({contexts,rustTopics,legacyDetails,sites,baseline,registry,reviewInputs}){
 for(const id of sites.literalContexts)if(!contexts[id])throw Error('Unknown literal consumer context: '+id);
 const expected=inventoryFingerprint({contexts,rustTopics,legacyDetails,sites,registry,reviewInputs});
 for(const key of ['sites','fileDigests','metadataFiles','reviewInputs','contexts','rustTopics','legacyDetails'])if(JSON.stringify(expected[key])!==JSON.stringify(baseline[key]))throw Error('Consumer inventory requires independent review: '+key);
 const actual=new Map(registry.routes.map(row=>[row.id,row]));
 for(const [id,c]of Object.entries(contexts))if(!registry.files[c.source.path]?.contexts.includes(id))throw Error('Generic consumer missing from index: '+id);
 for(const row of legacyDetails){const route=actual.get('legacy-detail:'+row.id);if(!route||route.kind!=='legacy-detail'||JSON.stringify(route.legacy)!==JSON.stringify({title:row.title,...row.explanation})||route.readings[0]?.context!==row.context)throw Error('Legacy consumer missing/different: '+row.id);}
 for(const [topic,t]of Object.entries(rustTopics))for(const selectedStep of t.variants){
  const id='rust:'+topic+(selectedStep?':'+selectedStep:''),route=actual.get(id),expectedRows=[...t.readings];
  if(selectedStep)expectedRows.sort((a,b)=>(b.context==='tx:'+selectedStep)-(a.context==='tx:'+selectedStep));
  if(!route||route.kind!=='rust-topic'||route.topic!==topic||route.selectedStep!==selectedStep||JSON.stringify(route.lesson)!==JSON.stringify(t.lesson)||JSON.stringify(route.readings.map(r=>({context:r.context,rustTopic:r.rustTopic,claims:r.claims})))!==JSON.stringify(expectedRows.map(r=>({context:r.context,rustTopic:r.rustTopic,claims:r.claims}))))throw Error('Rust purpose consumer missing/different: '+id);
 }
 if(JSON.stringify(expected.routePayloads)!==JSON.stringify(baseline.routePayloads))throw Error('Consumer inventory requires independent review: routePayloads');
 return {kind:'mechanical-consumer-closure-only',sites:sites.sites.length,genericContexts:Object.keys(contexts).length,legacyOwners:legacyDetails.length,rustTopics:Object.keys(rustTopics).length,rustVariants:Object.values(rustTopics).reduce((n,t)=>n+t.variants.length-1,0),reviewInputs:Object.keys(reviewInputs).length,semantic:'not-approved-by-this-check',displayEquivalence:'not-measured'};
}
module.exports={hash,validateSource,verifyPinnedContexts,deriveRustTopics,deriveLegacyDetails,productionFiles,discoverConsumerSites,readReviewInputs,inventoryFingerprint,verifyConsumerInventory};
