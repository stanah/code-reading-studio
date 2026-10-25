---
name: verify-notes-persistence
description: 読解ノートの保存（local-app/server.mjs の state、save()、writes チェーン、/api/item、/api/explain、/api/delete）を TLA+ のモデル検査と実コードへの障害注入で検証する。保存、削除、再起動まわりのコードを変えたとき、保存の順序や失敗時の挙動を問われたとき、または coverage.json に載っている行に触れる変更をレビューするときに使う。
---

# 読解ノートの保存を形式検証する

読解ノートは、このアプリで利用者が書いた唯一のデータである。
ガイドやコードは固定コミットから再生成できるが、ノートは失えば戻らない。
そのため、この検証は「保存に成功したと答えたノートは、再起動後も残るか」と「画面に見えているノートは、再起動後も同じか」を対象にする。

## 何を検証したか

| ID | 性質（一文） | 破れたときの害 | 現在のコード |
| --- | --- | --- | --- |
| `AckedSurvives` | 200 で答えた追加は、削除が始まるまでファイルに残る。 | 保存できたはずのメモが再起動で消える。 | 成り立つ |
| `AckedDeleteSticks` | 200 で答えた削除は、古い書き込みで元に戻らない。 | 消したメモが再起動で復活する。 | 成り立つ |
| `IdleMatchesDisk` | 書き込み待ちがないとき、画面のノート一覧と再起動後の一覧は同じである。 | 見えていたメモが再起動で消える。 | **破れる（F1）** |
| `NoSkippedSave` | 保存の失敗は、その保存自身の書き込みの失敗に限られる。 | 一度の失敗のあと、再起動まで全ての保存が失敗する。 | **破れる（F2）** |

検査は2段で行う。

- **モデル検査**：`model/NotesPersistence.tla` を TLC で調べる。ノート3件の追加、そのうち2件の削除、最大2回の書き込み失敗、最大2回の再起動について、全ての実行順序を調べ尽くす。
- **実コードの再現**：`scripts/replay.mjs` が実際の `createStudio` を起動し、`node:fs/promises` の `writeFile` に遅延や失敗を注入して、モデルの4つの性質を同じ形で確かめる。

TLA+ を選んだのは、問いが「非同期の手順がどの順で進むか」だからである。
`server.mjs` の保存は、await のあいだに別の要求が割り込める。
起こりうる順序をテストで列挙し尽くすことはできないが、モデル検査なら上の範囲で漏れなく調べられる。
一方、モデルは人が書いた写しなので、実コードの再現でモデルと実装の挙動が一致することを確かめる。

## 見つかったこと

コードは変更していない。
次の2つは、現在のコードで実際に起きる問題として報告する。

**F1（`IdleMatchesDisk`）**：書き込みが1回失敗すると、失敗したメモが画面には残り、再起動で消える。

1. 利用者が「範囲とメモを保存」を押す。`/api/item` はメモを `state.items` に加え、`save()` を呼ぶ。
2. `writeFile` が失敗する（ディスク不足など）。利用者にはエラーが表示される。
3. しかし `state.items` からメモは取り除かれない。「読解ノート」を開くと、そのメモが一覧に出る。
4. サーバーを再起動すると、ファイルにはメモがないので一覧から消える。

再現スクリプトの結果は `{"addStatus":400,"shownBeforeRestart":["A"],"afterRestart":[]}` である。

**F2（`NoSkippedSave`）**：書き込みが1回失敗すると、再起動するまで以後の保存が全て失敗する。

1. 1件目の保存で `writeFile` が一時的に失敗し、`writes` が reject された promise になる。
2. `save()` は `writes=writes.then(...)` と書くので、reject 済みの `writes` に `then` を付けても書き込み関数は実行されない。
3. 2件目以降の保存は書き込みを試みないまま、1件目と同じエラーで 400 を返す。ディスクが回復しても直らない。

再現スクリプトの結果は `{"firstStatus":400,"secondStatus":400,"secondError":"injected ENOSPC"}` である（2件目の書き込みは失敗を注入していない）。
F1 と F2 が重なると、画面には全てのメモが見えているのに、ファイルには最初の失敗より前のメモしか残らない。

`AckedSurvives` と `AckedDeleteSticks` は、失敗が起きても成り立つ。
200 で答えるのは書き込み完了を待ってからであり、`writes` の連鎖が書き込みを呼び出し順に1本ずつ実行するからである。

## 実行方法

```sh
bash .claude/skills/verify-notes-persistence/scripts/check.sh
```

必要なのは Java 11 以上、Node.js 22 以上、curl である。
初回だけ TLA+ の公式リリース v1.8.0 の `tla2tools.jar` を `~/.cache/verify-notes-persistence/` に取得し、`check.sh` に固定した SHA-256 で照合する。
全体は数秒で終わる。
TLC のログは `outputs/verify-notes-persistence/<設定名>.log` に残る（Git 管理外）。

`check.sh` は次の3つを順に行い、全ての結果が `expected.json` と一致し、差分検出に変化がないときだけ終了コード 0 を返す。

1. **差分検出**（`scripts/drift.mjs`）：`coverage.json` に載せた `server.mjs` の行が同期コミットから変わっていないかを、行の SHA-256 で調べる。
2. **TLC**：`model/*.cfg` を全て実行する。
3. **実コードの再現**：`scripts/replay.mjs` を実行する。Reth は使わず、一時ディレクトリに小さな Git リポジトリを作る。

| 設定 | 内容 | 期待 |
| --- | --- | --- |
| `Baseline` | 現在のコード、書き込み失敗なし。4つの性質を全て調べる。 | PASS |
| `Fault-AckedSurvives` | 現在のコード、失敗2回まで。`AckedSurvives` と `AckedDeleteSticks`。 | PASS |
| `Fault-IdleMatchesDisk` | 現在のコード、失敗2回まで。F1。 | `FAIL:IdleMatchesDisk` |
| `Fault-NoSkippedSave` | 現在のコード、失敗2回まで。F2。 | `FAIL:NoSkippedSave` |
| `Broken-Unserialized` | `save()` が連鎖せずに書き込みを始める壊れた版。 | `FAIL:AckedSurvives` |
| `Broken-Unserialized-Delete` | 同じ壊れた版。 | `FAIL:AckedDeleteSticks` |

`Broken-*` は、性質が実際に破れうることを示すための設定である。
この2つが PASS になったら、モデルが壊れて何も検査していないことを疑う。

## 変更がこの検証に触れるか

次のどれかに当てはまる変更は、この検証の対象である。

- `coverage.json` に載っている `local-app/server.mjs` の行を変える（`check.sh` の差分検出が `!!` を出す）。
- `state.items` を読み書きする新しい API を足す。
- データディレクトリの場所、ファイル名、起動時の読み込み方を変える。

UI（`local-app/public/`）だけの変更は対象外である。
画面の操作は `verify-studio` スキルで確かめる。

## 結果の読み方

`!!` の付いた行が、期待と違った結果である。

TLC の反例は、ログの `State 1:` から最後の状態までの手順である。
pstack の `/statechart` スキルが使える環境では、TLC の結果を必ず `/statechart` で読む。
違反のたびに最短の手順を平易な言葉で示し、変更でどの違反が消えたかも示してくれる。
検査が通ったときは、状態の移り変わりを図にしてくれる。
`/statechart` がない環境では、ログの各状態の `mem`、`disk`、`queue`、`pc` を順に読み、次の対応でコードの言葉に直す。

| モデル | コード |
| --- | --- |
| `mem` | メモリ上の `state.items`。`GET /api/state` が返す。 |
| `disk` | `<dataDir>/<index.id>.json` の中身。起動時に一度だけ読む。 |
| `queue` | `writes` の連鎖で待っている書き込み。各要素は `save()` を呼んだ時点の JSON。 |
| `broken` | `writes` が reject 済みである。 |
| `pc[<<"add", i>>]` | ノート `i` の `/api/item` 要求の状態。`acked` は 200、`failed` と `skipped` は 400、`dropped` は再起動で応答が失われた。 |
| `Add`、`Delete`、`Write`、`Restart` | 要求の処理、書き込み1回分（`writeFile` と `rename`）、プロセスの再起動。 |

本物の不具合かモデルの誤りかは、次の手順で見分ける。

1. 反例の各手順を、上の対応表でコードの行に当てはめる。
2. `replay.mjs` に同じ手順のシナリオがあれば、その結果と比べる。実コードでも同じ結果なら、本物の不具合である。
3. 実コードでは起こらない手順が含まれていたら、モデルが実装より多くを許している。`NotesPersistence.tla` の冒頭の対応表と、その手順を許したアクションを直す。
4. 逆に、実コードで起きることがモデルで起きないなら、モデルが実装より少なくしか許していない。こちらは検査の漏れになるので、より重大である。

## 対象のコードが変わったとき

`drift.mjs` が `CHANGED` を出したら、TLC の結果をそのまま信じず、次を行う。

1. 変わった行を読み、`NotesPersistence.tla` の冒頭にある対応表のどの部分に当たるかを決める。
2. await の位置が変わったか、`state.items` を変える場所が増えたか、`save()` の連鎖の作り方が変わったかを確かめ、モデルのアクションを実装に合わせて直す。1つのアクションは、コードの await から次の await までの1区間と一致させる。
3. 意図した変更で性質の成否が変わるなら（たとえば F1 や F2 を直したなら）、`expected.json` の該当する行を書き換える。F2 を直したら `Fault-NoSkippedSave` と `NoSkippedSave-after-one-failure` を `PASS` にする。
4. 直したモデルの `Broken-*` が引き続き FAIL になることを確かめる。
5. `node .claude/skills/verify-notes-persistence/scripts/drift.mjs --write` で行のハッシュを書き直す。
6. モデルが新しいコミットのコードを表していると確かめてから、`coverage.json` の `syncCommit` をそのコミットに進める。確かめる前に進めてはならない。

性質を弱めたりモデルの範囲を狭めたりして PASS にしてはならない。
現在のコードで破れる性質は、直すまで `FAIL` のまま記録しておく。

## 範囲と前提

- 範囲はノート3件、削除2件、書き込み失敗2回、再起動2回である。この範囲の外（たとえば4件以上）は調べていない。
- 1つのサーバープロセスだけを扱う。同じデータディレクトリに複数のプロセスが書く構成は、README のとおり未対応であり、モデルにも入れていない。
- `rename` は不可分で、電源断などで中間状態のファイルが残ることはないと仮定している。`fsync` の有無や、OS が書き込みを失う場合は対象外である。
- `writeFile` と `rename` の失敗は区別しない。どちらで失敗しても、その書き込みの連鎖が同じように reject されるからである。
- `/api/explain` は `/api/item` と同じ形の追加として扱う。AI への問い合わせの失敗は、ノートを加える前に起きるので保存には影響しない。
- 要求本文の解析エラー、64 KiB の上限、範囲検証のエラーは、ノートを変える前に起きるので対象外である。
- ブラウザー側の表示（保存後に一覧を読み直すか、など）は対象外である。

## 対応するコードと同期コミット

`coverage.json` が、検証が表すコードの行と、最後に確認したコミット（`syncCommit`）を持つ。
現在の同期コミットは `b61f976` で、対象は `local-app/server.mjs` の次の行である。

- `let state=...`：起動時のファイルの読み込み（`Init`、`Restart`）。
- `const save=()=>...`：`writes` の連鎖（`queue`、`broken`、`Write`）。
- `/api/item` と `/api/explain` の処理：ノートの追加（`Add`）。
- `/api/delete` の処理：削除（`Delete`）。
- `/api/state` の処理：画面に出る一覧（`mem`）。
- 要求全体の `catch`：失敗が 400 になる箇所（`failed`、`skipped`）。
