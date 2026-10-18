(() => {
  function update() {
    const hash = new URLSearchParams(location.hash.slice(1));
    const query = new URLSearchParams(location.search);
    const page = location.pathname.split('/').pop();
    const step = ['startup','files','guide'].includes(page) ? null : (document.body.dataset.readingStep || hash.get('step') || query.get('step'));
    const view = ['files','startup','guide'].includes(page) ? page : (hash.get('lens') || (page === 'lenses.html' ? 'flow' : 'structure'));
    document.querySelectorAll('.studio-nav [data-view]').forEach(a => {
      if (a.dataset.view === view) a.setAttribute('aria-current', 'page');
      else a.removeAttribute('aria-current');
      const target = new URL(a.href, location.href);
      const params = new URLSearchParams(target.hash.slice(1));
      if (!params.has('lens')) return;
      if (step) params.set('step', step);
      else params.delete('step');
      target.hash = params.toString();
      a.href = target.pathname + target.search + target.hash;
    });
  }
  addEventListener('hashchange', update);
  document.addEventListener('reading-context-change', update);
  update();
})();
