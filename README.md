# Code Reading Studio

Rethの起動を、全体像から実際のコードまで追う読解ツールです。
TypeScriptの経験があり、Rustをこれから読む人に向けて説明しています。

## 起動

Node.js 22以上とGitを用意してください。npmパッケージの追加は不要です。

```sh
git clone --recurse-submodules https://github.com/stanah/code-reading-studio-public.git
cd code-reading-studio-public
node local-app/server.mjs targets/reth 3d592ece6de8c4559987416a544fc215fd6d6921
```

[起動ガイド](http://127.0.0.1:4317/startup)を開きます。
取得済みの作業ツリーでは `git submodule update --init --recursive` で対象をそろえます。
Reth自体をビルドしたり、ノードを起動したりする必要はありません。

## 読み方

| 入口 | できること |
| --- | --- |
| 起動ガイド `/startup` | CLI → ノードの準備 → 稼働中の処理を、段階ごとに読む |
| ファイルから読む `/files` | Gitのツリー、検索、行番号付き本文からコードを追う |
| 説明資料 `/guide` | 全体の図と短い説明で予習・復習する。印刷も可能 |
| 構造・送信経路・Rustのガイド `/` | 責務、トランザクション送信、言語構文を行き来する |

起動ガイドでは、処理の目的、入力と出力、待機する箇所を先に確認します。
その後、ファイル表示または行範囲付きのメモ画面へ進めます。
ファイル表示では、Markdownや設定ファイルも読めます。
本文は400行ずつ表示し、前後の移動や行の指定で続きを開けます。

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
