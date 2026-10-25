"""Build a Rust path index from the pinned Git tree; never execute target code."""
import pathlib, subprocess, json, sys
root=pathlib.Path(sys.argv[1]); out=pathlib.Path(__file__).resolve().parents[1]/'dist'
target=json.loads((out.parent/'reading-target.json').read_text())
sha=target['commit']
subprocess.check_call(['git','cat-file','-e',sha+'^{commit}'],cwd=root)
def source(path):return subprocess.check_output(['git','show',sha+':'+path],cwd=root).decode()
tree=subprocess.check_output(['git','ls-tree','-r','--name-only',sha],cwd=root,text=True).splitlines()
def area(id,name,en,description,prefixes,entry,question,neighbors,color):
 return dict(id=id,name=name,en=en,description=description,prefixes=prefixes,entry=entry,question=question,neighbors=neighbors,color=color)
areas=[
area('node','起動・組み立て','NODE & CLI','設定を読み、ノードを構成する部品を組み合わせる。ノード全体の構成をつかむ入口。',['bin/','crates/node/','crates/cli/','crates/ethereum/node/','crates/ethereum/cli/','crates/config/'],['bin/reth/src/main.rs','crates/node/builder/src/lib.rs','crates/ethereum/node/src/lib.rs'],'どの部品をどこで組み立てる？',['rpc','engine','network'],'#547fbc'),
area('rpc','外部 API','JSON-RPC','アプリからの問い合わせや送信、コンセンサス層からの Engine API を受け付ける。',['crates/rpc/'],['crates/rpc/rpc-eth-api/src/core.rs','crates/rpc/rpc-engine-api/src/lib.rs'],'API の入口と実処理の境界は？',['pool','engine','storage'],'#348b79'),
area('pool','トランザクションプール','TRANSACTION POOL','未確定トランザクションを検証し、保持・選択する。追加成功と取り込み確定を分けて読む。',['crates/transaction-pool/'],['crates/transaction-pool/src/lib.rs','crates/transaction-pool/src/batcher.rs'],'未確定トランザクションはどう扱われる？',['rpc','payload','network'],'#369788'),
area('network','P2P ネットワーク','NETWORK','ピアの発見、接続、プロトコル、データのやり取りを担う。',['crates/net/'],['crates/net/network/src/lib.rs','crates/net/p2p/src/lib.rs'],'データを誰からどう取得する？',['sync','pool','engine'],'#638db0'),
area('sync','履歴・状態の同期','SYNC & STAGES','ステージ型パイプラインや snap sync で、不足するチェーン履歴・状態を取得する。',['crates/stages/','crates/snap-sync/','crates/era/','crates/era-downloader/','crates/era-utils/','crates/etl/'],['crates/stages/stages/src/lib.rs','crates/snap-sync/src/lib.rs'],'新規ノードはどう現在の状態に追いつく？',['network','execution','storage'],'#a88752'),
area('engine','チェーンの進行・検証','ENGINE & CONSENSUS','コンセンサスイベントへの応答、チェーンの追跡、ブロック検証、同期の調整を扱う。',['crates/engine/','crates/consensus/','crates/ethereum/consensus/','crates/ethereum/engine-primitives/'],['crates/engine/tree/src/lib.rs','crates/consensus/consensus/src/lib.rs'],'新しいブロックで何を確認し、どの状態を更新する？',['rpc','execution','sync','storage'],'#9274a8'),
area('execution','EVM・ブロック実行','EXECUTION','EVM の設定とブロック実行をつなぐ。トランザクション実行が生む状態変化を追う。',['crates/evm/','crates/revm/','crates/ethereum/evm/'],['crates/evm/evm/src/lib.rs','crates/ethereum/evm/src/lib.rs'],'実行結果と状態の更新をどう表す？',['engine','payload','storage'],'#a4758f'),
area('payload','ブロック候補の構築','PAYLOAD BUILDER','ブロック候補を構築するジョブと、Ethereum 固有のペイロード構築を扱う。',['crates/payload/','crates/ethereum/payload/'],['crates/payload/builder/src/lib.rs','crates/ethereum/payload/src/lib.rs'],'プールのトランザクションから何を組み立てる？',['pool','execution','engine'],'#b28a4c'),
area('storage','永続化・状態・トライ','STORAGE & STATE','データベースへのアクセス、状態の取得、トライ、静的ファイル、pruning を扱う。',['crates/storage/','crates/trie/','crates/static-file/','crates/prune/','crates/chain-state/'],['crates/storage/provider/src/lib.rs','crates/trie/trie/src/lib.rs'],'状態はどこにあり、誰が読み書きする？',['execution','sync','rpc'],'#658e68'),
area('extension','拡張・利用例','EXTENSIONS & EXAMPLES','ExEx で状態変化を購読する拡張や、Reth の部品を使うサンプル。',['crates/exex/','examples/'],['crates/exex/exex/src/lib.rs'],'ノードの状態変化を外部の機能へどうつなぐ？',['node','engine','storage'],'#6b8fa4'),
area('foundation','共通部品・テストほか','FOUNDATIONS & OTHER','型・チェーン定義・タスク・テスト支援など。上記のディレクトリ分類に入らない Rust ファイルもここに含む。',[],['crates/chainspec/src/lib.rs','crates/tasks/src/lib.rs'],'他の領域を支える共通の前提は？',['node','execution'],'#91919a')]
paths=[p for p in tree if p.endswith('.rs')]
files=[]
for p in paths:
 a=next((a for a in areas if any(p.startswith(pre) for pre in a['prefixes'])),areas[-1])
 files.append(dict(path=p,area=a['id'],test=any(x in p for x in ['/tests/','/test_utils/','/test-utils/','/test.rs','/tests.rs'])))
for a in areas:
 a['count']=sum(f['area']==a['id'] for f in files)
 a['entry']=[p for p in a['entry'] if p in paths]
 a['manifests']=sum(p.endswith('Cargo.toml') and (next((x['id'] for x in areas if any(p.startswith(pre) for pre in x['prefixes'])),'foundation')==a['id']) for p in tree)
topics=[
 dict(id='transaction',title='送信したトランザクションはどこへ行く？',desc='JSON-RPC で受け付けてからプールに追加するまでを追う。その後の伝播・選択は別の問いとして扱う。',areas=['rpc','pool','network','payload'],entries=['crates/rpc/rpc-eth-api/src/core.rs','crates/transaction-pool/src/lib.rs'],ready=True,scope='今回解説済み：RPC 受付からプール追加まで。'),
 dict(id='block',title='新しいブロックはどう検証される？',desc='Engine API とチェーン進行、実行、永続化の責務を分けて読む。',areas=['rpc','engine','execution','storage'],entries=['crates/engine/tree/src/lib.rs','crates/consensus/consensus/src/lib.rs','crates/evm/evm/src/lib.rs'],ready=True,scope='Engine APIの受信、検証・実行、採用指示、保存を原文で区別して追います。'),
 dict(id='sync',title='まっさらなノードはどう追いつく？',desc='ピアからの取得と、同期の段階、実行、保存を追う。',areas=['network','sync','engine','execution','storage'],entries=['crates/stages/stages/src/lib.rs','crates/engine/tree/src/lib.rs'],ready=True,scope='履歴を取得する段階型同期の経路を、要求から保存・完了通知まで追います。ほかの同期モードとは区別します。'),
 dict(id='boot',title='起動時に何が組み立てられる？',desc='main からノードのビルダーへ処理をたどり、全体を構成する部品をつかむ。',areas=['node','rpc','network','engine'],entries=['bin/reth/src/main.rs','crates/node/builder/src/lib.rs'],ready=True,scope='CLI → ノードの準備 → 稼働中の処理を、起動資料で解説しています。')]
seed={}
for p in sorted({p for a in areas for p in a['entry']}):
 if p in tree:seed[p]=source(p)
# Include the actual files behind the existing source-backed reading pack.
pack=json.loads((out/'reth-data.js').read_text().removeprefix('window.RETH_PACK = ').removesuffix(';\n'))
for s in pack['steps']+pack['details']:
 seed[s['path']]=source(s['path'])
data=dict(commit=sha,version=target['version'],files=files,areas=areas,topics=topics,totalTracked=len(tree),totalRust=len(files),totalCargo=sum(p.endswith('Cargo.toml') for p in tree),seed=seed)
(out/'atlas-data.js').write_text('window.RETH_ATLAS = '+json.dumps(data,ensure_ascii=False,separators=(',',':'))+';\n')
print(json.dumps({k:data[k] for k in ['totalTracked','totalRust','totalCargo']}));print('seed files:',len(seed))
