# 開発ガイド — Code Reading Studio

## 目的と読み方

Reth v2.7.0のCLI入口、ノードの準備、稼働中の処理を説明する読解アプリです。
全体の意味を理解してからコードへ進むガイドと、ファイルから直接読む入口を用意しています。
説明はソースに基づく読解メモです。実行トレースや利用者による理解の認定ではありません。

## 対象と根拠

`reading-target.json`を対象バージョンの設定とします。
Rethは`targets/reth`サブモジュールに固定し、上流のコードを書き換えません。
この版はv2.7.0、`3d592ece6de8c4559987416a544fc215fd6d6921`です。
Rustファイルは1,283個、Rustファイルを持つCargo配下グループは146個です。

- 起動ガイドの根拠は`local-app/startup-guide.json`に記録しています。
- 送信経路の根拠は`dist/reth-data.js`と`local-app/annotations.json`にあります。
- 各抜粋はファイル、行範囲、コミット、SHA-256、GitHubの固定リンクを持ちます。
- 別コミットを開いた場合、専用の注釈と起動ガイドは適用しません。

版の差分と起動経路の調査は`reth-v2.7.0-startup-research.md`を参照してください。

## 画面と実装

| パス | 役割 |
| --- | --- |
| `/startup` | 全体像 → 段階 → 個別処理。Rustの補足、理解チェック、実コードへの入口 |
| `/files` | 展開式ファイルツリー、検索、パンくず、400行窓、行リンク |
| `/guide` | 説明・印刷用のHTML資料 |
| `/` | 構造、送信経路、Rustのガイド、コード範囲と読解メモ |
| `local-app/core.mjs` | 固定Gitツリーの索引、本文取得、関数候補、根拠ハッシュ |
| `local-app/server.mjs` | localhost API、トークン・Host・Originの確認、ノート永続化 |
| `ui/studio.js`, `ui/studio.css` | 共通ナビゲーションとスタイルの生成元 |
| `docs/reth-startup-guide.md`, `docs/reading-guide.html` | 資料のMarkdown版とHTML版 |

`/api/tree`は追跡済みblobの一覧を返します。`/api/file`はそのblobを読み、
作業ツリーの変更や追跡されていないファイルを返しません。シンボリックリンクも辿りません。
2 MiBを超えるファイルとバイナリは本文を表示せず、理由を返します。
APIにはセッションのトークンが必要です。サーバーは127.0.0.1にのみバインドします。

## データ生成

```sh
python3 scripts/build-atlas.py targets/reth
python3 scripts/build-drill.py
node scripts/build-lenses.cjs
node scripts/build-annotations.cjs
python3 scripts/build-guide.py
python3 scripts/build-design.py
node scripts/check-reading-data.mjs
```

索引と本文は、いずれも固定コミットから読みます。
`build-annotations.cjs`は送信経路・領域・モジュールの説明をローカル版へ同期します。
`check-reading-data.mjs`は説明のコピー間の一致も確認します。
`build-guide.py`は資料のMarkdownとCSSから、`docs/reading-guide.html`と`dist/startup.html`を更新します。
`build-design.py`は既存の共通ヘッダーも更新します。配布コピーだけを個別に直さないでください。
静的版の`dist/startup.html`は説明資料のコピーです。ローカル版のAPIやファイルツリーは使いません。

対象を変える場合は、ソース差分を読んでから注釈・行範囲・説明・ハッシュを更新します。
検査のためにハッシュだけを置き換えると、説明とコードの意味がずれるおそれがあります。
既存の解説がそのまま使える場合も、本文一致を確認した記録を残します。

## 検証

```sh
npm --prefix local-app test
node tests/smoke.cjs
node tests/atlas.cjs
node tests/zoom.cjs
node scripts/check-reading-data.mjs
```

自動検査は、Gitスナップショット、許可パス、本文・行範囲、認証、保存と復元、
ガイドの遷移、ファイルの探索、ソースのエスケープ、固定コミットとの一致を対象にします。
画面の見た目や操作は別途ブラウザーで確認します。

確認する導線:

1. 起動ガイドの全体像からCLI・準備・稼働の各段階を選べる。
2. 個別処理の説明から該当ファイル・行へ進み、同じ説明へ戻れる。
3. ファイル検索から別ディレクトリへ進み、長いファイルの末尾も読める。
4. 保存したメモが同じコミットと行範囲に対応する。
5. 説明資料がデスクトップと狭い幅で読め、コードのリンクが機能する。

## 説明を追加するとき

各説明は、目的、入力、出力、待機または副作用を短く書きます。
呼び出す順序と非同期タスクの開始順を混同しないでください。
とくに、終了監視、Engine Treeの専用スレッド、networkのFuture、
backfill時に呼ばれる`Pipeline::run_as_fut`と`run_loop`を区別します。

Rustの類推はTypeScriptで簡単に示し、同じでない点を添えます。
FutureとPromise、タスクとOSスレッド、プール追加とブロック確定を区別します。
資料にはyomiyasuを適用し、数値・条件・否定・根拠を変えずに推敲します。
起動資料の検査記録は`yomiyasu-review.md`、既存3画面の検査記録は`yomiyasu-existing-review.md`にあります。

## 制限と運用

- 関数候補は字句抽出です。AST、マクロ展開、正確な関数境界、呼び出し関係は解析しません。
- 読解メモはローカル保存です。同じ保存先への複数プロセス同時書き込みは未対応です。
- AIは任意の接続先を設定したときだけ使います。実サービスでの生成は未検証です。
- Rethのビルド、実ノード起動、ネットワーク同期は今回のアプリ検証に含めません。
- 自動テストやブラウザー確認を、利用者の理解・受け入れ・勉強会での評価とは扱いません。
- このリポジトリはprivateで維持します。公開や自動デプロイを設定していません。
- 個人情報、非公開の会話、秘密鍵、読解ノートをコミットしません。

Rethの抜粋には`dist/reth-LICENSE-MIT.txt`を付属させます。
