# Reth読解の達成状況

対象はv2.7.0、3d592ece6de8c4559987416a544fc215fd6d6921。全体の完了判定は未達です。

| 計測対象 | 現在値 | 完了条件 |
| --- | --- | --- |
| 全追跡ファイルの台帳 | 1872/1872 | 100% |
| 一部分に解説があるRustファイル | 61/1283 | 100% |
| 全体をレビュー済みのRustファイル | 2/1283 | 100% |
| 同じページで読める領域の入口 | 11/11 | 100% |
| 公開データの原文照合エラー | 0 | 0 |
| AIペルソナの課題 | 未計測（現版の記録なし） | 全課題、8操作以内、根拠付き4項目・追加課題は補助を閉じた予測 |
| 操作順が条件に合わず採点外の課題 | 0 | 固定した順序と実操作順を照合 |
| 追加した条件変更・予測の課題 | 0/33 | 補助を閉じた予測と根拠行を別途照合 |
| URL・行・ヒント・下書きの保持 | 未計測（現版の記録なし） | 全ペルソナ |
| 全課題と保持を連続して達成した回数 | 0 | 2回以上 |
| 人間の理解検証 | 0/66課題・0/3人 | 各ペルソナの実在の学習者が全22課題で、補助を閉じて根拠付き4項目を再説明 |

抜粋の解説をファイル全体のレビューとして数えません。関数・分岐の全数に対する網羅率は未計測です。AIの操作と回答は、人間の理解度を示しません。

## 領域別の対応

| 領域 | Rustファイル | 一部に解説あり | 読解入口 |
| --- | --- | --- | --- |
| 起動・組み立て | 191 | 16 | あり |
| 外部 API | 152 | 7 | あり |
| トランザクションプール | 42 | 6 | あり |
| P2P ネットワーク | 193 | 7 | あり |
| 履歴・状態の同期 | 122 | 5 | あり |
| チェーンの進行・検証 | 73 | 12 | あり |
| EVM・ブロック実行 | 28 | 2 | あり |
| ブロック候補の構築 | 27 | 1 | あり |
| 永続化・状態・トライ | 288 | 2 | あり |
| 拡張・利用例 | 75 | 2 | あり |
| 共通部品・テストほか | 92 | 1 | あり |

## 未達条件

- FR-COV-002: Every Rust file has a source-anchored explanation; excerpt coverage is separate from full-file review
- FR-COV-003: Every Rust file has a full-file review recording public operations and branches; an excerpt is not sufficient
- FR-EVAL-001: Three personas complete 22 fixed tasks each within 8 clicks, with source-supported role/input/output/boundary; 11 transfer tasks also require closed-help predictions and evidence lines; two consecutive rounds on the same build
- FR-EVAL-002: All three personas retain URL, selected line and hint across assistance changes, and no saved or draft note is lost
- FR-EVAL-003: Actual novice learners complete all 22 tasks each and explain source-supported role/input/output/failure with help closed; AI roleplay does not satisfy this gate
