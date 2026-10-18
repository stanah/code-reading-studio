# 既存の送信経路・構造・Rust説明の見直し

2026-10-19。対象は Reth v2.7.0、固定コミット `3d592ece6de8c4559987416a544fc215fd6d6921`。
アプリの比較元は `4fda42a4a758addd25b90805d0ba14f53e10f612`。
使用した [yomiyasu](https://github.com/nanaism/yomiyasu/tree/84e1f5b15e497538fcfe19ab7e9c6f6d138f19ff/skills/yomiyasu) は v2.0.1。

## 書き直した本文

画面の説明を次の4群に分けて検査した。抽出時の識別子は表示文ではない。

| 対象 | 確認した範囲 | 原文・最終稿 |
| --- | --- | --- |
| 送信経路 | 6ステップ・5補足の本文、前提、見出し、入出力、言語補足、関係の説明、構造画面の18段階文。計189フィールド | [原文](reviews/existing-copy/transaction/original.md)・[最終稿](reviews/existing-copy/transaction/final.md) |
| 構造 | 11領域、4つの問い、RPCの4構成部品、6ファイルの役割、未解説部分の案内。計90フィールド | [原文](reviews/existing-copy/structure/original.md)・[最終稿](reviews/existing-copy/structure/final.md) |
| Rust・3つの見方 | 5教材、3段階の概要、38種類の描画状態から抽出した44種類の共通画面文 | [原文](reviews/existing-copy/lenses/original.md)・[最終稿](reviews/existing-copy/lenses/final.md) |
| 画面案内 | atlas、zoom、静的reader、ローカルreaderの見出し・案内から28箇所 | [原文](reviews/existing-copy/ui/original.md)・[最終稿](reviews/existing-copy/ui/final.md) |

同じ説明の配布コピーは再生成し、静的版とローカル版の一致を確認した。
全アプリのボタン名やエラー表示を網羅した検査ではない。

## 変えたところ

- 「意味のあるデータ」「委譲」「全体の配線」などを、送信者の復元、処理の受け渡し、ノードの構成という具体的な説明にした。blob sidecarの変換後に外部転送を判定する順序を明記した。
- `?` の説明にasyncブロックを含め、`await??` の受信失敗とプール追加失敗を分けた。oneshotはTokioの機能であることと、値を送らずに送信側を破棄した場合の受信失敗を明記した。
- 構造探索の表示をCargo.tomlごとのグループとして示した。未作成・未確認の説明を残し、関数名やディレクトリから動作を推定したとは書いていない。
- Rust教材の本文を13pxから15pxにし、最大行幅を48em、実測720pxにした。CSSの内容ハッシュをURLに付け、更新前のスタイルがキャッシュに残る問題も防ぐようにした。
- 静的readerのコミットリンクとzoomのフッターに残っていた旧コミットを修正した。今後は対象設定から生成し、本文・注釈のコピーとともに一致を検査する。

## 残した表現と検査候補

`move`とコピー、FutureとPromise、プール追加とブロック取り込みは混同しやすいため、否定による区別を残した。入力・出力のコロンは画面上で値に続くラベルなので残した。送信経路の「ます」の繰り返しも、各処理を説明する自然な文末として残した。

差分検査が挙げた引用符内の変更は外部資料の引用ではなく、説明用の言い換えである。oneshotの「1回」は原文の「一度限り」に対応する。Tokioという名前はコードの `tokio::sync::oneshot::channel()` と一致する。Futureの説明は完了待ちを維持している。「すべてが使うとは限らない」「専用スレッドを作るとは限らない」という条件も保った。

## 事実の確かめ

- [要求送信と返答待ち](https://github.com/paradigmxyz/reth/blob/3d592ece6de8c4559987416a544fc215fd6d6921/crates/rpc/rpc/src/eth/core.rs#L489-L504) と [復元を行うasyncブロック](https://github.com/paradigmxyz/reth/blob/3d592ece6de8c4559987416a544fc215fd6d6921/crates/rpc/rpc-eth-api/src/helpers/transaction.rs#L81-L109) を確認した。
- blob変換・転送・通常経路は [Ethereum向け実装](https://github.com/paradigmxyz/reth/blob/3d592ece6de8c4559987416a544fc215fd6d6921/crates/rpc/rpc/src/eth/helpers/transaction.rs#L32-L114) と照合した。
- asyncブロック内の `?` がFutureの結果に作用する点は [Rust Reference](https://doc.rust-lang.org/reference/expressions/block-expr.html#control-flow-operators) で、ポーリングは [Futureの公式説明](https://doc.rust-lang.org/std/future/trait.Future.html) で確認した。
- oneshotの失敗条件は、RethのCargo.lockと同じ [Tokio 1.53.1の資料](https://docs.rs/tokio/1.53.1/tokio/sync/oneshot/) で確認した。
- コード抜粋、行番号、ハッシュ、URL、シンボル、IDなど、送信データの説明以外の値は比較元と完全一致した。構造生成スクリプトも日本語文字列以外のASTが一致した。

## 確認の記録

書き手: Code Reading Studioの解説者（推定）／読み手: TypeScript経験がありRustを学ぶ開発者、informed（推定）／場面: 画面上のコード読解（指定）。

原文の通読、原文lint、最終稿のlint・diff・資料照合、候補の再確認、verifyを実行した。構造は初回run後に本文を変更せず、他の3群は修正を1回にまとめて再実行した。追加の画面案内28箇所だけは原文lintが初稿作成後となったため、「書き直す前にlint」という順序から外れている。検査そのものの未実行項目はない。コードと公式資料の照合は、ユーザーから指定された整合性確認として実施した。

| 群 | lint候補 | 硬化の候補 | 最終run回数 |
| --- | --- | --- | --- |
| 送信経路 | 11 → 3 | なし | 2 |
| 構造 | 2 → 0 | なし | 1 |
| Rust・3つの見方 | 6 → 3 | 2件 | 2 |
| 画面案内 | 2 → 0 | 2件 | 2 |

件数は点数ではなく、増減は読みやすさの良し悪しを示さない。勢いの検査は全群で候補なし。
原文・最終稿のSHA-256とverifyの出力は [record.json](reviews/existing-copy/record.json) に記録した。

アプリの自動テスト20件、静的版のsmoke・atlas・zoom検査、27箇所の参照範囲と49ファイルのソース照合が通った。説明コピーと参照表示の一致も確認した。Reth自体はビルド・実行していない。

ブラウザーでは送信経路、構造、Rustの説明を読み、選択した処理を保つ切り替えと「Rust補足→根拠コード→同じ補足」の往復を確認した。狭い画面は667px、最終CSS適用後の内容幅は652px、静的版は1265pxで確認した。本文の欠けやページ全体の横方向へのはみ出しは見られなかった。これらはエージェントによる表示確認であり、利用者の読解テストや承認を表すものではない。
