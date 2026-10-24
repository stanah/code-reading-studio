# Code Reading Studio

コードリーディングを通じて、Rethとブロックチェーンの仕組みを学ぶツールです。
ブロックチェーン、Ethereum、ノード、RPCの基礎から、一つの動作と根拠のコードへ進みます。
ブロックチェーンやRustの知識を前提にしません。

## 起動

Node.js 22以上とGitを用意してください。npmパッケージの追加は不要です。

```sh
git clone --recurse-submodules https://github.com/stanah/code-reading-studio.git
cd code-reading-studio
node local-app/server.mjs targets/reth 3d592ece6de8c4559987416a544fc215fd6d6921
```

[学習の入口](http://127.0.0.1:4317/)を開きます。
取得済みの作業ツリーでは `git submodule update --init --recursive` で対象をそろえます。
Reth自体をビルドしたり、ノードを起動したりする必要はありません。

## 読み方

最初はブロックチェーンとは何かを読み、一つの動作と実コードへ進みます。
画面上部の「読むときの補助」で、ブロックチェーンの用語とコードを読む経験を別々に選べます。
たとえば、用語は分かるがコードは初めて、ほかの言語は読めるがブロックチェーンは初めて、という組み合わせを使えます。

送信経路や起動の説明では、分からない用語、実コード、日本語の処理と行の対応、記号の意味を同じページで開きます。
補助はその場で増減できます。切り替えても読んでいる箇所やメモの入力は置き換えません。
TypeScriptの比較は、自分で開く詳しい補足にあります。

「学ぶ」で基礎から進み、「コードを調べる」で領域やファイルを探索します。
起動の説明からファイルへ直接進んだ場合も、注釈のある範囲では同じ読解補助を表示します。
範囲の調整、ファイル全体、読解メモは必要なときに開けます。

補助の設定と学習の続きはブラウザーに保存します。「読んだ」は自分で付ける記録です。
行選択や記号ヒントの開閉は、同じページ内の表示切り替え中に保持します。再読み込み後の復元は行いません。
[学習体験の設計](docs/learning-experience.md)と[操作評価・改善の記録](docs/adaptive-reading-review.md)に方針と検証範囲を記載しています。

## 対応範囲と達成状況

11領域それぞれに、最初の処理と、条件を変えて読む追加の処理があります。
同じページでヒントを開き、必要なら原文だけの表示へ切り替えられます。
全Rustファイルを表示できますが、原文に結び付いた解説は一部です。
[現在値と未達条件](docs/reading-status.md)、[全ファイルの台帳](docs/coverage-ledger.json)、
[完了条件と計測方法](docs/measurement.md)を分けて記録しています。
抜粋の解説をファイル全体のレビューとして数えず、人間の理解検証も別に扱います。

```sh
npm --prefix local-app run req:trace
npm --prefix local-app run measure:strict
```

全体が未達の場合、厳格な判定は終了コード2になります。

## 対象バージョン

Reth **v2.7.0**、コミット `3d592ece6de8c4559987416a544fc215fd6d6921` に固定しています。
指定は [`reading-target.json`](reading-target.json) にあります。
Rustファイルは1,283個、Rustファイルを持つCargo配下グループは146個です。

コードと説明を同じコミットで照合しています。別のコミットを開くと、
この版専用の起動ガイドと送信経路の注釈は表示しません。

- [起動の読解資料](docs/reth-startup-guide.md)
- [ブラウザー用の説明資料](docs/reading-guide.html)
- [バージョン差分と起動経路の調査](docs/reth-v2.7.0-startup-research.md)
- [yomiyasuによる推敲と検査の記録](docs/yomiyasu-review.md)

## データと検証

メモは `local-app/.reading-data/` に保存します。Gitの追跡対象外です。
AI接続は任意です。設定方法と送信するデータは [`local-app/README.md`](local-app/README.md) を参照してください。

```sh
npm --prefix local-app test
node tests/smoke.cjs
node tests/atlas.cjs
node tests/zoom.cjs
node scripts/check-reading-data.mjs
```

最後の検査は、全ての解説範囲・ハッシュ・ソースリンクと固定コミットを照合します。
説明はソースを読んで作成したもので、Rethを動かした実行トレースではありません。
関数候補の抽出には字句パターンを使っています。AST、マクロ展開、呼び出し解析は行いません。

## 構成

- `local-app/`: Git読み取りAPI、ガイド、ファイル表示、読解メモ
- `docs/`: 説明資料、調査、開発ガイド
- `dist/`: 固定データを使う静的版。起動の説明資料も含む
- `ui/`, `scripts/`: 共通UIとデータの生成・検査
- `targets/reth/`: 固定コミットのGitサブモジュール

リポジトリはprivateで運用しています。pushによる自動公開は設定していません。
Rethのソース抜粋には [`dist/reth-LICENSE-MIT.txt`](dist/reth-LICENSE-MIT.txt) が適用されます。

固定した条件に基づく4回の評価・改善は[計測評価の記録](docs/measured-reading-review.md)を参照してください。

課題を1人22件へ広げた評価は[追加課題の評価記録](docs/expanded-reading-review.md)に記録しています。
