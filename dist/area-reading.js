/* A reading question inside each existing area page. Not a separate learner route. */
(() => {
 const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const readings=commit=>globalThis.READING_HELP_DATA?.commit===commit?globalThis.READING_HELP_DATA.areaReadings||[]:[];
 const find=(id,commit)=>readings(commit).find(r=>r.area===id);
 function followup(r,commit){
  const f=r.followup;if(!f)return '';
  return `<details class="area-followup"><summary>もう一つ読む：${esc(f.question)}</summary><section aria-label="条件を変えて読む"><h2>${esc(f.question)}</h2><div class="followup-explanation"><p>${esc(f.role)}</p><dl><dt>受け取るもの</dt><dd>${esc(f.input)}</dd><dt>返すもの・次に起きること</dt><dd>${esc(f.output)}</dd><dt>失敗・待ち・この範囲の限界</dt><dd>${esc(f.boundary)}</dd></dl></div><div data-reading-help="${esc(f.context)}" data-help-commit="${esc(commit)}" data-help-open="true"></div><p class="reading-self-check"><strong>条件を変えて確かめる</strong>${esc(f.selfCheck)}</p></section></details>`;
 }
 function render(id,commit){
  const r=find(id,commit);if(!r)return '';
  return `<section class="area-reading" aria-label="この領域の最初の読解"><p class="eyebrow">この領域で、まず一つの処理を読む</p><h1>${esc(r.question)}</h1><p class="lead">${esc(r.role)}</p><div class="cards area-reading-io"><section class="card"><h2>受け取るもの</h2><p>${esc(r.input)}</p></section><section class="card"><h2>返すもの・次に起きること</h2><p>${esc(r.output)}</p></section></div><p class="area-reading-boundary"><strong>失敗・待ち・この範囲の限界</strong>${esc(r.boundary)}</p><div data-reading-help="${esc(r.context)}" data-help-commit="${esc(commit)}"></div>${r.extraContext?`<details class="area-extra"><summary>検証条件の一例を原文で確かめる</summary><div data-reading-help="${esc(r.extraContext)}" data-help-commit="${esc(commit)}" data-help-open="true"></div></details>`:''}${followup(r,commit)}<p class="meta">この領域の入口となる一つの処理です。領域内の全ファイル・全関数を解説したものではありません。</p></section>`;
 }
 function coverage(commit){const c=globalThis.READING_COVERAGE_DATA;if(c?.commit!==commit)return '';const m=c.metrics;return `<details class="area-coverage"><summary>解説がある範囲を確かめる</summary><p>領域の読解入口：${m.guidedAreas} / ${m.totalAreas}。一部に解説があるRustファイル：${m.anchoredRustFiles} / ${m.totalRust}。</p><p>ファイル全体をレビューした数：${m.fullyReviewedRustFiles}。未解説のファイルも原文を表示できます。</p></details>`;}
 globalThis.ReadingAreas={readings,find,render,coverage};
 if(typeof document!=='undefined'){
  document.dispatchEvent(new Event('reading-areas-ready'));
  const slot=document.getElementById('area-reading');
  if(slot){const p=new URLSearchParams(location.search),commit=globalThis.READING_HELP_DATA?.commit;
   if(!p.has('c')&&!p.has('f')&&!p.has('fn')&&find(p.get('area'),commit)){
    slot.hidden=false;slot.innerHTML=render(p.get('area'),commit);document.body.classList.add('area-guided');const heading=document.getElementById('zoom-title'),subtitle=document.getElementById('zoom-subtitle');if(heading)heading.textContent=find(p.get('area'),commit).title+'をコードから読む';if(subtitle)subtitle.textContent='まず一つの処理を、説明と原文の行で確かめます。';const structure=document.getElementById('area-structure');if(structure)structure.dataset.codeDetail='true';globalThis.ReadingHelp?.mount(slot);
   }
  }
 }
})();
