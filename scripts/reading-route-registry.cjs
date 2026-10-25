// Public availability includes direct, legacy, Rust-purpose and generic source consumers.
// File/range availability does not certify semantic or human understanding.
const {validateSource}=require('./reading-consumer-inventory.cjs');
// A file entry means that selected ranges have help; it is not a whole-file review.
function buildRouteRegistry({commit,contexts,lessonLinks,journeyLinks,operationLinks,fileRoleLinks,componentLinks,areaReadings,guide,legacyDetails,rustTopics}){
 if(guide.commit!==commit)throw Error('Guide/public reading registry commit differs');
 if(!Array.isArray(legacyDetails)||!legacyDetails.length||!rustTopics||!Object.keys(rustTopics).length)throw Error('Actual legacy/Rust consumer inputs are required');
 for(const [id,c]of Object.entries(contexts))validateSource(c,id);
 const routes=[],files={},send=lessonLinks.find(r=>r.lesson==='send');
 const stages=rows=>rows.map(row=>{
  const c=contexts[row.context];if(!c)throw Error('Registry source missing: '+row.context);
  return {...row,title:row.title||c.title,purpose:row.purpose||c.intro||'',connection:row.connection||''};
 });
 const add=(id,kind,key,title,rows,meta={})=>{
  if(routes.some(r=>r.id===id))throw Error('Duplicate public reading route '+id);
  const readings=stages(rows);if(!readings.length)throw Error('Empty public reading route '+id);
  if(new Set(readings.map(r=>r.context)).size!==readings.length)throw Error('Duplicate route context '+id);
  routes.push({id,kind,key,title,...meta,context:readings[0].context,readings});
 };
 const operationRows=r=>r.contexts.map(id=>{
  const stage=send.readings.find(s=>s.context===id);if(!stage)throw Error('Operation source is outside send: '+id);
  return {...stage,connection:r.connections?.[id]||stage.connection};
 });
 for(const r of lessonLinks)add('lesson:'+r.lesson,'lesson',r.lesson,r.title,r.readings,{goal:r.why,scope:r.scope,phases:r.phases,origin:{lesson:r.lesson}});
 for(const r of journeyLinks)add('journey:'+r.id,'journey',r.id,r.title,r.readings,{goal:r.goal,scope:r.scope,origin:{journey:r.id}});
 for(const r of operationLinks)add('operation:'+r.id,'operation',r.id,r.title,operationRows(r),{goal:r.title,scope:r.scope,origin:{step:r.id}});
 for(const r of fileRoleLinks)add('file-role:'+r.path,'file-role',r.path,r.goal,r.readings,{goal:r.goal,scope:r.scope,origin:{file:r.path}});
 for(const r of componentLinks)add('component:'+r.area+':'+r.component,'component',r.component,r.goal,r.readings,{goal:r.goal,scope:r.scope,origin:{area:r.area,component:r.component}});
 for(const r of areaReadings){
  for(const [part,value] of [['main',r],['followup',r.followup]])if(value){
   const rows=value.readings?.length?value.readings:part==='main'&&r.area==='pool'?operationRows(operationLinks.find(o=>o.id==='pool')):[{context:value.context,purpose:value.role}];
   add('area:'+r.area+':'+part,'area',r.area,value.question,rows,{goal:value.role,scope:value.boundary,origin:{area:r.area,part}});
  }
  if(r.extraContext){
   // The existing pool surface references the full stateless implementation, not a duplicate excerpt.
   const context=r.area==='pool'?'area:send-stateless':r.extraContext;
   add('area:'+r.area+':extra','area-extra',r.area,'検証条件の一例を原文で確かめる',[{context}],{origin:{area:r.area,part:'extra'}});
  }
 }
 const scope=guide.readingScopes,steps=new Map(guide.steps.map(s=>[s.id,s]));
 for(const [id,rows] of Object.entries(scope.steps)){
  const s=steps.get(id);add('guide:step:'+id,'guide-step',id,s.title,rows,{goal:s.question,scope:s.boundary,origin:{guideStep:id}});
 }
 for(const [id,rows] of Object.entries(scope.loops)){
  const loop=guide.loops[Number(id)-1];add('guide:loop:'+id,'guide-loop',id,loop.name,rows,{goal:loop.role,scope:[loop.trigger,loop.wait].filter(Boolean).join(' '),origin:{guideLoop:id}});
 }
 for(const [name,kind] of [['staticStartup','guide-startup'],['staticRuntime','guide-runtime']])scope[name].forEach((s,i)=>{
  const local=s.localSteps.map(id=>steps.get(id));
  add('guide:'+name+':'+(i+1),kind,String(i+1),local.map(s=>s.title).join(' / '),s.readings,{goal:local.map(s=>s.question).join(' '),scope:local.map(s=>s.boundary).join(' '),origin:{guideSection:name,section:String(i+1)}});
 });
 // Preserve complete legacy fields. A one-source detail is not silently upgraded
 // to a complete modern operation path by this mechanical derivation.
 for(const detail of legacyDetails)add('legacy-detail:'+detail.id,'legacy-detail',detail.id,detail.title,[{context:detail.context,purpose:detail.explanation.question||contexts[detail.context].intro}],{goal:detail.explanation.question,scope:contexts[detail.context].note||'',legacy:{title:detail.title,...detail.explanation},explanationHash:detail.explanationHash,reviewStatus:detail.reviewStatus,origin:{legacyDetail:detail.id}});
 for(const [topic,t]of Object.entries(rustTopics))for(const selectedStep of t.variants){
  const readings=[...t.readings];if(selectedStep)readings.sort((a,b)=>(b.context==='tx:'+selectedStep)-(a.context==='tx:'+selectedStep));
  add('rust:'+topic+(selectedStep?':'+selectedStep:''),'rust-topic',topic,t.lesson.name,readings,{topic,selectedStep,goal:t.lesson.problem,scope:t.lesson.benefit,lesson:t.lesson,claimHash:t.claimHash,reviewStatus:t.reviewStatus,origin:{lens:'rust',topic,...(selectedStep?{step:selectedStep}:{})}});
 }
 // forSource() consumes the full context table. Its smallest-containing choice
 // must be represented even when no hand-curated learning route mentions it.
 for(const [id,c] of Object.entries(contexts)){
  if(!c.source?.path)throw Error('Registry source path missing: '+id);
  (files[c.source.path]??={contexts:[],routes:[]}).contexts.push(id);
 }
 for(const route of routes)for(const reading of route.readings){
  const f=files[contexts[reading.context].source.path];if(!f.routes.includes(route.id))f.routes.push(route.id);
 }
 for(const f of Object.values(files))f.contexts.sort((a,b)=>contexts[a].source.start-contexts[b].source.start||contexts[a].source.end-contexts[b].source.end||a.localeCompare(b));
 return {version:2,commit,routes,files,generic:{strategy:'forSource-smallest-containing',contexts:Object.keys(contexts).sort(),reviewStatus:{pinnedSource:'checked-by-build-help',semantic:'separate-review-records',consumerFit:'pending',displayEquivalence:'not-measured'}}};
}
module.exports={buildRouteRegistry};
