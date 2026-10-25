// UI preflight, separate from comprehension scoring and the full 108-unit audit.
export async function checkReadingFlows(tab,base='http://127.0.0.1:4317',lessons=['send','reading','startup','reth']) {
 const assert=(ok,message)=>{if(!ok)throw Error(message);},observations=[];
 for(const lesson of lessons){
  await tab.goto(base+'/#lesson='+lesson);
  // Force a new document so the transient source-open map cannot carry a prior success.
  await tab.reload();
  await tab.getAXState({emit:false});
  const choices=await tab.playwright.locator('[data-reading-phase]').count();
  const allBefore=await tab.playwright.locator('.rh-code-line code').allTextContents({});
  for(let phase=0;phase<choices;phase++){
   await tab.playwright.locator(`[data-reading-phase="${phase}"]`).click();
   await tab.getAXState({emit:false});
   const state=await tab.playwright.evaluate(index=>{
    const group=document.querySelector(`[data-reading-group="${index}"]`);
    return {open:group.open,required:[...group.querySelectorAll('[data-reading-essential="true"]')].map(stage=>({id:stage.dataset.readingStage,open:stage.querySelector('.rh-source').open})),allGroups:[...document.querySelectorAll('[data-reading-group]')].map(g=>g.open)};
   },phase);
   assert(state.open&&state.required.every(s=>s.open),lesson+' phase '+phase+' opens every required source');
   assert(state.allGroups.filter(Boolean).length===1,lesson+' has one chosen flow');
   observations.push({lesson,phase,...state});
  }
  assert(JSON.stringify(allBefore)===JSON.stringify(await tab.playwright.locator('.rh-code-line code').allTextContents({})),lesson+' flow selection preserves every original');
  const advanced=tab.playwright.locator('[data-reading-advanced]');
  await advanced.locator('summary').click();await tab.getAXState({emit:false});
  const firstContext=await tab.playwright.locator('[data-reading-stage]').first().getAttribute('data-reading-stage');
  await tab.playwright.locator('[data-reading-destination]').selectOption(firstContext);
  await tab.getAXState({emit:false});
  assert(await tab.playwright.locator(`[data-reading-stage="${firstContext}"] .rh-source`).getAttribute('open')!==null,lesson+' picker immediately opens destination');
 }
 return {status:'PASS',observations,kind:'UI preflight; not learner comprehension'};
}
