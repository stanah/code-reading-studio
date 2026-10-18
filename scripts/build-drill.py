import pathlib,json,subprocess
root=pathlib.Path(__file__).resolve().parents[1]; out=root/'dist';repo=root/'targets'/'reth'
atlas=json.loads((out/'atlas-data.js').read_text().removeprefix('window.RETH_ATLAS = ').removesuffix(';\n'))
models={}
for a in atlas['areas']:
 groups={}
 for f in atlas['files']:
  if f['area']!=a['id']:continue
  p=f['path']; key=p.split('/src/')[0]+'/src/' if '/src/' in p else '/'.join(p.split('/')[:-1])+'/'
  groups.setdefault(key,[]).append(p)
 models[a['id']]=[dict(id=str(i),name=k.rstrip('/').removesuffix('/src').split('/')[-1],prefix=k,files=v,role='ディレクトリ構成から抽出した部品です。責務の説明は未作成です。',input='未確認',output='未確認',kind='構造から抽出') for i,(k,v) in enumerate(sorted(groups.items()))]
rpc_specs=[('interface','公開 API とハンドラー',['crates/rpc/rpc-eth-api/src/core.rs','crates/rpc/rpc-api/'],'RPC のメソッド名・引数・戻り値を定義し、共通の処理へ委譲する入口。','RPC の要求・パラメーター','型付けされた処理の呼び出し'),('helpers','eth_ の共通処理',['crates/rpc/rpc-eth-api/src/helpers/'],'ブロック・状態・トランザクションなど、扱う対象ごとに共通のヘルパーを分ける。','ハンドラーから渡された引数','プロバイダーやプールへの操作・結果'),('implementation','RPC の具象実装',['crates/rpc/rpc/src/'],'EthApi などの具体的な実装を、プロバイダー・プールなどのノード部品につなぐ。','共通 API / ヘルパーの呼び出し','構成されたノード部品への要求'),('integration','サーバー・接続・型など',[],'サーバーの構成、通信、変換、共有型、Engine API など。さらに分解してから読む範囲を選ぶ。','接続・設定・型付きデータ','RPC を提供するための周辺機構')]
used=set(); rpc=[]
for id,name,prefixes,role,inp,outp in rpc_specs:
 fs=[f['path'] for f in atlas['files'] if f['area']=='rpc' and f['path'] not in used and (not prefixes or any(f['path'].startswith(x) for x in prefixes))];used.update(fs)
 rpc.append(dict(id=id,name=name,prefix=prefixes[0] if len(prefixes)==1 and prefixes[0].endswith('/') else '',files=fs,role=role,input=inp,output=outp,kind='コード構造・宣言から事前整理'))
models['rpc']=rpc
roles={
'crates/rpc/rpc-eth-api/src/helpers/transaction.rs':{'name':'トランザクションの送信・取得','role':'送信、取得、送信者の復元などの共通処理を提供する。今回は送信の責務だけに絞る。','input':'署名済みバイト列、トランザクションの識別子など','output':'送信時はハッシュ。取得系は対応するデータ。'},
'crates/rpc/rpc-eth-api/src/core.rs':{'name':'公開メソッドと RPC ハンドラー','role':'外部に公開するメソッドの契約と、その要求を共通処理へ渡す入口。','input':'JSON-RPC のパラメーター','output':'RpcResult に包んだ成功値またはエラー'},
'crates/transaction-pool/src/batcher.rs':{'name':'追加要求のバッチ処理','role':'要求を受信し、件数と origin に応じてプールへ渡して個別に返答する。','input':'追加要求と返信用チャネル','output':'要求ごとのプール追加結果'},
'crates/transaction-pool/src/lib.rs':{'name':'トランザクションプールの公開操作','role':'検証と内部プールの操作をつなぐ。追加、取得、購読などの入口。','input':'トランザクションと origin など','output':'追加結果・取得データ・イベントなど'},
'crates/rpc/rpc/src/eth/helpers/transaction.rs':{'name':'Ethereum 向け送信処理','role':'通常のプール追加と、設定に応じた外部転送・blob 変換を扱う。','input':'origin とエンコード付きトランザクション','output':'ハッシュまたはエラー'},
'crates/rpc/rpc/src/eth/core.rs':{'name':'RPC 内部の部品と要求チャネル','role':'API 内部のプール・設定・チャネルなどを保持し、追加要求をバッチ処理へつなぐ。','input':'未検証トランザクションと origin','output':'追加結果の非同期応答'}
}
seeds={}
for p in atlas['files']:
 path=p['path']
 if path.startswith('crates/rpc/rpc-eth-api/src/helpers/'):seeds[path]=subprocess.check_output(['git','-C',str(repo),'show',atlas['commit']+':'+path]).decode()
(out/'drill-data.js').write_text('window.RETH_DRILL = '+json.dumps(dict(components=models,roles=roles,seed=seeds),ensure_ascii=False,separators=(',',':'))+';\n')
print('Generated components for',len(models),'areas')
