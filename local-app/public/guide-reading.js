/* Reuse reviewed source, comments and assistance UI; retain portable guide anchors. */
(() => {
  let selectingFragment = false;
  function evidence(context, commit, original, hash, help = globalThis.ReadingHelp) {
    const c = help?.context(context, commit);
    return c && c.source.code === original && c.source.hash === hash ? c : undefined;
  }
  function revealFragment(doc = document) {
    let id;
    try { id = decodeURIComponent(location.hash.slice(1)); } catch { return; }
    const target = doc.getElementById(id);
    const row = target?.matches('.guide-code-line') ? target : target?.matches('[data-guide-context]') ? target.querySelector('.guide-code-line') : undefined;
    if (!row) return;
    for (let p = row.parentElement; p; p = p.parentElement) if (p.tagName === 'DETAILS') p.open = true;
    selectingFragment = true;
    try { row.querySelector('[data-rh-source-line]')?.click(); } finally { selectingFragment = false; }
    row.scrollIntoView({block:'center'});
  }
  function failed(panel, reason, doc) {
    panel.dataset.guideError = reason;
    if (!panel.querySelector('[data-guide-error-message]')) {
      const message = doc.createElement('p'); message.dataset.guideErrorMessage = 'true'; message.setAttribute('role', 'alert');
      message.textContent = '補助の切り替えを読み込めませんでした。原文はそのまま表示しています。ページを再読み込みしてください。'; panel.append(message);
    }
  }
  function mount(doc = document, help = globalThis.ReadingHelp) {
    for (const panel of doc.querySelectorAll('[data-guide-reading-context]')) {
      if (panel.dataset.guideReady) continue;
      const context = panel.dataset.guideReadingContext, commit = panel.dataset.guideCommit;
      const original = [...panel.querySelectorAll('.guide-code-line code')].map(x => x.textContent).join('\n');
      const hash = panel.querySelector('[data-source-hash]')?.dataset.sourceHash;
      const c = evidence(context, commit, original, hash, help);
      if (!c) { failed(panel, 'source-mismatch', doc); continue; }
      const shell = doc.createElement('section');
      shell.id = panel.id; shell.className = panel.className;
      shell.dataset.guideContext = context; shell.dataset.guideReadingContext = context; shell.dataset.guideCommit = commit;
      shell.dataset.readingStage = context;
      const heading = doc.createElement('h3'); heading.textContent = panel.querySelector('summary').textContent;
      const host = doc.createElement('div'); host.dataset.readingHelp = context; host.dataset.helpCommit = commit; host.dataset.helpOpen = String(panel.open);
      const sourceLink = panel.querySelector('a[href]')?.cloneNode(true);
      const navigation = doc.createElement('nav'); navigation.className = 'learn-code-navigation';
      const back = doc.createElement('button'); back.type = 'button'; back.dataset.readingBack = ''; back.hidden = true; back.textContent = '呼び出した原文へ戻る';
      navigation.append(back); shell.append(heading, host, navigation); if (sourceLink) shell.append(sourceLink);
      try { help.mount(host); } catch { failed(panel, 'renderer-error', doc); continue; }
      const pre = host.querySelector('.rh-code');
      if (!pre) { failed(panel, 'missing-renderer', doc); continue; }
      pre.classList.add('guide-annotated-code'); pre.dataset.sourceHash = hash;
      for (const row of pre.querySelectorAll('[data-code-line]')) {
        const line = row.dataset.codeLine;
        row.classList.add('guide-code-line'); row.dataset.sourceLine = line; row.id = shell.id + '-L' + line;
        row.querySelector('[data-rh-source-line]')?.classList.add('guide-line-number');
      }
      for (const comment of pre.querySelectorAll('[data-comment-for]')) comment.classList.add('guide-code-comment');
      shell.dataset.guideReady = 'true'; panel.replaceWith(shell);
    }
    if (!doc.documentElement.dataset.guideBound) {
      doc.documentElement.dataset.guideBound = 'true';
      doc.addEventListener('click', event => {
        const button = event.target.closest('[data-rh-source-line]');
        const row = button?.closest('.guide-code-line');
        if (row && !selectingFragment) history.replaceState(history.state, '', '#' + row.id);
      });
      globalThis.addEventListener('hashchange', () => revealFragment(doc));
    }
    if (location.hash) revealFragment(doc);
  }
  globalThis.GuideReading = {evidence, mount};
  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => mount(), {once:true});
    else mount();
  }
})();
