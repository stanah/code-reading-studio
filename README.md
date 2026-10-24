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

最初は「基礎から学ぶ」で、ブロックチェーンとは何かを読みます。
基礎が分かる人はRethの役割から、コードを調べたい人は実装の読み方から始められます。
読み方は画面上部でいつでも変更できます。

「学ぶ」では説明を順に読み、「コードを調べる」では領域やファイルを探索します。
構造・送信経路・Rustの解説は、必要なところで開きます。
起動の解説は学習の中から、メモなどの操作はコード画面から使えます。

読み方と学習の続きはブラウザーに保存します。「読んだ」は自分で付ける記録です。
画面の役割と整理方針は[学習体験の設計](docs/learning-experience.md)を参照してください。

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
