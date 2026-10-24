# 読解ノート

読解ノートでは、固定コミットの行範囲にメモをつけて保存し、サーバーを再起動しても同じメモを開き直し、不要になったら削除できる。

## Sub-features

- `notes-range`：コード画面で開始行と終了行を変えて、範囲を表示し直す。
- `notes-save`：範囲とメモを保存し、保存完了の状態を出す。
- `notes-list`：「読解ノート」で、保存した範囲とメモを一覧する。
- `notes-restore`：サーバーを再起動しても、同じメモが一覧に出る。
- `notes-delete`：一覧から削除すると、一覧と保存データの両方から消える。
- `notes-export`：「JSONを書き出す」で、保存データを JSON ファイルとして受け取る。

## How to get to it (user POV)

- 起動ガイドの読みどころで「範囲にメモをつける」を選ぶ。
- 構造や送信経路の画面で「根拠の実コードへ →」を選ぶ。
- 上部ツールバーの「読解ノート」を選ぶ（`/` の画面にだけある）。

## Driving it with studio.mjs

Preconditions:

- `$STUDIO doctor` が `ok: true` を返す。
- `$STUDIO api GET /api/state` の `items` が空である。

- **メモの画面を開く。** 起動ガイドからメモの画面へ進む。`$STUDIO browser goto "/startup?step=entry"` と `$STUDIO browser click --role link --name "範囲にメモをつける"` を実行する。URL が `/#path=bin%2Freth%2Fsrc%2Fmain.rs&code=1&start=33&end=48` になり、見出し `bin/reth/src/main.rs`、spinbutton「開始行」が `33`、「終了行」が `48` である。
- **範囲を変える。** `$STUDIO browser fill --label "終了行" --value "45"` と `$STUDIO browser click --role button --name "範囲を表示"` を実行する。URL の `end` が `45` になる。確かめたら `$STUDIO browser fill --label "終了行" --value "48"` と `$STUDIO browser click --role button --name "範囲を表示"` で戻す。
- **保存する。** `$STUDIO browser fill --label "問い・読解メモ" --value "verify: mainはhandleで終了を待つ"` と `$STUDIO browser click --role button --name "範囲とメモを保存"` を実行する。`$STUDIO browser text --selector "#status"` が「保存しました。読解ノートから再び開けます。」を返す。
- **保存データを確かめる。** `$STUDIO api GET /api/state --save reading-notes/state-after-save.json` を実行する。`items` が1件で、`note` が入力した文、`anchor.path` が `bin/reth/src/main.rs`、`anchor.start` と `anchor.end` が `33` と `48`、`anchor.commit` が固定コミットである。`anchor.hash` は `local-app/startup-guide.json` の `entry` の `source.hash` と一致する。
- **一覧で開く。** `$STUDIO browser goto "/"` と `$STUDIO browser click --role button --name "読解ノート"` を実行する。URL が `/#notes=1` になり、`$STUDIO browser text --selector "#view"` に `bin/reth/src/main.rs : 33–48` と入力したメモが含まれる。
- **再起動後に復元する。** `$STUDIO restart`、`$STUDIO browser goto "/"`、`$STUDIO browser click --role button --name "読解ノート"` を実行する。同じ範囲とメモが出る。`$STUDIO browser snapshot --path reading-notes/after-restart.aria.txt` と `$STUDIO browser screenshot --path reading-notes/after-restart.png` で残す。
- **削除する。** `$STUDIO browser click --role button --name "削除"` を実行する。`#view` に「コード画面で範囲を選び、読解ノートに保存できます。」が出る。`$STUDIO api GET /api/state --save reading-notes/state-after-delete.json` の `items` が空である。

## Gotchas

- 「読解ノート」ボタンは `/` の画面のツールバーにだけある。`/startup` や `/files` からは、先に `$STUDIO browser goto "/"` で移る。
- `$STUDIO restart` のあと、開いていたタブは古いトークンを持ったままなので API が 403 になり、画面は「読み込めませんでした。」を出す。再起動後は必ず `browser goto` で読み込み直す（`goto` は毎回フルロードする）。
- 「この範囲をAIで解説」は、検証中は AI を設定しないので無効である。AI 解説を検証するには、外部へ送ってよい OpenAI 互換の検証用エンドポイントを用意し、利用者の了解を得てから起動する必要がある。この手順では扱わない。
- 「JSONを書き出す」はブラウザーのダウンロードである。`studio.mjs` はダウンロードを受け取らないので、`notes-export` は未検証として報告し、代わりに `/api/state` の内容を証拠にしたとは書かない。
- 範囲は、ファイルに実在する1〜240行に限られる。範囲外の行を入れて「範囲を表示」を選ぶと、`#status` に「実在する1〜240行を指定してください」が出て、URL の範囲は変わらない。
- 保存されるのは URL が示す表示中の範囲であり、spinbutton に入れただけの値ではない。範囲を変えて保存するときは、先に「範囲を表示」で URL の `start` と `end` が変わったことを確かめる。
- 同じデータディレクトリへ複数プロセスが同時に書く構成は未対応である。1つの実行で1つのサーバーだけを使う。
