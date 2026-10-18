import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,rm,symlink} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {git,indexRepository,readFileAtCommit} from '../core.mjs';
import {createStudio} from '../server.mjs';

async function fixture(){
 const dir=await mkdtemp(join(tmpdir(),'studio-files-')),repo=join(dir,'repo');
 await mkdir(join(repo,'src'),{recursive:true});
 await writeFile(join(repo,'Cargo.toml'),'[package]\nname="files"\nversion="0.1.0"\n');
 await writeFile(join(repo,'src/main.rs'),'fn main() {}\n');
 await writeFile(join(repo,'README.md'),'# A committed document\n');
 await writeFile(join(repo,'binary.bin'),Buffer.from([0,255,1,2]));
 await writeFile(join(repo,'large.txt'),'a'.repeat(2*1024*1024+1));
 await symlink('/etc/passwd',join(repo,'external-link'));
 await git(repo,'init');await git(repo,'add','.');
 await git(repo,'-c','user.name=Test','-c','user.email=test@example.com','commit','-m','File fixtures');
 return {dir,repo};
}

test('file viewer reads the committed blob, rejects unknown paths, and never follows symlinks',async()=>{
 const {dir,repo}=await fixture();
 try{
  const index=await indexRepository(repo);
  assert.equal(index.entries.length,6);
  await writeFile(join(repo,'README.md'),'uncommitted private note');
  await writeFile(join(repo,'untracked.txt'),'untracked private note');
  assert.equal((await readFileAtCommit(index,'README.md')).source,'# A committed document\n');
  assert.equal((await readFileAtCommit(index,'external-link')).source,'/etc/passwd');
  await assert.rejects(readFileAtCommit(index,'../README.md'),/追跡対象外/);
  await assert.rejects(readFileAtCommit(index,'untracked.txt'),/追跡対象外/);
  const binary=await readFileAtCommit(index,'binary.bin');assert.equal(binary.binary,true);assert.equal(binary.source,'');
  const large=await readFileAtCommit(index,'large.txt');assert.equal(large.truncated,true);assert.equal(large.source,'');
 }finally{await rm(dir,{recursive:true,force:true});}
});

test('tree, file and startup routes require auth and keep commit-specific explanations isolated',async()=>{
 const {dir,repo}=await fixture();let app;
 try{
  app=await createStudio({repo,port:0,dataDir:join(dir,'data')});
  const base=`http://127.0.0.1:${app.server.address().port}`;
  const headers={'x-studio-token':app.token};
  for(const route of ['/api/tree','/api/file?path=README.md','/api/startup'])assert.equal((await fetch(base+route)).status,403);
  const tree=await (await fetch(base+'/api/tree',{headers})).json();
  assert.equal(tree.commit,app.index.commit);assert.ok(tree.entries.some(e=>e.path==='README.md'));assert.equal(tree.repo,undefined);
  const file=await (await fetch(base+'/api/file?path=README.md',{headers})).json();assert.equal(file.commit,tree.commit);assert.match(file.source,/committed document/);
  assert.equal((await fetch(base+'/api/file?path=..%2Fsecret',{headers})).status,400);
  assert.equal((await fetch(base+'/api/startup',{headers})).status,404);
  for(const route of ['/files','/startup']){
   const page=await fetch(base+route);assert.equal(page.status,200);
   const html=await page.text();assert.ok(html.includes(app.token));assert.ok(!html.includes('__TOKEN__'));
  }
 }finally{if(app)await new Promise(resolve=>app.server.close(resolve));await rm(dir,{recursive:true,force:true});}
});
