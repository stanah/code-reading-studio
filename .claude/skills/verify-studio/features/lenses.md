# 3つの見方と説明資料

3つの見方（構造から読む、送信経路を読む、Rust と設計）では、トランザクション送信の同じ処理を別の切り口で読み、説明資料 `/guide` では全体を図と短い説明で読める。

## Sub-features

- `lens-structure`：処理の担当箇所を、コードの配置（領域、クレート、モジュール）から見る。
- `lens-flow`：ユースケース全体から、3段階、個別処理、根拠の実コードへ詳細化する。
- `lens-rust`：TypeScript の知識を足場に、5つの Rust の概念を読む。
- `lens-switch`：個別処理から、ほかの見方やほかの段階へ移る。
- `guide-page`：説明資料を開き、印刷用の画面を出す。

## How to get to it (user POV)

- 上部ナビゲーションの「構造から読む」「送信経路を読む」「Rust・設計」「説明資料」を選ぶ。
- 起動ガイドのツールバーで「説明資料を開く」を選ぶ。

## Driving it with studio.mjs

Preconditions:

- `$STUDIO doctor` が `ok: true` を返す。

- **送信経路の全体。** `$STUDIO browser goto "/startup"` と `$STUDIO browser click --role link --name "送信経路を読む"` を実行する。URL が `/#lens=flow` になり、見出し「署名済みトランザクションを送ると、何が起きる？」と、3つの段階リンク（「1. 要求を受け取り、送信者を復元する」から「3. 検証して保持し、結果を返す」まで）が出る。
- **段階を開く。** `$STUDIO browser click --role link --name "1. 要求を受け取り、送信者を復元する"` を実行する。URL が `/#lens=flow&group=receive` になり、「RPC の入口を読む」「デコードして送信者を復元」が並ぶ。
- **個別処理を開く。** `$STUDIO browser click --role link --name "処理を詳しく RPC の入口を読む"` を実行する。URL が `/#lens=flow&step=rpc` になり、見出し「受け取るもの」「返すもの」「この段階で起きること」「副作用・失敗・分岐」と、リンク「根拠の実コードへ →」「次の段階 →」が出る。
- **根拠へ進む。** `$STUDIO browser click --role link --name "根拠の実コードへ →"` を実行する。URL に `code=1` が入り、spinbutton「開始行」と「終了行」が出る。
- **構造の見方。** `$STUDIO browser goto "/startup"` と `$STUDIO browser click --role link --name "構造から読む"` を実行する。URL が `/#lens=structure` になり、見出し「動作の担当箇所をコードの配置で見る」と、各処理のリンク「担当モジュールを開く →」が出る。
- **Rust の見方。** `$STUDIO browser click --role link --name "Rust・設計"` を実行する。URL が `/#lens=rust` になり、「値を貸す・渡す」「後で結果を受け取る」「失敗を戻り値で表す」「共通処理と実装を分ける」「要求と返答を分離する」の5つのリンクが出る。
- **説明資料。** `$STUDIO browser goto "/startup"` と `$STUDIO browser click --role link --name "説明資料を開く"` を実行する。URL が `/guide` になり、タイトルが `Reth v2.7.0 起動から稼働まで` になる。
- **証拠。** 各見方で `$STUDIO browser snapshot --path lenses/<lens>.aria.txt` と `$STUDIO browser screenshot --path lenses/<lens>.png` を実行する（`<lens>` は `flow-step-rpc`、`structure`、`rust`、`guide`）。

## Gotchas

- 3つの見方は同じ `/` の文書で、ハッシュだけが変わる。リンクのクリックではページが読み込み直されないので、表示の更新はハッシュ変更で起きる。
- 送信経路と Rust の解説は、固定コミットに対して人が書いた読解メモである。実行トレースや自動解析の結果として検証しない。
- 段階リンクの名前は「入力：」「出力：」まで含む長い文字列である。部分一致の先頭部分（段階名）で指定する。
- `/guide` は `docs/reading-guide.html` をそのまま配信し、ナビゲーションを持たない。戻るときは `browser goto` を使う。
