# Reth読解の達成状況

対象はv2.7.0、3d592ece6de8c4559987416a544fc215fd6d6921。全体の完了判定は未達です。

| 計測対象 | 現在値 | 完了条件 |
| --- | --- | --- |
| 全追跡ファイルの台帳 | 1872/1872 | 100% |
| 一部分に解説があるRustファイル | 23/1283 | 100% |
| 全体をレビュー済みのRustファイル | 0/1283 | 100% |
| 同じページで読める領域の入口 | 11/11 | 100% |
| 原文と不一致の根拠 | 0 | 0 |
| AIペルソナの課題 | 33/33 | 全課題、8クリック以内、根拠付き4項目 |
| URL・行・ヒント・下書きの保持 | 3/3 | 全ペルソナ |
| 全課題と保持を連続して達成した回数 | 2 | 2回以上 |
| 人間の理解検証 | 0/33課題・0/3人 | 各ペルソナの実在の学習者が全11課題で、補助を閉じて根拠付き4項目を再説明 |

抜粋の解説をファイル全体のレビューとして数えません。関数・分岐の全数に対する網羅率は未計測です。AIの操作と回答は、人間の理解度を示しません。

## 領域別の対応

| 領域 | Rustファイル | 一部に解説あり | 読解入口 |
| --- | --- | --- | --- |
| 起動・組み立て | 191 | 6 | あり |
| 外部 API | 152 | 4 | あり |
| トランザクションプール | 42 | 4 | あり |
| P2P ネットワーク | 193 | 1 | あり |
| 履歴・状態の同期 | 122 | 1 | あり |
| チェーンの進行・検証 | 73 | 2 | あり |
| EVM・ブロック実行 | 28 | 1 | あり |
| ブロック候補の構築 | 27 | 1 | あり |
| 永続化・状態・トライ | 288 | 1 | あり |
| 拡張・利用例 | 75 | 1 | あり |
| 共通部品・テストほか | 92 | 1 | あり |

## 未達条件

- FR-COV-002: Every Rust file has a source-anchored explanation; excerpt coverage is separate from full-file review
- FR-COV-003: Every Rust file has a full-file review recording public operations and branches; an excerpt is not sufficient
- FR-EVAL-003: Actual novice learners independently explain role/input/output/failure from source after closing help; AI roleplay does not satisfy this gate
