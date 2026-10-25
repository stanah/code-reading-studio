// Real UI regression: follow an implementation, then return to the exact call line.
export async function checkCallNavigation(tab) {
 const assert=(ok,message)=>{if(!ok)throw Error(message);};
 const url=await tab.url();
 const origin='[data-reading-stage="tx:pool"]';
 const target='[data-reading-stage="area:send-validation-dispatch"]';
 const original=await tab.playwright.locator(origin+' .rh-code-line code').allTextContents({});
 await tab.playwright.locator(origin+' [data-code-line="500"] [data-reading-jump]').click();
 assert(await tab.playwright.locator(target+' [data-rh-source-line="384"]').getAttribute('aria-pressed')==='true','呼び出し先の関数定義を選択すること');
 await tab.playwright.locator(target+' [data-reading-back]').click();
 assert(await tab.playwright.locator(origin+' [data-rh-source-line="500"]').getAttribute('aria-pressed')==='true','元の呼び出し行へ戻れること');
 await tab.playwright.locator(origin+' [data-code-line="501"] [data-reading-jump]').click();
 assert(await tab.playwright.locator('[data-reading-stage="area:send-pool-limit"] [data-rh-source-line="661"]').getAttribute('aria-pressed')==='true','検証の内部を読み終えなくても次の追加処理へ進めること');
 await tab.playwright.locator('[data-reading-stage="area:send-pool-limit"] [data-reading-back]').click();
 assert(await tab.playwright.locator(origin+' [data-rh-source-line="501"]').getAttribute('aria-pressed')==='true','二つ目の呼び出し行にも戻れること');
 assert(await tab.url()===url,'同じページを保つこと');
 assert(JSON.stringify(await tab.playwright.locator(origin+' .rh-code-line code').allTextContents({}))===JSON.stringify(original),'原文を変えないこと');
 return {result:'PASS',callTarget:true,returnToCallLine:true,skipOptionalDepth:true,samePage:true};
}
