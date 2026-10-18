import {test} from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';import {readFile} from 'node:fs/promises';
test('lenses retain selected operation; flow expands before source; TS explanations distinguish Rust semantics',async()=>{
 const c={URLSearchParams};vm.runInNewContext(await readFile(new URL('../public/lenses.js',import.meta.url),'utf8'),c);const {render,lessons}=c.ReadingLenses;
 const {steps,commit}=JSON.parse(await readFile(new URL('../annotations.json',import.meta.url),'utf8'));const root={innerHTML:''},data={steps,commit,sourceUrl:s=>'#code='+s.id,structureUrl:s=>'#file='+s.id};
 render(root,data,{lens:'flow'});assert.match(root.innerHTML,/group=receive/);assert.doesNotMatch(root.innerHTML,/#code=/);
 render(root,data,{lens:'flow',group:'dispatch'});assert.match(root.innerHTML,/step=queue/);assert.doesNotMatch(root.innerHTML,/#code=/);
 for(const lens of ['structure','flow','rust']){render(root,data,{lens,step:'queue'});assert.match(root.innerHTML,/lens=rust&amp;step=queue/);assert.match(root.innerHTML,/追加要求をチャネルへ送る/);}
 render(root,data,{lens:'rust',step:'queue',topic:'result'});assert.match(root.innerHTML,/オプショナルチェーン/);assert.match(root.innerHTML,/#code=queue/);assert.match(root.innerHTML,/TypeScript/);
 assert.match(lessons.future.difference,/ポーリング/);assert.match(lessons.borrow.difference,/借用チェック/);
 render(root,{...data,steps:[]},{lens:'flow'});assert.match(root.innerHTML,/まだありません/);
 render(root,{...data,steps:[{...steps[0],title:'<script>bad</script>'}]},{lens:'flow',step:steps[0].id});assert.doesNotMatch(root.innerHTML,/<script>/);assert.match(root.innerHTML,/&lt;script&gt;/);
});
