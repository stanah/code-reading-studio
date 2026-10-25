// Build source-backed hints from the same pinned Git objects as the reading guides.
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),cp=require('node:child_process'),crypto=require('node:crypto');
const {buildRouteRegistry}=require('./reading-route-registry.cjs');
const {deriveRustTopics,deriveLegacyDetails,productionFiles,discoverConsumerSites,readReviewInputs,verifyConsumerInventory}=require('./reading-consumer-inventory.cjs');
const root=path.resolve(__dirname,'..');const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const target=JSON.parse(read('reading-target.json')),authored=JSON.parse(read('ui/reading-help-content.json')),guide=JSON.parse(read('local-app/startup-guide.json')),ctx={window:{}};
vm.runInNewContext(read('dist/reth-data.js'),ctx);
const areaSources=JSON.parse(read('ui/area-source-excerpts.json'));const contexts={};
for(const [id,hints] of Object.entries(authored.contexts)){
 const [kind,key]=id.split(':');const item=kind==='tx'?([...ctx.window.RETH_PACK.steps,...ctx.window.RETH_PACK.details].find(s=>s.id===key)||areaSources[key]):kind==='area'?areaSources[key]:guide.steps.find(s=>s.id===key);
 if(!item)throw Error('Unknown hint context '+id);
 const source=item.source||item;
 const full=cp.execFileSync('git',['-C',path.join(root,'targets/reth'),'show',target.commit+':'+source.path],{encoding:'utf8'});
 const code=full.split('\n').slice(source.start-1,source.end).join('\n');
 const hash=crypto.createHash('sha256').update(code).digest('hex');if(hash!==(source.contentHash||source.hash))throw Error('Source hash differs: '+id);
 for(const hint of hints.lines){if(hint.line<source.start||hint.line>source.end||!full.split('\n')[hint.line-1].includes(hint.match))throw Error('Hint no longer matches source: '+id+' L'+hint.line);}
 for(const term of hints.terms)if(!authored.terms[term])throw Error('Unknown term '+term);
 for(const [line,tokens] of Object.entries(hints.tokenHints||{}))for(const [token,term] of Object.entries(tokens)){if(Number(line)<source.start||Number(line)>source.end||!full.split('\n')[Number(line)-1].includes(token)||!authored.terms[term])throw Error('Invalid token hint: '+id+' L'+line);}
 contexts[id]={...hints,title:item.title,source:{path:source.path,start:source.start,end:source.end,hash,code,url:source.sourceUrl||source.url}};
}
// Resolve every displayed context to the nearest owning Cargo package.
// Lesson entries keep authored reading paths; ownership is derived independently.
const lessonConfig=JSON.parse(read('ui/lesson-code-links.json')),courseContext={window:{}};
vm.runInNewContext(read('ui/learning-content.js'),courseContext);
const lessons=courseContext.window.READING_COURSE.lessons,tracked=new Set(cp.execFileSync('git',['-C',path.join(root,'targets/reth'),'ls-tree','-r','--name-only',target.commit],{encoding:'utf8'}).trim().split('\n'));
if(lessonConfig.length!==lessons.length||new Set(lessonConfig.map(r=>r.lesson)).size!==lessons.length||!lessons.every(l=>lessonConfig.some(r=>r.lesson===l.id)))throw Error('Every lesson needs one authored reading path');
const annotations=JSON.parse(read('local-app/annotations.json'));if(annotations.commit!==target.commit)throw Error('Stale source area map');
const manifests=new Map(),sourceOwners={};
for(const [id,c] of Object.entries(contexts)){
 let dir=path.posix.dirname(c.source.path);while(dir!=='.'&&!tracked.has(dir+'/Cargo.toml'))dir=path.posix.dirname(dir);
 const manifest=dir+'/Cargo.toml';if(!tracked.has(manifest))throw Error('Owning crate missing: '+c.source.path);
 if(!manifests.has(manifest)){
  const text=cp.execFileSync('git',['-C',path.join(root,'targets/reth'),'show',target.commit+':'+manifest],{encoding:'utf8'}),packageSection=text.split('[package]')[1]?.split(/\n\[/)[0],name=packageSection?.match(/^name\s*=\s*"([^"]+)"/m)?.[1];
  if(!name)throw Error('Cargo package name missing: '+manifest);
  manifests.set(manifest,{id:manifest,name,hash:crypto.createHash('sha256').update(text).digest('hex'),url:'https://github.com/'+target.repository+'/tree/'+target.commit+'/'+dir});
 }
 const area=annotations.pathAreas[c.source.path];if(!area)throw Error('Source area missing: '+c.source.path);
 sourceOwners[id]={area,crate:manifests.get(manifest)};
}
const lessonLinks=lessonConfig.map(r=>{
 if(!contexts[r.context]||!r.title||!r.why||!r.scope||!Array.isArray(r.readings)||r.readings.length<2)throw Error('Invalid lesson reading path '+r.lesson);
 if(new Set(r.readings.map(x=>x.context)).size!==r.readings.length)throw Error('Duplicate context in lesson '+r.lesson);
 for(const reading of r.readings)if(!contexts[reading.context]||!['title','purpose','connection'].every(k=>typeof reading[k]==='string'&&reading[k].trim()))throw Error('Invalid lesson stage '+r.lesson+':'+reading.context);
 return {...r,...sourceOwners[r.context]};
});
const journeyLinks=JSON.parse(read('ui/journey-code-links.json'));
if(new Set(journeyLinks.map(j=>j.id)).size!==journeyLinks.length)throw Error('Duplicate journey reading path');
for(const j of journeyLinks){
 if(!['id','title','goal','scope'].every(k=>typeof j[k]==='string'&&j[k].trim())||!Array.isArray(j.readings)||j.readings.length<2)throw Error('Invalid journey reading path '+j.id);
 if(new Set(j.readings.map(r=>r.context)).size!==j.readings.length)throw Error('Duplicate journey source '+j.id);
 for(const reading of j.readings)if(!contexts[reading.context]||!['title','purpose','connection'].every(k=>typeof reading[k]==='string'&&reading[k].trim()))throw Error('Invalid journey stage '+j.id+':'+reading.context);
}
const validatePath=(row,label)=>{
 if(!['goal','scope'].every(k=>typeof row[k]==='string'&&row[k].trim())||!Array.isArray(row.readings)||!row.readings.length)throw Error('Invalid reading path '+label);
 if(new Set(row.readings.map(r=>r.context)).size!==row.readings.length)throw Error('Duplicate reading source '+label);
 for(const r of row.readings)if(!contexts[r.context]||!sourceOwners[r.context]||!['title','purpose','connection'].every(k=>typeof r[k]==='string'&&r[k].trim()))throw Error('Invalid reading source '+label+':'+r.context);
 for(let i=0;i<row.readings.length;i++)for(let j=i+1;j<row.readings.length;j++){
  const a=contexts[row.readings[i].context].source,b=contexts[row.readings[j].context].source;
  if(a.path===b.path&&a.start<=b.end&&b.start<=a.end)throw Error('Repeated original source lines in '+label+':'+row.readings[i].context+'/'+row.readings[j].context);
 }
};
const fileRoleLinks=JSON.parse(read('ui/file-role-code-links.json')),rolePaths=Object.keys({...annotations.roles,...guide.roles}).sort();
if(JSON.stringify(fileRoleLinks.map(r=>r.path).sort())!==JSON.stringify(rolePaths))throw Error('Every merged local file role needs exactly one reading path');
for(const r of fileRoleLinks){validatePath(r,r.path);if(!r.readings.some(s=>contexts[s.context].source.path===r.path))throw Error('File role needs source from its actual file: '+r.path);}
vm.runInNewContext(read('dist/drill-data.js'),ctx);
const componentLinks=JSON.parse(read('ui/component-code-links.json')),componentKeys=['interface','helpers','implementation','integration'].map(c=>'rpc:'+c).sort();
if(JSON.stringify(componentLinks.map(c=>c.area+':'+c.component).sort())!==JSON.stringify(componentKeys))throw Error('Every authored RPC component needs exactly one reading path');
for(const r of componentLinks){
 validatePath(r,r.area+':'+r.component);
 const group=ctx.window.RETH_DRILL.components[r.area]?.find(c=>c.id===r.component);
 if(!group||!r.readings.some(s=>group.files.includes(contexts[s.context].source.path)))throw Error('Component needs a source in its actual group: '+r.component);
}
const operationLinks=JSON.parse(read('ui/operation-code-links.json')),operationIds=['rpc','recover','submit','queue','batch','pool'].sort(),sendContexts=new Set(lessonLinks.find(l=>l.lesson==='send').readings.map(r=>r.context));
if(JSON.stringify(operationLinks.map(r=>r.id).sort())!==JSON.stringify(operationIds))throw Error('All six canonical operations need exactly one path');
for(const r of operationLinks){
 if(!['title','scope'].every(k=>typeof r[k]==='string'&&r[k].trim())||!Array.isArray(r.contexts)||!r.contexts.length||new Set(r.contexts).size!==r.contexts.length||r.contexts.some(c=>!sendContexts.has(c)||!contexts[c]))throw Error('Invalid canonical operation '+r.id);
 if(!r.connections||Array.isArray(r.connections)||Object.entries(r.connections).some(([id,value])=>!r.contexts.includes(id)||typeof value!=='string'||!value.trim()))throw Error('Invalid operation connection '+r.id);
}
for(const row of fileRoleLinks)for(const operation of operationLinks){
 if(contexts['tx:'+operation.id]?.source.path===row.path&&operation.contexts.some(id=>!row.readings.some(r=>r.context===id)))throw Error('File role must contain its complete operation path: '+row.path+'/'+operation.id);
}
const startupScopes=guide.readingScopes;
if(!startupScopes||JSON.stringify(Object.keys(startupScopes.steps||{}).sort())!==JSON.stringify(guide.steps.map(s=>s.id).sort())||JSON.stringify(Object.keys(startupScopes.loops||{}).sort())!==JSON.stringify(guide.loops.map((_,i)=>String(i+1)).sort())||startupScopes.staticStartup?.length!==7||startupScopes.staticRuntime?.length!==4)throw Error('Every local/static startup scope needs an authored source sequence');
const startupSequences=[...Object.values(startupScopes.steps),...Object.values(startupScopes.loops),...startupScopes.staticStartup.map(s=>s.readings),...startupScopes.staticRuntime.map(s=>s.readings)];
for(const [i,rows] of startupSequences.entries()){
 if(!Array.isArray(rows)||!rows.length||new Set(rows.map(r=>r.context)).size!==rows.length||rows.some(r=>!contexts[r.context]||!sourceOwners[r.context]||typeof r.purpose!=='string'||!r.purpose.trim()))throw Error('Invalid startup source sequence '+i);
 for(let a=0;a<rows.length;a++)for(let b=a+1;b<rows.length;b++){const x=contexts[rows[a].context].source,y=contexts[rows[b].context].source;if(x.path===y.path&&x.start<=y.end&&y.start<=x.end)throw Error('Repeated original lines in startup sequence '+i);}
}
const areaReadings=JSON.parse(read('ui/area-readings.json'));
for(const row of areaReadings)for(const [part,label] of [[row,row.area],[row.followup,row.area+':followup']])if(part?.readings)validatePath({goal:part.question,scope:part.boundary,readings:part.readings},'area:'+label);
// A non-call relation must be anchored at both fixed sources and must not
// promise that the peer is already mounted by every possible consumer.
for(const [id,c]of Object.entries(contexts))for(const relation of c.relatedReadings||[]){
 const targetContext=contexts[relation.context];if(!targetContext||relation.relationship!=='related-source'||!relation.title?.trim()||!relation.purpose?.trim())throw Error('Invalid related reading: '+id);
 for(const [side,context]of [['from',c],['to',targetContext]]){const anchor=relation.evidence?.[side];if(!anchor||anchor.line<context.source.start||anchor.line>context.source.end||!context.source.code.split('\n')[anchor.line-context.source.start].includes(anchor.match))throw Error('Related reading anchor differs: '+id+'/'+side);}
}
const rustTopics=deriveRustTopics({script:read('local-app/public/lenses.js'),contexts,commit:target.commit});
const legacyDetails=deriveLegacyDetails({pack:ctx.window.RETH_PACK,contexts,commit:target.commit});
const routeRegistry=buildRouteRegistry({commit:target.commit,contexts,lessonLinks,journeyLinks,fileRoleLinks,componentLinks,operationLinks,areaReadings,guide,rustTopics,legacyDetails});
const sites=discoverConsumerSites(productionFiles(root)),consumerInventory=verifyConsumerInventory({contexts,rustTopics,legacyDetails,sites,baseline:JSON.parse(read('ui/reading-consumer-sites.json')),registry:routeRegistry,reviewInputs:readReviewInputs(root)});
const output='window.READING_HELP_DATA = '+JSON.stringify({commit:target.commit,version:target.version,terms:authored.terms,contexts,sourceOwners,lessonLinks,journeyLinks,fileRoleLinks,componentLinks,operationLinks,areaReadings,routeRegistry,rustTopics,legacyDetails,consumerInventory})+';\n';
for(const dir of ['dist','local-app/public'])fs.writeFileSync(path.join(root,dir,'reading-help-data.js'),output);
console.log(`Built ${Object.keys(contexts).length} contexts with ${Object.values(contexts).reduce((n,c)=>n+c.lines.length,0)} source-checked line hints; ${lessonLinks.reduce((n,l)=>n+l.readings.length,0)} lesson reading stages; ${journeyLinks.reduce((n,j)=>n+j.readings.length,0)} journey stages`);
