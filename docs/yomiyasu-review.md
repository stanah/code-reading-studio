# 日本語レビュー記録

確認日: 2026-10-19。対象は起動ガイドの本文と、ローカルアプリの起動案内に表示する短文です。検査結果は文章を見直すために使い、読みやすさや技術的な正しさの合格判定には使っていません。

使用したスキル: [nanaism/yomiyasu v2.0.1](https://github.com/nanaism/yomiyasu/tree/84e1f5b15e497538fcfe19ab7e9c6f6d138f19ff)。適用した指示は `skills/yomiyasu/SKILL.md` と、記事・技術分野・読者・構文・事実照合・候補レビューの参照資料です。Rethの根拠は `v2.7.0`、commit `3d592ece6de8c4559987416a544fc215fd6d6921` のソースです。

## 起動ガイド

対象: `docs/reth-startup-guide.md`。新規作成として、ソース抜粋を資料に渡して検査しました。`docs/reading-guide.html` はこのMarkdownから生成し、本文の表示文字列と24個のリンクが一致することを照合しました。見出しやリストの番号は表示形式に合わせて扱っています。

HTMLの再生成は `python3 scripts/build-guide.py` で行えます。CSSを埋め込み、本文とリンクの一致を確認したあとにHTMLを書き出します。

### 変えたところ

- タイトルの装飾用ダッシュを外し、短い主語の後などにあった読点を削除しました。処理の担当や条件は変えていません。
- ソースの再確認で、`run_as_fut` の同期処理と巻き戻し処理を分けて記述しました。同期先を指定すると `run_loop` へ進み、`Unwind` を指定すると `unwind` へ進みます。

### 残したAIっぽいところ

- 「ます」の連続6件は、各処理の動作を説明する自然な文として残しました。語尾を変えるために、事実を助言や可能性の表現へ置き換えていません。

### 事実の確かめ

- 資料との照合で挙がった32件は、固定commitのURL、コード識別子、一般的な略語、資料内の分類数などでした。URLの21個の行範囲を実ファイルと照合し、識別子と分類数も確認しました。数値候補の「三つ」「四か所」は記事の構成を数えたものです。
- 同期と巻き戻しの分岐は [Pipeline::run_as_fut](https://github.com/paradigmxyz/reth/blob/3d592ece6de8c4559987416a544fc215fd6d6921/crates/stages/api/src/pipeline/mod.rs#L153-L178) を読み比べました。live同期とbackfill同期の排他性は [backfillモジュールの説明](https://github.com/paradigmxyz/reth/blob/3d592ece6de8c4559987416a544fc215fd6d6921/crates/engine/tree/src/backfill.rs#L1-L8) に基づきます。
- 検査後にRethの起動や同期を実行して確かめたものではありません。

### 確認の記録

- 書き手・読み手・場面: 書き手: 技術資料の作成者（推定）／読み手: Rethを読む開発者、informed（推定）／場面: article（推定）
- 実行した検査: lint、資料との照合、最終稿の照合
- 実行しなかった検査: diff（新規作成で、推敲前の原文がないため）
- 見直し候補: 最終稿 6件（件数は点数ではなく、増減は読みやすさの良し悪しを示さない）
- `yomiyasu-check: executed via=verify run=20261018T153454Z-9f6bc570 attempt=3 final=sha256:7bc3935f67a9 mode=compose doc_type=article reader=informed checks=lint,materials meaning_risk=32 replay=skipped`

文体の修正を1回行ったあと、ソースの分岐条件を追記して再検査しました。そのため、スキルの「修正は1回のみ」という手順を超えたことが記録されています。検査の実行と最終稿の一致を確認した記録であり、手順全体への完全準拠を示すものではありません。

## アプリの起動案内

対象: `local-app/startup-guide.json`。初稿を原文として保存し、日本語の短文を推敲しました。ID、順番、ソース参照、ソースのハッシュ、導線の構造は維持しています。

### 変えたところ

- 一般語として使われていた `task`、`thread`、`network` などを日本語にしました。関数名や型名、コード例は残しています。
- 「CLIと実行の寿命」を「CLIと終了監視」に変え、何を担当する段階かを見出しから読めるようにしました。
- 通信処理の「予算」を「一度に処理する量の上限」と言い換え、上限に達したときの動作を保ちました。
- 読む順番とタスクが起動する順番の違いを明記しました。同期方式の排他性、保存が遅れたときの待機、同期と巻き戻しの分岐は維持しています。
- 最終レビューで、すべての終了経路が `Terminate` を送るように読めた箇所を修正しました。停止要求を受信した場合とgraceful shutdownの分岐に条件を限定し、graceful shutdownでは完了通知を待つことを明記しました。ループ終了後の結果通知は、別の項目に分けています。

### 残したAIっぽいところ

- 否定対比2件は、Rustの `?` と例外の違い、live同期とbackfill同期の排他性を伝えるために残しました。

### 事実の確かめ

- ソース参照16件のハッシュが対象commitの抜粋と一致することを確認しました。
- 初回の推敲ではdiffの候補12件を確認しました。語の増減は主に日本語化に伴うものです。条件候補は処理量の上限の言い換えであり、発火条件を変えていません。指示語の参照先、体言止めから動作説明への変更も原文と読み比べました。
- OSスレッドで待つtree handler、非同期のエンジンタスク、`Future::poll` で進む通信、必要時に起動するpipelineを区別しています。
- 最終レビューの修正は [終了要求とgraceful shutdownの分岐](https://github.com/paradigmxyz/reth/blob/3d592ece6de8c4559987416a544fc215fd6d6921/crates/node/builder/src/launch/engine.rs#L387-L410) と、[直接ループを抜ける分岐](https://github.com/paradigmxyz/reth/blob/3d592ece6de8c4559987416a544fc215fd6d6921/crates/node/builder/src/launch/engine.rs#L332-L353) を読み比べました。追加検査のdiff候補11件には、条件の明記、文の分割、変更していない指示語などが含まれます。`Terminate` の送信条件と結果通知の順番がソースに対応することを確認しました。

### 確認の記録

- 書き手・読み手・場面: 書き手: 技術資料の作成者（推定）／読み手: Rethを読む開発者、informed（推定）／場面: article（推定）
- 実行した検査: lint、diff、資料との照合、最終稿の照合
- 実行しなかった検査: なし
- 硬化の検査: 候補なし
- 勢いの検査: 候補なし
- 見直し候補: 原文 2件 → 最終稿 2件（件数は点数ではなく、増減は読みやすさの良し悪しを示さない）
- `yomiyasu-check: executed via=verify run=20261018T154132Z-41d7540b attempt=1 final=sha256:e6eec8390950 mode=rewrite doc_type=article reader=informed checks=lint,diff,materials meaning_risk=0 replay=skipped`

## 実行コマンド

`YOMIYASU_SKILL` は取得したスキルの `skills/yomiyasu` ディレクトリを指します。作業ファイルには公開ソースの抜粋と推敲対象だけを保存しました。検査の生記録はローカルの作業ディレクトリに置き、この公開用記録には実行環境の絶対パスを含めていません。

```sh
# 新規ガイド
python3 "$YOMIYASU_SKILL/scripts/yomiyasu_check.py" run \
  --material work/startup-guide/material.txt \
  --final docs/reth-startup-guide.md \
  --stance=説明 --doc-type article --reader informed --fact-gaps \
  --state-dir work/startup-guide/yomiyasu
python3 "$YOMIYASU_SKILL/scripts/yomiyasu_check.py" verify \
  --final docs/reth-startup-guide.md \
  --state-dir work/startup-guide/yomiyasu

# 既存の案内文の推敲
python3 "$YOMIYASU_SKILL/scripts/yomiyasu_lint.py" \
  work/startup-guide/startup-original.json --doc-type article
python3 "$YOMIYASU_SKILL/scripts/yomiyasu_check.py" run \
  --source work/startup-guide/startup-original.json \
  --material work/startup-guide/material.txt \
  --final local-app/startup-guide.json \
  --stance=説明 --doc-type article --reader informed --fact-gaps \
  --state-dir work/startup-guide/yomiyasu-ui
python3 "$YOMIYASU_SKILL/scripts/yomiyasu_check.py" verify \
  --final local-app/startup-guide.json \
  --state-dir work/startup-guide/yomiyasu-ui

# 終了条件の最終レビュー（上の推敲後の版を原文として保存）
python3 "$YOMIYASU_SKILL/scripts/yomiyasu_lint.py" \
  work/startup-guide/startup-before-shutdown-review.json --doc-type article
python3 "$YOMIYASU_SKILL/scripts/yomiyasu_check.py" run \
  --source work/startup-guide/startup-before-shutdown-review.json \
  --material work/startup-guide/material.txt \
  --final local-app/startup-guide.json \
  --stance=説明 --doc-type article --reader informed --fact-gaps \
  --state-dir work/startup-guide/yomiyasu-ui-shutdown
python3 "$YOMIYASU_SKILL/scripts/yomiyasu_check.py" verify \
  --final local-app/startup-guide.json \
  --state-dir work/startup-guide/yomiyasu-ui-shutdown
```

最終稿のSHA-256:

- ガイド: `7bc3935f67a9c4264686c9c845e26982bfbb6c8e5d807958f4317b1054898ee9`
- アプリの案内: `e6eec8390950ad4a02648b2b2a8fff409f511b2966245e4d7de8f7de34ce9be2`
