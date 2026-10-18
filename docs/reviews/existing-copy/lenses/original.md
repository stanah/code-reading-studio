## lesson.borrow

### name

値を貸す・渡す

### rust

&tx / &self / move

### problem

バイト列を読む処理と、その値を後で使う非同期処理で、データをどう受け渡すか。

### plain

&tx は「txをここでは借りて読む」です。所有権を渡すのとは異なり、元の持ち主が残ります。&self は、この処理を持つオブジェクトを借りる引数です。

### ts

```typescript
function inspect(tx: Uint8Array): void {
  // 同じオブジェクトへの参照を受け取る
}
inspect(tx); // 呼び出し元も引き続き参照できる
```

### difference

TypeScriptのオブジェクト参照にはRustの借用チェックがありません。Rustでは有効な借用の期間や、変更可能な参照の競合をコンパイラーが検査します。moveもコピーの意味ではなく、値によっては所有権を移します。

### benefit

ここでは &tx で復元処理に貸したあと、元のバイト列を WithEncoded に渡します。復元結果と元データを組にして次へ進める点に注目します。

## lesson.future

### name

後で結果を受け取る

### rust

impl Future / async move / .await

### problem

別の処理が終わるまで、実行スレッドを占有せずに結果を待ちたい。

### plain

Futureは、進めると将来の結果が得られる値です。.await はその結果を待ちます。async move は、非同期ブロックが使用する値を取り込みます。

### ts

```typescript
async function submit(tx: Tx): Promise<Hash> {
  return await pool.add(tx);
}
```

### difference

PromiseとFutureは同一ではありません。JavaScriptのasync関数は呼び出すと実行を開始します。Rustのasyncブロックやasync関数が返すFutureは、作っただけでは本体が進まず、ポーリングが必要です。asyncは別スレッドの意味でもありません。

### benefit

キューに要求を渡した側は返答をawaitし、処理する側と分離できます。Sendという境界があれば、スレッド間へ移動可能な型という条件も表します。

## lesson.result

### name

失敗を戻り値で表す

### rust

Result<T, E> / ? / await??

### problem

復元や検証に失敗した場合、後続処理を止めて呼び出し元へ伝えたい。

### plain

Result<T, E> は、成功のOk(T)か失敗のErr(E)のどちらかです。この送信経路の ? は、成功なら中身を取り出し、失敗なら関数から早く戻ります。

### ts

```typescript
type Result<T, E> =
  | { ok: true; value: T }
  | { ok: false; error: E };
const r = recover(tx);
if (!r.ok) return r; // 失敗を呼び出し元へ返す
```

### difference

? はTypeScriptのオプショナルチェーン ?. ではありません。Resultの失敗は通常の値で、例外をthrowすることとも異なります。Rustの ? には必要に応じてエラー型を変換する仕組みもあります。

### benefit

response_rx.await?? では、返答チャネルの失敗と、受け取ったプール追加結果の失敗を順に扱います。「待てなかった」と「処理が失敗した」を分けて読めます。

## lesson.trait

### name

共通処理と実装を分ける

### rust

trait / Self / 関連型

### problem

共通のRPC処理を保ちつつ、使うプールや具体的な処理を差し替えたい。

### plain

traitは型が提供する操作などの約束です。Selfはその約束を実装する型を指します。関連型は、その実装が使う型を約束の中で定める仕組みです。

### ts

```typescript
interface Pool<Tx> {
  add(tx: Tx): Promise<Hash>;
}
// 呼び出す側は具体クラスから切り離せる
```

### difference

interfaceは入口としての類推です。Rustのtraitにはメソッドの既定実装や関連型があります。TypeScriptの構造的な型の一致と、Rustでtraitを実装することは同じではありません。traitを使うだけで実行時の動的ディスパッチになるわけでもありません。

### benefit

共通ヘルパーからEthereum向け実装へ処理を渡す境界を読みます。Self::ErrorやSelf::Poolは、今の実装が選んだ型という意味で捉えると読み進めやすくなります。

## lesson.channel

### name

要求と返答を分離する

### rust

channel / oneshot

### problem

要求をまとめて処理する側と、個別の結果を待つ側を分離したい。

### plain

要求をキューへ送り、要求ごとに用意した一度限りの返答口で結果を受け取ります。キューへ送れたことと、プールへの追加が成功したことは別です。

### ts

```typescript
// 概念用の疑似コード。Rethの移植ではありません。
const result = new Promise<Result<Hash, Error>>(resolve => {
  queue.push({ tx, reply: resolve });
});
return await result;
```

### difference

Rustのoneshotは送受信端を持つチャネルです。Promiseのresolveコールバックそのものではありません。送り手が消えた場合など、値を受け取れない失敗も扱います。

### benefit

バッチ処理は複数要求をまとめて扱い、各要求に結果を返します。呼び出しスタックだけでは見えにくい非同期の境界です。

## group.receive

### name

1. 要求を受け取り、意味のあるデータにする

### input

署名済みのバイト列

### output

送信者を復元したトランザクション

## group.dispatch

### name

2. 実装を選び、処理する側へ渡す

### input

復元したトランザクションと元データ

### output

キューの追加要求と返答待ち

## group.validate

### name

3. 検証して保持し、結果を返す

### input

追加要求

### output

ハッシュまたはエラー

## screen text

TYPESCRIPT → RUST / READING GUIDE

Rustを知らなくても、動きから読める。

まず日本語で理解し、必要な構文だけ開きます。選んだ処理を保ったまま、3つの見方を切り替えられます。

構造から読む

動作から読む

Rust・設計から読む

題材：トランザクションを送る · [commit]

解説者による読解メモ · 固定コミットのコードに対応。実行トレース・自動生成の呼び出しグラフではありません。

署名済みトランザクションを送ると、何が起きる？

正常経路の大きな流れです。まず3段階から選び、次に部品間の受け渡しを見ます。

入力：

出力：

内側の処理を見る →

↓

返るハッシュは、ブロックへの取り込み完了やレシートを意味しません。
設定によって外部への転送などの分岐があります。第2段階で確認します。

← ユースケース全体へ

処理を詳しく

現在の対象：[title] · [commit]

← ひとつ上の処理へ

受け取るもの

返すもの

この段階で起きること

副作用・失敗・分岐

Rustが分からなくなったら

根拠: [path] L1–2

根拠の実コードへ →

モジュールを探索 →

次の段階 →

← 前の段階

動作の担当箇所を、コードの配置で見る

クレートはRustのコンパイル単位です。Cargoのパッケージには複数のクレートが含まれることもあり、npmパッケージとの一対一対応ではありません。

動作で理解する

Rustの読み方

担当モジュールを開く →

TypeScriptの知識を足場にする

解決したいこと

まず日本語で

TypeScriptで考えると

理解のための簡略例 · 等価な移植コードではありません

ここはTypeScriptと違う

このRethの処理で役立つ点

対応する処理を読む

処理の説明へ戻る

このコミットに対応した動作・Rust解説はまだありません。構造の探索からコードを選んでください。
