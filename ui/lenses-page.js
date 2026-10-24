function renderLenses() {
  const params = Object.fromEntries(new URLSearchParams(location.hash.slice(1)));
  const origin = new URLSearchParams();
  for (const key of ['lens', 'step', 'group', 'topic']) {
    if (params[key]) origin.set(key, params[key]);
  }
  ReadingLenses.render(document.querySelector('#lens-root'), {
    ...LENSES_PACK,
    sourceUrl: step => 'reader.html?' + new URLSearchParams({
      step: step.id,
      from: 'lenses.html#' + origin,
    }),
    structureUrl: step => step.structureUrl,
  }, params);
}
addEventListener('hashchange', renderLenses);

renderLenses();
