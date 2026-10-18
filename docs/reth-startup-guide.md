# Reth v2.7.0 起動から稼働まで

`reth node` が設定とデータベースを準備し、通信やブロック処理を動かし続けるまでを追います。最初に「誰が何を起動するか」を押さえ、そのあとで処理を繰り返す場所を読みます。

対象: Reth `v2.7.0` / `3d592ece6de8c4559987416a544fc215fd6d6921`。通常のノード起動をソースから読んだ資料です。開発用・デバッグ用の分岐は省略しています。

[ローカルアプリで順に読む](http://127.0.0.1:4317/startup) · [対象ソース](https://github.com/paradigmxyz/reth/tree/3d592ece6de8c4559987416a544fc215fd6d6921)

## まず、三つに分ける

### 01 CLIを受け取る

`main` が引数を解析し、`node` コマンドへ処理を渡します。CLI runner が非同期処理を動かす実行環境と、終了を監視する仕組みを用意します。

### 02 部品を組み立てて起動する

設定・DB・チェーンの初期状態を用意し、ネットワーク、トランザクションプール、エンジン、RPCを接続します。この途中から、通信やバックグラウンド処理が動き始めます。

### 03 入力を待ちながら処理を続ける

通信、エンジン、同期などの担当が、それぞれ入力や完了通知を待って働きます。`main` は `NodeHandle` を受け取り、ノードの終了を待ちます。

## リポジトリのどこを読むか

| 場所 | この資料で読む役割 |
| --- | --- |
| `bin/reth`、`crates/ethereum/cli`、`crates/cli` | プログラムの入口、コマンド選択、実行環境 |
| `crates/node/builder` | DBや各サービスの準備、サービス間の接続と起動 |
| `crates/engine/tree`、`crates/net`、`crates/stages` | 起動後のブロック処理、通信、過去区間の同期 |

入口から呼び出しを追うときは、次の順番で役割が変わります。

```text
main → Cli::run → CliRunner → NodeCommand::execute
                                     ↓
                   NodeBuilder → EngineNodeLauncher
                                     ↓
              サービスを接続・起動 → NodeHandleを返す
                                     ↓
                         mainは終了を待つ
```

## 起動の順番を追う

### 1. 引数を読んで、nodeコマンドを選ぶ

`main` は `Cli::parse().run(...)` を呼び、ノードの起動方法をクロージャーで渡します。`Cli::run` は実行環境やログを準備し、`Commands::Node` で `CliRunner::run_command_until_exit` に処理を渡します。

読む場所: [main.rs:20–48](https://github.com/paradigmxyz/reth/blob/3d592ece6de8c4559987416a544fc215fd6d6921/bin/reth/src/main.rs#L20-L48)、[CLI app.rs:106–191](https://github.com/paradigmxyz/reth/blob/3d592ece6de8c4559987416a544fc215fd6d6921/crates/ethereum/cli/src/app.rs#L106-L191)

### 2. ノード設定とDBを用意する

`NodeCommand::execute` はCLIの値から `NodeConfig` を作り、DBを開きます。そのDBとタスク実行用の情報を `NodeBuilder` に渡し、起動処理を呼び出します。

読む場所: [NodeCommand::execute:157–225](https://github.com/paradigmxyz/reth/blob/3d592ece6de8c4559987416a544fc215fd6d6921/crates/cli/commands/src/node.rs#L157-L225)

### 3. チェーンの状態を扱う準備をする

`EngineNodeLauncher::launch_node` は設定ファイルを読み、DBへのアクセスを担う provider を用意します。genesisというチェーンの初期状態を初期化し、稼働中のチェーンを扱う `BlockchainProvider` を作ります。

読む場所: [launch_node:102–140](https://github.com/paradigmxyz/reth/blob/3d592ece6de8c4559987416a544fc215fd6d6921/crates/node/builder/src/launch/engine.rs#L102-L140)

### 4. 実行・通信・ブロック生成の部品を作る

component builder は、EVM、トランザクションプール、ネットワークを順に組み立てます。続いて payload builder のサービスを起動し、コンセンサス検証用の部品を作ります。準備処理の途中にサービスの起動が含まれています。

読む場所: [build_components:375–402](https://github.com/paradigmxyz/reth/blob/3d592ece6de8c4559987416a544fc215fd6d6921/crates/node/builder/src/components/builder.rs#L375-L402)

### 5. エンジンと同期処理を接続する

launcher は同期用 pipeline を作り、コンセンサス層からの要求を受け取る経路を用意します。`EngineOrchestratorBuilder::build` は、ブロックのダウンロード、保存処理、エンジンの tree handler、要求の振り分け、backfill同期を接続します。保存処理と tree handler は、この段階で起動します。

読む場所: [launcher:145–177](https://github.com/paradigmxyz/reth/blob/3d592ece6de8c4559987416a544fc215fd6d6921/crates/node/builder/src/launch/engine.rs#L145-L177)、[orchestrator構築:248–269](https://github.com/paradigmxyz/reth/blob/3d592ece6de8c4559987416a544fc215fd6d6921/crates/node/builder/src/launch/engine.rs#L248-L269)、[build:44–159](https://github.com/paradigmxyz/reth/blob/3d592ece6de8c4559987416a544fc215fd6d6921/crates/engine/tree/src/launch.rs#L44-L159)

### 6. RPCとエンジンのタスクを起動する

launcher はRPCを含む add-ons を起動し、エンジンを動かす非同期タスクを登録します。その後、各部品をまとめた `FullNode` と終了通知を `NodeHandle` に入れて返します。ここで返ることは、チェーン同期の完了を意味しません。

読む場所: [add-onsの起動:279–294](https://github.com/paradigmxyz/reth/blob/3d592ece6de8c4559987416a544fc215fd6d6921/crates/node/builder/src/launch/engine.rs#L279-L294)、[タスク登録と戻り値:410–444](https://github.com/paradigmxyz/reth/blob/3d592ece6de8c4559987416a544fc215fd6d6921/crates/node/builder/src/launch/engine.rs#L410-L444)

### 7. mainは終了を待つ

`main` は `handle.wait_for_node_exit().await` へ進みます。このメソッドは終了通知の future を待ちます。外側のCLI runnerはコマンドの完了や終了シグナルを扱い、終了時のタスク停止を管理します。

読む場所: [NodeHandle:8–25](https://github.com/paradigmxyz/reth/blob/3d592ece6de8c4559987416a544fc215fd6d6921/crates/node/builder/src/handle.rs#L8-L25)、[CLI runner:63–101](https://github.com/paradigmxyz/reth/blob/3d592ece6de8c4559987416a544fc215fd6d6921/crates/cli/runner/src/lib.rs#L63-L101)

## 稼働中は、どこが処理を繰り返すか

ノード全体の稼働は複数のタスクとスレッドの協調で続きます。まず次の四か所を区別すると、イベントの受け渡しを追いやすくなります。

### エンジンを進める非同期タスク

launcher 内の `loop` は `tokio::select!` で orchestrator のイベント、生成済みpayload、停止要求などを待ちます。orchestrator は要求の処理とbackfillの進行を調整し、結果をイベントとして返します。

読む場所: [エンジンタスク:317–413](https://github.com/paradigmxyz/reth/blob/3d592ece6de8c4559987416a544fc215fd6d6921/crates/node/builder/src/launch/engine.rs#L317-L413)、[ChainOrchestrator:75–138](https://github.com/paradigmxyz/reth/blob/3d592ece6de8c4559987416a544fc215fd6d6921/crates/engine/tree/src/chain.rs#L75-L138)

### ブロックを処理する専用スレッド

`EngineApiTreeHandler` は専用のOSスレッドで動きます。`run` のループはエンジン要求や保存完了を処理し、必要に応じて次の保存を始めます。保存が追いつかないときは、新しい要求を読む前に保存完了を待ちます。

読む場所: [スレッド起動:460–480](https://github.com/paradigmxyz/reth/blob/3d592ece6de8c4559987416a544fc215fd6d6921/crates/engine/tree/src/tree/mod.rs#L460-L480)、[run:517–604](https://github.com/paradigmxyz/reth/blob/3d592ece6de8c4559987416a544fc215fd6d6921/crates/engine/tree/src/tree/mod.rs#L517-L604)

### ピアとの通信を進めるタスク

`NetworkManager::poll` は、他の部品からの要求とネットワークのイベントを処理します。待つべき状態では `Poll::Pending` を返し、実行環境に処理を委ねます。一度に処理する量にも上限があり、他のタスクが動けるようになっています。

読む場所: [NetworkManager::poll:1134–1203](https://github.com/paradigmxyz/reth/blob/3d592ece6de8c4559987416a544fc215fd6d6921/crates/net/network/src/manager.rs#L1134-L1203)

### 必要な区間をまとめて同期するタスク

backfill が必要になると、`PipelineSync` が対象区間の処理を起動します。同期先を指定した場合は `run_as_fut` から `run_loop` へ進み、登録されたstageを順に実行します。巻き戻しを指定した場合は `unwind` へ進みます。live同期とbackfill同期は切り替えて使います。

読む場所: [同期方式の関係:1–8](https://github.com/paradigmxyz/reth/blob/3d592ece6de8c4559987416a544fc215fd6d6921/crates/engine/tree/src/backfill.rs#L1-L8)、[PipelineSync:140–158](https://github.com/paradigmxyz/reth/blob/3d592ece6de8c4559987416a544fc215fd6d6921/crates/engine/tree/src/backfill.rs#L140-L158)、[run_as_fut:149–175](https://github.com/paradigmxyz/reth/blob/3d592ece6de8c4559987416a544fc215fd6d6921/crates/stages/api/src/pipeline/mod.rs#L149-L175)、[run_loop:223–258](https://github.com/paradigmxyz/reth/blob/3d592ece6de8c4559987416a544fc215fd6d6921/crates/stages/api/src/pipeline/mod.rs#L223-L258)

## 読むための用語

| 用語 | ここで押さえる意味 |
| --- | --- |
| provider | DBやチェーンの状態を読み書きするための窓口 |
| Engine API | コンセンサス層から実行層へ、payloadやチェーン選択の要求を送るAPI |
| payload builder | 新しいブロックに含める実行内容を組み立てるサービス |
| live同期 / backfill同期 | コンセンサス層からの通知に応じた同期 / 過去のブロック区間をstageごとに進める同期 |
| future / poll | 完了待ちの処理を表す値 / その処理を進め、結果か待機状態を返す操作 |

## 自分の言葉で説明できるか

1. **CLIの値はどこでノードの設定になるか。** `NodeCommand::execute`、`NodeConfig`、DB、`NodeBuilder` の関係を説明する。
2. **launchが返ったあとも、なぜノードは動くか。** 起動済みのタスク・スレッドと、`NodeHandle` で終了を待つ処理を分けて説明する。
3. **「メインループはどこか」と聞かれたら、どこを示すか。** エンジンの非同期タスク、tree handler、通信、backfillの役割を挙げ、backfillが動く条件を添える。

各問いを説明してからリンク先のコードで確かめると、関数名だけを覚えていないか確認できます。ローカルアプリの起動導線では同じ順番でソースを開けます。

---

作成: 2026-10-19。ソース参照はすべて上記commitに固定しています。この資料は静的なコード読解に基づき、Rethを実行して得た観測結果は含みません。日本語の確認には [yomiyasu v2.0.1](https://github.com/nanaism/yomiyasu/tree/84e1f5b15e497538fcfe19ab7e9c6f6d138f19ff) を使用しています。
