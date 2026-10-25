// Build source-backed hints from the same pinned Git objects as the reading guides.
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),cp=require('node:child_process'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..');const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const target=JSON.parse(read('reading-target.json')),authored=JSON.parse(read('ui/reading-help-content.json')),guide=JSON.parse(read('local-app/startup-guide.json')),ctx={window:{}};
vm.runInNewContext(read('dist/reth-data.js'),ctx);
const areaSources=JSON.parse(read('ui/area-source-excerpts.json'));const contexts={};
for(const [id,hints] of Object.entries(authored.contexts)){
 const [kind,key]=id.split(':');const item=kind==='tx'?ctx.window.RETH_PACK.steps.find(s=>s.id===key):kind==='area'?areaSources[key]:guide.steps.find(s=>s.id===key);
 if(!item)throw Error('Unknown hint context '+id);
 const source=kind==='tx'?item:item.source;
 const full=cp.execFileSync('git',['-C',path.join(root,'targets/reth'),'show',target.commit+':'+source.path],{encoding:'utf8'});
 const code=full.split('\n').slice(source.start-1,source.end).join('\n');
 const hash=crypto.createHash('sha256').update(code).digest('hex');if(hash!==(source.contentHash||source.hash))throw Error('Source hash differs: '+id);
 for(const hint of hints.lines){if(hint.line<source.start||hint.line>source.end||!full.split('\n')[hint.line-1].includes(hint.match))throw Error('Hint no longer matches source: '+id+' L'+hint.line);}
 for(const term of hints.terms)if(!authored.terms[term])throw Error('Unknown term '+term);
 for(const [line,tokens] of Object.entries(hints.tokenHints||{}))for(const [token,term] of Object.entries(tokens)){if(Number(line)<source.start||Number(line)>source.end||!full.split('\n')[Number(line)-1].includes(token)||!authored.terms[term])throw Error('Invalid token hint: '+id+' L'+line);}
 contexts[id]={...hints,title:item.title,source:{path:source.path,start:source.start,end:source.end,hash,code,url:source.sourceUrl||source.url}};
}
// Resolve every lesson's representative code to its actual owning Cargo package.
const lessonConfig=JSON.parse(read('ui/lesson-code-links.json')),courseContext={window:{}};
vm.runInNewContext(read('ui/learning-content.js'),courseContext);
const lessons=courseContext.window.READING_COURSE.lessons,tracked=new Set(cp.execFileSync('git',['-C',path.join(root,'targets/reth'),'ls-tree','-r','--name-only',target.commit],{encoding:'utf8'}).trim().split('\n'));
if(lessonConfig.length!==lessons.length||new Set(lessonConfig.map(r=>r.lesson)).size!==lessons.length||!lessons.every(l=>lessonConfig.some(r=>r.lesson===l.id)))throw Error('Every lesson needs exactly one representative code reference');
const annotations=JSON.parse(read('local-app/annotations.json'));if(annotations.commit!==target.commit)throw Error('Stale source area map');
const lessonLinks=lessonConfig.map(r=>{
 const c=contexts[r.context];if(!c||!r.title||!r.why||!r.scope)throw Error('Invalid lesson code reference '+r.lesson);
 let dir=path.posix.dirname(c.source.path);while(dir!=='.'&&!tracked.has(dir+'/Cargo.toml'))dir=path.posix.dirname(dir);
 const manifest=dir+'/Cargo.toml';if(!tracked.has(manifest))throw Error('Owning crate missing: '+c.source.path);
 const text=cp.execFileSync('git',['-C',path.join(root,'targets/reth'),'show',target.commit+':'+manifest],{encoding:'utf8'}),packageSection=text.split('[package]')[1]?.split(/\n\[/)[0],name=packageSection?.match(/^name\s*=\s*"([^"]+)"/m)?.[1];
 if(!name)throw Error('Cargo package name missing: '+manifest);
 return {...r,area:annotations.pathAreas[c.source.path],crate:{id:manifest,name,hash:crypto.createHash('sha256').update(text).digest('hex'),url:'https://github.com/'+target.repository+'/tree/'+target.commit+'/'+dir}};
});
const output='window.READING_HELP_DATA = '+JSON.stringify({commit:target.commit,version:target.version,terms:authored.terms,contexts,lessonLinks,areaReadings:JSON.parse(read('ui/area-readings.json'))})+';\n';
for(const dir of ['dist','local-app/public'])fs.writeFileSync(path.join(root,dir,'reading-help-data.js'),output);
console.log(`Built ${Object.keys(contexts).length} contexts with ${Object.values(contexts).reduce((n,c)=>n+c.lines.length,0)} source-checked line hints`);
