## root/topic

eth_sendRawTransaction → transaction pool

## root/sourceStatus

commit-pinned

## root/conditions/0

転送先なしの通常経路を中心に読む

## root/conditions/1

blob sidecar の変換処理は折りたたみ

## root/conditions/2

静的なコード読解。ノードやテストは未実行

## steps/rpc/title

RPC の入口を読む

## steps/rpc/question

署名済みトランザクションは、どこへ渡る？

## steps/rpc/subtitle

eth_sendRawTransaction のハンドラーから、共通ヘルパーへの委譲を追います。

## steps/rpc/node

RPC の入口

## steps/rpc/short

入口と委譲

## steps/rpc/summary

RPC ハンドラーは、共通のトランザクション処理へ委譲します。

## steps/rpc/detail

受け取った Bytes を EthTransactions::send_raw_transaction に渡し、結果を待ちます。成功時は B256 のハッシュを RPC の結果として返します。

## steps/rpc/input

署名済みトランザクションのバイト列（Bytes）

## steps/rpc/output

RpcResult<B256>：成功時はハッシュ

## steps/rpc/side

トレースログの記録、ヘルパーの呼び出し

## steps/rpc/branch

await? で失敗を呼び出し元へ伝播します。成功はブロック取り込みの完了を意味しません。

## steps/rpc/concept

.await? と Ok(...)

## steps/rpc/language

await で Future の結果を待ち、その Result に ? を適用します。Ok なら値を取り出し、Err なら必要な型変換を行って呼び出し元へ返します。

## steps/rpc/compare

TypeScript の await に似ていますが、Result の Err は Promise の reject とは別の値です。? がエラーの早期返却を明示します。

## steps/rpc/group

RPC

## steps/rpc/edge

ヘルパーへ委譲

## steps/recover/title

デコードして送信者を復元

## steps/recover/question

バイト列は、どうプール用の型になる？

## steps/recover/subtitle

生のバイト列からプール用トランザクションを復元し、Local として次へ渡します。

## steps/recover/node

デコード・送信者復元

## steps/recover/short

型と入力の確認

## steps/recover/summary

復元に成功したトランザクションを、元のバイト列と組にして渡します。

## steps/recover/detail

recover_raw_pool_transaction はキャッシュ設定に応じた復元フックを選びます。次の send_pool_transaction には TransactionOrigin::Local を指定し、WithEncoded に元のバイト列と復元結果を持たせます。

## steps/recover/input

Bytes と &self

## steps/recover/output

Result<B256, Self::Error> を返す Future

## steps/recover/side

設定に応じた復元処理、送信処理への委譲

## steps/recover/branch

復元の失敗時は ? で早期終了し、send_pool_transaction を呼びません。キャッシュの有無で呼ぶ復元フックが変わります。

## steps/recover/concept

&tx / async move / impl Future

## steps/recover/language

&tx は値を借用します。async move は使う値を非同期ブロックへ取り込みます。戻り値の impl Future は具体的な型名を隠しつつ、Future を返すことを表します。

## steps/recover/compare

TypeScript の型注釈と異なり、Rust の借用は所有権に関わる制約です。Future は通常、ポーリングされて処理が進みます。

## steps/recover/group

DECODE

## steps/recover/edge

EthApi の実装へ

## steps/submit/title

通常の送信経路を追う

## steps/submit/question

どの条件で、ローカルのプールへ進む？

## steps/submit/subtitle

転送先なし・blob 変換対象外の経路に注目します。省略箇所は展開できます。

## steps/submit/node

通常経路を選ぶ

## steps/submit/short

転送先の有無で分岐

## steps/submit/summary

通常経路では購読者へ通知し、プールへの追加結果を待ちます。

## steps/submit/detail

WithEncoded を分解した後、設定次第で blob sidecar の変換や外部 RPC への転送に分岐します。ここでは転送先がない経路を読み、add_pool_transaction の成功結果から hash を取り出します。

## steps/submit/input

origin と WithEncoded<PoolTx<Self::Pool>>

## steps/submit/output

成功時はプール追加結果の hash

## steps/submit/side

raw transaction 購読者への通知、追加要求

## steps/submit/branch

転送先があれば別経路で早期 return します。通常経路の追加失敗は ? で返ります。購読者への通知を P2P 伝播の完了と混同しないでください。

## steps/submit/concept

構造体パターン { hash, .. }

## steps/submit/language

AddedTransactionOutcome { hash, .. } は構造体を分解して hash を取り出します。.. は残りのフィールドを指定しないことを表します。

## steps/submit/compare

TypeScript のオブジェクト分割代入に似ていますが、Rust ではフィールドの所有権や借用も考慮します。

## steps/submit/group

BRANCH

## steps/submit/edge

追加要求を作る

## steps/queue/title

追加要求をチャネルへ送る

## steps/queue/question

RPC は、プールへの追加をどう待つ？

## steps/queue/subtitle

要求を送るチャネルと、結果を一度だけ受け取るチャネルを分けて読みます。

## steps/queue/node

要求と応答をつなぐ

## steps/queue/short

チャネルと二重の Result

## steps/queue/summary

バッチ処理へ要求を送り、oneshot で個別の結果を待ちます。

## steps/queue/detail

response_tx を要求に添えて tx_batch_sender に送ります。RPC 側は response_rx を保持し、処理側から追加結果が戻るのを待ちます。このメソッド自身はトランザクションの検証を実行していません。

## steps/queue/input

未検証トランザクションと origin

## steps/queue/output

Result<AddedTransactionOutcome, EthApiError>

## steps/queue/side

バッチ処理の要求キューへの送信

## steps/queue/branch

send 失敗は BatchTxSendError。await?? の一つ目は受信失敗、二つ目は届いた追加結果の失敗を伝播します。

## steps/queue/concept

oneshot / .await??

## steps/queue/language

oneshot は一度だけ結果を送受信するチャネルです。ここで await の結果は Result の中に Result を持つため、? を二回適用してそれぞれの失敗を処理します。

## steps/queue/compare

Promise の resolve 用コールバックを渡す構成に似ていますが、送信側・受信側が明示的な型に分かれ、チャネル切断も結果として扱います。

## steps/queue/group

CHANNEL

## steps/queue/edge

チャネル経由で受信

## steps/batch/title

バッチをプールへ引き渡す

## steps/batch/question

要求はいつ、一件または複数件で処理される？

## steps/batch/subtitle

一件・同じ origin・異なる origin の三つの分岐を確認します。

## steps/batch/node

まとめて引き渡す

## steps/batch/short

一件とバッチの分岐

## steps/batch/summary

要求の件数と origin に合わせて、プールの追加メソッドを選びます。

## steps/batch/detail

一件なら process_request → add_transaction、同じ origin の複数件なら add_transactions、混在時は add_transactions_with_origins を呼びます。各要求に添えられた response_tx に結果を戻します。

## steps/batch/input

Vec<BatchTxRequest<Pool::Transaction>>

## steps/batch/output

各要求の oneshot にプールの結果を返す

## steps/batch/side

検証・追加の委譲、応答チャネルへの送信

## steps/batch/branch

response_tx.send の結果は let _ で捨てています。受信側がなくても、この箇所ではエラーを上へ返しません。

## steps/batch/concept

into_iter / unzip / zip

## steps/batch/language

into_iter はコレクションを消費する反復を行います。ここで unzip はトランザクションと返信先を二つの Vec に分け、zip は各結果と返信先を順に組にします。

## steps/batch/compare

TypeScript の map で複数配列を作る考え方に近いですが、into_iter は元のコレクションの所有権を消費します。

## steps/batch/group

BATCH

## steps/batch/edge

検証付き API へ

## steps/pool/title

検証してプールに追加

## steps/pool/question

成功したら、すでにチェーンへ記録された？

## steps/pool/subtitle

プールへの追加と、ブロックへの取り込みを区別して読解を締めくくります。

## steps/pool/node

検証・プール追加

## steps/pool/short

ハッシュと確定の違い

## steps/pool/summary

検証結果を内部プールへ渡し、追加の成否を返します。

## steps/pool/detail

単件・複数件ともに検証を経由して内部プールへ渡します。単件では結果リストから一件を取り出します。この経路はレシートやブロック取り込みを待つ処理ではありません。

## steps/pool/input

未検証トランザクションと origin

## steps/pool/output

PoolResult<AddedTransactionOutcome>

## steps/pool/side

検証処理、内部プールの更新

## steps/pool/branch

検証結果を内部プールが扱い、追加結果を返します。結果リストが空なら expect は panic します。検証器の具体的な条件はこの抜粋の外です。

## steps/pool/concept

Self::Transaction / expect

## steps/pool/language

Self::Transaction は、この実装が使う関連型です。expect は値が存在すれば取り出し、存在しなければ指定メッセージで panic します。? によるエラー伝播とは挙動が違います。

## steps/pool/compare

TypeScript の非 null アサーション ! は実行時検証をしません。Rust の expect は実行時に失敗を検出し、panic します。

## steps/pool/group

POOL

## steps/pool/edge



## details/rpc-contract/title

RPC の公開インターフェース

## details/rpc-contract/question

通常版と Sync 版は、何を返す？

## details/rpc-contract/subtitle

公開メソッドの宣言とコメントを比較します。

## details/rpc-contract/node

RPC 定義

## details/rpc-contract/short

ハッシュとレシート

## details/rpc-contract/summary

通常版はハッシュを返し、Sync 版はレシートを待つと定義されています。

## details/rpc-contract/detail

sendRawTransaction と sendRawTransactionSync は別メソッドです。Sync 版のコメントには、一定時間内に取り込まれなければタイムアウトになることも記されています。

## details/rpc-contract/input

署名済みトランザクション

## details/rpc-contract/output

通常版：B256、Sync 版：レシート

## details/rpc-contract/side

ここはインターフェース宣言

## details/rpc-contract/branch

宣言から挙動の契約を確認できます。実行した結果ではありません。

## details/rpc-contract/concept

#[method(...)]

## details/rpc-contract/language

#[...] は属性です。この method 属性は RPC 用マクロのための情報で、公開されるメソッド名を指定しています。

## details/rpc-contract/compare

TypeScript のデコレーターと見た目は似ていますが、Rust の属性マクロはコンパイル時のコード生成などに使われます。

## details/recovery-hook/title

デフォルトの復元フック

## details/recovery-hook/question

どんな入力が、デコードで拒否される？

## details/recovery-hook/subtitle

PoolTransaction trait のデフォルト実装を確認します。具象型による上書きが可能です。

## details/recovery-hook/node

復元フック

## details/recovery-hook/short

デコードと署名の失敗

## details/recovery-hook/summary

デフォルト実装は空データを拒否し、デコードと送信者復元を行います。

## details/recovery-hook/detail

decode_2718_exact の失敗と、try_recover の失敗を別のエラーに変換します。これは trait のデフォルト実装であり、すべてのプール型が必ずこの本体を使うとは限りません。

## details/recovery-hook/input

&[u8]：バイト列の借用

## details/recovery-hook/output

復元された Self または RawPoolTransactionError

## details/recovery-hook/side

デコード・送信者復元

## details/recovery-hook/branch

空データ、デコード失敗、署名復元失敗を区別します。キャッシュありのフックも別にあります。

## details/recovery-hook/concept

&[u8] / Self / map_err

## details/recovery-hook/language

&[u8] はバイト列を借用するスライスです。Self はこの trait を実装する型を指します。map_err は Result のエラー側の値を変換します。

## details/recovery-hook/compare

Uint8Array を渡す感覚に近いですが、Rust の参照には借用と有効期間の制約があります。

## details/forward/title

転送先ありの分岐

## details/forward/question

外部へ転送した後、ローカル追加が失敗したら？

## details/forward/subtitle

通常経路とは異なる成功条件を持つ分岐へ寄り道します。

## details/forward/node

外部 RPC へ転送

## details/forward/short

エラーの扱いを比較

## details/forward/summary

転送が成功すれば、ローカル追加の失敗を返さずに転送先のハッシュを返します。

## details/forward/detail

外部 RPC の request は await と ? で失敗を伝播します。一方、後続の add_pool_transaction の結果は let _ で捨てています。通常経路の await? と比較するのが読解のポイントです。

## details/forward/input

設定された RPC クライアントとトランザクション

## details/forward/output

転送先が返した hash

## details/forward/side

購読者通知、外部 RPC 呼び出し、ローカル追加の試行

## details/forward/branch

外部への転送失敗はエラー。転送成功後のローカル追加失敗は、この分岐の返却結果に反映されません。

## details/forward/concept

if let Some / let _ =

## details/forward/language

if let Some(client) は Option が Some のときだけ中の値を取り出します。let _ = は式の結果を保持しません。ここでは Result の成功・失敗を検査していません。

## details/forward/compare

TypeScript の if (client) に近い分岐ですが、Option の Some/None を明示的に扱います。結果を捨てる処理と ? の伝播を区別しましょう。

## details/batch-runner/title

受信側のタスクを読む

## details/batch-runner/question

キューの向こう側は、どこで動く？

## details/batch-runner/subtitle

BatchTxProcessor の Future 実装から、要求の受信と処理の起動を確認します。

## details/batch-runner/node

受信タスク

## details/batch-runner/short

非同期の境界

## details/batch-runner/summary

利用可能な要求を受け取り、まとめて処理する非同期タスクを起動します。

## details/batch-runner/detail

poll_recv_many で受け取った要求を buf に蓄え、空でなければ取り出します。pool のハンドルを clone して tokio::spawn の中で process_batch を待ちます。

## details/batch-runner/input

要求チャネルとバッファ

## details/batch-runner/output

Poll<()>

## details/batch-runner/side

受信、バッファの移動、タスクの起動

## details/batch-runner/branch

ready! は未準備なら Pending を返します。spawn はタスクを起動しますが、ここから常に専用スレッドが作られるとは言えません。

## details/batch-runner/concept

poll / ready! / tokio::spawn

## details/batch-runner/language

Future は poll によって進みます。Pending はまだ完了していない状態です。tokio::spawn はランタイムへ非同期タスクを登録し、その処理をスケジュールさせます。

## details/batch-runner/compare

JavaScript のイベントループと似た待機・再開の考え方がありますが、Rust は Future の poll とランタイムの役割を分けて扱います。

## details/pool-test/title

既存テストを根拠に読む

## details/pool-test/question

このテストは、どこまで確かめている？

## details/pool-test/subtitle

テストコードの一部を読みます。このモックではテストを実行していません。

## details/pool-test/node

既存テスト

## details/pool-test/short

期待する挙動の確認

## details/pool-test/summary

送信後にプール内の件数が 1 になることを、テストが期待しています。

## details/pool-test/detail

mock_eth_api からプールを取得し、raw_transfer_tx を送った後に pool.len() を比較しています。これはテストの記述を読んだ根拠であり、この環境での実行成功やメインネットでの動作を示すものではありません。

## details/pool-test/input

テスト用の API と raw transaction

## details/pool-test/output

assert_eq! による件数の検査

## details/pool-test/side

テスト用プールへの追加

## details/pool-test/branch

unwrap はエラー時に panic します。抜粋の後には二件目の送信・取得・Local origin の検査が続きます。

## details/pool-test/concept

#[tokio::test] / assert_eq!

## details/pool-test/language

#[tokio::test] は非同期テスト用の属性です。assert_eq! は二つの値が等しいことを検査し、違えば panic します。

## details/pool-test/compare

Vitest などの expect に近い役割ですが、! が付く assert_eq! は Rust のマクロです。

## zoom/phases/rpc/0

RPC の引数としてバイト列を受け取る

## zoom/phases/rpc/1

共通ヘルパーへ渡して完了を待つ

## zoom/phases/rpc/2

成功値を包んで返す。失敗は伝播する

## zoom/phases/recover/0

バイト列からプール用トランザクションを復元する

## zoom/phases/recover/1

復元の失敗時は、この先へ進まない

## zoom/phases/recover/2

Local と元のバイト列を添えて送信処理へ渡す

## zoom/phases/submit/0

元のバイト列とプール用トランザクションを分ける

## zoom/phases/submit/1

設定に応じた blob 変換・外部転送へ分岐する

## zoom/phases/submit/2

通常経路では購読者通知とプール追加を行い、ハッシュを返す

## zoom/phases/queue/0

一度だけ結果を受け取る返信チャネルを作る

## zoom/phases/queue/1

トランザクションと返信先を要求キューへ送る

## zoom/phases/queue/2

返信を待ち、受信失敗と追加失敗を分けて伝播する

## zoom/phases/batch/0

一件・同一 origin の複数件・混在を分ける

## zoom/phases/batch/1

対応するプールの追加操作を待つ

## zoom/phases/batch/2

各要求の返信チャネルへ結果を戻す

## zoom/phases/pool/0

トランザクションを検証する

## zoom/phases/pool/1

検証結果を内部プールへ渡す

## zoom/phases/pool/2

追加結果を取り出して返す
