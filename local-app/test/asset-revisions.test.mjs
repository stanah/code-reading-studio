import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
const root=fileURLToPath(new URL('../../',import.meta.url));

test('generated pages cannot reuse stale local scripts or styles after their content changes',async()=>{
 let count=0;
 for(const folder of ['dist','local-app/public'])for(const name of await readdir(resolve(root,folder))){
  if(!name.endsWith('.html'))continue;
  const html=await readFile(resolve(root,folder,name),'utf8');
  for(const match of html.matchAll(/\b(?:src|href)="([^"?#]+\.(?:js|css)(?:\?[^"#]*)?)"/g)){
   const ref=match[1];if(/^(?:https?:)?\/\//.test(ref))continue;
   const url=new URL(ref,'http://test.invalid/');
   let bytes;try{bytes=await readFile(resolve(root,folder,url.pathname.slice(1)));}catch(e){if(e.code==='ENOENT')continue;throw e;}
   const expected=createHash('sha256').update(bytes).digest('hex').slice(0,12);
   assert.equal(url.searchParams.get('v'),expected,folder+'/'+name+' must request the current '+url.pathname);
   count++;
  }
 }
 assert.ok(count>80,'all generated app surfaces were inspected');
});
