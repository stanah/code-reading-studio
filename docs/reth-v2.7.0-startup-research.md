# Reth v2.7.0：CLIから継続処理までの調査根拠

調査日: 2026-10-19。対象は [`paradigmxyz/reth` の v2.7.0](https://github.com/paradigmxyz/reth/releases/tag/v2.7.0)、commit [`3d592ece6de8c4559987416a544fc215fd6d6921`](https://github.com/paradigmxyz/reth/commit/3d592ece6de8c4559987416a544fc215fd6d6921)。この文書は固定commitの静的なコード調査であり、ノードの起動、P2P接続、chain同期やupstreamテストの実行結果ではない。

読者向けの案内は [起動ガイド](reth-startup-guide.md)、アプリが表示する注釈と抜粋位置は [startup-guide.json](../local-app/startup-guide.json) にある。この調査では「コマンド選択 → 設定・DB・部品の準備 → 稼働中の処理」という読む順を採用した。実際にはnetworkやpayload builder等のタスクは部品生成中に起動する。

## 確認した結論

`main` はCLIに起動closureを渡し、得られた `NodeHandle` の終了を待つ。ブロック処理の大きなloopは `main` にない。`wait_for_node_exit` 自体も終了Futureをawaitする入口である。[main](https://github.com/paradigmxyz/reth/blob/3d592ece6de8c4559987416a544fc215fd6d6921/bin/reth/src/main.rs#L40-L48)、[NodeHandle::wait_for_node_exit](https://github.com/paradigmxyz/reth/blob/3d592ece6de8c4559987416a544fc215fd6d6921/crates/node/builder/src/handle.rs#L17-L25)。

起動後の処理は、CLIの終了監視、consensus engineの非同期イベントループ、Engine Treeの専用OSスレッド、NetworkManagerのFuture、必要時に起動するbackfill pipelineへ分かれる。これらは概念上の「一つのメインループ」にはまとめない。バックグラウンドの永続化、payload builder、RPC、P2P transaction処理等も存在し、ここで挙げる5区分は全タスクの一覧ではない。[CLI監視](https://github.com/paradigmxyz/reth/blob/3d592ece6de8c4559987416a544fc215fd6d6921/crates/cli/runner/src/lib.rs#L228-L294)、[Engineイベントループ](https://github.com/paradigmxyz/reth/blob/3d592ece6de8c4559987416a544fc215fd6d6921/crates/node/builder/src/launch/engine.rs#L317-L413)、[Treeのspawn](https://github.com/paradigmxyz/reth/blob/3d592ece6de8c4559987416a544fc215fd6d6921/crates/engine/tree/src/tree/mod.rs#L421-L480)、[network関連タスクのspawn](https://github.com/paradigmxyz/reth/blob/3d592ece6de8c4559987416a544fc215fd6d6921/crates/node/builder/src/builder/mod.rs#L955-L997)、[Engine内部サービスの配線](https://github.com/paradigmxyz/reth/blob/3d592ece6de8c4559987416a544fc215fd6d6921/crates/engine/tree/src/launch.rs#L132-L158)。

backfillとlive syncは排他的な同期モードである。backfill中もnetworkや終了監視等の役割は存在するが、treeとpipelineを「同時にチェーンへ書き込む常設の二つのloop」とは説明しない。排他の理由はDBの書き込みアクセスで、treeはpipelineがIdleでなければforkchoice更新にSYNCINGを返す。[同期モードの契約](https://github.com/paradigmxyz/reth/blob/3d592ece6de8c4559987416a544fc215fd6d6921/crates/engine/tree/src/backfill.rs#L1-L8)、[DB書き込みの制約](https://github.com/paradigmxyz/reth/blob/3d592ece6de8c4559987416a544fc215fd6d6921/crates/engine/tree/src/backfill.rs#L211-L225)、[forkchoice側の制御](https://github.com/paradigmxyz/reth/blob/3d592ece6de8c4559987416a544fc215fd6d6921/crates/engine/tree/src/tree/mod.rs#L1204-L1209)。

## 起動の読解地点

| ID | 読む地点 | 確認した役割 | 固定commitの根拠 |
| --- | --- | --- | --- |
| `entry` | CLIから起動用の処理を渡す | 引数を読み、EthereumNodeを起動する非同期処理をCLIへ渡す。起動後はhandleを使ってノードの終了を待つ。 | [main](https://github.com/paradigmxyz/reth/blob/3d592ece6de8c4559987416a544fc215fd6d6921/bin/reth/src/main.rs#L33-L48) |
| `dispatch` | nodeサブコマンドを選ぶ | コマンドenumをmatchし、Nodeの場合はRPCの公開モジュール指定を検証して、runnerへNodeCommand::executeを渡す。 | [run_commands_with](https://github.com/paradigmxyz/reth/blob/3d592ece6de8c4559987416a544fc215fd6d6921/crates/ethereum/cli/src/app.rs#L159-L192) |
| `supervisor` | 起動処理と終了条件を監視する | 実行環境上でコマンドを動かし、コマンド完了、終了シグナル、critical タスクのpanicを監視する。正常な終了条件ではgraceful shutdownを試みる。 | [CliRunner::run_command_until_exit](https://github.com/paradigmxyz/reth/blob/3d592ece6de8c4559987416a544fc215fd6d6921/crates/cli/runner/src/lib.rs#L63-L102) |
| `database` | 引数を設定に変えてDBを開く | NodeCommandをNodeConfigへ組み替え、データディレクトリのDBを開く。設定・DB・タスク executorをNodeBuilderに渡してlauncherを呼ぶ。 | [NodeCommand::execute](https://github.com/paradigmxyz/reth/blob/3d592ece6de8c4559987416a544fc215fd6d6921/crates/cli/commands/src/node.rs#L157-L225) |
| `context` | 設定・provider・genesisを準備する | EngineNodeLauncherが設定を読み込み、ピアを解決し、DBへアクセスするproviderを準備する。genesisとmetricsも準備して部品群生成へ進む。 | [EngineNodeLauncher::launch_node / launch context](https://github.com/paradigmxyz/reth/blob/3d592ece6de8c4559987416a544fc215fd6d6921/crates/node/builder/src/launch/engine.rs#L101-L140) |
| `components` | EVM・pool・ネットワークなどを組み立てる | EVM設定、transaction pool、ネットワーク、payload builder service、consensusを順に作り、Componentsとして返す。後の部品は先に作った部品を利用する。 | [ComponentsBuilder::build_components](https://github.com/paradigmxyz/reth/blob/3d592ece6de8c4559987416a544fc215fd6d6921/crates/node/builder/src/components/builder.rs#L375-L403) |
| `services` | Engine API・pipeline・treeをつなぐ | ネットワーク clientと段階的同期用pipelineを用意し、Engine API要求を受け取るチャネルを作る。それらをEngineOrchestratorBuilderに渡してチェーンを進める構造を組む。 | [EngineNodeLauncher::launch_node / engine wiring](https://github.com/paradigmxyz/reth/blob/3d592ece6de8c4559987416a544fc215fd6d6921/crates/node/builder/src/launch/engine.rs#L145-L266) |
| `orchestrator` | Engineのイベントと終了要求を待つ | consensus engineのタスクがorchestratorの次イベント、ローカルで作られたpayload、終了要求を待つ。イベントに応じてネットワークの同期状態等を更新し、treeへ処理を渡す。 | [consensus_engine task](https://github.com/paradigmxyz/reth/blob/3d592ece6de8c4559987416a544fc215fd6d6921/crates/node/builder/src/launch/engine.rs#L317-L413) |
| `tree` | 専用スレッドでEngine要求を処理する | EngineApiTreeHandlerの専用OS スレッドがEngine messageや永続化完了を処理する。永続化が遅れて閾値に達すると、新規要求を取り出さず永続化側を待つ。 | [EngineApiTreeHandler::run](https://github.com/paradigmxyz/reth/blob/3d592ece6de8c4559987416a544fc215fd6d6921/crates/engine/tree/src/tree/mod.rs#L517-L606) |
| `network` | ネットワークの入出力をpollで進める | NetworkManagerはFutureとしてpollされ、内部handleからの要求とswarmのイベントを処理する。一度に処理する量の上限に達したら、executorへ制御を返す。 | [Future for NetworkManager::poll](https://github.com/paradigmxyz/reth/blob/3d592ece6de8c4559987416a544fc215fd6d6921/crates/net/network/src/manager.rs#L1134-L1203) |
| `backfill` | 必要なときだけ段階的同期を走らせる | PipelineSyncはtargetを受け、Idleならpipelineをタスクへ移す。結果をoneshotで待ち、終了したpipelineを再びIdleとして保持する。 | [PipelineSync::try_spawn_pipeline / poll_pipeline](https://github.com/paradigmxyz/reth/blob/3d592ece6de8c4559987416a544fc215fd6d6921/crates/engine/tree/src/backfill.rs#L123-L183) |

主線の間をつなぐ補助参照も確認した。

- `Cli::run` は設定済みのCLIアプリへlauncherを渡す。CLIアプリはruntime・ログ・metricsを準備して `run_commands_with` へ進む。[Cli::run](https://github.com/paradigmxyz/reth/blob/3d592ece6de8c4559987416a544fc215fd6d6921/crates/ethereum/cli/src/interface.rs#L158-L166)、[CliApp::run_with_components](https://github.com/paradigmxyz/reth/blob/3d592ece6de8c4559987416a544fc215fd6d6921/crates/ethereum/cli/src/app.rs#L94-L145)。
- `launch_with_debug_capabilities` は `DebugNodeLauncher` に `EngineNodeLauncher` を包む。debug launcherはまずinner launcherをawaitするので、標準Engineの起動経路を追える。[launch_with_debug_capabilities](https://github.com/paradigmxyz/reth/blob/3d592ece6de8c4559987416a544fc215fd6d6921/crates/node/builder/src/builder/mod.rs#L736-L756)、[DebugNodeLauncherFuture::launch_node](https://github.com/paradigmxyz/reth/blob/3d592ece6de8c4559987416a544fc215fd6d6921/crates/node/builder/src/launch/debug.rs#L211-L225)。
- `EngineOrchestratorBuilder::build` はdownloader、persistence service、Treeスレッド、要求handler、PipelineSyncを結ぶ。launcherはその後add-onsをlaunchし、consensus engineをcritical taskとしてspawnする。終了結果のoneshot受信側から `NodeExitFuture` を作る。[EngineOrchestratorBuilder::build](https://github.com/paradigmxyz/reth/blob/3d592ece6de8c4559987416a544fc215fd6d6921/crates/engine/tree/src/launch.rs#L132-L158)、[add-onsの起動](https://github.com/paradigmxyz/reth/blob/3d592ece6de8c4559987416a544fc215fd6d6921/crates/node/builder/src/launch/engine.rs#L288-L308)、[spawnとNodeHandle](https://github.com/paradigmxyz/reth/blob/3d592ece6de8c4559987416a544fc215fd6d6921/crates/node/builder/src/launch/engine.rs#L410-L444)。
- `ChainOrchestrator` はbackfillとhandlerをpollし、開始・完了をhandlerへ通知する。`EngineHandler` が要求streamとdownload結果を取り込み、`EngineApiRequestHandler` がTreeとのchannelを仲介する。[orchestratorのpoll](https://github.com/paradigmxyz/reth/blob/3d592ece6de8c4559987416a544fc215fd6d6921/crates/engine/tree/src/chain.rs#L75-L138)、[EngineHandler::poll](https://github.com/paradigmxyz/reth/blob/3d592ece6de8c4559987416a544fc215fd6d6921/crates/engine/tree/src/engine.rs#L81-L126)、[Tree channelの仲介](https://github.com/paradigmxyz/reth/blob/3d592ece6de8c4559987416a544fc215fd6d6921/crates/engine/tree/src/engine.rs#L189-L217)。
- backfillの実際の呼び出しは `PipelineSync` → `pipeline.run_as_fut(Some(target))`。同期targetなら `run_loop` でstage群を進める。Unwind targetなら巻き戻して戻る。この経路を、別メソッドである `Pipeline::run` の無限loopへつながるものとして描かない。[pipeline taskのspawn](https://github.com/paradigmxyz/reth/blob/3d592ece6de8c4559987416a544fc215fd6d6921/crates/engine/tree/src/backfill.rs#L138-L158)、[run_as_fut](https://github.com/paradigmxyz/reth/blob/3d592ece6de8c4559987416a544fc215fd6d6921/crates/stages/api/src/pipeline/mod.rs#L150-L178)、[run_loop](https://github.com/paradigmxyz/reth/blob/3d592ece6de8c4559987416a544fc215fd6d6921/crates/stages/api/src/pipeline/mod.rs#L212-L258)。

## 旧読解pinからの差分

旧pinは [`1a4dbbe11264fd52e6e9fbe768aa83f9a6b73607`](https://github.com/paradigmxyz/reth/commit/1a4dbbe11264fd52e6e9fbe768aa83f9a6b73607)、commit日時は `2026-10-10T03:08:17Z`。v2.7.0のcommit日時は `2026-09-28T11:49:29+01:00`。したがってこれは「より新しいリリースへ順方向に更新」とは限らず、旧pinより古いリリースcommitへの固定変更である。日付・subjectは各checkoutの `git show -s --format='%H%n%aI%n%s' HEAD` でも確認した。

全tracked tree entryのmode/type/object IDを比較した結果、旧pin → v2.7.0の方向で **501 paths** に差がある。内訳は本文またはtree entryの変更478、旧pin側だけに存在22、v2.7.0側だけに存在1。ソース以外の設定・docs・test等も含む。renameは推定しないので、移動したファイルは存在先の差として数える。[全501件のpath・旧新blob ID](reth-v2.7.0-source-diff.json) が完全な比較一覧である。GitHubでも [v2.7.0から旧pinへの逆方向の比較](https://github.com/paradigmxyz/reth/compare/3d592ece6de8c4559987416a544fc215fd6d6921...1a4dbbe11264fd52e6e9fbe768aa83f9a6b73607) を参照できる。

起動ガイドに影響する主な違いは次のとおり。差分全体の振る舞いを検証した表ではなく、読解対象のsymbol・接続が変わる箇所を抽出したもの。

| 箇所 | 旧pin | v2.7.0で読む内容 | 根拠 |
| --- | --- | --- | --- |
| バイナリー入口 | `EthereumBackfill` を作り `launch_with_debug_capabilities_and_backfill` へ渡す | `EthereumNode` を `launch_with_debug_capabilities` で起動する | [旧pin](https://github.com/paradigmxyz/reth/blob/1a4dbbe11264fd52e6e9fbe768aa83f9a6b73607/bin/reth/src/main.rs#L15-L55) / [v2.7.0](https://github.com/paradigmxyz/reth/blob/3d592ece6de8c4559987416a544fc215fd6d6921/bin/reth/src/main.rs#L15-L48) |
| CLI runtime設定 | `command.engine.cpu_cores` に応じた設定分岐がある | この箇所はRayonの予約core等の設定を作る | [旧pin](https://github.com/paradigmxyz/reth/blob/1a4dbbe11264fd52e6e9fbe768aa83f9a6b73607/crates/ethereum/cli/src/app.rs#L106-L128) / [v2.7.0](https://github.com/paradigmxyz/reth/blob/3d592ece6de8c4559987416a544fc215fd6d6921/crates/ethereum/cli/src/app.rs#L106-L123) |
| Engine launcher | generic backfill builderとrecovery hookを受け取る | `with_provider_factory`、`EngineOrchestratorBuilder::build` の標準経路 | [旧pin](https://github.com/paradigmxyz/reth/blob/1a4dbbe11264fd52e6e9fbe768aa83f9a6b73607/crates/node/builder/src/launch/engine.rs#L48-L137) / [v2.7.0](https://github.com/paradigmxyz/reth/blob/3d592ece6de8c4559987416a544fc215fd6d6921/crates/node/builder/src/launch/engine.rs#L47-L140) |
| Engineの内部配線 | `build_with_backfill` でbackfillを差し替えられる | `build` 内で `PipelineSync::new` を作る | [旧pin](https://github.com/paradigmxyz/reth/blob/1a4dbbe11264fd52e6e9fbe768aa83f9a6b73607/crates/engine/tree/src/launch.rs#L109-L178) / [v2.7.0](https://github.com/paradigmxyz/reth/blob/3d592ece6de8c4559987416a544fc215fd6d6921/crates/engine/tree/src/launch.rs#L109-L159) |
| BackfillAction | Start / UpdateTarget / UpdateFinalized | Startのみ。継続中target更新を前提に説明しない | [旧pin](https://github.com/paradigmxyz/reth/blob/1a4dbbe11264fd52e6e9fbe768aa83f9a6b73607/crates/engine/tree/src/backfill.rs#L63-L79) / [v2.7.0](https://github.com/paradigmxyz/reth/blob/3d592ece6de8c4559987416a544fc215fd6d6921/crates/engine/tree/src/backfill.rs#L63-L69) |
| 主要な監視・部品・network処理 | runner、NodeCommand、ComponentsBuilder、NetworkManager、ChainOrchestrator | 5ファイルは全ファイルのblob IDが一致 | [全差分一覧の比較方法](reth-v2.7.0-source-diff.json) |

全差分一覧では、v2.7.0にだけあるpathは `crates/engine/tree/src/tree/precompile_cache.rs`。旧pinでは別の場所 `crates/engine/execution-cache/src/precompile_cache.rs` に存在する。旧pinにだけある22 pathsにはsnap用のnode配線、追加e2eテスト、builderの `sync.rs` 等が含まれる。これはpath存在の比較であり、v2.7.0のsnap関連機能全体の有無を断定するものではない。

### 既存transaction送信ガイドの再確認

既存の主線6抜粋と寄り道5抜粋を、両checkoutのUTF-8ソースから行単位で比較した。**11件すべての本文が一致**した。10件は同じ行範囲、`pool-test` のみ旧L331–344からv2.7.0のL349–362へ18行移動している。抜粋が一致しても、各ファイル全体やノード全体の挙動が同じという意味ではない。対応作業はcommit/source URLの再固定と、移動したtestの行範囲更新である。

| 抜粋ID | 旧pin | v2.7.0 | 比較結果 |
| --- | --- | --- | --- |
| `rpc` | [L920–924](https://github.com/paradigmxyz/reth/blob/1a4dbbe11264fd52e6e9fbe768aa83f9a6b73607/crates/rpc/rpc-eth-api/src/core.rs#L920-L924) | [L920–924](https://github.com/paradigmxyz/reth/blob/3d592ece6de8c4559987416a544fc215fd6d6921/crates/rpc/rpc-eth-api/src/core.rs#L920-L924) | 本文一致、行番号一致 |
| `recover` | [L81–109](https://github.com/paradigmxyz/reth/blob/1a4dbbe11264fd52e6e9fbe768aa83f9a6b73607/crates/rpc/rpc-eth-api/src/helpers/transaction.rs#L81-L109) | [L81–109](https://github.com/paradigmxyz/reth/blob/3d592ece6de8c4559987416a544fc215fd6d6921/crates/rpc/rpc-eth-api/src/helpers/transaction.rs#L81-L109) | 本文一致、行番号一致 |
| `submit` | [L32–114](https://github.com/paradigmxyz/reth/blob/1a4dbbe11264fd52e6e9fbe768aa83f9a6b73607/crates/rpc/rpc/src/eth/helpers/transaction.rs#L32-L114) | [L32–114](https://github.com/paradigmxyz/reth/blob/3d592ece6de8c4559987416a544fc215fd6d6921/crates/rpc/rpc/src/eth/helpers/transaction.rs#L32-L114) | 本文一致、行番号一致 |
| `queue` | [L489–504](https://github.com/paradigmxyz/reth/blob/1a4dbbe11264fd52e6e9fbe768aa83f9a6b73607/crates/rpc/rpc/src/eth/core.rs#L489-L504) | [L489–504](https://github.com/paradigmxyz/reth/blob/3d592ece6de8c4559987416a544fc215fd6d6921/crates/rpc/rpc/src/eth/core.rs#L489-L504) | 本文一致、行番号一致 |
| `batch` | [L69–105](https://github.com/paradigmxyz/reth/blob/1a4dbbe11264fd52e6e9fbe768aa83f9a6b73607/crates/transaction-pool/src/batcher.rs#L69-L105) | [L69–105](https://github.com/paradigmxyz/reth/blob/3d592ece6de8c4559987416a544fc215fd6d6921/crates/transaction-pool/src/batcher.rs#L69-L105) | 本文一致、行番号一致 |
| `pool` | [L495–528](https://github.com/paradigmxyz/reth/blob/1a4dbbe11264fd52e6e9fbe768aa83f9a6b73607/crates/transaction-pool/src/lib.rs#L495-L528) | [L495–528](https://github.com/paradigmxyz/reth/blob/3d592ece6de8c4559987416a544fc215fd6d6921/crates/transaction-pool/src/lib.rs#L495-L528) | 本文一致、行番号一致 |
| `rpc-contract` | [L380–390](https://github.com/paradigmxyz/reth/blob/1a4dbbe11264fd52e6e9fbe768aa83f9a6b73607/crates/rpc/rpc-eth-api/src/core.rs#L380-L390) | [L380–390](https://github.com/paradigmxyz/reth/blob/3d592ece6de8c4559987416a544fc215fd6d6921/crates/rpc/rpc-eth-api/src/core.rs#L380-L390) | 本文一致、行番号一致 |
| `recovery-hook` | [L1429–1466](https://github.com/paradigmxyz/reth/blob/1a4dbbe11264fd52e6e9fbe768aa83f9a6b73607/crates/transaction-pool/src/traits.rs#L1429-L1466) | [L1429–1466](https://github.com/paradigmxyz/reth/blob/3d592ece6de8c4559987416a544fc215fd6d6921/crates/transaction-pool/src/traits.rs#L1429-L1466) | 本文一致、行番号一致 |
| `forward` | [L88–105](https://github.com/paradigmxyz/reth/blob/1a4dbbe11264fd52e6e9fbe768aa83f9a6b73607/crates/rpc/rpc/src/eth/helpers/transaction.rs#L88-L105) | [L88–105](https://github.com/paradigmxyz/reth/blob/3d592ece6de8c4559987416a544fc215fd6d6921/crates/rpc/rpc/src/eth/helpers/transaction.rs#L88-L105) | 本文一致、行番号一致 |
| `batch-runner` | [L114–135](https://github.com/paradigmxyz/reth/blob/1a4dbbe11264fd52e6e9fbe768aa83f9a6b73607/crates/transaction-pool/src/batcher.rs#L114-L135) | [L114–135](https://github.com/paradigmxyz/reth/blob/3d592ece6de8c4559987416a544fc215fd6d6921/crates/transaction-pool/src/batcher.rs#L114-L135) | 本文一致、行番号一致 |
| `pool-test` | [L331–344](https://github.com/paradigmxyz/reth/blob/1a4dbbe11264fd52e6e9fbe768aa83f9a6b73607/crates/rpc/rpc/src/eth/helpers/transaction.rs#L331-L344) | [L349–362](https://github.com/paradigmxyz/reth/blob/3d592ece6de8c4559987416a544fc215fd6d6921/crates/rpc/rpc/src/eth/helpers/transaction.rs#L349-L362) | 本文一致、18行後方へ移動 |

## 検証方法と範囲

startup-guideの11地点と5つの継続処理の参照、計 **16件** について、実在するpath・1-basedの行範囲・固定commit URL・抜粋SHA-256を確認した。ハッシュはソースを改行でsplitし、指定行を改行でjoinした文字列のUTF-8 bytesに対するSHA-256で、抜粋末尾の改行を追加しない。全参照の `source.hash` に保存している。

全tree比較を同じ履歴を持つcheckoutで再現する場合は次を使える。完全一覧のmanifestは2つのcheckoutで個別に取得した同じ形式のtree出力をpathごとに比較して作成した。

```sh
git ls-tree -rz --full-tree 1a4dbbe11264fd52e6e9fbe768aa83f9a6b73607
git ls-tree -rz --full-tree 3d592ece6de8c4559987416a544fc215fd6d6921
git diff --no-renames --name-status 1a4dbbe11264fd52e6e9fbe768aa83f9a6b73607 3d592ece6de8c4559987416a544fc215fd6d6921
```

今回はReth本体を変更・ビルド・実行していない。上記は読解案内の参照整合性と、固定する2つのソース間の比較証拠である。
