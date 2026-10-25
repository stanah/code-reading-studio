// Public availability is derived from authored consumers, never from the legacy tour.
// A file entry means that selected ranges have help; it is not a whole-file review.
function buildRouteRegistry({commit,contexts,lessonLinks,journeyLinks,operationLinks,fileRoleLinks,componentLinks,areaReadings,guide}){
 if(guide.commit!==commit)throw Error('Guide/public reading registry commit differs');
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
 const availableContexts=new Set(routes.flatMap(r=>r.readings.map(s=>s.context)));
 for(const [id,c] of Object.entries(contexts)){
  // Kept legacy fragments may serve other old views. Merely existing in the data
  // must not introduce them as newly reviewed Atlas choices.
  if(!availableContexts.has(id))continue;
  if(!c.source?.path)throw Error('Registry source path missing: '+id);
  (files[c.source.path]??={contexts:[],routes:[]}).contexts.push(id);
 }
 for(const route of routes)for(const reading of route.readings){
  const f=files[contexts[reading.context].source.path];if(!f.routes.includes(route.id))f.routes.push(route.id);
 }
 for(const f of Object.values(files))f.contexts.sort((a,b)=>contexts[a].source.start-contexts[b].source.start||contexts[a].source.end-contexts[b].source.end||a.localeCompare(b));
 return {version:1,commit,routes,files};
}
module.exports={buildRouteRegistry};
