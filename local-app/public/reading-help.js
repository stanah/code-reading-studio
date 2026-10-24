/* Contextual, authored hints. They never replace the source, navigate, or write notes. */
(() => {
  const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const data=()=>globalThis.READING_HELP_DATA;
  const prefs=()=>globalThis.LearningStudio?.preferences?.()||{chain:'new',code:'first'};
  const mounted=new WeakSet(),transient=new Map();
  const syntax={'.await':'await','??':'double-question','?':'question','async':'async','fn':'function','let':'variable','Result':'result','RpcResult':'result','Ok':'result','Err':'result','&self':'borrow','&tx':'borrow','->':'return','Bytes':'bytes','B256':'hash','Self':'trait','move':'closure','oneshot':'channel','handle':'handle'};
  function context(id,commit){return data()?.commit===commit?data().contexts[id]:undefined;}
  function forSource(path,line,commit){
    if(data()?.commit!==commit)return;
    return Object.entries(data().contexts).filter(([,c])=>c.source.path===path&&c.source.start<=line&&line<=c.source.end).sort((a,b)=>(a[1].source.end-a[1].source.start)-(b[1].source.end-b[1].source.start))[0]?.[0];
  }
  function tokenMarkup(line,lineNumber,c){
    // Strings/comments and tracing's ?field formatting are not Rust error propagation.
    return line.split(/(\/\/.*$|"(?:[^"\\]|\\.)*"|\.await|\?\?|\?|&self\b|&tx\b|->|\b(?:async|fn|let|Result|RpcResult|Ok|Err|Bytes|B256|Self|move|oneshot|handle)\b)/g).map((part,index,parts)=>{
      if(part.startsWith('//')||part.startsWith('"'))return esc(part);
      const override=c?.tokenHints?.[lineNumber]?.[part];
      if(override)return `<button type="button" class="rh-token" data-rh-term="${esc(override)}" aria-label="${esc(part)} の意味を表示">${esc(part)}</button>`;
      if(part==='?'&&/\b(?:trace|debug|info|warn|error)!/.test(line))return `<button type="button" class="rh-token" data-rh-term="logging" aria-label="ログの ? の意味を表示">?</button>`;
      if(part==='?'&&/^(?:\s*[A-Za-z_])/.test(parts[index+1]||''))return esc(part);
      return syntax[part]?`<button type="button" class="rh-token" data-rh-term="${syntax[part]}" aria-label="${esc(part)} の意味を表示">${esc(part)}</button>`:esc(part);
    }).join('');
  }
  function codeHtml(c){return c.source.code.split('\n').map((line,i)=>`<span class="rh-code-line" data-code-line="${c.source.start+i}"><span class="rh-line-number" aria-hidden="true">${c.source.start+i}</span><code>${tokenMarkup(line,c.source.start+i,c)}</code></span>`).join('');}
  function render(id,commit,{openCode=false}={}){
    const c=context(id,commit);if(!c)return '';
    const options=prefs();
    return `<section class="rh-panel" aria-label="この箇所の読解ヒント"><p class="rh-intro">${esc(c.intro)}</p><div class="rh-vocabulary" data-concept-hints><span>この言葉は？</span>${c.terms.map(id=>`<button type="button" data-rh-term="${esc(id)}">${esc(data().terms[id].name)}</button>`).join('')}</div><div class="rh-concept-answer" role="status" aria-live="polite" hidden></div><details class="rh-source"${openCode?' open':''}><summary>実コードをこの場で確かめる <span>L${c.source.start}–${c.source.end}</span></summary><div class="rh-source-body"><div class="rh-code-controls"><label><input type="checkbox" data-rh-basics${options.code==='first'?' checked':''}> コードの読み方を補う</label><label><input type="checkbox" data-rh-trace${options.code!=='rust'?' checked':''}> 日本語の処理と対応づける</label></div><div class="rh-basics"${options.code==='first'?'':' hidden'}><p>関数は処理のまとまり、引数は渡すデータ、戻り値は返る結果です。コード中の下線の付いた記号から、その意味を開けます。</p><div class="rh-basic-links">${['function','argument','return','type'].map(t=>`<button type="button" data-rh-term="${t}">${esc(data().terms[t].name)}</button>`).join('')}</div></div><div class="rh-trace"${options.code==='rust'?' hidden':''}><p>確かめたい処理を選ぶと、対応する行と説明を示します。</p><div class="rh-line-steps">${c.lines.map((line,i)=>`<button type="button" data-rh-line="${i}" aria-pressed="false">${esc(line.label)} <small>L${line.line}</small></button>`).join('')}</div><div class="rh-line-answer" role="status" aria-live="polite"><p>処理を選ぶか、下のコードの記号を選んでください。</p></div></div><div class="rh-symbol-answer" role="status" aria-live="polite" hidden></div><pre class="rh-code" tabindex="0" aria-label="${esc(c.title)}の実コード。記号の意味をその場で開けます">${codeHtml(c)}</pre>${c.note?`<p class="rh-source-note">${esc(c.note)}</p>`:''}<p class="rh-evidence">原文：${esc(c.source.path)} · ${esc(commit.slice(0,12))}。行番号・コードは原文のまま、ヒントは解説者による読解です。</p></div></details></section>`;
  }
  function termHtml(id){const t=data()?.terms[id];if(!t)return '';return `<div class="rh-answer-heading"><strong>${esc(t.name)}</strong><button type="button" data-rh-close aria-label="ヒントを閉じる">閉じる</button></div><p>${esc(t.meaning)}</p><p class="rh-example">${esc(t.example)}</p>`;}
  function applyPreferences(){
    if(typeof document==='undefined')return;
    document.querySelectorAll('[data-chain-detail]').forEach(d=>{if(!d.dataset.manual)d.open=prefs().chain==='new';if(!d.dataset.bound){d.querySelector('summary')?.addEventListener('click',()=>{d.dataset.manual='true';});d.dataset.bound='true';}});
    document.querySelectorAll('[data-code-detail]').forEach(d=>{if(!d.dataset.manual)d.open=prefs().code!=='first';if(!d.dataset.bound){d.querySelector('summary')?.addEventListener('click',()=>{d.dataset.manual='true';});d.dataset.bound='true';}});
    document.querySelectorAll('[data-reading-help]').forEach(host=>{
      const p=prefs();host.dataset.chain=p.chain;host.dataset.code=p.code;
      for(const [selector,region,enabled] of [['[data-rh-basics]','.rh-basics',p.code==='first'],['[data-rh-trace]','.rh-trace',p.code!=='rust']]){
        const control=host.querySelector(selector);if(control&&!control.dataset.manual){control.checked=enabled;host.querySelector(region).hidden=!enabled;}
      }
    });
  }
  function mount(scope=document){
    const hosts=[...(scope.matches?.('[data-reading-help]')?[scope]:[]),...scope.querySelectorAll('[data-reading-help]')];
    for(const host of hosts){
      if(mounted.has(host))continue;
      const commit=host.dataset.helpCommit,id=host.getAttribute('data-reading-help')||forSource(host.dataset.helpPath,Number(host.dataset.helpLine),commit),c=context(id,commit);
      if(!c){host.hidden=true;continue;}
      const stateKey=commit+':'+id,saved=transient.get(stateKey)||{};transient.set(stateKey,saved);
      host.hidden=false;const manual=host.parentElement?.querySelector('.manual-source');if(manual){manual.dataset.codeDetail='true';}if(host.closest?.('#files-content'))document.body.classList.add('has-guided-file');if(host.closest?.('#view'))document.body.classList.add('guided-source');host.innerHTML=render(id,commit,{openCode:host.dataset.helpOpen==='true'||saved.openCode===true});mounted.add(host);if(host.dataset.helpCompact==='true'){host.querySelector('.rh-source').hidden=true;}
      const showTerm=(termId,code)=>{
        const region=host.querySelector(code?'.rh-symbol-answer':'.rh-concept-answer');region.hidden=false;region.innerHTML=termHtml(termId);saved.term={id:termId,code};
      };
      const showLine=index=>{
        const hint=c.lines[index];if(!hint)return;
        saved.line=index;
        host.querySelectorAll('[data-rh-line]').forEach(b=>b.setAttribute('aria-pressed',String(Number(b.dataset.rhLine)===index)));
        host.querySelectorAll('[data-code-line]').forEach(row=>row.classList.toggle('is-reading',Number(row.dataset.codeLine)===hint.line));
        host.querySelector('.rh-line-answer').innerHTML=`<strong>L${hint.line} · ${esc(hint.label)}</strong><p>${esc(hint.explanation)}</p>`;
        const row=host.querySelector(`[data-code-line="${hint.line}"]`),scroller=host.querySelector('.rh-code');
        if(row&&scroller)scroller.scrollTop=Math.max(0,row.offsetTop-scroller.clientHeight/3);
      };
      host.addEventListener('click',event=>{
        const term=event.target.closest('[data-rh-term]');
        if(term){host._hintTrigger=term;showTerm(term.dataset.rhTerm,!!term.closest('.rh-source'));return;}
        if(event.target.closest('[data-rh-close]')){event.target.closest('.rh-symbol-answer,.rh-concept-answer').hidden=true;delete saved.term;host._hintTrigger?.focus();return;}
        const button=event.target.closest('[data-rh-line]');if(button)showLine(Number(button.dataset.rhLine));
      });
      host.querySelector('.rh-source').addEventListener('toggle',event=>{saved.openCode=event.currentTarget.open;if(saved.openCode&&Number.isInteger(saved.line))showLine(saved.line);});
      if(Number.isInteger(saved.line))showLine(saved.line);if(saved.term)showTerm(saved.term.id,saved.term.code);
      host.querySelectorAll('[data-rh-basics],[data-rh-trace]').forEach(input=>input.addEventListener('change',()=>{
        input.dataset.manual='true';saved[input.hasAttribute('data-rh-basics')?'basics':'trace']=input.checked;host.querySelector(input.hasAttribute('data-rh-basics')?'.rh-basics':'.rh-trace').hidden=!input.checked;
      }));
      for(const [key,selector,region] of [['basics','[data-rh-basics]','.rh-basics'],['trace','[data-rh-trace]','.rh-trace']])if(typeof saved[key]==='boolean'){const input=host.querySelector(selector);input.checked=saved[key];input.dataset.manual='true';host.querySelector(region).hidden=!saved[key];}
    }
    applyPreferences();
  }
  globalThis.ReadingHelp={context,forSource,render,codeHtml,termHtml,mount,applyPreferences};
  if(typeof document!=='undefined'){
    mount();document.addEventListener('reading-context-change',()=>mount());document.addEventListener('reading-preferences-change',applyPreferences);
  }
})();
