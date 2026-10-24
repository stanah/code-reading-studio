import http from 'node:http';
import {readFile,writeFile,mkdir,rename} from 'node:fs/promises';
import {resolve,dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {randomBytes,createHash} from 'node:crypto';
import {indexRepository,readSource,readFileAtCommit,functions,evidence,generateExplanation,digest} from './core.mjs';
const root=dirname(fileURLToPath(import.meta.url));
export async function createStudio({repo,ref='HEAD',dataDir=join(root,'.reading-data'),ai={},port=4317}){
 const index=await indexRepository(resolve(repo),ref);await mkdir(dataDir,{recursive:true});
 const annotations=JSON.parse(await readFile(join(root,'annotations.json'),'utf8'));
 let guide;try{guide=JSON.parse(await readFile(join(root,'startup-guide.json'),'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;}
 const guideReady=guide?.commit===index.commit;
 const version=guideReady?guide.version:(annotations.commit===index.commit?annotations.version:undefined);
 if(index.commit===annotations.commit){for(const c of index.crates)c.area=annotations.pathAreas[c.files[0]]||c.area;index.areas=[...new Set(index.crates.map(c=>c.area))];index.areaDetails=annotations.areas;}
 const token=randomBytes(24).toString('hex'),cache=new Map();const stateFile=join(dataDir,index.id+'.json');
 const source=async path=>{if(cache.has(path))return cache.get(path);const s=await readSource(index,path);if(cache.size>=20)cache.delete(cache.keys().next().value);cache.set(path,s);return s};
 let state={version:1,commit:index.commit,items:[]};try{state=JSON.parse(await readFile(stateFile,'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;}
 let writes=Promise.resolve();
 const save=()=>{const data=JSON.stringify(state,null,2);writes=writes.then(async()=>{await writeFile(stateFile+'.tmp',data,{mode:0o600});await rename(stateFile+'.tmp',stateFile)});return writes;};
 const server=http.createServer(async(req,res)=>{
  const json=(value,status=200)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(value));};
  try{
   const local=`127.0.0.1:${server.address().port}`;
   if(req.headers.host!==local&&req.headers.host!==`localhost:${server.address().port}`)return json({error:'Host rejected'},403);
   if(req.headers.origin&&!['http://'+local,`http://localhost:${server.address().port}`].includes(req.headers.origin))return json({error:'Origin rejected'},403);
   const url=new URL(req.url,'http://'+local);
   if(url.pathname.startsWith('/api/')){
    if(req.headers['x-studio-token']!==token)return json({error:'Token required'},403);
    if(req.method==='GET'&&url.pathname==='/api/index')return json({...index,repo:undefined,paths:undefined,entries:undefined,version,startupReady:guideReady,aiReady:!!(ai.url&&ai.model),roles:{...(index.commit===annotations.commit?annotations.roles:{}),...(guideReady?guide.roles:{})},steps:index.commit===annotations.commit?annotations.steps:[],startupSteps:guideReady?guide.steps.map(({id,title,source})=>({id,title,source})):[]});
    if(req.method==='GET'&&url.pathname==='/api/tree')return json({commit:index.commit,version,entries:index.entries.map(({path,type,size})=>({path,type,size}))});
    if(req.method==='GET'&&url.pathname==='/api/file')return json(await readFileAtCommit(index,url.searchParams.get('path')));
    if(req.method==='GET'&&url.pathname==='/api/startup')return guideReady?json(guide):json({error:'このコミットの起動ガイドはありません。ファイルからコードを確認できます。',commit:index.commit},404);
    if(req.method==='GET'&&url.pathname==='/api/crate'){const c=index.crates.find(c=>c.id===url.searchParams.get('id'));if(!c)throw Error('クレートが見つかりません');const manifest=await source(c.id);const entry=c.files.find(p=>p===c.directory+'src/lib.rs')||c.files.find(p=>p===c.directory+'src/main.rs');const text=entry?await source(entry):'';return json({manifest,entry,docs:text.split('\n').filter(l=>l.startsWith('//!')).slice(0,35).map(l=>l.slice(3)).join('\n')});}
    if(req.method==='GET'&&url.pathname==='/api/source'){const path=url.searchParams.get('path'),s=await source(path);return json({path,commit:index.commit,source:s,functions:functions(s),docs:s.split('\n').filter(l=>l.startsWith('//!')).slice(0,30).map(l=>l.slice(3)).join('\n')});}
    if(req.method==='GET'&&url.pathname==='/api/state')return json(state);
    if(req.method==='POST'){
     let raw='';for await(const chunk of req){raw+=chunk;if(Buffer.byteLength(raw)>65536)throw Error('リクエストが大きすぎます');}const body=JSON.parse(raw);
     if(url.pathname==='/api/item'){
      const anchor=evidence(index,body.path,await source(body.path),body.start,body.end);
      const item={id:digest(anchor.id+Date.now()+randomBytes(4)),anchor,note:String(body.note||'').slice(0,10000),createdAt:new Date().toISOString()};state.items.push(item);await save();return json(item);
     }
     if(url.pathname==='/api/explain'){
      const anchor=evidence(index,body.path,await source(body.path),body.start,body.end);
      const explanation=await generateExplanation(anchor,String(body.question||'この範囲の処理を段階的に説明してください').slice(0,4000),ai);
      const item={id:randomBytes(12).toString('hex'),anchor,note:'',explanation};state.items.push(item);await save();return json(item);
     }
     if(url.pathname==='/api/delete'){state.items=state.items.filter(i=>i.id!==body.id);await save();return json({ok:true});}
    }
    return json({error:'Not found'},404);
   }
   if(req.method!=='GET')return json({error:'Method not allowed'},405);
   if(url.pathname==='/guide'||url.pathname==='/guide.css'){
    const file=url.pathname==='/guide'?'reading-guide.html':'reading-guide.css';
    const content=await readFile(join(root,'../docs',file),'utf8');
    const printScript="document.getElementById('guide-print').addEventListener('click',()=>window.print());";
    const printHash=createHash('sha256').update(printScript).digest('base64');
    res.writeHead(200,{'Content-Type':file.endsWith('.css')?'text/css':'text/html; charset=utf-8','X-Content-Type-Options':'nosniff','Content-Security-Policy':`default-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'sha256-${printHash}'; img-src 'self' data:; frame-ancestors 'none'; base-uri 'none'`});res.end(content);return;
   }
   const assets={'/':'index.html','/reader':'reader.html','/reading-help.js':'reading-help.js','/reading-help-data.js':'reading-help-data.js','/learning.js':'learning.js','/learning-content.js':'learning-content.js','/files':'files.html','/files.js':'files.js','/files.css':'files.css','/startup':'startup.html','/startup.js':'startup.js','/startup.css':'startup.css','/app.js':'app.js','/lenses.js':'lenses.js','/style.css':'style.css','/studio.css':'studio.css','/studio.js':'studio.js'};const file=assets[url.pathname];if(!file)return json({error:'Not found'},404);
   let content=await readFile(join(root,'public',file),'utf8');if(file.endsWith('.html'))content=content.replace('__TOKEN__',token);
   res.writeHead(200,{'Content-Type':file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':'text/html; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'self'; style-src 'self'; script-src 'self'; frame-ancestors 'none'; base-uri 'none'"});res.end(content);
  }catch(e){json({error:e.message},400);}
 });
 await new Promise(r=>server.listen(port,'127.0.0.1',r));return {server,index,token};
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
 const repo=process.argv[2];if(!repo){console.error('Usage: npm start -- /absolute/path/to/repo [commit]');process.exit(1);}
 const {server,index}=await createStudio({repo,ref:process.argv[3]||'HEAD',port:Number(process.env.PORT||4317),dataDir:process.env.READING_DATA_DIR||join(root,'.reading-data'),ai:{url:process.env.AI_BASE_URL,model:process.env.AI_MODEL,key:process.env.AI_API_KEY}});
 console.log(`Code Reading Studio: http://127.0.0.1:${server.address().port}\n${index.commit} / ${index.rust.length} Rust files`);
}
