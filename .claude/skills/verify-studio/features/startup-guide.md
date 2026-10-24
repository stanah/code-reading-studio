# 起動ガイド

起動ガイドでは、Reth の起動を3つの段階と11の読みどころに分けて読み、各読みどころから根拠となる固定コミットの行範囲へ移動できる。

## Sub-features

- `startup-overview`：全体像に3段階のカードと「メインのループ」の案内が出る。
- `startup-stage`：段階を開くと、その段階の読みどころが順に並ぶ。
- `startup-step`：読みどころに、問い、要約、入力と出力、処理、境界、つながり、根拠の行範囲が出る。
- `startup-source`：「この範囲のコードを開く →」で、ファイル表示がその行範囲を選択した状態で開く。
- `startup-reverse`：ファイルの行から、最も近い読みどころへ逆に引ける。
- `startup-missing`：存在しない読みどころの ID では、目次へ戻るよう案内が出る。

## How to get to it (user POV)

- 上部ナビゲーションの「起動ガイド」を選ぶ。
- ブランドの「⌘ Code Reading Studio」を選ぶ。
- 読みどころの共有リンク `/startup?step=<id>` を開く。
- 読解ノートのコード画面で「このファイルの起動解説」を選ぶ（`startup-reverse`）。

## Driving it with studio.mjs

Preconditions:

- `$STUDIO doctor` が `ok: true` を返し、`startupReady` が真である。

- **全体像を開く。** 起動ガイドを開く。`$STUDIO browser goto "/startup"` を実行する。見出し「CLIからノードの継続処理まで」と、「01 CLIと終了監視」「02 ノードを組み立てる」「03 稼働中の処理を分けて読む」の3つのリンクが目次に出る。
- **段階を開く。** 目次の最初の段階を選ぶ。`$STUDIO browser click --role link --name "01 CLIと終了監視"` を実行する。URL が `/startup?stage=cli` になり、読みどころ「CLIから起動用の処理を渡す」「nodeサブコマンドを選ぶ」「起動処理と終了条件を監視する」が並ぶ。
- **読みどころを開く。** 最初の読みどころを選ぶ。`$STUDIO browser click --role link --name "CLIから起動用の処理を渡す"` を実行する。URL が `/startup?step=entry` になり、見出し「入力 / 受け取るもの」「出力 / 次へ渡すもの」「ここで行うこと」と、根拠 `bin/reth/src/main.rs · L33–48` が出る。
- **次へ進む。** 前後のナビゲーションで次へ進む。`$STUDIO browser click --role link --name "nodeサブコマンドを選ぶ →"` を実行する。URL が `/startup?step=dispatch` になる。
- **根拠のコードを開く。** 読みどころ `entry` に戻り、コードを開く。`$STUDIO browser goto "/startup?step=entry"` と `$STUDIO browser click --role link --name "この範囲のコードを開く →"` を実行する。URL が `/files?path=bin%2Freth%2Fsrc%2Fmain.rs&line=33&end=48` になり、`$STUDIO browser count --selector ".files-code-row.is-selected"` が `16` を返す。`$STUDIO browser text --selector '[aria-current="location"]'` は `33` を返す。
- **逆引きする。** ファイルの行から解説へ戻る。`$STUDIO browser goto "/startup?path=bin%2Freth%2Fsrc%2Fmain.rs&line=40"` を実行する。見出し「CLIから起動用の処理を渡す」が出る。
- **存在しない ID。** `$STUDIO browser goto "/startup?step=no-such-step"` を実行する。`$STUDIO browser text --selector "#startup-main"` に「この読みどころは見つかりませんでした。目次から選び直してください。」が含まれる。
- **証拠。** 読みどころの画面を残す。`$STUDIO browser goto "/startup?step=entry"`、`$STUDIO browser snapshot --path startup-guide/step-entry.aria.txt`、`$STUDIO browser screenshot --path startup-guide/step-entry.png --full` を実行する。スナップショットに `bin/reth/src/main.rs · L33–48` とリンク「この範囲のコードを開く →」が含まれる。

## Gotchas

- 全体像の段階カードのリンク名は「01 · 3つの読みどころ CLIと終了監視 …」であり、目次のリンク名「01 CLIと終了監視」とは違う。目次から選ぶときは目次の名前を使う。
- 11の読みどころは読む順番であり、タスクの開始順ではない。順序の検証に、プロセスの起動順を持ち出さない。
- 起動ガイドは `reading-target.json` のコミットでだけ出る。別のコミットで起動すると `/api/startup` が 404 になり、画面は案内文に切り替わる。
- 「GitHub ↗」は外部サイトへのリンクである。検証環境から GitHub へ出られないことがあるので、リンク先 URL の値だけを確かめる。
- 「Rustの補足」と「答えを確認する」は閉じた `details` である。中身を証明するときは、先にその group を開く。
