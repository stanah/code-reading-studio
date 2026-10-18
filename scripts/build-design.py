from pathlib import Path
import re,shutil
root=Path(__file__).resolve().parent.parent
for target in (root/'dist',root/'local-app/public'):
 for name in ('studio.css','studio.js'):shutil.copyfile(root/'ui'/name,target/name)
for folder,names in [('dist',['index.html','zoom.html','reader.html','lenses.html','implementation.html']),('local-app/public',['index.html'])]:
 for name in names:
  p=root/folder/name;s=p.read_text();local=folder.startswith('local')
  if 'class="studio-header"' in s:continue
  s=re.sub(r'<div style="padding:12px 24px;background:#17382f;[\s\S]*?</div>','',s)
  s=re.sub(r'<nav class="lens-global"[\s\S]*?</nav>','',s)
  s=s.replace('<header>','<header class="context-toolbar">')
  if local:s=s.replace('<a href="#">◈ Code Reading Studio</a>','')
  if name=='lenses.html':s=re.sub(r'<header class="context-toolbar">[\s\S]*?</header>','',s);s=s.replace(' style="max-width:1100px;margin:auto"','')
  if name=='implementation.html':s=re.sub(r'<style>[\s\S]*?</style>','',s);s=s.replace('<main>','<main class="studio-install">');s=s.replace('<a href="index.html">← Rethの操作モック</a>','')
  base='' if local else 'lenses.html'
  nav=[('structure','構造から読む',base+'#lens=structure'),('flow','動作から読む',base+'#lens=flow'),('rust','Rust・設計から読む',base+'#lens=rust')]
  links=''.join(f'<a data-view="{v}" href="{href}">{label}</a>' for v,label,href in nav)
  links+=f'<a href="{"#" if local else "index.html"}">全体マップ・ファイル</a>'
  header='<header class="studio-header"><a class="studio-brand" href="'+('#lens=flow' if local else 'lenses.html')+'"><span class="studio-mark">⌘</span>Code Reading Studio</a><span class="studio-project">paradigmxyz / reth</span><span class="studio-mode">'+('LOCAL WORKSPACE' if local else 'READING WORKSPACE')+'</span>'+('' if local else '<a class="studio-download" href="implementation.html">ローカル版</a>')+'</header><nav class="studio-nav" aria-label="読み方">'+links+'<span class="studio-profile">TypeScript経験あり · Rustは初めて</span></nav>'
  s=re.sub(r'(<body[^>]*>)',r'\1'+header,s,count=1)
  if local:s=s.replace('<body>','<body data-studio="local">')
  s=s.replace('</head>','<link rel="stylesheet" href="'+('/' if local else '')+'studio.css"><script defer src="'+('/' if local else '')+'studio.js"></script></head>')
  p.write_text(s)
