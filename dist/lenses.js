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
// Each claim is authored against its own source lines; step.language is deliberately not reused.
const rustEvidence={
 borrow:{
  recover:{purpose:'借りて読む箇所と、値を渡す箇所を区別する',claims:[{line:89,match:'&tx',text:'L89 の &tx は元データを貸して読みます。L92 では tx 自体を WithEncoded に渡します。借りることと値を渡すことを同じ操作として読まないでください。'},{line:92,match:'WithEncoded::new(tx',text:'復元結果と元のデータを組にして渡します。async move が使う値を取り込む範囲は L88 のブロックです。'}]},
  submit:{purpose:'共有する対象と、受け取った値の所有を区別する',claims:[{line:33,match:'&self',text:'L33 の &self は EthApi を借りる引数です。一方 L35 の tx は値で受け取り、L37 の split() がそれを消費して二つへ分けます。& が付く対象を確認して読み分けます。'},{line:37,match:'tx.split()',text:'mut は pool_transaction の束縛を変更可能にします。&mut self の意味ではありません。'}]}
 },
 future:{
  rpc:{purpose:'非同期の呼出結果を待つ入口を読む',claims:[{line:921,match:'async fn',text:'L921 の async fn は Future を返す関数です。L923 の .await が send_raw_transaction の結果を待ちます。ここに別スレッドの起動指示はありません。'},{line:923,match:'.await?',text:'通常のローカル追加経路で比べると、この待機の先はrecoverのasync moveと、その先のqueueの返答待ちです。同ページの「デコードして送信者を復元」と「追加要求をチャネルへ送る」の節で比較できます。'}]},
  recover:{purpose:'Future を返す型と、その本体を読む',claims:[{line:87,match:'impl Future',text:'L87 は具体的な型名を隠して Future を返す宣言です。結果は Result、+ Send はその Future をスレッド間で移せる条件です。'},{line:88,match:'async move',text:'L88 で Future の本体を作り、L94 で次の処理を待ちます。作っただけで本体が完了するわけではありません。'}]},
  queue:{purpose:'要求を渡した後の待機を読む',claims:[{line:503,match:'response_rx.await',text:'L503 は要求ごとの返答を待ちます。キューへ送れた L500 と、返答が来る L503 は別の時点です。待っている間ずっとスレッドを占有する、という意味ではありません。'}]},
  batch:{purpose:'待たれる処理と、進行させる側をつなぐ',claims:[{line:71,match:'.await',text:'L71 は単件のプール追加を待ちます。複数件では L91 / L101 の追加を待ちます。処理を開始させる側は、同ページの「Future が進む側」の poll と tokio::spawn にあります。'},{line:91,match:'.await',text:'Future の作成・実行器による poll・.await の待機を分けて読みます。into_iter / unzip はこの非同期の仕組み自体ではありません。'}]}
 },
 result:{
  rpc:{purpose:'呼出先の Err が入口へ戻る箇所を読む',claims:[{line:923,match:'.await?',text:'L923 は await の結果へ ? を適用します。Ok なら中身を取り出して外側の Ok(...) へ進み、Err ならこの関数から返ります。EVM の Revert や失敗レシートを示す記号ではありません。'}]},
  recover:{purpose:'読取り・署名復元の失敗を戻す箇所を読む',claims:[{line:89,match:'&tx)?',text:'L89 の復元が Err なら ? でこの async ブロックから返り、L90 以降へ進みません。L108 の map_err は成功値を変えず、エラーの型を合わせます。'},{line:108,match:'.map_err',text:'失敗が Result の値として返ることと、panic で処理が中断することを区別します。'}]},
  queue:{purpose:'二層の失敗を順に読む',claims:[{line:501,match:'.map_err',text:'L501 の ? は要求をキューへ渡せない失敗を返します。L503 の最初の ? は返答チャネルから受信できない失敗、二つ目の ? は受け取ったプール追加結果の Err を扱います。'},{line:503,match:'await??',text:'二つの ? があるのは同じ検証を二度するためではなく、Result の中に Result があるためです。'}]},
  pool:{purpose:'プールの結果を返すことと panic を区別する',claims:[{line:499,match:'PoolResult',text:'L499 の戻り値は PoolResult です。L501 が返す配列には追加の成功または失敗が入り、L502 は最後の Result を取り出して呼出元へ返します。'},{line:502,match:'.expect(',text:'expect は配列から取り出す Option が空なら panic します。Result の Err を ? で呼出元へ返す操作ではありません。検証失敗の通常経路と、内部で想定する結果件数の破れを分けます。'}]}
 },
 trait:{
  rpc:{purpose:'入口から共通ヘルパーへの委譲を読む',claims:[{line:923,match:'EthTransactions::send_raw_transaction',text:'L923 は EthTransactions の共通ヘルパーへ渡す箇所です。trait の約束は同ページの「約束と既定実装」、EthApi の impl は「具体実装」の節で確かめます。'}]},
  recover:{purpose:'trait の既定処理と実装が決める型を読む',claims:[{line:87,match:'Self::Error',text:'Self::Error は現在の実装が使うエラー型です。L90 の self.send_pool_transaction は具体実装へ渡す境界で、同ページの「具体実装：EthApi が EthTransactions を実装する」に対応します。'},{line:99,match:'Self::Pool',text:'Self::Pool は実装が提供するプール型で、継承する trait から得る関連型も含みます。Self は常に EthTransactions という trait 自体の型、という意味ではありません。'}]},
  submit:{purpose:'具体的な EthApi 実装の処理を読む',claims:[{line:35,match:'Self::Pool',text:'この send_pool_transaction は、同ページの「具体実装」にある impl EthTransactions for EthApi の内側です。Self::Pool / Self::Error は EthApi に結び付く型です。共通処理から、この Ethereum 向け実装へ制御が移ります。'}]},
  pool:{purpose:'具体的なプールが選ぶトランザクション型を読む',claims:[{line:498,match:'Self::Transaction',text:'L498 の Self::Transaction はこのプール実装が扱う関連型です。EthApi 側の Self と、ここでの Self は別の実装を指します。型名が Self というだけで同じ型とは限りません。'}]}
 },
 channel:{
  queue:{purpose:'要求と返答先を組にして送る側を読む',claims:[{line:496,match:'oneshot::channel()',text:'L496 が一度だけ返す返答用の両端を作り、L497 で返答を送る端を要求へ入れます。L500 で要求キューへ送り、受け取る端は L503 で待ちます。'},{line:503,match:'response_rx.await',text:'要求キューへの送信成功では追加結果はまだ分かりません。同ページの「バッチをプールへ引き渡す」が、同じ要求から response_tx を取り出して追加結果を返します。'}]},
  batch:{purpose:'要求を処理し、各返答先へ結果を返す側を読む',claims:[{line:70,match:'response_tx',text:'L70 は要求からトランザクションと返答先を取り出し、L71 の結果を L72 で返します。複数件は L92 / L102 で結果と対応する返答先を組にします。'},{line:72,match:'response_tx.send',text:'let _ = は返答先が失われたときの send の失敗をここでは使わない指定です。追加結果そのものは pool_result に入っています。要求の受信と起動は、同ページの「要求キューを読む側」の節にあります。'}]}
 }
};
const rustSupport={
 borrow:[],
 future:[{id:'batch-runner',purpose:'Future が進む側：要求を受信し、処理タスクを起動する',claims:[{line:114,match:'fn poll',text:'L114 の poll は実行器から呼ばれる進行処理です。L119 で要求を読み、L124–125 で非同期タスクを起動します。要求がなければ L133 の Pending で待ちます。'}]}],
 result:[],
 trait:[{id:'trait-contract',purpose:'約束と既定実装：EthTransactions の宣言',claims:[{line:65,match:'pub trait EthTransactions',text:'L65 が trait の宣言、L69 の signers は実装が提供する操作です。L72 の accounts には本体があり、共通の既定処理として使えます。同ページの「デコードして送信者を復元」に send_raw_transaction の既定処理があります。'}]},{id:'trait-implementation',purpose:'具体実装：EthApi が EthTransactions を実装する',claims:[{line:21,match:'EthTransactions for EthApi',text:'L21 の impl が具体型と trait を結び付け、L23–25 が利用する型の条件を示します。L28 の signers は EthApi 向けの処理です。同ページの「通常の送信経路を追う」に send_pool_transaction の実装があります。'}]}],
 channel:[{id:'batch-runner',purpose:'要求キューを読む側：poll から batch 処理へ',claims:[{line:119,match:'poll_recv_many',text:'L119 が要求をまとめて受信し、L124–125 で process_batch を動かします。queue の send → この受信 → batch の追加 → response_tx.send → queue の await が要求と返答の往復です。'}]}]
};
const groups=[
 {id:'receive',name:'1. 要求を受け取り、送信者を復元する',input:'署名済みのバイト列',output:'送信者を復元した取引と元のバイト列',outputLabel:'途中で次へ渡すデータ',note:'この図は途中の受け渡しを示します。RPC関数やsend_raw_transaction全体の戻り値ではありません。復元した取引と元データは、次のEthereum向け送信処理へ渡します。',ids:['rpc','recover']},
 {id:'dispatch',name:'2. Ethereum向け実装からキューへ渡す',input:'復元したトランザクションと元データ',output:'追加する取引・origin・返信先を持つキューの要求',outputLabel:'途中でキューへ渡すデータ',note:'通常経路の要求送信を示します。受付側の関数は、要求を渡した後も返信用チャネルで追加結果を待ちます。キューへの送信と関数の戻り値を分けて読みます。',ids:['submit','queue']},
 {id:'validate',name:'3. 検証して保持し、結果を返す',input:'追加要求',output:'取引ごとのプール追加結果、またはエラー',outputLabel:'返信用チャネルへ戻す結果',note:'成功時のAddedTransactionOutcomeはhashとstateを持ち、返信用チャネルで返します。process_batchの非同期処理の完了値()とは別です。通常経路では、上位のsend_pool_transactionが追加結果からRPCへ返すハッシュを取り出します。転送設定時は転送先RPCのハッシュを使い、転送後のローカル追加結果は返答に使いません。',ids:['batch','pool']}
];

const firstReading={
 rpc:{summary:'アプリから届いた送信要求を、Rethの送信処理へ渡す入口です。ここではまだ、ブロックへの取り込みを行いません。',input:'署名済みトランザクションのバイト列',output:'成功なら識別用のハッシュ、失敗ならRPCのエラー'},
 recover:{summary:'署名済みデータを読み解き、署名から送信者を復元して送信処理へ渡します。読み取れないデータや署名の問題は失敗になります。この関数全体は、さらに先の追加や転送の結果を待ちます。',input:'署名済みのバイト列',output:'成功なら取引のハッシュ、失敗ならエラー',transferLabel:'途中で送信処理へ渡すもの',transfer:'送信者を復元したトランザクションと元のバイト列'},
 submit:{summary:'Ethereum向けの実装が次の処理を決めます。通常はローカル追加結果を使い、転送設定時は転送先RPCの結果を使います。転送後のローカル追加も試みますが、その失敗は転送先の成功の返答を変えません。',input:'origin（取引の出所）と、復元したトランザクション・元のバイト列',output:'成功なら識別用のハッシュ、失敗ならエラー'},
 queue:{summary:'追加の要求を内部キューへ渡し、結果が返るのを待ちます。要求を渡せたことと、プールへの追加成功は別です。',input:'origin（取引の出所）と、プールへ追加したいトランザクション',output:'取引のハッシュとプール内の状態を持つ追加結果、またはエラー'},
 batch:{summary:'キューから届いた複数の追加要求をまとめて扱い、それぞれの結果を返信用チャネルで返します。',input:'キューに届いた追加要求',output:'()（この非同期処理の完了を表す値）',transferLabel:'返信用チャネルへ送るもの',transfer:'要求ごとのプール追加結果（成功時はハッシュと状態）、またはエラー'},
 pool:{summary:'トランザクションを検証し、プールへ追加します。成功しても、ブロックへの取り込みや確定まで終わったという意味ではありません。',input:'origin（取引の出所）と、追加を依頼されたトランザクション',output:'取引のハッシュとプール内の状態を持つ追加結果、またはエラー'}
};
function lessonArticle(key,l,step,withEvidence=true){
 const benefit=step?rustEvidence[key]?.[step.id]?.claims.map(c=>c.text).join(' ')||l.benefit:l.benefit;
 const marker=step?.id==='rpc'&&key==='result'?'Result / .await?':step?.id==='rpc'&&key==='future'?'async fn / .await':l.rust;
 return `<article class="card"><span class="tag">${e(marker)}</span><h2>${e(l.name)}</h2><h3>解決したいこと</h3><p>${e(l.problem)}</p><h3>まず日本語で</h3><p>${e(l.plain)}</p><details class="rh-ts-comparison"><summary>TypeScriptの例と比べる</summary><h3>TypeScriptで考えると</h3><p class="meta">理解のための簡略例 · 等価な移植コードではありません</p><pre>${e(l.ts)}</pre><h3>ここはTypeScriptと違う</h3><div class="note">${e(l.difference)}</div></details>${withEvidence?`<h3>いま読んでいる実装で確かめる点</h3><p>${e(benefit)}</p>`:''}</article>`;
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
   body=`${a({lens:'flow',group:groups.find(g=>g.ids.includes(step.id))?.id},'← ひとつ上の処理へ')}${simple?`<p class="guide-plain">${e(simple.summary)}</p><div class="cards"><section class="card"><h2>受け取るもの</h2><p>${e(simple.input)}</p></section><section class="card"><h2>非同期処理が完了したときの結果</h2><p>${e(simple.output)}</p></section>${simple.transfer?`<section class="card"><h2>${e(simple.transferLabel)}</h2><p>${e(simple.transfer)}</p></section>`:''}</div>`:''}<div data-reading-operation="${e(step.id)}" data-operation-commit="${e(commit)}" data-operation-local="${typeof document!=='undefined'&&document.body?.dataset.studio==='local'}"></div><details class="guide-technical" data-code-detail${guided?'':' open'}><summary>型名・分岐・実装の説明を読む</summary><div>${technical}</div></details><details class="rh-more-lessons"><summary>Rustの補足を詳しく読む</summary><h2>Rustが分からなくなったら</h2><div class="toolbar">${keys.map(k=>`<details class="rh-inline-lesson"><summary>${e(lessons[k].name)}</summary>${lessonArticle(k,lessons[k],step)}</details>`).join('')}</div></details>${evidence(step)}<div class="toolbar">${steps.indexOf(step)>0?a({lens,step:steps[steps.indexOf(step)-1].id},'← 前の段階'):''}${steps.indexOf(step)<steps.length-1?a({lens,step:steps[steps.indexOf(step)+1].id},'次の段階 →'):''}</div>`;

  }else if(group){body=`${a({lens:'flow'},'← ユースケース全体へ')}<h2>${e(group.name)}</h2><p>入力：${e(group.input)}</p><p>${e(group.outputLabel)}：${e(group.output)}</p><p class="meta">${e(group.note)}</p><div class="cards">${steps.filter(s=>group.ids.includes(s.id)).map(stepCard).join('')}</div>`;
  }else{body='<h2>署名済みトランザクションを送ると、何が起きる？</h2><p>正常経路の大きな流れです。まず3段階から選び、次に部品間の受け渡しを見ます。</p><div class="lens-flow">'+groups.map(g=>`<a class="card" href="${e(route({lens,group:g.id}))}"><h2>${e(g.name)}</h2><p>入力：${e(g.input)}</p><p>${e(g.outputLabel)}：${e(g.output)}</p><span class="tag">内側の処理を見る →</span></a>`).join('<span class="flow-arrow" aria-hidden="true">↓</span>')+'</div><div class="note">図の矢印は、担当間で渡すデータ・要求・返答を表します。各Rust関数の戻り値は、内側のコードで区別して確かめます。\n返るハッシュはブロックへの取り込み完了やレシートを意味しません。\n設定によって外部への転送などの分岐があります。第2段階で確認します。</div>';}
 }else if(lens==='structure'){
 body=`<h2>動作の担当箇所をコードの配置で見る</h2><p>クレートはRustのコンパイル単位です。Cargoのパッケージには複数のクレートが含まれることもあり、npmパッケージとの一対一対応ではありません。</p><div class="cards">${(step?[step]:steps).map(s=>`<section class="card"><h2>${e(s.title)}</h2><p>${e(s.subtitle)}</p><p class="meta">${e(s.path)}</p><div class="toolbar">${a({lens:'flow',step:s.id},'動作で理解する')}${a({lens:'rust',step:s.id},'Rustの読み方')}</div><a href="${e(structureUrl(s))}">担当モジュールを開く →</a></section>`).join('')}</div>`;
 }else{
 const keys=Object.keys(lessons).filter(k=>!step||lessons[k].steps.includes(step.id));const key=keys.includes(p.topic)?p.topic:keys[0],l=lessons[key];
 const selectedSteps=steps.filter(s=>l.steps.includes(s.id));
 // Selection sets the starting point; all evidence required by the topic stays on this page.
 if(step)selectedSteps.sort((a,b)=>(b.id===step.id)-(a.id===step.id));
 const sources=selectedSteps.map(s=>({id:s.id,title:s.title,...rustEvidence[key][s.id]})).concat((rustSupport[key]||[]).map(s=>({...s,title:s.purpose})));
 const exampleCode=sources.map(s=>`<section class="rust-source-example" data-rust-evidence="${e(key)}:${e(s.id)}"><h2>${e(s.title)}</h2><p>${e(s.purpose)}</p><div data-help-rust-topic="${e(key)}" data-reading-help="tx:${e(s.id)}" data-help-commit="${e(commit)}" data-help-open="true"></div></section>`).join('');
 body=`<h2>必要な構文の意味を確かめる</h2><div class="toolbar">${keys.map(k=>a({lens,topic:k,...(step?{step:step.id}:{})},lessons[k].name)).join('')}</div>${lessonArticle(key,l,step,false)}${exampleCode}<h2>対応する処理を読む</h2><div class="cards">${steps.filter(s=>l.steps.includes(s.id)&&(!step||s.id===step.id)).map(s=>`<section class="card"><h2>${e(s.title)}</h2>${a({lens:'flow',step:s.id},'処理の説明へ戻る')}${evidence(s)}</section>`).join('')}</div>`;
 }
 root.innerHTML=head+body;globalThis.ReadingHelp?.mount(root);
}
function rustContextClaims(topic,contextId){const id=contextId?.replace(/^tx:/,'');return rustEvidence[topic]?.[id]?.claims||rustSupport[topic]?.find(s=>s.id===id)?.claims;}
globalThis.ReadingLenses={render,lessons,groups,rustEvidence,rustSupport,rustContextClaims};
})();
