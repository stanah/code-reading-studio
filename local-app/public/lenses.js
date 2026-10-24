/* Shared by the hosted reading guide and the Git-backed local application. */
(()=>{
const e=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const route=p=>'#'+new URLSearchParams(p).toString();
const a=(p,t)=>`<a class="lens-link" href="${e(route(p))}">${e(t)}</a>`;
const lessons={
 borrow:{name:'値を貸す・渡す',rust:'&tx / &self / move',steps:['recover','submit'],problem:'バイト列を読む処理と、その値を後で使う非同期処理で、データをどう受け渡すか。',plain:'ここでは &tx でバイト列を借りて読みます。所有権は元の持ち主に残ります。&self はこのメソッドの対象を借りる引数です。',ts:'function inspect(tx: Uint8Array): void {\n  // 同じオブジェクトへの参照を受け取る\n}\ninspect(tx); // 呼び出し元も引き続き参照できる',difference:'TypeScriptのオブジェクト参照にはRustの借用チェックがありません。Rustでは有効な借用の期間や、変更可能な参照の競合をコンパイラーが検査します。moveもコピーの意味ではなく、値によっては所有権を移します。',benefit:'ここでは &tx で復元処理に貸したあと、元のバイト列を WithEncoded に渡します。復元結果と元データを組にして次へ進める点に注目します。'},
 future:{name:'後で結果を受け取る',rust:'impl Future / async move / .await',steps:['rpc','recover','queue','batch'],problem:'別の処理が終わるまで、実行スレッドを占有せずに結果を待ちたい。',plain:'Futureは非同期処理の進行と結果を表す値です。.await でその処理を進め、完了を待ちます。async move は非同期ブロックが使用する値を取り込みます。',ts:'async function submit(tx: Tx): Promise<Hash> {\n  return await pool.add(tx);\n}',difference:'PromiseとFutureは同一ではありません。JavaScriptのasync関数は呼び出すと実行を開始します。Rustのasyncブロックやasync関数が返すFutureは、作っただけでは本体が進まず、ポーリングが必要です。asyncは別スレッドの意味でもありません。',benefit:'キューに要求を渡した側は返答をawaitし、処理する側と分離できます。戻り値の + Send はそのFutureをスレッド間で移動できるという条件です。'},
 result:{name:'失敗を戻り値で表す',rust:'Result<T, E> / ? / await??',steps:['rpc','recover','queue','pool'],problem:'復元や検証に失敗した場合、後続処理を止めて呼び出し元へ伝えたい。',plain:'Result<T, E> は成功のOk(T)か失敗のErr(E)のどちらかです。この送信経路の ? は成功なら中身を取り出し、失敗なら現在の関数やasyncブロックからエラーを返します。',ts:'type Result<T, E> =\n  | { ok: true; value: T }\n  | { ok: false; error: E };\nconst r = recover(tx);\nif (!r.ok) return r; // 失敗を呼び出し元へ返す',difference:'? はTypeScriptのオプショナルチェーン ?. ではありません。Resultの失敗は通常の値で、例外をthrowすることとも異なります。Rustの ? には必要に応じてエラー型を変換する仕組みもあります。',benefit:'response_rx.await?? では、返答チャネルの失敗と、受け取ったプール追加結果の失敗を順に扱います。「返答を受け取れなかった」と「プールへの追加が失敗した」を分けて読めます。'},
 trait:{name:'共通処理と実装を分ける',rust:'trait / Self / 関連型',steps:['rpc','recover','submit','pool'],problem:'共通のRPC処理を保ちつつ、使うプールや具体的な処理を差し替えたい。',plain:'traitは型が提供する操作などの約束です。Selfはその約束を実装する型を指します。関連型はその実装が使う型を約束の中で定める仕組みです。',ts:'interface Pool<Tx> {\n  add(tx: Tx): Promise<Hash>;\n}\n// 呼び出す側は具体クラスから切り離せる',difference:'上のinterfaceはtraitを理解するための類推です。Rustのtraitにはメソッドの既定実装や関連型があります。TypeScriptの構造的な型の一致と、Rustでtraitを実装することは同じではありません。traitを使うだけで実行時の動的ディスパッチになるわけでもありません。',benefit:'共通ヘルパーからEthereum向け実装へ処理を渡す境界を読みます。Self::ErrorやSelf::Poolは、今の実装が選んだ型という意味で捉えると読み進めやすくなります。'},
 channel:{name:'要求と返答を分離する',rust:'channel / oneshot',steps:['queue','batch'],problem:'要求をまとめて処理する側と、個別の結果を待つ側を分離したい。',plain:'要求をキューへ送り、要求ごとのoneshotチャネルで結果を受け取ります。このチャネルで送れる返答は1回だけです。キューへ送れたことと、プールへの追加が成功したことは別です。',ts:'// 概念用の疑似コード。Rethの移植ではありません。\nconst result = new Promise<Result<Hash, Error>>(resolve => {\n  queue.push({ tx, reply: resolve });\n});\nreturn await result;',difference:'ここで使うTokioのoneshotは送信側と受信側を持つチャネルです。Promiseのresolveコールバックそのものではありません。値を送らずに送信側が破棄された場合など、受信できない失敗も扱います。',benefit:'バッチ処理は複数要求をまとめて扱い、各要求に結果を返します。呼び出しスタックだけでは見えにくい非同期の境界です。'}
};
const groups=[{id:'receive',name:'1. 要求を受け取り、送信者を復元する',input:'署名済みのバイト列',output:'送信者を復元したトランザクション',ids:['rpc','recover']},{id:'dispatch',name:'2. Ethereum向け実装からキューへ渡す',input:'復元したトランザクションと元データ',output:'キューの追加要求と返答待ち',ids:['submit','queue']},{id:'validate',name:'3. 検証して保持し、結果を返す',input:'追加要求',output:'ハッシュまたはエラー',ids:['batch','pool']}];

const firstReading={
 rpc:{summary:'アプリから届いた送信要求を、Rethの送信処理へ渡す入口です。ここではまだ、ブロックへの取り込みを行いません。',input:'署名済みトランザクションのバイト列',output:'処理結果。成功なら識別用のハッシュ、失敗ならエラー'},
 recover:{summary:'署名済みデータを読み解き、署名から送信者を復元します。読み取れないデータや署名の問題は、ここで失敗として返します。',input:'署名済みのバイト列',output:'送信者を復元したトランザクションと元のデータ'},
 submit:{summary:'Ethereum向けの実装が次の処理を決めます。通常はプールへの追加を依頼しますが、設定による外部転送などの分岐もあります。',input:'復元したトランザクションと元のデータ',output:'追加や転送の結果。成功ならハッシュ、失敗ならエラー'},
 queue:{summary:'追加の要求を内部キューへ渡し、結果が返るのを待ちます。要求を渡せたことと、プールへの追加成功は別です。',input:'プールへ追加したいトランザクション',output:'処理する側から届く、プール追加の結果'},
 batch:{summary:'キューから届いた複数の追加要求をまとめて扱い、それぞれの結果を返します。',input:'キューに届いた追加要求',output:'要求ごとのプール追加結果'},
 pool:{summary:'トランザクションを検証し、プールへ追加します。成功しても、ブロックへの取り込みや確定まで終わったという意味ではありません。',input:'追加を依頼されたトランザクション',output:'追加の結果。成功ならハッシュ、失敗ならエラー'}
};
function lessonArticle(key,l,step){
 const benefit=step?.language||l.benefit;
 const marker=step?.id==='rpc'&&key==='result'?'Result / .await?':step?.id==='rpc'&&key==='future'?'async fn / .await':l.rust;
 return `<article class="card"><span class="tag">${e(marker)}</span><h2>${e(l.name)}</h2><h3>解決したいこと</h3><p>${e(l.problem)}</p><h3>まず日本語で</h3><p>${e(l.plain)}</p><details class="rh-ts-comparison"><summary>TypeScriptの例と比べる</summary><h3>TypeScriptで考えると</h3><p class="meta">理解のための簡略例 · 等価な移植コードではありません</p><pre>${e(l.ts)}</pre><h3>ここはTypeScriptと違う</h3><div class="note">${e(l.difference)}</div></details><h3>いま読んでいる実装で確かめる点</h3><p>${e(benefit)}</p></article>`;
}
function render(root,{steps=[],commit='',sourceUrl,structureUrl},p={}){
 const lens=['structure','flow','rust'].includes(p.lens)?p.lens:'flow',step=steps.find(s=>s.id===p.step),group=groups.find(g=>g.id===p.group);
 const guided=globalThis.LearningStudio?.codeExperience?globalThis.LearningStudio.codeExperience()==='first':globalThis.LearningStudio?.profile?.()==='foundation';
  const tabs=`<nav class="lens-tabs" aria-label="この処理の別の見方">${[['structure','構造から読む'],['flow','動作から読む'],['rust','Rust・設計から読む']].map(([id,name])=>`<a ${id===lens?'aria-current="page"':''} href="${e(route({lens:id,...(step?{step:step.id}:{})}))}">${name}</a>`).join('')}</nav>`;
 const head=`<p class="eyebrow">RETH / READING GUIDE</p><h1>${step&&lens==='flow'?e(step.title):lens==='rust'?'この処理に必要なRustを読む':lens==='structure'?'この処理は、どこに書かれている？':'送信要求は、どこへ進む？'}</h1><p class="lead">入力と出力、途中の変化をつかんでから、根拠のコードで確かめます。Rustの補足は、必要なところで開けます。</p>${tabs}<p class="meta">${step?`現在の対象：${e(step.title)}`:'題材：トランザクションを送る'} · ${e(commit.slice(0,12))}</p><p class="lens-evidence">解説者による読解メモ · 固定コミットのコードに対応。実行トレース・自動生成の呼び出しグラフではありません。</p>`;
 if(!steps.length){root.innerHTML=head+'<p class="empty">このコミットに対応した動作・Rust解説はまだありません。構造の探索からコードを選んでください。</p>';return;}
 const evidence=s=>`<p class="meta">根拠: ${e(s.path)} L${s.start}–${s.end}</p><div class="toolbar"><a class="lens-link primary" href="${e(sourceUrl(s))}">根拠の実コードへ →</a>${guided?`<details class="lens-placement"><summary>コードの配置を調べる</summary><a class="lens-link" href="${e(structureUrl(s))}">モジュールを探索 →</a></details>`:`<a class="lens-link" href="${e(structureUrl(s))}">モジュールを探索 →</a>`}</div>`;
 const stepCard=s=>`<a class="card" href="${e(route({lens,step:s.id}))}"><span class="tag">処理を詳しく</span><h2>${e(s.title)}</h2><p>${e(s.subtitle)}</p><span class="meta">${e(s.symbol)}</span></a>`;
 let body='';
 if(lens==='flow'){
  if(step){
   const keys=Object.keys(lessons).filter(k=>lessons[k].steps.includes(step.id));
   const simple=firstReading[step.id];
   const technical=`<p>${e(step.summary)}</p><div class="cards"><section class="card"><h2>受け取るもの</h2><p>${e(step.input)}</p></section><section class="card"><h2>返すもの</h2><p>${e(step.output)}</p></section></div><h2>この段階で起きること</h2><div class="note">${e(step.detail)}</div><h2>副作用・失敗・分岐</h2><p>${e(step.side)}</p><p>${e(step.branch)}</p>`;
   body=`${a({lens:'flow',group:groups.find(g=>g.ids.includes(step.id))?.id},'← ひとつ上の処理へ')}${simple?`<p class="guide-plain">${e(simple.summary)}</p><div class="cards"><section class="card"><h2>受け取るもの</h2><p>${e(simple.input)}</p></section><section class="card"><h2>返すもの</h2><p>${e(simple.output)}</p></section></div>`:''}<div data-reading-help="tx:${e(step.id)}" data-help-commit="${e(commit)}"></div><details class="guide-technical" data-code-detail${guided?'':' open'}><summary>型名・分岐・実装の説明を読む</summary><div>${technical}</div></details><details class="rh-more-lessons"><summary>Rustの補足を詳しく読む</summary><h2>Rustが分からなくなったら</h2><div class="toolbar">${keys.map(k=>`<details class="rh-inline-lesson"><summary>${e(lessons[k].name)}</summary>${lessonArticle(k,lessons[k],step)}</details>`).join('')}</div></details>${evidence(step)}<div class="toolbar">${steps.indexOf(step)>0?a({lens,step:steps[steps.indexOf(step)-1].id},'← 前の段階'):''}${steps.indexOf(step)<steps.length-1?a({lens,step:steps[steps.indexOf(step)+1].id},'次の段階 →'):''}</div>`;

  }else if(group){body=`${a({lens:'flow'},'← ユースケース全体へ')}<h2>${e(group.name)}</h2><p>${e(group.input)} → ${e(group.output)}</p><div class="cards">${steps.filter(s=>group.ids.includes(s.id)).map(stepCard).join('')}</div>`;
  }else{body='<h2>署名済みトランザクションを送ると、何が起きる？</h2><p>正常経路の大きな流れです。まず3段階から選び、次に部品間の受け渡しを見ます。</p><div class="lens-flow">'+groups.map(g=>`<a class="card" href="${e(route({lens,group:g.id}))}"><h2>${e(g.name)}</h2><p>入力：${e(g.input)}</p><p>出力：${e(g.output)}</p><span class="tag">内側の処理を見る →</span></a>`).join('<span class="flow-arrow" aria-hidden="true">↓</span>')+'</div><div class="note">返るハッシュはブロックへの取り込み完了やレシートを意味しません。\n設定によって外部への転送などの分岐があります。第2段階で確認します。</div>';}
 }else if(lens==='structure'){
 body=`<h2>動作の担当箇所をコードの配置で見る</h2><p>クレートはRustのコンパイル単位です。Cargoのパッケージには複数のクレートが含まれることもあり、npmパッケージとの一対一対応ではありません。</p><div class="cards">${(step?[step]:steps).map(s=>`<section class="card"><h2>${e(s.title)}</h2><p>${e(s.subtitle)}</p><p class="meta">${e(s.path)}</p><div class="toolbar">${a({lens:'flow',step:s.id},'動作で理解する')}${a({lens:'rust',step:s.id},'Rustの読み方')}</div><a href="${e(structureUrl(s))}">担当モジュールを開く →</a></section>`).join('')}</div>`;
 }else{
 const keys=Object.keys(lessons).filter(k=>!step||lessons[k].steps.includes(step.id));const key=keys.includes(p.topic)?p.topic:keys[0],l=lessons[key];
 body=`${step?`<div data-reading-help="tx:${e(step.id)}" data-help-commit="${e(commit)}" data-help-open="true"></div>`:''}<h2>必要な構文の意味を確かめる</h2><div class="toolbar">${keys.map(k=>a({lens,topic:k,...(step?{step:step.id}:{})},lessons[k].name)).join('')}</div>${lessonArticle(key,l,step)}<h2>対応する処理を読む</h2><div class="cards">${steps.filter(s=>l.steps.includes(s.id)&&(!step||s.id===step.id)).map(s=>`<section class="card"><h2>${e(s.title)}</h2>${a({lens:'flow',step:s.id},'処理の説明へ戻る')}${evidence(s)}</section>`).join('')}</div>`;
 }
 root.innerHTML=head+body;globalThis.ReadingHelp?.mount(root);
}
globalThis.ReadingLenses={render,lessons,groups};
})();
