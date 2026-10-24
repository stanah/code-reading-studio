"""Distribute shared assets and generate the same task-based navigation on every page."""
from pathlib import Path
import hashlib,json,re,shutil
root=Path(__file__).resolve().parent.parent
reading_target=json.loads((root/'reading-target.json').read_text())
css_revision=hashlib.sha256((root/'ui/studio.css').read_bytes()).hexdigest()[:12]
# The learning entry is shared; existing deep links continue to resolve via learning.js.
page=(root/'ui/learning-page.html').read_text()
(root/'dist/index.html').write_text(page)
(root/'local-app/public/index.html').write_text(page.replace('<body class="learning-page">','<body data-studio="local" class="learning-page">').replace('href="studio.css"','href="/studio.css"').replace('src="','src="/'))
for target in (root/'dist',root/'local-app/public'):
 for name in ('studio.css','studio.js','learning.js','learning-content.js','reading-help.js','area-reading.js'):shutil.copyfile(root/'ui'/name,target/name)
for folder,names in [('dist',['index.html','explore.html','zoom.html','reader.html','lenses.html','implementation.html','startup.html']),('local-app/public',['index.html','reader.html','files.html','startup.html'])]:
 for name in names:
  p=root/folder/name
  if not p.exists():continue
  s=p.read_text();local=folder.startswith('local');prefix='/' if local else ''
  s=re.sub(r'<header class="studio-header"[\s\S]*?</header>','',s)
  s=re.sub(r'<nav class="studio-nav"[\s\S]*?</nav>','',s)
  home='/' if local else 'index.html'
  explore='/reader' if local else 'explore.html'
  tools=(('<a href="/files">ファイル名から探す</a><a href="/guide">説明・印刷用の資料</a>') if local else '<a href="startup.html">起動の説明資料</a><a href="implementation.html">ローカル版の使い方</a>')
  header='<header class="studio-header"><a class="studio-brand" href="'+home+'"><span class="studio-mark" aria-hidden="true">⌘</span>Code Reading Studio</a><span class="studio-project">Reth · '+reading_target['version']+'</span><details class="studio-assistance"><summary>読むときの補助</summary><div class="studio-assistance-panel"><p>必要なところだけ、その場で変えられます。</p><label>ブロックチェーンの用語<select aria-label="ブロックチェーンの用語" data-learning-axis="chain"><option value="new">用語の意味も補いたい</option><option value="known">基本用語はわかる</option></select></label><label>コードを読む経験<select aria-label="コードを読む経験" data-learning-axis="code"><option value="first">コードを読むのは初めて</option><option value="other">ほかの言語は読める</option><option value="rust">Rustも読める</option></select></label><p>読む場所やメモは保ったまま、補助を選べます。</p></div></details></header><nav class="studio-nav" aria-label="主な入口"><a data-view="learn" href="'+home+'">学ぶ</a><a data-view="explore" href="'+explore+'">コードを調べる</a><a data-learning-return href="'+home+'">学習の入口へ戻る</a><details class="studio-tools"><summary>資料・道具</summary><div class="studio-tools-menu">'+tools+'<p>参照版：Reth '+reading_target['version']+'</p></div></details></nav>'
  s=re.sub(r'(<body[^>]*>)',r'\1'+header,s,count=1)
  s=re.sub(r'(<a id="snapshot-link" href=")[^"]+("[^>]*>)[^<]+',lambda m:m[1]+'https://github.com/'+reading_target['repository']+'/commit/'+reading_target['commit']+m[2]+reading_target['commit'][:12]+' ↗',s)
  s=re.sub(r'(<span id="zoom-reference">参照：)[0-9a-f]+',lambda m:m[1]+reading_target['commit'][:12],s)
  if not re.search(r'href="/?studio\.css(?:\?[^"]*)?"',s):s=s.replace('</head>',f'<link rel="stylesheet" href="{prefix}studio.css"></head>')
  s=re.sub(r'href="(/?)studio\.css(?:\?[^"]*)?"',lambda m:'href="'+m[1]+'studio.css?v='+css_revision+'"',s)
  # Defer in dependency order: content -> learner state -> shared navigation.
  for asset in ('learning-content.js','learning.js','reading-help-data.js','reading-help.js','reading-coverage-data.js','area-reading.js','studio.js'):
   s=re.sub(r'<script[^>]*src="/?'+re.escape(asset)+r'"[^>]*></script>','',s)
  s=s.replace('</head>',''.join(f'<script defer src="{prefix}{asset}"></script>' for asset in ('learning-content.js','learning.js','reading-help-data.js','reading-help.js','reading-coverage-data.js','area-reading.js','studio.js'))+'</head>')
  p.write_text('\n'.join(line.rstrip() for line in s.splitlines())+'\n')
