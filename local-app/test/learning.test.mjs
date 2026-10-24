import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
const read=p=>readFile(new URL(p,import.meta.url),'utf8');
const content=await read('../../ui/learning-content.js'),script=await read('../../ui/learning.js');
function app({local=true,href='http://localhost/',saved,blocked=false}={}){
 const root={innerHTML:''},handlers={},events=[],controls=new Map();
 const storage=new Map(saved?[['reading-studio-learning-v1',JSON.stringify(saved)]]:[]);
 const location=new URL(href);location.replace=url=>{location.redirected=url;};
 function control(id){if(!controls.has(id))controls.set(id,{dataset:{finish:id,markRead:id},addEventListener(name,fn){this[name]=fn;}});return controls.get(id);}
 const document={body:{dataset:local?{studio:'local'}:{}},title:'',dispatchEvent(e){events.push(e.type);},
  querySelector(s){if(s==='#learning-root')return root;if(s==='[data-finish]'){const id=root.innerHTML.match(/data-finish="([^"]+)"/)?.[1];return id?control(id):null;}if(s==='#learn-storage-note')return {set textContent(t){root.notice=t;}};return null;},
  querySelectorAll(s){return s==='[data-mark-read]'?[...root.innerHTML.matchAll(/data-mark-read="([^"]+)"/g)].map(m=>control(m[1])):[];}};
 const context={document,location,URLSearchParams,Event:class{constructor(type){this.type=type;}},localStorage:{getItem(k){if(blocked)throw Error('Storage disabled');return storage.get(k)||null;},setItem(k,v){if(blocked)throw Error('Storage disabled');storage.set(k,v);}},addEventListener(n,fn){handlers[n]=fn;},scrollTo(){}};context.window=context;
 vm.runInNewContext(content,context);vm.runInNewContext(script,context);
 function follow(id,{mark=false}={}){if(mark)controls.get(context.LearningStudio.readState().last).click();location.hash=new URLSearchParams({lesson:id}).toString();handlers.hashchange();}
 return {context,root,location,follow,controls,storage,events,api:context.LearningStudio};
}

test('new learners get one first action; changing experience changes the recommendation without marking lessons read',()=>{
 const a=app();
 assert.match(a.root.innerHTML,/href="\/#lesson=blockchain">ここから読み始める/);
 assert.doesNotMatch(a.root.innerHTML,/href="\/reader/);
 a.api.setProfile('familiar');assert.match(a.root.innerHTML,/href="\/#lesson=reth">ここから読み始める/);
 a.api.setProfile('code');assert.match(a.root.innerHTML,/href="\/#lesson=reading">ここから読み始める/);
 assert.equal(a.api.readState().read.length,0);
});

test('reading order, explicit marks, resume per experience, reload, and undo keep learner intent',()=>{
 const a=app();
 for(const [i,id] of ['blockchain','ethereum','rpc','reth','send','startup','reading'].entries()){
  a.follow(id,{mark:i>0});
  assert.match(a.root.innerHTML,/自分の言葉で確かめる/);
  assert.match(a.root.innerHTML,/考え方を見る/);
 }
 assert.equal(a.api.readState().read.length,6);
 assert.match(a.root.innerHTML,/href="\/reader#lens=flow&amp;step=rpc"|href="\/reader#lens=flow&step=rpc"/);
 const b=app({saved:JSON.parse(a.storage.values().next().value)});
 assert.match(b.root.innerHTML,/続きから読む/);assert.match(b.root.innerHTML,/#lesson=reading/);
 b.api.setProfile('familiar');assert.match(b.root.innerHTML,/#lesson=reth">ここから読み始める/);
 b.api.setProfile('foundation');assert.match(b.root.innerHTML,/#lesson=reading">続きから読む/);
 b.follow('blockchain');b.controls.get('blockchain').click({currentTarget:b.controls.get('blockchain')});
 assert.equal(b.api.readState().read.includes('blockchain'),false);
});

test('experience changes optional explanations, while blocked or malformed storage cannot block learning',()=>{
 const a=app({href:'http://localhost/#lesson=reth',blocked:true});
 assert.match(a.root.innerHTML,/<details class="learn-terms" open>/);
 a.api.setProfile('code');assert.match(a.root.innerHTML,/<details class="learn-terms">/);
 assert.match(a.root.innerHTML,/<details class="learn-sources" open>/);
 a.controls.get('reth').click();a.follow('send');assert.match(a.root.innerHTML,/要求を渡すこと/);
 const b=app({saved:{profile:'<script>',last:'missing',positions:{},read:['missing','reth']}});
 assert.equal(b.api.profile(),'foundation');assert.equal(b.api.readState().read.length,1);
 b.location.hash='#lesson=missing';b.api.render();assert.match(b.root.innerHTML,/読みどころが見つかりません/);
});

test('legacy entry links retain source context, and static and local learning resources stay identical',async()=>{
 const a=app({href:'http://localhost/#lens=rust&step=queue&topic=result'});
 assert.equal(a.location.redirected,'/reader#lens=rust&step=queue&topic=result');
 const b=app({local:false,href:'http://localhost/index.html?file=crates%2Frpc%2Fsrc%2Flib.rs&line=11'});
 assert.equal(b.location.redirected,'explore.html?file=crates%2Frpc%2Fsrc%2Flib.rs&line=11');
 const c=app({local:false,href:'http://localhost/index.html#lesson=reading'});
 assert.match(c.root.innerHTML,/href="lenses.html#lens=flow&step=rpc"/);
 for(const name of ['learning-content.js','learning.js']){
  assert.equal(await read('../../dist/'+name),await read('../../ui/'+name));
  assert.equal(await read('../public/'+name),await read('../../ui/'+name));
 }
});
