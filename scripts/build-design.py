"""Distribute shared assets and replace the navigation idempotently."""
from pathlib import Path
import re,shutil
root=Path(__file__).resolve().parent.parent
for target in (root/'dist',root/'local-app/public'):
 for name in ('studio.css','studio.js'):shutil.copyfile(root/'ui'/name,target/name)
for folder,names in [('dist',['index.html','zoom.html','reader.html','lenses.html','implementation.html']),('local-app/public',['index.html','files.html','startup.html'])]:
 for name in names:
  p=root/folder/name
  if not p.exists():continue
  s=p.read_text();local=folder.startswith('local');prefix='/' if local else ''
  s=re.sub(r'<header class="studio-header"[\s\S]*?</header>','',s)
  s=re.sub(r'<nav class="studio-nav"[\s\S]*?</nav>','',s)
  base='/' if local else 'lenses.html'
  nav=[('startup','起動ガイド','/startup' if local else 'startup.html'),('structure','構造から読む',base+'#lens=structure'),('flow','送信経路を読む',base+'#lens=flow'),('rust','Rust・設計',base+'#lens=rust'),('files','ファイルから読む','/files' if local else 'index.html')]
  links=''.join(f'<a data-view="{view}" href="{href}">{label}</a>' for view,label,href in nav)
  if local:links+='<a data-view="guide" href="/guide">説明資料</a>'
  header='<header class="studio-header"><a class="studio-brand" href="'+('/startup' if local else 'startup.html')+'"><span class="studio-mark">⌘</span>Code Reading Studio</a><span class="studio-project">paradigmxyz / reth · v2.7.0</span><span class="studio-mode">'+('LOCAL WORKSPACE' if local else 'READING WORKSPACE')+'</span>'+('' if local else '<a class="studio-download" href="implementation.html">ローカル版</a>')+'</header><nav class="studio-nav" aria-label="読み方">'+links+'</nav>'
  s=re.sub(r'(<body[^>]*>)',r'\1'+header,s,count=1)
  if not re.search(r'href="/?studio.css"',s):s=s.replace('</head>',f'<link rel="stylesheet" href="{prefix}studio.css"></head>')
  if not re.search(r'src="/?studio.js"',s):s=s.replace('</head>',f'<script defer src="{prefix}studio.js"></script></head>')
  p.write_text('\n'.join(line.rstrip() for line in s.splitlines())+'\n')
