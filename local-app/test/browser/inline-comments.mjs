// Run inside cua_repl with the real #lesson=send tab, after generated data loads.
export async function checkInlineComments(tab) {
  const root='[data-reading-help="tx:recover"] ';
  const basics=tab.playwright.locator(root+'[data-rh-basics]');
  const comments=tab.playwright.locator(root+'[data-rh-trace]');
  const note=tab.playwright.locator(root+'[data-comment-for="89"]');
  const line=tab.playwright.locator(root+'[data-rh-source-line="89"]');
  const assert=(ok,message)=>{if(!ok)throw Error(message);};
  const source=()=>tab.playwright.locator(root+'.rh-code-line code').allTextContents({});
  const before=JSON.stringify(await source()),url=await tab.url();
  assert(await basics.isVisible()&&await comments.isVisible(),'補助の切り替えが常に見えること');
  await comments.check();
  assert(await note.isVisible(),'原文の直前に日本語の補助コメントが見えること');
  const adjacent=await note.evaluate(el=>el.nextElementSibling?.dataset.codeLine==='89');
  assert(adjacent,'補助コメントが対応する原文行の直前にあること');
  await line.click();
  await comments.uncheck();await basics.uncheck();
  assert(!await note.isVisible(),'補助コメントだけを隠せること');
  assert(await comments.isVisible()&&await basics.isVisible(),'補助を隠しても切り替えが残ること');
  assert(await line.getAttribute('aria-pressed')==='true','切り替えで選択行を失わないこと');
  await tab.playwright.locator(root+'[data-rh-selected-hint]').click();
  assert(await tab.playwright.locator(root+'.rh-selection-answer').isVisible(),'コメントを隠しても一行だけ補助を開けること');
  await comments.check();
  assert(!await tab.playwright.locator(root+'.rh-selection-answer').isVisible(),'同じ行の説明を二重に表示しないこと');
  await basics.check();
  assert(JSON.stringify(await source())===before&&await tab.url()===url,'原文とURLを変えないこと');
  const selectedVisible=await line.evaluate(el=>{const code=el.closest('.rh-code'),r=el.getBoundingClientRect(),b=code.getBoundingClientRect();return r.top>=b.top&&r.bottom<=b.bottom;});
  assert(selectedVisible,'補助の表示で原文の選択行を見失わないこと');
  return {result:'PASS',inlineComments:true,switchesAlwaysVisible:true,selectedLine:89,originalCodeUnchanged:true};
}
