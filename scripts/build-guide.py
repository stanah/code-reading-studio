#!/usr/bin/env python3
"""Build the standalone reading guide from its reviewed Markdown and CSS."""
from pathlib import Path
from html import escape
from html.parser import HTMLParser
import re, hashlib, json, subprocess
root=Path(__file__).resolve().parents[1]
md=(root/'docs/reth-startup-guide.md').read_text()
css=(root/'docs/reading-guide.css').read_text()

guide=json.loads((root/'local-app/startup-guide.json').read_text())
raw=(root/'dist/reading-help-data.js').read_text()
help_data=json.loads(raw.removeprefix('window.READING_HELP_DATA = ').strip().removesuffix(';'))
if guide['commit'] != help_data['commit']: raise ValueError('Startup guide and hints use different commits')

# These are the same reviewed scope definitions used by /startup.
startup_sections=guide['readingScopes']['staticStartup']
rendered_sources=[]

def source_id(context_id):
    return 'guide-source-'+re.sub(r'[^a-zA-Z0-9-]', '-', context_id)

def evidence_panel(context_id, title):
    context=help_data['contexts'][context_id]
    source=context['source']
    for previous_id, previous in rendered_sources:
        if previous['path']==source['path'] and previous['start']<=source['start'] and source['end']<=previous['end']:
            target=source_id(previous_id)+'-L'+str(source['start'])
            return '<p class="guide-existing-source" data-guide-context-ref="'+context_id+'" data-guide-ref-source="'+previous_id+'"><a href="#'+target+'">同じページの原文を開く：'+escape(title)+' L'+str(source['start'])+'–'+str(source['end'])+'</a></p>'
    text=subprocess.check_output(['git','-C',str(root/'targets/reth'),'show',guide['commit']+':'+source['path']],text=True)
    lines=text.split('\n')[source['start']-1:source['end']]
    digest=hashlib.sha256('\n'.join(lines).encode()).hexdigest()
    if digest != source['hash']: raise ValueError('Source hash mismatch: '+context_id)
    rows=[]
    for offset,line in enumerate(lines):
        number=source['start']+offset
        for hint in context['lines']:
            if hint['line'] != number: continue
            if hint['match'] not in line: raise ValueError('Hint no longer matches its line: '+context_id)
            rows.append('<span class="guide-code-comment" data-comment-for="'+str(number)+'"><b>補助 L'+str(number)+'</b> // '+escape(hint['explanation'])+'</span>')
        rows.append('<span class="guide-code-line" id="'+source_id(context_id)+'-L'+str(number)+'" data-source-line="'+str(number)+'"><span class="guide-line-number" aria-hidden="true">'+str(number)+'</span><code>'+escape(line)+'</code></span>')
    open_code=not rendered_sources
    rendered_sources.append((context_id,source))
    url=source.get('url') or source.get('sourceUrl') or 'https://github.com/paradigmxyz/reth/blob/'+guide['commit']+'/'+source['path']+'#L'+str(source['start'])+'-L'+str(source['end'])
    return '<details class="annotated-loop-code" id="'+source_id(context_id)+'" data-guide-context="'+context_id+'" data-guide-reading-context="'+context_id+'" data-guide-commit="'+guide['commit']+'"'+(' open' if open_code else '')+'><summary>原文と補助コメント：'+escape(title)+'</summary><p>'+escape(source['path'])+' L'+str(source['start'])+'–'+str(source['end'])+'</p><pre class="guide-annotated-code" data-source-hash="'+digest+'">'+''.join(rows)+'</pre><p>「補助」は解説者によるコメントです。原文のコードと行番号は固定コミットに対応します。</p><a href="'+escape(url,quote=True)+'">固定コミットの原文へ</a></details>'

def render_readings(readings):
    parts=[]
    for reading in readings:
        context_id=reading['context']
        title=help_data['contexts'][context_id]['title']
        panel=evidence_panel(context_id,title)
        if 'data-guide-context-ref=' not in panel:
            parts.append('<p class="guide-code-purpose">'+escape(reading['purpose'])+'</p>')
        parts.append(panel)
        if reading.get('connection'): parts.append('<p>'+escape(reading['connection'])+'</p>')
    return ''.join(parts)

def annotated_startup(index):
    section=startup_sections[index]
    names={s['id']:s['title'] for s in guide['steps']}
    return '<section data-generated-evidence="true" class="startup-source-evidence" data-startup-section="'+str(index+1)+'" data-local-steps="'+','.join(section['localSteps'])+'"><p>アプリの読みどころ：'+escape('、'.join(names[k] for k in section['localSteps']))+'</p>'+render_readings(section['readings'])+'</section>'

def annotated_runtime():
    local_ids=['supervisor','orchestrator','tree','network','backfill']
    panels=[]
    for index,loop in enumerate(guide['loops']):
        readings=guide['readingScopes']['loops'][str(index+1)]
        panels.append('<section class="runtime-loop-evidence" data-runtime-loop="'+str(index+1)+'" data-local-steps="'+local_ids[index]+'"><h3>'+escape(loop['name'])+'</h3>'+render_readings(readings)+'</section>')
    return '<section data-generated-evidence="true" class="runtime-source-evidence"><h3>待つ対象と処理を、コードで確かめる</h3><p>'+escape(guide['readingScopes']['sequenceMeaning'])+'</p>'+''.join(panels)+'</section>'


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
            rendered=prefix+'<div class="step-cards">'+''.join('<article class="step-card">'+x+annotated_startup(j)+'</article>' for j,x in enumerate(chunks))+'</div>'
        else:
            rendered=prefix+'<div class="loop-map">'+''.join('<article class="loop">'+x+'</article>' for x in chunks)+'</div>'+annotated_runtime()
    sections.append('<section id="'+section_ids[i]+'"><h2>'+inline(heading)+'</h2>\n'+rendered+'</section>')
    if foot: sections.append('<footer>'+blocks(foot)+'</footer>')
body=header+'\n'+''.join(sections)
sha=hashlib.sha256(md.encode()).hexdigest()
css+='\n.runtime-source-evidence{margin-top:32px}.annotated-loop-code{margin:18px 0;border:1px solid #c9d9cf;border-radius:6px;padding:14px}.annotated-loop-code>summary{cursor:pointer;font-weight:600}.guide-annotated-code{background:#17271f;color:#edf4ee;padding:16px 0;overflow:auto;font:12px/1.8 ui-monospace,SFMono-Regular,Consolas,monospace}.guide-code-line{display:block;white-space:pre;min-width:max-content;padding-right:16px}.guide-line-number{display:inline-block;width:4em;padding-right:14px;text-align:right;color:#9bb8a6;user-select:none}.guide-code-comment{display:block;white-space:normal;background:#294536;color:#d3eddb;border-left:3px solid #82b197;padding:8px 14px;margin:8px 14px 5px 4em;font:13px/1.8 -apple-system,BlinkMacSystemFont,sans-serif}.guide-code-comment b{font-size:10px;color:#a3c7b1}@media print{.annotated-loop-code:not([open])>*:not(summary){display:block!important}.guide-annotated-code{overflow:visible;white-space:pre-wrap}.guide-code-line{white-space:pre-wrap;min-width:0}}\n'
# Same reviewed renderer/data on local, static and the portable docs copy.
assets={
    'studio.css':root/'dist/studio.css',
    'reading-help-data.js':root/'dist/reading-help-data.js',
    'reading-help.js':root/'dist/reading-help.js',
    'guide-reading.js':root/'local-app/public/guide-reading.js',
}
for name,path in assets.items():
    content=path.read_bytes()
    if path != root/'dist'/name: (root/'dist'/name).write_bytes(content)
    (root/'docs'/name).write_bytes(content)
def asset_url(name):
    return name+'?v='+hashlib.sha256(assets[name].read_bytes()).hexdigest()[:12]
css+='\n.guide-code-comment[hidden]{display:none!important}.annotated-loop-code .rh-code{max-height:560px}.annotated-loop-code>.rh-panel{margin:0}.annotated-loop-code .guide-line-number{border:0;background:transparent}.guide-code-line.is-reading{background:#385a49!important;outline:1px solid #a8c7b3}.guide-code-line:target{outline:2px solid #a8c7b3}@media print{.rh-context,.rh-code-controls,.rh-code-navigation,.rh-symbol-answer,.rh-selection-answer{display:none!important}.rh-source:not([open])>.rh-source-body{display:block!important}.annotated-loop-code .rh-code{max-height:none;overflow:visible}.rh-code-line code{white-space:pre-wrap}.rh-token,.rh-source-number{border:0!important;background:transparent!important;color:inherit!important;padding:0!important}.guide-code-comment[hidden]{display:none!important}}\n'
guide_scripts=''.join('<script defer src="'+asset_url(name)+'"></script>' for name in ['reading-help-data.js','reading-help.js','guide-reading.js'])
html='<!doctype html>\n<html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>'+escape(title)+'</title><meta name="description" content="Reth v2.7.0のCLI起動、ノード準備、稼働中の処理をソースと照らして読む短いガイド。"><meta name="guide-source-sha256" content="'+sha+'"><link rel="stylesheet" href="'+asset_url('studio.css')+'"><style>\n'+css+'\n</style></head><body><main><div class="toolbar"><a href="http://127.0.0.1:4317/startup">ローカルアプリを開く</a><button id="guide-print" class="print-button" type="button">印刷 / PDF</button></div><nav aria-label="目次">'+''.join(nav)+'</nav><article id="guide-content">'+body+'</article></main><script>document.getElementById(\'guide-print\').addEventListener(\'click\',()=>window.print());</script>'+guide_scripts+'</body></html>\n'

class Extract(HTMLParser):
    def __init__(self): super().__init__(); self.depth=0; self.text=[]; self.links=[]; self.skip=0
    def handle_starttag(self,tag,attrs):
        d=dict(attrs)
        if self.skip: self.skip+=1; return
        if d.get('data-generated-evidence')=='true': self.skip=1; return
        if tag=='article' and d.get('id')=='guide-content': self.depth=1
        elif self.depth and tag=='article': self.depth+=1
        if self.depth and tag=='a': self.links.append(d['href'])
    def handle_endtag(self,tag):
        if self.skip: self.skip-=1; return
        if self.depth and tag=='article': self.depth-=1
    def handle_data(self,data):
        if self.depth and not self.skip: self.text.append(data)
x=Extract();x.feed(html)
# Compare authored Markdown prose independently; generated evidence is verified against Git above.
# Its comments/code are deliberately excluded from the prose-only comparison.
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
