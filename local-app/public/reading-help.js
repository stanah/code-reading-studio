/* Authored comments and source navigation preserve the pinned original and never write notes. */
(() => {
  const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const data=()=>globalThis.READING_HELP_DATA;
  const prefs=()=>globalThis.LearningStudio?.preferences?.()||{chain:'new',code:'first'};
  const mounted=new WeakSet(),transient=new Map();
  const syntax={'.await':'await','.expect':'expect','if':'if','for':'for-context','match':'match','return':'early-return','continue':'continue','Some':'option','None':'option','??':'double-question','?':'question','async':'async','fn':'function','let':'variable','Result':'result','RpcResult':'result','Ok':'result','Err':'result','&self':'borrow','&tx':'borrow','->':'return','Bytes':'bytes','B256':'hash','Self':'trait','move':'closure','oneshot':'channel','handle':'handle'};
  // Each link is a reviewed call site; reading-order links are labelled separately.
  const callRoutes=[
    {from:'tx:rpc',line:923,match:'send_raw_transaction',to:'tx:recover',targetFn:'send_raw_transaction'},
    {from:'tx:recover',line:90,match:'send_pool_transaction',to:'tx:submit',targetFn:'send_pool_transaction'},
    {from:'tx:recover',line:102,match:'recover_raw_transaction_with_cache',to:'tx:recovery-hook',targetFn:'recover_raw_transaction_with_cache'},
    {from:'tx:recover',line:106,match:'recover_raw_transaction',to:'tx:recovery-hook',targetFn:'recover_raw_transaction'},
    {from:'tx:submit',line:111,match:'add_pool_transaction',to:'tx:queue',targetFn:'add_pool_transaction'},
    {from:'area:send-receive',line:125,match:'process_batch',to:'tx:batch',targetFn:'process_batch'},
    {from:'tx:batch',line:71,match:'add_transaction',to:'tx:pool',targetFn:'add_transaction'},
    {from:'tx:batch',line:91,match:'add_transactions',to:'tx:pool',targetFn:'add_transactions'},
    {from:'tx:batch',line:101,match:'add_transactions_with_origins',to:'tx:pool',targetFn:'add_transactions_with_origins'},
    {from:'tx:pool',line:500,match:'self.validate',to:'area:send-validation-dispatch',targetFn:'validate'},
    {from:'tx:pool',line:501,match:'self.pool.add_transactions',to:'area:send-pool-limit',targetFn:'add_transactions'},
    {from:'area:send-validation-dispatch',line:389,match:'validate_transaction',to:'area:send-validation-task',targetFn:'validate_transaction'},
    {from:'area:send-validation-task',line:244,match:'validate_transaction',to:'area:send-validation-entry',targetFn:'validate_transaction'},
    {from:'area:send-validation-entry',line:1015,match:'validate_one',to:'area:send-validation-order',targetFn:'validate_one'},
    {from:'area:send-validation-order',line:411,match:'validate_stateless',to:'area:send-stateless',targetFn:'validate_stateless'},
    {from:'area:send-validation-order',line:431,match:'validate_stateful',to:'area:send-stateful',targetFn:'validate_stateful'},
    {from:'area:send-stateful',line:687,match:'validate_sender_nonce',to:'area:send-nonce',targetFn:'validate_sender_nonce'},
    {from:'area:send-stateful',line:693,match:'validate_sender_balance',to:'area:pool-balance',targetFn:'validate_sender_balance'},
    {from:'area:send-pool-limit',line:687,match:'self.add_transaction',to:'area:send-pool-add',targetFn:'add_transaction'},
    {from:'area:rpc-balance-entry',line:698,match:'balance',to:'area:rpc-balance-read',targetFn:'balance'},
    {from:'startup:network',line:1172,match:'poll_nested_stream_with_budget!',to:'area:network-budget',kind:'macro',targetFn:'poll_nested_stream_with_budget'},
    {from:'startup:network',line:1183,match:'poll_nested_stream_with_budget!',to:'area:network-budget',kind:'macro',targetFn:'poll_nested_stream_with_budget'}
  ];
  function callMarkup(part,line,c){
    let html=esc(part);
    for(const link of c.callLinks||[])if(link.line===line&&part.includes(link.match)){
      html=html.replace(esc(link.match),`<button type="button" class="rh-call" data-reading-jump="${esc(link.to)}" data-reading-target-line="${link.targetLine}" data-reading-kind="${link.kind||'function'}" title="${link.kind==='macro'?'マクロの定義':'この呼び出し先のコード'}を同じページで読む" aria-label="${esc(link.match)}の${link.kind==='macro'?'マクロ定義':'呼び出し先'}を読む">${esc(link.match)}</button>`);
    }
    return html;
  }
  function context(id,commit){const d=data();return d&&d.commit===commit?d.contexts[id]:undefined;}
  function topicContext(id,commit,topic){
    const c=context(id,commit),claims=globalThis.ReadingLenses?.rustContextClaims?.(topic,id);if(!c||!claims?.length)return c;
    const lines=new Set(claims.map(h=>h.line));
    return {...c,lines:[...c.lines.filter(h=>!lines.has(h.line)),...claims.map(h=>({line:h.line,match:h.match,label:h.label||'この構文で確かめる点',explanation:h.text||h.explanation}))].sort((a,b)=>a.line-b.line)};
  }
  function forSource(path,line,commit){
    if(!data()||data().commit!==commit)return;
    return Object.entries(data().contexts).filter(([,c])=>c.source.path===path&&c.source.start<=line&&line<=c.source.end).sort((a,b)=>(a[1].source.end-a[1].source.start)-(b[1].source.end-b[1].source.start))[0]?.[0];
  }
  function tokenMarkup(line,lineNumber,c){
    // Strings/comments and tracing's ?field formatting are not Rust error propagation.
    return line.split(/(\/\/.*$|"(?:[^"\\]|\\.)*"|\.await|\.expect|\?\?|\?|&self\b|&tx\b|->|\b(?:async|fn|let|Result|RpcResult|Ok|Err|Bytes|B256|Self|move|oneshot|handle|if|for|match|return|continue|Some|None)\b)/g).map((part,index,parts)=>{
      if(part.startsWith('//')||part.startsWith('"'))return esc(part);
      const override=c?.tokenHints?.[lineNumber]?.[part];
      if(override)return `<button type="button" class="rh-token" data-rh-term="${esc(override)}" aria-label="${esc(part)} の意味を表示">${esc(part)}</button>`;
      if(part==='?'&&/\b(?:trace|debug|info|warn|error)!/.test(line))return `<button type="button" class="rh-token" data-rh-term="logging" aria-label="ログの ? の意味を表示">?</button>`;
      if(part==='?'&&/^(?:\s*[A-Za-z_])/.test(parts[index+1]||''))return esc(part);
      return syntax[part]?`<button type="button" class="rh-token" data-rh-term="${syntax[part]}" aria-label="${esc(part)} の意味を表示">${esc(part)}</button>`:callMarkup(part,lineNumber,c);
    }).join('');
  }
  function codeHtml(c){
    return c.source.code.split('\n').map((line,i)=>{
      const number=c.source.start+i,hints=(c.lines||[]).filter(h=>h.line===number);
      const comments=hints.map(h=>`<span class="rh-inline-comment" data-comment-for="${number}" role="note" aria-label="L${number}の補助コメント"><span class="rh-comment-label">補助コメント · L${number}</span><span class="rh-comment-text">// ${esc(h.explanation)}</span></span>`).join('');
      return comments+`<span class="rh-code-line" data-code-line="${number}"><button type="button" class="rh-line-number" data-rh-source-line="${number}" aria-pressed="false" aria-label="L${number}を選択">${number}</button><code>${tokenMarkup(line,number,c)}</code></span>`;
    }).join('');
  }
  function basicLinks(c){
    const markup=c.source.code.split('\n').map((line,i)=>tokenMarkup(line,c.source.start+i,c)).join(''),ids=[...new Set([...markup.matchAll(/data-rh-term="([^"]+)"/g)].map(m=>m[1]))];
    return ids.filter(id=>data().terms[id]).map(id=>`<button type="button" data-rh-term="${esc(id)}">${esc(data().terms[id].name)}</button>`).join('');
  }
  function operationReadings(id){
    const operation=data()?.operationLinks?.find(r=>r.id===id),send=data()?.lessonLinks?.find(r=>r.lesson==='send');
    if(!operation||!send)return [];
    return operation.contexts.map(context=>{
      const reading=send.readings.find(r=>r.context===context);
      return reading?{...reading,connection:operation.connections?.[context]||reading.connection}:undefined;
    }).filter(Boolean);
  }
  function areaReadings(id,part){const r=data()?.areaReadings?.find(r=>r.area===id);return (part==='followup'?r?.followup:r)?.readings||[];}
  function render(id,commit,{openCode=true,lesson,journey,rustTopic,operation,filePath,component,area,part}={}){
    const c=topicContext(id,commit,rustTopic);if(!c)return '';
    const options=prefs();
    const annotated={...c,callLinks:callRoutes.filter(r=>r.from===id&&data().contexts[r.to]).map(r=>{const dest=data().contexts[r.to];const offset=dest.source.code.split('\n').findIndex(line=>line.match(r.kind==='macro'?/\bmacro_rules!\s+([A-Za-z_][A-Za-z_0-9]*)/:/\bfn\s+([A-Za-z_][A-Za-z_0-9]*)/)?.[1]===r.targetFn);return {...r,targetLine:offset<0?dest.source.start:dest.source.start+offset};})};
    return `<section class="rh-panel" aria-label="この箇所の読解ヒント"><details class="rh-context"><summary>読む範囲・用語を確かめる</summary><p class="rh-intro">${esc(c.intro)}</p><div class="rh-vocabulary" data-concept-hints><span>この言葉は？</span>${c.terms.map(id=>`<button type="button" data-rh-term="${esc(id)}">${esc(data().terms[id].name)}</button>`).join('')}</div><div class="rh-concept-answer" role="status" aria-live="polite" hidden></div></details><details class="rh-source"${openCode?' open':''}><summary>実コードをこの場で確かめる：${esc(c.title)} <span>L${c.source.start}–${c.source.end}</span></summary><div class="rh-source-body"><div class="rh-code-controls"><label><input type="checkbox" data-rh-basics${options.code==='first'?' checked':''}> 記号の一覧を表示</label><label><input type="checkbox" data-rh-trace${options.code!=='rust'?' checked':''}> 日本語の補助コメントを表示</label></div><div class="rh-basics"${options.code==='first'?'':' hidden'}><div class="rh-basic-links" aria-label="このコードにある記号の意味">${basicLinks(c)}</div></div><div class="rh-symbol-answer" role="status" aria-live="polite" hidden></div><div class="rh-code-navigation"><span class="rh-selection-status" role="status" aria-live="polite">行番号で選択できます。点線の下線は言葉の補助${annotated.callLinks.length?'、実線の下線は呼び出し先の実装':''}を開きます。</span><button type="button" data-rh-selected-hint hidden>この行のヒント</button></div><div class="rh-selection-answer" role="status" aria-live="polite" hidden></div><pre class="rh-code" tabindex="0" aria-label="${esc(c.title)}の実コード。記号の意味をその場で開けます">${codeHtml(annotated)}</pre>${c.note?`<p class="rh-source-note">${esc(c.note)}</p>`:''}<p class="rh-evidence">原文：${esc(c.source.path)} · ${esc(commit.slice(0,12))}。行番号・コードは原文のまま、ヒントは解説者による読解です。</p></div></details></section>`;
  }
  function readingSequence(r,id,isLocal,isJourney=false,options={}){
    if(!r)return '';
    const readings=r.readings?.length?r.readings:[{context:r.context,title:r.title,purpose:r.why,connection:r.scope}];
    const picker=readings.length>=8?`<details class="learn-code-advanced" data-reading-advanced><summary>処理名から直接探す</summary><div class="learn-code-picker"><label>処理を選ぶとそのコードへ移動します<select data-reading-destination>${readings.map((reading,i)=>`<option value="${esc(reading.context)}">${i+1}. ${reading.group?esc(reading.group)+'：':''}${esc(reading.title)}</option>`).join('')}</select></label><button type="button" data-reading-select-jump>もう一度表示</button></div></details>`:'';
    const stageHtml=readings.map((reading,i)=>{
      const c=context(reading.context,data().commit),owner=data().sourceOwners?.[reading.context]||(reading.context===r.context?r:undefined);if(!c||!owner?.crate)return '';
      const source=c.source,crate=owner.crate,origin=options.origin||(isJourney?{journey:id}:{lesson:id});
      const codeUrl=isLocal?'/reader#'+new URLSearchParams({path:source.path,code:1,start:source.start,end:source.end,...origin}):source.url;
      const crateUrl=isLocal?'/reader#'+new URLSearchParams({area:owner.area,crate:crate.id,...origin}):crate.url;
      const external=isLocal?'':' target="_blank" rel="noreferrer"';
      return `<section class="learn-reading-stage" id="reading-${esc(reading.context)}" data-reading-stage="${esc(reading.context)}" data-reading-essential="${reading.essential!==false}"><h3>${i+1}. ${esc(reading.title)}${reading.essential===false?' <small>詳しく読む</small>':''}</h3><p class="learn-reading-purpose">${esc(reading.purpose)}</p><div data-reading-help="${esc(reading.context)}" data-help-commit="${esc(data().commit)}" data-help-open="${reading.essential!==false&&(r.phases?.length?reading.group===readings[0].group:i===0)}" data-help-lesson="${isJourney?'':esc(id)}" data-help-journey="${isJourney?esc(id):''}" data-help-operation="${esc(options.operation||'')}" data-help-file-role="${esc(options.filePath||'')}" data-help-component="${esc(options.component||'')}" data-help-area="${esc(options.area||'')}" data-help-area-part="${esc(options.part||'')}"></div>${reading.connection?`<p class="learn-code-connection">${esc(reading.connection)}</p>`:''}<div class="learn-code-navigation"><button type="button" data-reading-back hidden>前に見ていたコードへ戻る</button>${readings[i+1]?`<button type="button" data-reading-jump="${esc(readings[i+1].context)}">次に読む：${esc(readings[i+1].title)} →</button>`:''}</div><details class="learn-source-links"><summary>原文のファイル・担当クレート</summary><div class="learn-implementation-links"><a href="${esc(codeUrl)}"${external}>原文のファイルと行範囲へ${isLocal?'':' ↗'}</a><a href="${esc(crateUrl)}"${external}>担当クレート：${esc(crate.name)}${isLocal?'':' ↗'}</a></div></details></section>`;
    });
    const groups=[];readings.forEach((reading,i)=>{const label=reading.group||'';let group=groups[groups.length-1];if(!group||group.label!==label)groups.push(group={label,items:[],contexts:[]});group.items.push(stageHtml[i]);group.contexts.push(reading.context);});
    const grouped=groups.some(g=>g.label),phases=grouped?`<nav class="learn-code-phases" aria-label="読む流れを選ぶ">${groups.map((g,i)=>`<button type="button" data-reading-phase="${i}" aria-pressed="${i===0}">${i+1}. ${esc(g.label||'関連する処理')}</button>`).join('')}</nav>`:'';
    const sections=groups.map((group,i)=>group.label?`<details class="learn-code-group" data-reading-group="${i}"${i===0?' open':''}><summary>${esc(group.label)} <span>（${group.items.length}箇所）</span></summary>${r.phases?.find(p=>p.title===group.label)?.relationship?`<p class="learn-phase-relationship">${esc(r.phases.find(p=>p.title===group.label).relationship)}</p>`:''}${group.items.join('')}</details>`:group.items.join('')).join('');
    return `${isJourney||options.header===false?'':`<span>説明をコードで確かめる</span><h2>${esc(r.title)}</h2><p>${esc(r.why)}</p>`}<details class="learn-core-code" open><summary>${readings.length>=8?'読む流れと処理を選ぶ':'このページで読むコード'}（${readings.length}箇所）</summary><p class="learn-code-scope">${esc(r.scope||'')}</p>${grouped?'<p class="learn-small">流れを選ぶと、必要な原文がこの下に開きます。ここでの並びは読む順番です。実行時の呼び出し・依頼と返答は、各コードの補助コメントで確認します。</p>':''}${phases}${picker}${sections}<p class="learn-small">「補助コメント」は解説者が添えた日本語です。行番号はRethの原文に対応します。担当クレートは、そのコードをまとめてビルドする単位です。</p></details>`;
  }

  function lessonBridge(id,isLocal){return readingSequence(data()?.lessonLinks?.find(r=>r.lesson===id),id,isLocal);}
  function journeyBridge(id,isLocal,commit=data()?.commit){if(!data()||commit!==data().commit)return '';const r=data().journeyLinks?.find(r=>r.id===id);return r?readingSequence({...r,context:r.readings[0]?.context,why:r.goal},id,isLocal,true):'';}
  function operationBridge(id,isLocal,origin,commit=data()?.commit){if(!data()||commit!==data().commit)return '';const r=data().operationLinks?.find(r=>r.id===id);return r?readingSequence({...r,readings:operationReadings(id)},id,isLocal,false,{header:false,operation:id,origin:origin||{step:id,from:'#'+new URLSearchParams({lens:'flow',step:id})}}):context('tx:'+id,data()?.commit)?`<p class="reading-uncovered">この段階の説明に必要な原文が、まだ揃っていません。選択した関数の原文を表示します。</p><div data-reading-help="tx:${esc(id)}" data-help-commit="${esc(data().commit)}"></div>`:'';}
  function fileRoleBridge(path,isLocal,commit=data()?.commit){if(!data()||commit!==data().commit)return '';const r=data().fileRoleLinks?.find(r=>r.path===path);return r?readingSequence(r,path,isLocal,false,{header:false,filePath:path,origin:{from:'#'+new URLSearchParams({path})}}):'';}
  function componentBridge(area,component,isLocal,commit=data()?.commit){if(!data()||commit!==data().commit)return '';const r=data().componentLinks?.find(r=>r.area===area&&r.component===component);return r?readingSequence(r,component,isLocal,false,{header:false,component:area+':'+component,origin:{area}}):'';}
  function areaBridge(id,part,isLocal,commit=data()?.commit){if(!data()||commit!==data().commit)return '';const a=data().areaReadings?.find(r=>r.area===id),r=part==='followup'?a?.followup:a;return r?.readings?.length?readingSequence({...r,scope:'「次に読む」は原文の読解順です。実際の要求と返答は、補助コメントと接続説明で確認します。'},id,isLocal,false,{header:false,area:id,part,origin:{from:'#'+new URLSearchParams({area:id})}}):'';}
  function routeBridge(route,isLocal=false,origin){
    const r=typeof route==='string'?data()?.routeRegistry?.routes.find(r=>r.id===route):route;
    if(!r?.readings?.length)return '';
    return readingSequence(r,r.key||r.id,isLocal,false,{header:false,origin:origin||r.origin});
  }
  function contextBridge(id,isLocal=false,origin){
    const c=context(id,data()?.commit);if(!c)return '';
    const ids=id==='startup:network'?[id,'area:network-budget']:[id];
    return readingSequence({readings:ids.filter(key=>context(key,data().commit)).map(key=>{const c=data().contexts[key];return {context:key,title:c.title,purpose:c.intro,connection:c.note||''};}),scope:'このファイルにある解説対象の抜粋です。呼び出し先は原文の実線の下線から同じ場所で開けます。'},id,isLocal,false,{header:false,origin});
  }
  function selectFlowGroup(scope,group){
    scope.querySelectorAll('[data-reading-phase]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.readingPhase===group?.dataset.readingGroup)));
    if(!group)return;
    scope.querySelectorAll('[data-reading-group]').forEach(other=>other.open=other===group);
    group.querySelectorAll('[data-reading-stage]').forEach(stage=>{if(stage.dataset.readingEssential!=='false'){const source=stage.querySelector('.rh-source');if(source)source.open=true;}});
  }
  function resetReadingTrail(scope){scope._readingTrail=[];scope.querySelectorAll('[data-reading-back]').forEach(button=>button.hidden=true);}
  function focusContext(id,line,scope=typeof document==='undefined'?undefined:document){
    if(!scope)return false;
    const target=[...(scope.matches?.('[data-reading-stage]')?[scope]:[]),...scope.querySelectorAll('[data-reading-stage]')].find(x=>x.dataset.readingStage===id)||[...(scope.matches?.('[data-reading-help]')?[scope]:[]),...scope.querySelectorAll('[data-reading-help]')].find(x=>x.dataset.readingHelp===id);
    if(!target)return false;
    const readingScope=target.closest('.learn-core-code');if(readingScope)selectFlowGroup(readingScope,target.closest('[data-reading-group]'));
    for(let parent=target;parent;parent=parent.parentElement)if(parent.tagName==='DETAILS')parent.open=true;
    const source=target.querySelector('.rh-source');if(!source)return false;source.open=true;
    const row=line?target.querySelector(`[data-rh-source-line="${Number(line)}"]`):undefined;row?.click();
    target.querySelector('[data-reading-help]')?._restoreSelectedSource?.();target._restoreSelectedSource?.();
    source.scrollIntoView({block:'start'});(row||source.querySelector('summary'))?.focus({preventScroll:true});return true;
  }
  function termHtml(id){const t=data()?.terms[id];if(!t)return '';return `<div class="rh-answer-heading"><strong>${esc(t.name)}</strong><button type="button" data-rh-close aria-label="ヒントを閉じる">閉じる</button></div><p>${esc(t.meaning)}</p><p class="rh-example">${esc(t.example)}</p>`;}
  function applyPreferences(){
    if(typeof document==='undefined')return;
    document.querySelectorAll('[data-chain-detail]').forEach(d=>{if(!d.dataset.manual)d.open=prefs().chain==='new';if(!d.dataset.bound){d.querySelector('summary')?.addEventListener('click',()=>{d.dataset.manual='true';});d.dataset.bound='true';}});
    document.querySelectorAll('[data-code-detail]').forEach(d=>{if(!d.dataset.manual)d.open=prefs().code!=='first';if(!d.dataset.bound){d.querySelector('summary')?.addEventListener('click',()=>{d.dataset.manual='true';});d.dataset.bound='true';}});
    document.querySelectorAll('[data-reading-advanced]').forEach(d=>{if(!d.dataset.manual)d.open=prefs().chain==='known'&&prefs().code!=='first';if(!d.dataset.bound){d.querySelector('summary')?.addEventListener('click',()=>{d.dataset.manual='true';});d.dataset.bound='true';}});
    document.querySelectorAll('[data-reading-help]').forEach(host=>{
      const p=prefs();host.dataset.chain=p.chain;host.dataset.code=p.code;
      for(const [selector,region,enabled] of [['[data-rh-basics]','.rh-basics',p.code==='first'],['[data-rh-trace]','.rh-inline-comment',p.code!=='rust']]){
        const control=host.querySelector(selector);if(control&&!control.dataset.manual){control.checked=enabled;host.querySelectorAll(region).forEach(node=>node.hidden=!enabled);}
      }
      host._updateSourceNavigation?.();
      host._restoreSelectedSource?.();
    });
  }
  function mount(scope=document){
    const wrapperSelector='[data-reading-operation],[data-file-role-reading],[data-component-reading],[data-area-reading-path]';
    const wrappers=[...(scope.matches?.(wrapperSelector)?[scope]:[]),...scope.querySelectorAll(wrapperSelector)];
    for(const wrapper of wrappers)if(!wrapper.dataset.ready){const local=wrapper.dataset.operationLocal==='true',commit=wrapper.dataset.operationCommit||data()?.commit,origin=wrapper.dataset.operationOrigin?{from:wrapper.dataset.operationOrigin}:undefined;const html=wrapper.dataset.areaReadingPath?areaBridge(wrapper.dataset.areaReadingPath,wrapper.dataset.areaReadingPart||'main',local,commit):wrapper.dataset.fileRoleReading?fileRoleBridge(wrapper.dataset.fileRoleReading,local,commit):wrapper.dataset.componentReading?componentBridge(wrapper.dataset.componentArea,wrapper.dataset.componentReading,local,commit):operationBridge(wrapper.dataset.readingOperation,local,origin,commit);if(html){wrapper.innerHTML=html;wrapper.dataset.ready='true';const manual=wrapper.parentElement?.querySelector('.manual-source');if(manual){if(!manual.dataset.manual)manual.open=false;manual.dataset.manual='true';manual.dataset.codeDetail='true';}}}
    const references=[...(scope.matches?.('[data-reading-reference]')?[scope]:[]),...scope.querySelectorAll('[data-reading-reference]')];
    for(const reference of references)if(!reference.dataset.ready){
      const id=reference.dataset.readingReference;
      const existing=[...document.querySelectorAll('[data-reading-stage]')].find(stage=>stage.dataset.readingStage===id);
      if(existing){reference.hidden=true;reference.dataset.ready='true';continue;}
      const c=context(id,reference.dataset.helpCommit);if(!c)continue;
      reference.hidden=false;reference.innerHTML=reference.dataset.referenceOperation?operationBridge(reference.dataset.referenceOperation,false,undefined,reference.dataset.helpCommit):`<section class="learn-reading-stage" id="reading-${esc(id)}" data-reading-stage="${esc(id)}"><div data-reading-help="${esc(id)}" data-help-commit="${esc(reference.dataset.helpCommit)}" data-help-open="true"></div></section>`;reference.dataset.ready='true';
    }
    for(const bridge of scope.querySelectorAll('[data-lesson-code]'))if(!bridge.dataset.ready){const html=lessonBridge(bridge.dataset.lessonCode,bridge.dataset.lessonLocal==='true');if(html){bridge.innerHTML=html;bridge.dataset.ready='true';}}
    const hosts=[...(scope.matches?.('[data-reading-help]')?[scope]:[]),...scope.querySelectorAll('[data-reading-help]')];
    for(const host of hosts){
      if(mounted.has(host))continue;
      const commit=host.dataset.helpCommit,id=host.getAttribute('data-reading-help')||forSource(host.dataset.helpPath,Number(host.dataset.helpLine),commit),c=topicContext(id,commit,host.dataset.helpRustTopic);
      if(!c){host.hidden=true;continue;}
      const stateKey=commit+':'+id,saved=transient.get(stateKey)||{};transient.set(stateKey,saved);
      host.hidden=false;const manual=host.parentElement?.querySelector('.manual-source');if(manual){if(!manual.dataset.manual)manual.open=false;manual.dataset.manual='true';manual.dataset.codeDetail='true';}if(host.closest?.('#files-content'))document.body.classList.add('has-guided-file');if(host.closest?.('#view'))document.body.classList.add('guided-source');host.innerHTML=render(id,commit,{openCode:typeof saved.openCode==='boolean'?saved.openCode:host.dataset.helpOpen!=='false',lesson:host.dataset.helpLesson,journey:host.dataset.helpJourney,rustTopic:host.dataset.helpRustTopic,operation:host.dataset.helpOperation,filePath:host.dataset.helpFileRole,component:host.dataset.helpComponent,area:host.dataset.helpArea,part:host.dataset.helpAreaPart});mounted.add(host);if(host.dataset.helpCompact==='true'){host.querySelector('.rh-source').hidden=true;}
      const showTerm=(termId,code)=>{
        const region=host.querySelector(code?'.rh-symbol-answer':'.rh-concept-answer');region.hidden=false;region.innerHTML=termHtml(termId);saved.term={id:termId,code};
      };
      const updateNavigation=()=>{
        const available=c.lines.some(h=>h.line===saved.sourceLine);
        const traceVisible=host.querySelector('[data-rh-trace]').checked;
        host.querySelector('[data-rh-selected-hint]').hidden=!available||traceVisible;
        if(traceVisible)host.querySelector('.rh-selection-answer').hidden=true;
      };
      host._updateSourceNavigation=updateNavigation;
      const selectSourceLine=(line,scroll=true)=>{
        if(!Number.isInteger(line)||line<c.source.start||line>c.source.end)return;
        saved.sourceLine=line;
        const index=c.lines.findIndex(h=>h.line===line);
        if(index>=0)saved.line=index;else delete saved.line;
        host.querySelectorAll('[data-code-line]').forEach(row=>row.classList.toggle('is-reading',Number(row.dataset.codeLine)===line));
        host.querySelectorAll('[data-rh-source-line]').forEach(b=>b.setAttribute('aria-pressed',String(Number(b.dataset.rhSourceLine)===line)));
        host.querySelector('.rh-selection-status').textContent=`選択中：L${line}${index<0?'（この行の解説はありません）':''}`;
        updateNavigation();
        host.querySelector('.rh-selection-answer').hidden=true;
        host.querySelectorAll('[data-comment-for]').forEach(comment=>comment.classList.toggle('is-reading',Number(comment.dataset.commentFor)===line));
        const comment=host.querySelector(`[data-comment-for="${line}"]`);
        const original=host.querySelector(`[data-code-line="${line}"]`),scroller=host.querySelector('.rh-code');
        if(scroll&&original&&scroller&&scroller.clientHeight>0){
          const start=comment&&!comment.hidden?comment.offsetTop:original.offsetTop,end=original.offsetTop+original.offsetHeight;
          // Keep the comment and original together when they fit; otherwise prioritize the original.
          scroller.scrollTop=Math.max(0,end-start<=scroller.clientHeight-24?start-12:original.offsetTop-12);
        }
      };
      const showLine=index=>{const hint=c.lines[index];if(hint)selectSourceLine(hint.line);};
      host._restoreSelectedSource=()=>{if(Number.isInteger(saved.sourceLine))selectSourceLine(saved.sourceLine);};
      host.addEventListener('click',event=>{
        const term=event.target.closest('[data-rh-term]');
        if(term){host._hintTrigger=term;const code=!!term.closest('.rh-source');showTerm(term.dataset.rhTerm,code);return;}
        if(event.target.closest('[data-rh-close]')){event.target.closest('.rh-symbol-answer,.rh-concept-answer').hidden=true;delete saved.term;host._hintTrigger?.focus({preventScroll:true});return;}
        const sourceLine=event.target.closest('[data-rh-source-line]');
        if(sourceLine){selectSourceLine(Number(sourceLine.dataset.rhSourceLine),false);return;}
        if(event.target.closest('[data-rh-selected-hint]')){
          const hint=c.lines.find(h=>h.line===saved.sourceLine);if(!hint)return;
          const answer=host.querySelector('.rh-selection-answer');answer.hidden=false;
          answer.innerHTML=`<div class="rh-answer-heading"><strong>L${hint.line} · ${esc(hint.label)}</strong><button type="button" data-rh-close-line>閉じる</button></div><p>${esc(hint.explanation)}</p>`;return;
        }
        if(event.target.closest('[data-rh-close-line]')){host.querySelector('.rh-selection-answer').hidden=true;host.querySelector('[data-rh-selected-hint]').focus({preventScroll:true});return;}
      });
      host.querySelector('.rh-source').addEventListener('toggle',event=>{saved.openCode=event.currentTarget.open;if(saved.openCode)host._restoreSelectedSource?.();});
      if(Number.isInteger(saved.sourceLine))selectSourceLine(saved.sourceLine,false);else if(Number.isInteger(saved.line))showLine(saved.line);
      if(saved.term)showTerm(saved.term.id,saved.term.code);
      host.querySelectorAll('[data-rh-basics],[data-rh-trace]').forEach(input=>input.addEventListener('change',()=>{
        input.dataset.manual='true';saved[input.hasAttribute('data-rh-basics')?'basics':'trace']=input.checked;host.querySelectorAll(input.hasAttribute('data-rh-basics')?'.rh-basics':'.rh-inline-comment').forEach(node=>node.hidden=!input.checked);updateNavigation();host._restoreSelectedSource();
      }));
      for(const [key,selector,region] of [['basics','[data-rh-basics]','.rh-basics'],['trace','[data-rh-trace]','.rh-inline-comment']])if(typeof saved[key]==='boolean'){const input=host.querySelector(selector);input.checked=saved[key];input.dataset.manual='true';host.querySelectorAll(region).forEach(node=>node.hidden=!saved[key]);}
    }
    scope.querySelectorAll('[data-reading-group]').forEach(group=>{if(group.dataset.flowBound)return;group.dataset.flowBound='true';
      group.querySelector(':scope > summary')?.addEventListener('click',()=>{resetReadingTrail(group.closest('.learn-core-code'));});
      group.addEventListener('toggle',()=>{if(group.open)selectFlowGroup(group.closest('.learn-core-code'),group);});
    });
    applyPreferences();
  }
  globalThis.ReadingHelp={context,forSource,render,codeHtml,termHtml,lessonBridge,journeyBridge,operationBridge,operationReadings,fileRoleBridge,componentBridge,areaBridge,mount,applyPreferences,callRoutes,topicContext,routeBridge,contextBridge,focusContext};
  if(typeof document!=='undefined'){
    document.addEventListener('click',event=>{
      const phase=event.target.closest('[data-reading-phase]');
      if(phase){
        const scope=phase.closest('.learn-core-code'),group=scope.querySelector(`[data-reading-group="${phase.dataset.readingPhase}"]`);if(!group)return;
        resetReadingTrail(scope);selectFlowGroup(scope,group);
        const target=group.querySelector('[data-reading-stage]');if(target)focusContext(target.dataset.readingStage,undefined,scope);return;
      }
      const reference=event.target.closest('[data-reading-ref]');
      if(reference){
        reference.closest('dialog')?.close();
        const id=reference.dataset.readingRef,target=[...document.querySelectorAll('[data-reading-stage]')].find(stage=>stage.dataset.readingStage===id);
        if(!target)return;
        const scope=target.closest('.learn-core-code');if(scope){scope._readingTrail=[];scope.querySelectorAll('[data-reading-back]').forEach(button=>button.hidden=true);const picker=scope.querySelector('[data-reading-destination]');if(picker)picker.value=id;}
        focusContext(id,Number(reference.dataset.readingTargetLine)||undefined,target);return;
      }
      const pickerJump=event.target.closest('[data-reading-select-jump]');
      const jump=pickerJump||event.target.closest('[data-reading-jump],[data-reading-back]');if(!jump)return;
      const host=jump.closest('[data-reading-help]'),scope=jump.closest('.learn-core-code,[data-reading-navigation-scope]')||host?.parentElement;if(!scope)return;
      scope.dataset.readingNavigationScope='true';
      const trail=scope._readingTrail||(scope._readingTrail=[]);let destination;
      if(pickerJump){trail.length=0;destination={context:scope.querySelector('[data-reading-destination]').value};}
      else if(jump.hasAttribute('data-reading-back'))destination=trail.pop();
      else{
        const origin=jump.closest('[data-reading-stage]'),id=origin?.dataset.readingStage||host?.dataset.readingHelp;
        if(id)trail.push({context:id,line:Number(jump.closest('[data-code-line]')?.dataset.codeLine)||undefined});
        destination={context:jump.dataset.readingJump,line:Number(jump.dataset.readingTargetLine)||undefined};
      }
      if(!destination)return;
      let target=[...scope.querySelectorAll('[data-reading-stage]')].find(x=>x.dataset.readingStage===destination.context)||[...scope.querySelectorAll('[data-reading-help]')].find(x=>x.dataset.readingHelp===destination.context);
      if(!target&&context(destination.context,data().commit)){
        const c=data().contexts[destination.context],stage=document.createElement('section');stage.className='learn-reading-stage rh-followed-source';stage.dataset.readingStage=destination.context;
        stage.innerHTML=`<h3>${esc(c.title)}</h3><p>${jump.dataset.readingKind==='macro'?'実線の下線から開いたマクロの定義です。展開元のコードへ戻れます。':'実線の下線から開いた呼び出し先です。元の呼び出し行へ戻れます。'}</p><div data-reading-help="${esc(destination.context)}" data-help-commit="${esc(data().commit)}"></div><button type="button" data-reading-back>前に見ていたコードへ戻る</button>`;scope.append(stage);mount(stage);target=stage;
      }
      if(!target)return;
      const picker=scope.querySelector('[data-reading-destination]');if(picker&&[...picker.options].some(o=>o.value===destination.context))picker.value=destination.context;
      scope.querySelectorAll('[data-reading-back]').forEach(button=>button.hidden=!trail.length);
      focusContext(destination.context,destination.line,scope);
    });
    document.addEventListener('change',event=>{if(event.target.matches('[data-reading-destination]'))event.target.closest('.learn-core-code')?.querySelector('[data-reading-select-jump]')?.click();});
    document.dispatchEvent(new Event('reading-help-ready'));
    mount();document.addEventListener('reading-context-change',()=>mount());document.addEventListener('reading-preferences-change',applyPreferences);
  }
})();
