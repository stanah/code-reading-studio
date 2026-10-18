## dist/app.js / 1

要求チャネルへの送信と、BatchTxProcessor::poll での受信を介する関係であり、直接の関数呼び出しではありません。

## dist/app.js / 2

TransactionOrigin やプールの挙動はプロジェクト固有です。言語仕様だけから意味を決めず、元コードを確認します。

## dist/app.js / 3

件数と origin に応じて呼び出す API が変わります。図はこれらの分岐を一つにまとめています。

## dist/app.js / 4

該当行の呼び出し式を根拠にしています。実行観測ではありません。

## dist/app.js / 5

構文から処理を理解する

## dist/app.js / 6

説明に使う読解メモ

## dist/atlas.js / 1

全 Rust ファイルのパスを索引にしています。本文は開いたファイルだけ取得し、100行ずつ表示します。

## dist/atlas.js / 2

構成、モジュールの役割、関数の処理段階、実コードの順に詳しく見ていきます。

## dist/atlas.js / 3

分類・関連領域は事前作成の案内です。正確な呼び出し関係はコードで確認します。

## dist/atlas.js / 4

リポジトリの構成と責務

## dist/atlas.js / 5

全体の中で読む場所を見つける

## dist/atlas.js / 6

読む範囲を段階的に絞る

## dist/atlas.js / 7

次に調べる問いを保存する

## dist/zoom.js / 1

この領域の部品は実際の src ディレクトリから抽出しています。責務や入出力の説明が未作成の部分は、次の段階で原文のモジュールコメントを確認します。

## dist/zoom.js / 2

一覧はテキスト上の fn 宣言から抽出した候補です。trait 宣言・実装・テストを含み、同名関数やマクロを完全には解決しません。

## dist/zoom.js / 3

どのモジュールがどの対象を担当するかを確認します。ファイルの量よりも責務の違いを先に押さえます。

## dist/zoom.js / 4

責務は未確認です。関数名だけから挙動を推定しません。

## dist/zoom.js / 5

の部品は何を分担する？

## dist/zoom.js / 6

はどのモジュールに分かれる？

## dist/zoom.js / 7

の関数と役割

## dist/zoom.js / 8

を構成する部品

## local-app/public/app.js / 1

原文の説明、宣言、読む範囲の順に確認します。関数候補は字句抽出です。マクロ生成・呼び出し関係・正確な関数終端は未解析です。

## local-app/public/app.js / 2

この行範囲を根拠としてメモ・AI解説を保存します。表示範囲は関数境界と一致するとは限りません。

## local-app/public/app.js / 3

まずCargo.toml ごとの構成と原文ドキュメントから責務を確認します。

## local-app/public/app.js / 4

この領域のCargo.toml ごとの構成を確認します。

## local-app/public/app.js / 5

領域からコードを読む

## local-app/public/app.js / 6

ディレクトリ名で絞り込む

## local-app/public/app.js / 7

Cargo.toml ごとの構成
