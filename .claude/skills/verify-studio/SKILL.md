---
name: verify-studio
description: Code Reading Studio（local-app のローカル Web UI）を、利用者と同じ操作で起動、操作して動作を証明する。起動ガイド /startup、ファイル閲覧 /files、読解ノート、3つの見方（構造、送信経路、Rust）を変更したとき、または「画面で動くか確かめて」と頼まれたときに使う。
---

# Code Reading Studio を操作して検証する

このスキルは、検証用に隔離したサーバーと headless Chromium を起動し、実際の画面を操作して証拠を残す手順である。
対象は `local-app/server.mjs` が配信する Web UI で、読解対象は `targets/reth` の固定コミット（`reading-target.json`）である。
`dist/` の静的版と `tests/*.cjs` は別の面であり、このスキルの対象外とする。

コマンドはすべてリポジトリのルートで実行する。
以下では `STUDIO="node .claude/skills/verify-studio/scripts/studio.mjs"` とする。
各コマンドは JSON を標準出力に書き、失敗時は終了コード 1 を返す。

## 前提

- Node.js 22 以上と Git がある。npm パッケージの追加は不要である。
- Playwright が `require('playwright')` で読み込める（クラウド環境には導入済み）。手元で読み込めない場合は、Playwright と Chromium を導入してから使う。
- `targets/reth` が取得済みである。未取得なら次を実行する。

```sh
git submodule update --init --filter=blob:none targets/reth
```

## 起動

```sh
$STUDIO launch            # 実行IDを自動採番する。--run <id> で指定もできる
```

`launch` は空きポートを選び、空のデータディレクトリでサーバーを起動する。
準備完了の判定は、ポートの応答ではなく、`/startup` から取ったトークンで `/api/index` を呼び、固定コミットと一致して `startupReady: true` になった時点である。
続いて、実行専用のプロファイルで headless Chromium を起動し、CDP で接続できるようにする。
起動に失敗したら、出力の `hint` にあるログを読み、`cleanup` してからやり直す。

実行ごとにポート、データディレクトリ、ブラウザープロファイルが分かれるため、複数の実行を並行できる。
利用者が自分で起動した `npm start` のインスタンス（既定ポート 4317、`local-app/.reading-data/`）は操作しない。
保存先を共有すると利用者の読解ノートを書き換えるからである。

## 診断

```sh
$STUDIO doctor
```

次をすべて確かめ、どれかが偽なら終了コード 1 を返す。

- サーバーとブラウザーのプロセスが、この実行のディレクトリを引数に持って生きている。
- トークンが受理され、`commit` が `reading-target.json` と一致し、`startupReady` が真である。
- サーバーログに、この実行のポートが出ている。
- CDP からブラウザーの版が取れる。

様子がおかしいときは、操作を続ける前にまず `doctor` を実行する。
`aiConfigured` は常に偽である。検証中は AI の環境変数を空にして起動し、外部へコードを送らない。

## 操作

ブラウザー操作は1コマンドで1動作である。
同じタブが実行の間ずっと残るので、前のコマンドの画面状態を次のコマンドが引き継ぐ。

```sh
$STUDIO browser goto "/startup"                              # 毎回フルロードする
$STUDIO browser click --role link --name "01 CLIと終了監視"
$STUDIO browser fill --label "名前・パスで探す" --value "launch.rs"
$STUDIO browser press --key Enter
$STUDIO browser wait --text "保存しました"
$STUDIO browser text --selector "#files-status"              # 省略時は main の innerText
$STUDIO browser count --selector ".files-code-row.is-selected"
$STUDIO browser snapshot --path startup/step.aria.txt        # ARIA スナップショット
$STUDIO browser screenshot --path startup/step.png [--full]
$STUDIO browser url
$STUDIO api GET /api/state [--save notes/state.json]         # 副作用の確認用
$STUDIO restart                                              # データを残してサーバーだけ再起動
```

要素は ARIA の役割と名前（`--role` と `--name`）、ラベル（`--label`）、表示文字列（`--text`）の順に選ぶ。
CSS セレクターは、`#files-status` のような ID か、`.is-selected` のような状態クラスに限る。
`--exact` を付けると名前の完全一致になる。既定は部分一致で、最初に見つかった要素を使う。

`browser` は、ページの JavaScript 例外、URL のない console エラー、400 以上の応答を `pageErrors` に集め、1件でもあれば失敗にする。
例外は `/favicon.ico` の 404 だけである（サーバーが favicon を配信しないため）。

`api` は利用者の操作経路ではない。
画面で行った操作の結果を、保存データという第二の視点から確かめるときだけ使う。
`api POST` で状態を作って画面の証明に代えてはならない。

## 証拠

証拠は `outputs/verify-studio/<実行ID>/evidence/` に置く（`/outputs/` は Git 管理外）。
`--path` と `--save` に相対パスを渡すと、このディレクトリからの相対になる。
ファイル名の先頭のディレクトリには機能 ID を使う（例: `notes/after-restart.aria.txt`）。

証明の基準は次のとおり。

- 利用者の経路を通す。URL を直接開くのは、その URL 自体が利用者の入口（ブックマーク、共有リンク）である場合に限る。
- 操作と結果の両方を残す。最後の画面だけでは足りない。
- 保存を伴う操作は、`api GET /api/state` と、再起動後の画面表示で確かめる。
- 画面の証拠は ARIA スナップショットとスクリーンショットの組にする。

## 後片付け

```sh
$STUDIO cleanup [--run <id>]
```

この実行が起動したプロセスだけを止める。
対象は、`launch` が付けた目印（サーバーの `--verify-run=<実行ディレクトリ>` と、Chromium の `--user-data-dir=<実行ディレクトリ>/chromium-profile`）をコマンドラインに持つプロセスに限る。
プロセス名で止めることはないので、利用者のサーバーやブラウザーには触れない。
データディレクトリ、ブラウザープロファイル、`run.json` を消し、`evidence/` と `server.log`、`chromium.log` は残す。
失敗した試行のあとも必ず `cleanup` する。

## 機能マップ

操作手順は [`features/README.md`](features/README.md) から機能ごとに引く。
変更した機能の入口が複数あるときは、マップに載っているすべての入口を通す。
