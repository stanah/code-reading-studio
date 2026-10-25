const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[char]));

export function startupUrl(params = {}) {
  const query = new URLSearchParams(Object.entries(params).filter(([, value]) => value !== undefined && value !== null && value !== ''));
  return '/startup' + (query.size ? '?' + query.toString() : '');
}

export function sourceUrl(source) {
  return '/files?' + new URLSearchParams({path:source.path, line:source.start, end:source.end}).toString();
}

export function noteUrl(step) {
  return '/#' + new URLSearchParams({path:step.source.path, code:1, start:step.source.start, end:step.source.end}).toString();
}

export function resolveView(guide, search) {
  const params = new URLSearchParams(search), stepId = params.get('step'), stageId = params.get('stage');
  const stepView = step => ({kind:'step', step, stage:guide.stages.find(stage => stage.id === step.stage) || guide.stages.find(stage => stage.steps.includes(step.id))});
  if (stepId) {
    const step = guide.steps.find(step => step.id === stepId);
    return step ? stepView(step) : {kind:'missing', message:'この読みどころは見つかりませんでした。目次から選び直してください。'};
  }
  if (params.has('path')) {
    const path = params.get('path'), rawLine = Number(params.get('line')), line = Number.isSafeInteger(rawLine) && rawLine > 0 ? rawLine : 1;
    const help = globalThis.READING_HELP_DATA?.commit === guide.commit ? globalThis.READING_HELP_DATA : undefined;
    const candidates = guide.steps.flatMap(step => {
      const entries = [{step, source:step.source, context:'startup:' + step.id, primary:true, title:step.title}];
      for (const reading of guide.readingScopes?.steps?.[step.id] || []) {
        const c = help?.contexts?.[reading.context];
        if (c && reading.context !== 'startup:' + step.id) entries.push({step, source:c.source, context:reading.context, primary:false, title:c.title});
      }
      return entries.filter(entry => entry.source.path === path);
    });
    const distance = entry => line < entry.source.start ? entry.source.start - line : line > entry.source.end ? line - entry.source.end : 0;
    candidates.sort((a, b) => distance(a) - distance(b) || Number(b.primary) - Number(a.primary) || (a.source.end - a.source.start) - (b.source.end - b.source.start));
    if (candidates.length) {
      const found = candidates[0];
      return {...stepView(found.step), origin:{path, line, exact:distance(found) === 0, context:found.context, source:found.source, title:found.title, primary:found.primary}};
    }
    return {kind:'overview', notice:'このファイルに対応する起動の解説はまだありません。全体像から、関連する段階を選べます。'};
  }
  if (stageId) {
    const stage = guide.stages.find(stage => stage.id === stageId);
    return stage ? {kind:'stage', stage} : {kind:'missing', message:'この段階は見つかりませんでした。目次から選び直してください。'};
  }
  return {kind:'overview'};
}

const stageNumber = (guide, stage) => String(guide.stages.indexOf(stage) + 1).padStart(2, '0');
const stageSteps = (guide, stage) => stage.steps.map(id => guide.steps.find(step => step.id === id)).filter(Boolean);
const stepLink = (step, label, className = '') => `<a${className ? ` class="${className}"` : ''} href="${escapeHtml(startupUrl({step:step.id}))}">${escapeHtml(label)}</a>`;
const notice = message => message ? `<div class="startup-notice">${escapeHtml(message)}</div>` : '';

export function renderSidebar(guide, view) {
  return `<a class="startup-nav-overview" href="/startup"${view.kind === 'overview' ? ' aria-current="page"' : ''}>全体像</a>` + guide.stages.map(stage => {
    const active = view.stage?.id === stage.id;
    return `<div class="startup-side-group"><a class="startup-side-stage${active ? ' is-active' : ''}" href="${escapeHtml(startupUrl({stage:stage.id}))}"${view.kind === 'stage' && active ? ' aria-current="page"' : ''}><span class="startup-side-number">${stageNumber(guide, stage)}</span>${escapeHtml(stage.title)}</a>${active ? '<ol class="startup-step-list">' + stageSteps(guide, stage).map(step => `<li><a href="${escapeHtml(startupUrl({step:step.id}))}"${view.step?.id === step.id ? ' aria-current="page"' : ''}>${escapeHtml(step.title)}</a></li>`).join('') + '</ol>' : ''}</div>`;
  }).join('');
}

export function renderOverview(guide, view = {}) {
  const running = guide.stages.at(-1);
  return notice(view.notice) + `<p class="startup-kicker">RETH ${escapeHtml(guide.version)} / STARTUP GUIDE</p><h1>${escapeHtml(guide.title || '起動から、動き続けるノードまで')}</h1><p class="startup-lead">${escapeHtml(guide.summary)}</p><div class="startup-howto"><b>全体の役割</b><span aria-hidden="true">→</span><b>ひとつの処理を理解</b><span aria-hidden="true">→</span><b>根拠のコードへ</b></div><div class="startup-overview-flow">` + guide.stages.map(stage => `<a class="startup-stage-card" href="${escapeHtml(startupUrl({stage:stage.id}))}"><span class="startup-stage-number">${stageNumber(guide, stage)} · ${stage.steps.length}つの読みどころ</span><strong>${escapeHtml(stage.title)}</strong><p>${escapeHtml(stage.summary)}</p><span class="startup-card-footer">この段階から読む →</span></a>`).join('') + `</div><section class="startup-note"><p><strong>「メインのループ」は、どこにある？</strong></p><p>起動後は、役割ごとのタスクがイベントを待ち、必要な処理を進めます。mainが待つ「ノードの終了」と、EngineやNetworkが続ける処理を分けて追います。</p>${running ? `<a href="${escapeHtml(startupUrl({stage:running.id}))}">動き続ける処理の分担を見る →</a>` : ''}</section><p class="startup-lead">各ページでは、入力・出力・処理の順序を先に確認できます。Rustの補足と理解チェックは、必要なときに開いてください。</p>`;
}

export function loopContext(guide, loop, help = globalThis.READING_HELP_DATA) {
  if (help?.commit !== guide.commit || !loop.source) return;
  return Object.entries(help.contexts || {}).find(([, context]) => {
    const source = context.source;
    return source.path === loop.source.path && source.start === loop.source.start && source.end === loop.source.end;
  })?.[0];
}

export function scopeReadings(guide, kind, id) {
  const refs = guide.readingScopes?.[kind]?.[id];
  if (refs?.length) return refs;
  if (kind === 'steps') return [{context:'startup:' + id}];
  const loop = guide.loops?.[Number(id) - 1], context = loop && loopContext(guide, loop);
  return context ? [{context}] : [];
}

const sourceSectionId = (scope, context) => 'startup-reading-' + (scope + '-' + context).replace(/[^a-z0-9-]/gi, '-');
export function renderReadingScope(guide, readings, scope, sourceOwners = new Map()) {
  if (!readings.length) return '<p class="startup-notice">対応する原文を準備中です。</p>';
  const title = reading => globalThis.ReadingHelp?.context(reading.context, guide.commit)?.title || globalThis.READING_HELP_DATA?.contexts?.[reading.context]?.title || reading.title || reading.purpose || '実装を読む';
  let firstOriginal = true;
  const plan = readings.map(reading => {
    const id = sourceSectionId(scope, reading.context), owner = sourceOwners.get(reading.context);
    if (!owner) sourceOwners.set(reading.context, id);
    return {reading, id, target:owner || id, reference:!!owner};
  });
  return `<section class="startup-reading-sequence" data-startup-sequence="${escapeHtml(scope)}"><p class="meta">${escapeHtml(guide.readingScopes?.sequenceMeaning || '原文を読む順番です。呼び出しとタスク起動は区別して確認します。')}</p>` + plan.map(({reading, id, target, reference}, i) => {
    const next = plan[i + 1];
    const code = reference
      ? `<p class="startup-source-reference"><button type="button" data-startup-read="${escapeHtml(target)}" data-startup-ref-origin="${escapeHtml(id)}">同じ原文をこのページで開く：${escapeHtml(title(reading))}</button></p>`
      : `<nav class="toolbar"><button type="button" data-startup-back hidden>直前の参照元へ戻る</button></nav><div data-reading-help="${escapeHtml(reading.context)}" data-help-commit="${escapeHtml(guide.commit)}" data-help-open="${firstOriginal}"></div>`;
    if (!reference) firstOriginal = false;
    return `<section class="learn-reading-stage" id="${escapeHtml(id)}" ${reference ? 'data-startup-context-ref' : 'data-startup-context'}="${escapeHtml(reading.context)}"><h2>${escapeHtml(title(reading))}</h2>${reading.purpose ? `<p class="learn-reading-purpose">${escapeHtml(reading.purpose)}</p>` : ''}${code}${reading.connection ? `<p class="learn-code-connection">${escapeHtml(reading.connection)}</p>` : ''}${next ? `<nav class="toolbar" aria-label="このページの読む順番"><button type="button" data-startup-read="${escapeHtml(next.target)}"${next.reference ? ` data-startup-ref-origin="${escapeHtml(id)}"` : ''}>次の原文を開く（読む順）：${escapeHtml(title(next.reading))}</button></nav>` : ''}</section>`;
  }).join('') + '</section>';
}

export function renderLoops(guide) {
  if (!guide.loops?.length) return '';
  const sourceOwners = new Map();
  const code = (loop, index) => renderReadingScope(guide, scopeReadings(guide, 'loops', index + 1), 'loop-' + (index + 1), sourceOwners);
  return `<section class="startup-loops" id="startup-loops"><h2>待機と反復処理の分担</h2><p>終了を監視する層、イベント処理を続ける層、必要なときだけ走る同期処理があります。待つ対象と実行条件を分けて確認します。</p><div class="startup-loop-cycle" aria-label="イベントループの読み方: 待機、入力が届く、処理、再び待機"><b>イベントループの読み方</b><span>待機</span><b>→</b><span>入力が届く</span><b>→</b><span>処理</span><b>→</b><span>再び待機</span></div>` + guide.loops.map((loop, index) => `<details class="startup-loop"><summary><strong>${escapeHtml(loop.name)}</strong><span>${escapeHtml(loop.role)}</span></summary><div class="startup-loop-body"><dl><dt>動き出すきっかけ</dt><dd>${escapeHtml(loop.trigger)}</dd><dt>待機する場所</dt><dd>${escapeHtml(loop.wait)}</dd></dl>${code(loop, index)}${loop.source ? `<a class="startup-link" href="${escapeHtml(sourceUrl(loop.source))}">この処理のコードへ →</a>` : ''}</div></details>`).join('') + '</section>';
}

export function renderConnections(guide, step) {
  const labels = {call:'呼び出し', spawn:'タスク起動', channel:'チャネル', wait:'終了待機'};
  const edges = (guide.edges || []).filter(edge => edge.from === step.id && guide.steps.some(target => target.id === edge.to));
  return edges.length ? '<section class="startup-connections"><h2>ほかの処理とのつながり</h2><ul>' + edges.map(edge => {
    const target = guide.steps.find(target => target.id === edge.to);
    return `<li><span class="startup-connection-kind">${escapeHtml(labels[edge.kind] || edge.kind)}</span><div>${stepLink(target, target.title)}<small>${escapeHtml(edge.label)}</small></div></li>`;
  }).join('') + '</ul></section>' : '';
}

export function renderStage(guide, stage) {
  const steps = stageSteps(guide, stage);
  return `<p class="startup-kicker">${stageNumber(guide, stage)} / ${guide.stages.length} 段階</p><h1>${escapeHtml(stage.title)}</h1><p class="startup-lead">${escapeHtml(stage.summary)}</p><div class="startup-step-cards">` + steps.map((step, i) => `<a class="startup-step-card" href="${escapeHtml(startupUrl({step:step.id}))}"><span class="startup-step-marker">${String(i + 1).padStart(2, '0')}</span><div><strong>${escapeHtml(step.title)}</strong><p>${escapeHtml(step.question)}</p></div><span class="startup-step-arrow" aria-hidden="true">→</span></a>`).join('') + '</div>' + (stage.id === guide.stages.at(-1)?.id ? renderLoops(guide) : '') + `<div class="startup-next"><a href="/startup">← 全体像へ</a>${steps[0] ? stepLink(steps[0], '最初の読みどころへ →', 'startup-next-forward') : ''}</div>`;
}

export function renderStep(guide, view) {
  const {step, stage} = view, source = view.origin?.exact && view.origin.source ? view.origin.source : step.source;
  const ownSteps = stage ? stageSteps(guide, stage) : [], ownIndex = ownSteps.findIndex(item => item.id === step.id);
  const globalIndex = guide.steps.findIndex(item => item.id === step.id), previous = guide.steps[globalIndex - 1];
  const next = (step.next || []).map(id => guide.steps.find(item => item.id === id)).filter(Boolean);
  const range = `L${source.start}–${source.end}`;
  const near = view.origin && !view.origin.exact ? `ファイルのL${view.origin.line}に最も近い読みどころを表示しています。この原文の範囲は ${range} です。` : view.origin?.exact && !view.origin.primary ? `参照した原文は、このページの「${view.origin.title}」で確認できます。` : '';
  const github = /^[a-f0-9]{40}$/i.test(guide.commit) ? `https://github.com/paradigmxyz/reth/blob/${guide.commit}/${source.path.split('/').map(encodeURIComponent).join('/')}#L${source.start}-L${source.end}` : '';
  return notice(near) + `<p class="startup-kicker">${stage ? `${stageNumber(guide, stage)} / ${escapeHtml(stage.title)} · ${ownIndex + 1} / ${ownSteps.length}` : 'STARTUP READING'}</p><h1>${escapeHtml(step.title)}</h1><p class="startup-question">${escapeHtml(step.question)}</p>${renderReadingScope(guide, scopeReadings(guide, 'steps', step.id), 'step-' + step.id)}<details class="startup-technical" data-code-detail><summary>処理の詳細・入出力を見る</summary><div><p class="startup-summary">${escapeHtml(step.summary)}</p><div class="startup-io"><section><h2>入力 / 受け取るもの</h2><p>${escapeHtml(step.input)}</p></section><section><h2>出力 / 次へ渡すもの</h2><p>${escapeHtml(step.output)}</p></section></div><section class="startup-actions"><h2>ここで行うこと</h2><ol>${(step.actions || []).map(action => `<li>${escapeHtml(action)}</li>`).join('')}</ol></section>${step.boundary ? `<div class="startup-boundary"><strong>この範囲を読むときの境界</strong>${escapeHtml(step.boundary)}</div>` : ''}${renderConnections(guide, step)}</div></details><details class="startup-file-tools"><summary>ファイルやメモで確認する</summary><section class="startup-source"><h2>説明をコードで確かめる</h2><p class="startup-source-symbol">${escapeHtml(view.origin?.title || source.symbol || step.source.symbol)}</p><p class="startup-source-path">${escapeHtml(source.path)} · ${range}</p><div class="startup-buttons"><a class="startup-button primary" href="${escapeHtml(sourceUrl(source))}">この範囲のコードを開く →</a><a class="startup-button" href="${escapeHtml(noteUrl({...step,source}))}">範囲にメモをつける</a>${github ? `<a class="startup-link" href="${escapeHtml(github)}" target="_blank" rel="noreferrer">GitHub ↗</a>` : ''}</div></section></details>${step.rust ? `<details class="startup-details"><summary>Rustの補足 · ${escapeHtml(step.rust.term)}</summary><div class="startup-details-content"><p>${escapeHtml(step.rust.explanation)}</p>${step.rust.ts ? `<details class="rh-ts-comparison"><summary>TypeScriptの例と比べる</summary><strong>TypeScriptから考えると</strong><p>${escapeHtml(step.rust.ts)}</p>` : ''}${step.rust.limit ? `<strong>類推できないところ</strong><p>${escapeHtml(step.rust.limit)}</p>` : ''}${step.rust.ts?'</details>':''}</div></details>` : ''}${step.check ? `<section class="startup-check"><p class="startup-kicker">UNDERSTANDING CHECK</p><h2>${escapeHtml(step.check.question)}</h2><details><summary>答えを確認する</summary><p>${escapeHtml(step.check.answer)}</p></details></section>` : ''}<nav class="startup-next" aria-label="前後の読みどころ">${previous ? stepLink(previous, '← ' + previous.title) : '<a href="/startup">← 全体像へ</a>'}<div class="startup-next-links">${next.length ? next.map(item => stepLink(item, item.title + ' →', 'startup-next-forward')).join('') : '<a class="startup-next-forward" href="/startup">全体像に戻って振り返る →</a>'}</div></nav>`;
}

export async function mount({document, location, fetch, history, addEventListener, scrollTo, Event} = globalThis) {
  const $ = selector => document.querySelector(selector);
  const token = $('meta[name="studio-token"]').content;
  let guide;
  function render() {
    const view = resolveView(guide, location.search);
    $('#startup-nav').innerHTML = renderSidebar(guide, view);
    $('#startup-crumb').innerHTML = '<a href="/startup">起動の全体像</a>' + (view.stage ? `<span class="separator" aria-hidden="true">/</span><a href="${escapeHtml(startupUrl({stage:view.stage.id}))}">${escapeHtml(view.stage.title)}</a>` : '') + (view.step ? `<span class="separator" aria-hidden="true">/</span><span aria-current="page">${escapeHtml(view.step.title)}</span>` : '');
    $('#startup-content').innerHTML = view.kind === 'step' ? renderStep(guide, view) : view.kind === 'stage' ? renderStage(guide, view.stage) : view.kind === 'missing' ? notice(view.message) + '<a class="startup-button" href="/startup">全体像に戻る</a>' : renderOverview(guide, view);
    $('#startup-content').innerHTML += guide.evidenceStatus ? `<p class="startup-evidence">${escapeHtml(guide.evidenceStatus)}</p>` : '';
    globalThis.ReadingHelp?.mount($('#startup-content'));
    if (view.origin?.exact && view.origin.context) {
      const host = $('#startup-content').querySelector?.('[data-reading-help="' + view.origin.context + '"]');
      const source = host?.querySelector('.rh-source');
      if (source) { source.open = true; host.querySelector('[data-rh-source-line="' + view.origin.line + '"]')?.click(); }
    }
    document.title = `${view.step?.title || view.stage?.title || '起動を追う'} · Code Reading Studio`;
    document.body.dataset.startupStep = view.step?.id || '';
    document.dispatchEvent(new Event('reading-context-change'));
  }
  try {
    const response = await fetch('/api/startup', {headers:{'X-Studio-Token':token}});
    guide = await response.json();
    if (!response.ok) throw Error(guide.error || 'このコミットの起動ガイドを読み込めませんでした。');
    $('#startup-commit').textContent = `${guide.version} · ${guide.commit.slice(0, 12)} · コードに紐づく読解ガイド`;
    $('#startup-status').textContent = '';
    document.addEventListener('click', event => {
      const openAncestors = section => { for (let parent = section?.parentElement; parent; parent = parent.parentElement) if (parent.tagName === 'DETAILS') parent.open = true; };
      const sourceBack = event.target.closest('[data-startup-back]');
      if (sourceBack?.dataset?.startupBack) {
        const origin = document.getElementById(sourceBack.dataset.startupBack);
        if (origin) { openAncestors(origin); origin.scrollIntoView({block:'start'}); origin.querySelector('[data-startup-read]')?.focus({preventScroll:true}); }
        return;
      }
      const sourceJump = event.target.closest('[data-startup-read]');
      if (sourceJump?.dataset?.startupRead) {
        const section = document.getElementById(sourceJump.dataset.startupRead);
        const source = section?.querySelector('.rh-source');
        if (source) {
          openAncestors(section); source.open = true;
          const back = section.querySelector('[data-startup-back]');
          if (back && sourceJump.dataset.startupRefOrigin) { back.dataset.startupBack = sourceJump.dataset.startupRefOrigin; back.hidden = false; }
          section.scrollIntoView({block:'start'}); section.querySelector('.rh-source > summary')?.focus({preventScroll:true});
        }
        return;
      }
      if (event.defaultPrevented || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
      const link = event.target.closest('a[href]');
      if (!link || link.target || link.hasAttribute('download')) return;
      const url = new URL(link.href, location.href);
      if (url.origin !== location.origin || url.pathname !== '/startup') return;
      event.preventDefault();
      history.pushState({}, '', url.pathname + url.search);
      render(); scrollTo({top:0});
    });
    addEventListener('popstate', render);
    render();
  } catch (error) {
    $('#startup-status').textContent = error.message;
    $('#startup-status').classList.add('error');
    $('#startup-content').innerHTML = '<p>ファイルツリーから、現在のコミットのコードを確認できます。</p><a class="startup-button" href="/files">ファイルから読む →</a>';
  }
}

// A module may execute before later deferred source-data scripts. DOMContentLoaded
// runs after those scripts, so loop-context lookup must not race their arrival.
export function startWhenReady(doc = globalThis.document, start = mount) {
  if (!doc) return;
  if (doc.readyState === 'complete') return start();
  doc.addEventListener('DOMContentLoaded', () => start(), {once:true});
}
if (typeof document !== 'undefined') startWhenReady();
