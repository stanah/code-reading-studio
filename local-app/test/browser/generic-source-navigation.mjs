// Run with a dedicated CUA tab. These controls never save a note or submit a question.
export async function checkGenericSourceNavigation(tab, base = 'http://127.0.0.1:4317') {
 const assert = (ok, message) => { if (!ok) throw Error(message); };
 const path = 'crates/rpc/rpc-eth-api/src/helpers/transaction.rs';
 const origin = '[data-reading-help="tx:trait-contract"]';
 const destination = '[data-reading-help="tx:recover"]';
 const read = () => tab.playwright.evaluate(() => ({
  url: location.href,
  focusContext: document.activeElement?.closest('[data-reading-help]')?.dataset.readingHelp,
  focusInViewport: (() => { const box = document.activeElement?.getBoundingClientRect(); return !!box && box.top >= 0 && box.bottom <= innerHeight; })(),
  sources: [...document.querySelectorAll('[data-reading-help]')].map(host => ({
   id: host.dataset.readingHelp,
   code: [...host.querySelectorAll('.rh-code-line code')].map(row => row.textContent).join('\n'),
   selected: host.querySelector('[data-rh-source-line][aria-pressed="true"]')?.dataset.rhSourceLine,
   sourceOpen: host.querySelector('.rh-source')?.open,
   sourceVisible: !!host.querySelector('.rh-code')?.getClientRects().length,
   backVisible: [...host.querySelectorAll('[data-reading-back]')].some(button => !button.hidden && !!button.getClientRects().length),
  })),
 }));
 const results = [];
 for (const url of [
  base + '/reader#' + new URLSearchParams({path, code: '1', start: '65', end: '79'}),
  base + '/files?' + new URLSearchParams({path, line: '65', end: '79'}),
 ]) {
  await tab.goto(url);
  await tab.playwright.locator(origin + ' [data-rh-source-line="72"]').waitFor({state: 'visible'});
  await tab.getAXState({emit: false});
  const before = await read();
  assert(before.sources.length === 1, 'Direct source entry must mount one source');
  assert(before.sources.some(source => source.id === 'tx:trait-contract'), 'Path/line entry must expose the resolved source identity');
  await tab.playwright.locator(origin + ' [data-rh-source-line="72"]').click();
  await tab.getAXState({emit: false});
  await tab.playwright.locator(origin + ' [data-reading-kind="related-source"]').click();
  await tab.getAXState({emit: false});
  const forward = await read();
  assert(forward.sources.length === 2 && new Set(forward.sources.map(source => source.id)).size === 2, 'Related navigation must mount one copy of each source');
  assert(forward.sources.some(source => source.id === 'tx:recover' && source.backVisible), 'Related source must offer a visible return action');
  await tab.playwright.locator(destination + ' [data-reading-back]').click();
  await tab.getAXState({emit: false});
  const returned = await read();
  const source = returned.sources.find(source => source.id === 'tx:trait-contract');
  assert(returned.sources.length === 2 && new Set(returned.sources.map(source => source.id)).size === 2, 'Return must reuse both original source hosts');
  assert(returned.focusContext === 'tx:trait-contract' && returned.focusInViewport, 'Return must visibly focus the original source');
  assert(source?.sourceOpen && source.sourceVisible, 'Returned original must be open and visible');
  assert(source?.selected === '72', 'Return must restore the selected original line');
  assert(source.code === before.sources.find(row => row.id === 'tx:trait-contract').code, 'Return must preserve the original bytes');
  assert(returned.url === before.url && forward.url === before.url, 'Both directions must remain on the same URL');
  assert(returned.sources.every(source => !source.backVisible), 'Return trail must be consumed');
  results.push({url, forward, returned, result: 'PASS'});
 }
 return results;
}
