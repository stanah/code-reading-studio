# Code Reading Studio

コードリーディング勉強会のための、構造・動作・言語設計を行き来する読解ツール。
TypeScript経験あり・Rust未経験の読者を想定しています。

## 起動

Node.js 22以上、Gitを用意してください。追加npmパッケージは不要です。

```sh
git clone --recurse-submodules https://github.com/stanah/code-reading-studio-public.git
cd code-reading-studio-public
node local-app/server.mjs targets/reth 1a4dbbe11264fd52e6e9fbe768aa83f9a6b73607
```

http://127.0.0.1:4317 を開きます。AI接続設定は `local-app/README.md` を参照。
初回取得時にサブモジュールを省略した場合は `git submodule update --init --recursive` を実行してください。

## リポジトリ構成

- `local-app/`: Git読み取りAPI、段階的な探索、読解ノート保存、AIアダプター
- `dist/`: 固定スナップショットによるブラウザー向け読解ガイド
- `ui/`: 共通ヘッダーの動作とデザイントークン・共通スタイル
- `scripts/`: ガイドデータと共通UIの生成
- `tests/`, `local-app/test/`: 自動テスト
- `targets/reth/`: 読解対象のGitサブモジュール

## 読解対象の管理

Rethは `1a4dbbe11264fd52e6e9fbe768aa83f9a6b73607` に固定しています。
Rethへの変更は本体リポジトリのファイルとして取り込みません。親リポジトリは `.gitmodules` とコミット参照を管理します。
更新時はサブモジュール内で対象コミットをcheckoutし、親側で `git add targets/reth` します。
ガイドの注釈・行番号は固定コミットに対応します。対象を更新する場合は読解データも検証・更新してください。
異なるコミットをローカルで開く場合、現在の日本語ガイドは適用されません。

## テスト

```sh
npm --prefix local-app test
node tests/smoke.cjs
node tests/atlas.cjs
node tests/zoom.cjs
```

## 現在の範囲

動作・Rustガイドはトランザクション送信経路の執筆済み解説です。関数抽出は字句解析で、ASTや呼び出し関係の解析ではありません。
デスクトップの主要導線、メモの保存・再起動復元、ガイドと実コードの往復はブラウザーで確認済みです。実AIによる生成、スマートフォン幅、勉強会での利用評価は未検証です。検証範囲と次の作業は `docs/HANDOFF.md` を参照してください。
このリポジトリには自動デプロイ設定を含めていません。
Reth由来のソース抜粋のMITライセンス表記は `dist/reth-LICENSE-MIT.txt` にあります。
