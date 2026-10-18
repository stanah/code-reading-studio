#!/usr/bin/env python3
"""Build the standalone reading guide from its reviewed Markdown and CSS."""
from pathlib import Path
from html import escape
from html.parser import HTMLParser
import re, hashlib
root=Path(__file__).resolve().parents[1]
md=(root/'docs/reth-startup-guide.md').read_text()
css=(root/'docs/reading-guide.css').read_text()

def inline(s):
    pat=r'`([^`]+)`|\[([^\]]+)\]\(([^)]+)\)|\*\*([^*]+)\*\*'
    result=[]; pos=0
    for m in re.finditer(pat,s):
        result.append(escape(s[pos:m.start()]))
        if m[1] is not None: result.append('<code>'+escape(m[1])+'</code>')
        elif m[2] is not None: result.append('<a href="'+escape(m[3],quote=True)+'">'+inline(m[2])+'</a>')
        else: result.append('<strong>'+inline(m[4])+'</strong>')
        pos=m.end()
    return ''.join(result)+escape(s[pos:])

def blocks(text):
    lines=text.splitlines(); i=0; out=[]
    while i<len(lines):
        line=lines[i]
        if not line.strip(): i+=1; continue
        if line.startswith('```'):
            code=[]; i+=1
            while i<len(lines) and not lines[i].startswith('```'): code.append(lines[i]); i+=1
            out.append('<pre><code>'+escape('\n'.join(code))+'</code></pre>'); i+=1; continue
        if line.startswith('|'):
            rows=[]
            while i<len(lines) and lines[i].startswith('|'):
                cells=[c.strip() for c in lines[i].strip().strip('|').split('|')]
                if not all(re.fullmatch(r':?-+:?',c) for c in cells): rows.append(cells)
                i+=1
            out.append('<table><thead><tr>'+''.join('<th scope="col">'+inline(c)+'</th>' for c in rows[0])+'</tr></thead><tbody>'+''.join('<tr>'+''.join('<td>'+inline(c)+'</td>' for c in row)+'</tr>' for row in rows[1:])+'</tbody></table>'); continue
        if re.match(r'\d+\. ',line):
            rows=[]
            while i<len(lines) and re.match(r'\d+\. ',lines[i]):
                rows.append(re.sub(r'^\d+\. ','',lines[i])); i+=1
            out.append('<ol>'+''.join('<li>'+inline(x)+'</li>' for x in rows)+'</ol>'); continue
        if line.startswith('### '): out.append('<h3>'+inline(line[4:])+'</h3>'); i+=1; continue
        para=[line]; i+=1
        while i<len(lines) and lines[i].strip() and not lines[i].startswith(('#','|','```')): para.append(lines[i]); i+=1
        cls=' class="refs"' if line.startswith('読む場所:') else ''
        out.append('<p'+cls+'>'+inline(' '.join(para))+'</p>')
    return '\n'.join(out)

parts=md.split('\n## ')
head=parts[0].split('\n\n')
title=head[0][2:]
header='<header><h1>'+inline(title)+'</h1>\n<p class="lead">'+inline(head[1])+'</p>\n<p class="source-version">'+inline(head[2])+'</p>\n<p>'+inline(head[3])+'</p></header>'
section_ids=['overview','map','startup','runtime','terms','practice']
sections=[]; nav=[]
for i,part in enumerate(parts[1:]):
    heading,body=part.split('\n',1); foot=''
    if '\n---\n' in body: body,foot=body.split('\n---\n',1)
    nav.append('<a href="#'+section_ids[i]+'">'+escape(heading)+'</a>')
    rendered=blocks(body)
    if section_ids[i] in ('overview','startup','runtime'):
        chunks=re.split(r'(?=<h3>)',rendered)
        prefix=chunks.pop(0)
        if section_ids[i]=='overview':
            rendered=prefix+'<div class="phases">'+''.join('<div class="phase">'+x+'</div>' for x in chunks)+'</div>'
        elif section_ids[i]=='startup':
            rendered=prefix+'<div class="step-cards">'+''.join('<article class="step-card">'+x+'</article>' for x in chunks)+'</div>'
        else:
            rendered=prefix+'<div class="loop-map">'+''.join('<article class="loop">'+x+'</article>' for x in chunks)+'</div>'
    sections.append('<section id="'+section_ids[i]+'"><h2>'+inline(heading)+'</h2>\n'+rendered+'</section>')
    if foot: sections.append('<footer>'+blocks(foot)+'</footer>')
body=header+'\n'+''.join(sections)
sha=hashlib.sha256(md.encode()).hexdigest()
html='<!doctype html>\n<html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>'+escape(title)+'</title><meta name="description" content="Reth v2.7.0のCLI起動、ノード準備、稼働中の処理をソースと照らして読む短いガイド。"><meta name="guide-source-sha256" content="'+sha+'"><style>\n'+css+'\n</style></head><body><main><div class="toolbar"><a href="http://127.0.0.1:4317/startup">ローカルアプリを開く</a><button id="guide-print" class="print-button" type="button">印刷 / PDF</button></div><nav aria-label="目次">'+''.join(nav)+'</nav><article id="guide-content">'+body+'</article></main><script>document.getElementById(\'guide-print\').addEventListener(\'click\',()=>window.print());</script></body></html>\n'

class Extract(HTMLParser):
    def __init__(self): super().__init__(); self.depth=0; self.text=[]; self.links=[]
    def handle_starttag(self,tag,attrs):
        d=dict(attrs)
        if tag=='article' and d.get('id')=='guide-content': self.depth=1
        elif self.depth and tag=='article': self.depth+=1
        if self.depth and tag=='a': self.links.append(d['href'])
    def handle_endtag(self,tag):
        if self.depth and tag=='article': self.depth-=1
    def handle_data(self,data):
        if self.depth: self.text.append(data)
x=Extract();x.feed(html)
# Independent normalized Markdown text comparison; rendered list numbers are browser markers.
expected=re.sub(r'\[([^\]]+)\]\(([^)]+)\)',r'\1',md)
expected=re.sub(r'^```.*$|^---$|^\|(?:\s*:?-+:?\s*\|)+\s*$', '', expected, flags=re.M)
expected=re.sub(r'^#{1,3} |^\d+\. ', '', expected, flags=re.M)
expected=expected.replace('**','').replace('`','').replace('|','')
normalize=lambda s:re.sub(r'\s+','',s)
assert normalize(expected)==normalize(''.join(x.text)), 'HTML wording differs from Markdown'
mdlinks=re.findall(r'\[[^\]]+\]\(([^)]+)\)',md)
assert x.links==mdlinks, 'HTML source links differ from Markdown'
(root/'docs/reading-guide.html').write_text(html)
(root/'dist/startup.html').write_text(html)
print(f'HTML/Markdown normalized visible text and all {len(mdlinks)} links match.')
print('Source SHA256:',sha)
