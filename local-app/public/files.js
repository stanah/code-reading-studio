// A commit-pinned browser for every tracked file, independent of the Rust reading map.
export const PAGE_SIZE = 100;
export const CODE_WINDOW = 400;
export const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[char]));

export function validPath(path) {
  return typeof path === 'string' && !path.includes('\0') && !path.startsWith('/') &&
    !path.split('/').some(part => part === '.' || part === '..' || part === '');
}

export function fileUrl(path = '', line, end) {
  const params = new URLSearchParams();
  if (path) params.set('path', path);
  if (Number.isSafeInteger(line) && line > 0) params.set('line', line);
  if (Number.isSafeInteger(end) && end > line) params.set('end', end);
  return '/files' + (params.size ? '?' + params.toString() : '');
}

export function readLocation(search) {
  const params = new URLSearchParams(search);
  const path = params.get('path') || '';
  const rawLine = params.get('line') || '';
  const line = /^\d+$/.test(rawLine) && Number.isSafeInteger(Number(rawLine)) && Number(rawLine) > 0 ? Number(rawLine) : 1;
  const rawEnd = params.get('end') || '', end = Number(rawEnd);
  return {path, line, ...(/^\d+$/.test(rawEnd) && Number.isSafeInteger(end) && end > line ? {end} : {})};
}

const compareNodes = (a, b) => (a.type === b.type ? 0 : a.type === 'tree' ? -1 : 1) || a.name.localeCompare(b.name, 'en');

export function buildTree(entries) {
  const root = {path:'', name:'reth', type:'tree', children:[]};
  const nodes = new Map([['', root]]), files = [];
  for (const entry of entries) {
    if (entry.type !== 'blob' || !validPath(entry.path) || nodes.has(entry.path)) continue;
    const parts = entry.path.split('/');
    let parent = root;
    for (let i = 0; i < parts.length; i++) {
      const path = parts.slice(0, i + 1).join('/');
      let node = nodes.get(path);
      if (!node) {
        node = i === parts.length - 1 ? {...entry, name:parts[i], type:'blob'} : {path, name:parts[i], type:'tree', children:[]};
        nodes.set(path, node);
        parent.children.push(node);
        if (node.type === 'blob') files.push(node);
      }
      if (node.type !== 'tree') break;
      parent = node;
    }
  }
  for (const node of nodes.values()) if (node.children) node.children.sort(compareNodes);
  files.sort((a, b) => a.path.localeCompare(b.path, 'en'));
  return {root, nodes, files};
}

export function ancestorPaths(path) {
  const parts = path.split('/');
  return parts.slice(0, -1).map((_, i) => parts.slice(0, i + 1).join('/'));
}

export function filterFiles(files, query, limit = PAGE_SIZE) {
  const terms = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  const matches = files.filter(file => terms.every(term => file.path.toLocaleLowerCase().includes(term)));
  return {total:matches.length, items:matches.slice(0, limit)};
}

export function lineWindow(total, requestedLine = 1, size = CODE_WINDOW) {
  const safeTotal = Math.max(1, Number.isSafeInteger(total) ? total : 1);
  const line = Math.max(1, Math.min(safeTotal, Number.isSafeInteger(requestedLine) ? requestedLine : 1));
  const start = Math.floor((line - 1) / size) * size + 1;
  const end = Math.min(safeTotal, start + size - 1);
  return {line, start, end, previous:start > 1 ? Math.max(1, start - size) : null, next:end < safeTotal ? end + 1 : null};
}

export function renderCode(source, path, requestedLine = 1, requestedEnd) {
  const lines = source.split('\n');
  if (lines.length > 1 && lines.at(-1) === '') lines.pop();
  let range = lineWindow(lines.length, requestedLine);
  const selectionEnd = Math.max(range.line, Math.min(lines.length, Number.isSafeInteger(requestedEnd) ? requestedEnd : range.line));
  // Keep a guide's short evidence range together when it straddles a page boundary.
  if (selectionEnd > range.end && selectionEnd - range.line < CODE_WINDOW) {
    const start = range.line, end = Math.min(lines.length, start + CODE_WINDOW - 1);
    range = {...range, start, end, previous:start > 1 ? Math.max(1, start - CODE_WINDOW) : null, next:end < lines.length ? end + 1 : null};
  }
  const html = lines.slice(range.start - 1, range.end).map((text, i) => {
    const line = range.start + i;
    return `<span class="files-code-row${line >= range.line && line <= selectionEnd ? ' is-selected' : ''}" id="L${line}"><a class="files-line-number" href="${escapeHtml(fileUrl(path, line))}" aria-label="${line}行目を選択"${line === range.line ? ' aria-current="location"' : ''}>${line}</a><span class="files-code-text">${escapeHtml(text) || ' '}</span></span>`;
  }).join('');
  return {html, total:lines.length, ...range, selectionEnd};
}

export function renderTree(tree, expanded, selectedPath, maxRows = 600) {
  let count = 0, limited = false;
  function list(node) {
    let html = '<ul class="files-tree-list">';
    for (const child of node.children) {
      if (count >= maxRows) { limited = true; break; }
      count++;
      const directory = child.type === 'tree', open = expanded.has(child.path);
      html += '<li><div class="files-tree-row">';
      html += directory ? `<button type="button" class="files-tree-toggle" data-toggle="${escapeHtml(child.path)}" aria-expanded="${open}" aria-label="${escapeHtml(child.name)}を${open ? '折りたたむ' : '展開'}">${open ? '▾' : '▸'}</button>` : '<span class="files-tree-spacer"></span>';
      html += `<a class="files-tree-link" href="${escapeHtml(fileUrl(child.path))}" title="${escapeHtml(child.path)}"${child.path === selectedPath ? ' aria-current="page"' : ''}><span class="files-tree-icon" aria-hidden="true">${directory ? '▰' : '≡'}</span><span class="files-tree-name">${escapeHtml(child.name)}</span></a></div>`;
      if (directory && open) html += list(child);
      html += '</li>';
    }
    return html + '</ul>';
  }
  const html = list(tree.root);
  return html + (limited ? '<p class="files-tree-limit">表示を600項目までに絞っています。フォルダ名を開くか、上の検索で目的のファイルへ進めます。</p>' : '');
}

function bytesLabel(size) {
  if (!Number.isFinite(size)) return '—';
  return size < 1024 ? `${size} B` : size < 1024 * 1024 ? `${(size / 1024).toFixed(1)} KB` : `${(size / 1024 / 1024).toFixed(1)} MB`;
}

async function mount() {
  const $ = selector => document.querySelector(selector);
  const token = $('meta[name="studio-token"]').content;
  const expanded = new Set(), cache = new Map();
  let tree, index, sequence = 0, searchLimit = PAGE_SIZE, directoryLimit = 200;
  let current = readLocation(location.search);
  const status = (message = '', error = false) => { $('#files-status').textContent = message; $('#files-status').classList.toggle('error', error); };
  const api = async endpoint => {
    const response = await fetch('/api/' + endpoint, {headers:{'X-Studio-Token':token}});
    const data = await response.json();
    if (!response.ok) throw Error(data.error || 'ファイルを読み込めませんでした。');
    return data;
  };

  function sidebar() {
    const query = $('#files-search').value.trim();
    if (!query) {
      $('#files-search-count').textContent = `${tree.files.length.toLocaleString()} ファイル · フォルダ名から階層を開けます`;
      $('#files-tree').innerHTML = renderTree(tree, expanded, current.path);
      return;
    }
    const result = filterFiles(tree.files, query, searchLimit);
    $('#files-search-count').textContent = `${result.total.toLocaleString()} 件${result.total > searchLimit ? ` · ${searchLimit} 件を表示` : ''}`;
    $('#files-tree').innerHTML = '<ul class="files-search-results">' + result.items.map(file => `<li><a href="${escapeHtml(fileUrl(file.path))}"${file.path === current.path ? ' aria-current="page"' : ''}><strong>${escapeHtml(file.name)}</strong><span>${escapeHtml(file.path)}</span></a></li>`).join('') + '</ul>' + (!result.total ? '<p class="files-meta">一致するファイルがありません。</p>' : '') + (result.total > searchLimit ? '<button type="button" class="files-more" data-more-search>さらに100件表示</button>' : '');
  }

  function context(node) {
    const segments = current.path ? current.path.split('/') : [];
    $('#files-crumb').innerHTML = `<a href="/files">reth</a>` + segments.map((segment, i) => `<span class="files-separator" aria-hidden="true">/</span>${i === segments.length - 1 ? `<span aria-current="page">${escapeHtml(segment)}</span>` : `<a href="${escapeHtml(fileUrl(segments.slice(0, i + 1).join('/')))}">${escapeHtml(segment)}</a>`}`).join('');
    const guide = new URLSearchParams();
    if (node?.type === 'blob') { guide.set('path', node.path); guide.set('line', current.line); }
    $('#files-guide').href = '/startup' + (guide.size ? '?' + guide.toString() : '');
    const github = $('#files-github');
    github.hidden = !/^[a-f0-9]{40}$/i.test(index.commit);
    github.href = `https://github.com/paradigmxyz/reth/${node?.type === 'blob' ? 'blob' : 'tree'}/${encodeURIComponent(index.commit)}/${current.path.split('/').map(encodeURIComponent).join('/')}${node?.type === 'blob' ? '#L' + current.line + (current.end > current.line ? '-L' + current.end : '') : ''}`;
    document.title = `${node?.name || 'ファイルから読む'} · Code Reading Studio`;
  }

  function directory(node) {
    const parent = node.path.split('/').slice(0, -1).join('/');
    $('#files-content').innerHTML = `<h1>${node.path ? escapeHtml(node.name) : 'ファイルから読む'}</h1><p class="files-intro">${node.path ? 'このフォルダに含まれるファイルとサブフォルダ。' : '入口は bin/reth。コード、Cargo.toml、設定ファイルを同じツリーから追えます。'} 固定コミットの内容を表示しています。</p><div class="files-panel"><table class="files-directory"><thead><tr><th scope="col">名前</th><th scope="col">サイズ</th></tr></thead><tbody>${node.path ? `<tr><td><a href="${escapeHtml(fileUrl(parent))}"><span class="files-tree-icon" aria-hidden="true">↰</span>親フォルダへ</a></td><td></td></tr>` : ''}${node.children.slice(0, directoryLimit).map(child => `<tr><td><a href="${escapeHtml(fileUrl(child.path))}"><span class="files-tree-icon" aria-hidden="true">${child.type === 'tree' ? '▰' : '≡'}</span>${escapeHtml(child.name)}${child.type === 'tree' ? '/' : ''}</a></td><td>${child.type === 'tree' ? `${child.children.length} 項目` : bytesLabel(child.size)}</td></tr>`).join('')}</tbody></table>${node.children.length > directoryLimit ? `<button type="button" class="files-more" data-more-directory>さらに200件表示</button>` : ''}</div><p class="files-meta">${node.children.length} 項目${node.children.length > directoryLimit ? ` · ${directoryLimit} 件を表示` : ''}</p>`;
  }

  function source(data) {
    if (data.binary || data.truncated || typeof data.source !== 'string') {
      const message = data.binary ? 'バイナリファイルのため、ここでは本文を表示しません。' : '表示上限を超えるファイルのため、ここでは本文を表示しません。';
      $('#files-content').innerHTML = `<h1>${escapeHtml(current.path.split('/').pop())}</h1><div class="files-panel files-empty"><p>${message}</p><p>上の「GitHubで開く」から、同じコミットのファイルを確認できます。</p></div>`;
      return;
    }
    const code = renderCode(data.source, current.path, current.line, current.end);
    current.line = code.line;
    if (current.end) current.end = code.selectionEnd;
    context(tree.nodes.get(current.path));
    $('#files-content').innerHTML = `<div data-reading-help="" data-help-path="${escapeHtml(current.path)}" data-help-line="${code.line}" data-help-commit="${escapeHtml(index.commit)}" data-help-open="true"></div><details class="manual-source" open><summary>ファイル全体と行範囲を見る</summary><div class="files-panel"><div class="files-code-heading"><strong>${escapeHtml(current.path.split('/').pop())}</strong><button type="button" id="files-copy-link">この行のリンクをコピー</button></div><div class="files-code-controls"><span>${code.start}–${code.end} / ${code.total.toLocaleString()} 行</span>${code.previous ? `<a href="${escapeHtml(fileUrl(current.path, code.previous))}">← 前の400行</a>` : ''}${code.next ? `<a href="${escapeHtml(fileUrl(current.path, code.next))}">次の400行 →</a>` : ''}<form id="files-jump"><label for="files-line">行へ移動</label><input id="files-line" name="line" type="number" min="1" max="${code.total}" value="${code.line}" required><button type="submit">表示</button></form></div><div class="files-code-scroll" tabindex="0" aria-label="ソースコード。左右上下にスクロールできます"><pre class="files-code">${code.html}</pre></div><div class="files-code-footer">行番号を選ぶと、その行を含むURLになります。全文は400行ずつ表示します。</div></div></details>`;
    globalThis.ReadingHelp?.mount($('#files-content'));
    requestAnimationFrame(() => {
      const row = document.getElementById('L' + code.line), scroller = $('.files-code-scroll');
      if (row && scroller) scroller.scrollTop = Math.max(0, row.offsetTop - scroller.clientHeight / 3);
    });
    $('#files-jump').onsubmit = event => {
      event.preventDefault();
      const line = Number($('#files-line').value);
      if (!Number.isSafeInteger(line) || line < 1 || line > code.total) { status(`1〜${code.total}行を指定してください。`, true); return; }
      navigate(fileUrl(current.path, line));
    };
    $('#files-copy-link').onclick = async () => {
      try { await navigator.clipboard.writeText(new URL(fileUrl(current.path, current.line, current.end), location.href).href); status('この行へのリンクをコピーしました。'); }
      catch { status('コピーできませんでした。アドレスバーからURLをコピーしてください。', true); }
    };
  }

  async function render() {
    const request = ++sequence;
    document.body.classList?.remove('has-guided-file');
    current = readLocation(location.search);
    for (const parent of ancestorPaths(current.path)) expanded.add(parent);
    const node = tree.nodes.get(current.path);
    if (node?.type === 'tree') expanded.add(node.path);
    sidebar(); context(node); status();
    if (!node) {
      $('#files-content').innerHTML = '<div class="files-panel files-empty"><p>このコミットに、そのパスはありません。</p><a href="/files">リポジトリの先頭へ戻る</a></div>';
      return;
    }
    if (node.type === 'tree') { directory(node); return; }
    $('#files-content').innerHTML = '';
    status('固定コミットからファイルを読み込んでいます…');
    try {
      const data = cache.get(node.path) || await api('file?path=' + encodeURIComponent(node.path));
      if (request !== sequence) return;
      if (data.commit !== index.commit || data.path !== node.path) throw Error('ファイルのパスまたはコミットが一致しません。ページを再読み込みしてください。');
      if (!cache.has(node.path)) {
        if (cache.size >= 5) cache.delete(cache.keys().next().value);
        cache.set(node.path, data);
      }
      status(); source(data);
    } catch (error) {
      if (request !== sequence) return;
      status(error.message, true);
      $('#files-content').innerHTML = '<div class="files-panel files-empty">ファイルを表示できませんでした。ファイルツリーから選び直してください。</div>';
    }
  }

  function navigate(href) {
    const url = new URL(href, location.href);
    if (url.search !== location.search) directoryLimit = 200;
    if (readLocation(url.search).path !== current.path) scrollTo({top:0});
    history.pushState({}, '', url.pathname + url.search);
    render();
  }

  try {
    index = await api('tree');
    tree = buildTree(index.entries);
    $('#files-commit').textContent = `${index.version || 'reth'} · ${index.commit.slice(0, 12)} · commit固定`;
    $('#files-search').oninput = () => { searchLimit = PAGE_SIZE; sidebar(); };
    $('#files-collapse').onclick = () => { expanded.clear(); sidebar(); };
    document.addEventListener('click', event => {
      if (event.defaultPrevented || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
      const toggle = event.target.closest('[data-toggle]');
      if (toggle) {
        const path = toggle.dataset.toggle;
        if (expanded.has(path)) expanded.delete(path); else expanded.add(path);
        sidebar();
        [...$('#files-tree').querySelectorAll('[data-toggle]')].find(button => button.dataset.toggle === path)?.focus();
        return;
      }
      if (event.target.closest('[data-more-search]')) { searchLimit += PAGE_SIZE; sidebar(); return; }
      if (event.target.closest('[data-more-directory]')) { directoryLimit += 200; directory(tree.nodes.get(current.path)); return; }
      const link = event.target.closest('a[href]');
      if (!link || link.target || link.hasAttribute('download')) return;
      const url = new URL(link.href, location.href);
      if (url.origin !== location.origin || url.pathname !== '/files') return;
      event.preventDefault(); navigate(url.href);
    });
    addEventListener('popstate', () => { directoryLimit = 200; render(); });
    await render();
  } catch (error) { status(error.message, true); }
}

if (typeof document !== 'undefined') mount();
