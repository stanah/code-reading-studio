import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {renderLoops,renderReadingScope,renderStep,resolveView,scopeReadings,startWhenReady} from '../public/startup.js';
const read=p=>readFile(new URL(p,import.meta.url),'utf8');
const ctx={URLSearchParams};ctx.window=ctx;
vm.runInNewContext(await read('../public/reading-help-data.js'),ctx);
vm.runInNewContext(await read('../public/lenses.js'),ctx);
const {steps,commit}=JSON.parse(await read('../annotations.json'));
const guide=JSON.parse(await read('../startup-guide.json'));
const setup={steps,commit,sourceUrl:s=>'#code='+s.id,structureUrl:s=>'#file='+s.id};
test('all Rust topics and 16 step variants bind their own claims to exact original source lines',()=>{
  const {lessons,rustEvidence,rustSupport}=ctx.ReadingLenses;
  let variants=0;
  for(const [topic,l]of Object.entries(lessons)){
    for(const stepId of [undefined,...l.steps]){
      const root={innerHTML:''};ctx.ReadingLenses.render(root,setup,{lens:'rust',topic,...(stepId?{step:stepId}:{})});
      const main=stepId?[stepId,...l.steps.filter(id=>id!==stepId)]:l.steps;
      const expected=[...main,...rustSupport[topic].map(s=>s.id)];
      const hosts=[...root.innerHTML.matchAll(/data-reading-help="tx:([^"]+)"/g)].map(m=>m[1]);
      assert.deepEqual(hosts,expected,topic+':'+stepId+' complete evidence, selected source first');
      assert.equal(new Set(hosts).size,hosts.length,'source is not duplicated');
      for(const id of hosts){
        const c=ctx.READING_HELP_DATA.contexts['tx:'+id];assert.ok(c,topic+':'+id+' source context');
        const source=(rustEvidence[topic][id]||rustSupport[topic].find(s=>s.id===id));
        assert.ok(source.purpose,topic+':'+id+' purpose');
        assert.ok(source.claims.length,topic+':'+id+' claims');
        for(const claim of source.claims){
          assert.ok(claim.line>=c.source.start&&claim.line<=c.source.end,'claim line belongs to source range');
          assert.ok(c.source.code.split('\n')[claim.line-c.source.start].includes(claim.match),topic+':'+id+' L'+claim.line+' evidence token '+claim.match);
          assert.equal(ctx.ReadingLenses.rustContextClaims(topic,'tx:'+id),source.claims,'renderer gets topic-specific line claims');
          assert.ok(root.innerHTML.includes('data-help-rust-topic="'+topic+'"'),'topic is retained on source host');
          assert.doesNotMatch(root.innerHTML,/rust-evidence-claim/,'claim explanation is shown beside original code only');
        }
      }
      if(stepId)variants++;
    }
  }
  assert.equal(variants,16);
});
test('startup waits through interactive state until deferred source data has arrived',async()=>{
  const previous=globalThis.READING_HELP_DATA;delete globalThis.READING_HELP_DATA;
  try{
    for(const state of ['loading','interactive']){
      let onReady,html,calls=0;
      const doc={readyState:state,addEventListener(name,fn,options){assert.equal(name,'DOMContentLoaded');assert.deepEqual(options,{once:true});onReady=fn;}};
      startWhenReady(doc,()=>{calls++;html=renderLoops(guide);});
      assert.equal(calls,0,'no startup render before later deferred scripts');
      globalThis.READING_HELP_DATA=ctx.READING_HELP_DATA;
      onReady();assert.equal(calls,1);assert.equal((html.match(/data-reading-help=/g)||[]).length,new Set(Object.values(guide.readingScopes.loops).flat().map(r=>r.context)).size);
      delete globalThis.READING_HELP_DATA;
    }
    let completed=0;startWhenReady({readyState:'complete'},()=>completed++);assert.equal(completed,1);
  }finally{globalThis.READING_HELP_DATA=previous;}
});
test('every startup step and runtime loop retains all of its purpose-bound original sources on the same page',()=>{
  const previous=globalThis.READING_HELP_DATA;globalThis.READING_HELP_DATA=ctx.READING_HELP_DATA;
  try{
    for(const step of guide.steps){
      const html=renderStep(guide,resolveView(guide,'?step='+step.id));
      const refs=scopeReadings(guide,'steps',step.id);
      assert.equal((html.match(/data-reading-help=/g)||[]).length,refs.length,step.id+' all authored evidence');
      assert.equal((html.match(/data-help-open="true"/g)||[]).length,1,step.id+' begins with one open original');
      for(const r of refs){assert.ok(ctx.READING_HELP_DATA.contexts[r.context],r.context+' source exists');assert.ok(html.includes('data-reading-help="'+r.context+'"'));assert.ok(r.purpose);}
    }
    const html=renderLoops(guide);const expected=new Set();
    for(const [index,loop]of guide.loops.entries()){
      const refs=scopeReadings(guide,'loops',index+1);refs.forEach(r=>expected.add(r.context));
      assert.ok(refs.some(r=>{const c=ctx.READING_HELP_DATA.contexts[r.context]?.source;return c&&c.path===loop.source.path&&c.start<=loop.source.start&&loop.source.end<=c.end;}),loop.name+' has its actual loop source');
      for(const r of refs)assert.ok(html.includes('data-reading-help="'+r.context+'"'),r.context+' loop support source');
    }
    assert.equal((html.match(/data-reading-help=/g)||[]).length,expected.size);
    assert.equal((html.match(/data-startup-context-ref=/g)||[]).length,Object.values(guide.readingScopes.loops).flat().length-expected.size);
    const originals=[...html.matchAll(/id="([^"]+)" data-startup-context="([^"]+)"/g)];
    const ownerIds=new Set(originals.map(m=>m[1]));
    for(const m of html.matchAll(/data-startup-read="([^"]+)"/g))assert.ok(ownerIds.has(m[1]),m[1]+' resolves to one original owner');
    assert.equal((html.match(/data-help-open="true"/g)||[]).length,guide.loops.length,'each loop starts with its first unique original open');
  }finally{globalThis.READING_HELP_DATA=previous;}
});
test('local and static Rust renderers are identical',async()=>{
  assert.equal(await read('../public/lenses.js'),await read('../../dist/lenses.js'));
});

test('static startup uses the same scope metadata and pinned original source, sharing overlaps without duplicate code',async()=>{
  const html=await read('../../dist/startup.html');
  assert.equal(html,await read('../../docs/reading-guide.html'));
  assert.equal((html.match(/data-startup-section=/g)||[]).length,7);
  assert.equal((html.match(/data-runtime-loop=/g)||[]).length,5);
  const unescape=s=>s.replace(/&(?:amp|lt|gt|quot|#x27);/g,e=>({'&amp;':'&','&lt;':'<','&gt;':'>','&quot;':'"','&#x27;':"'"}[e]));
  const panels=new Map([...html.matchAll(/<details\b[^>]*data-guide-context="([^"]+)"[\s\S]*?<\/details>/g)].map(m=>[m[1],m[0]]));
  const aliases=new Map([...html.matchAll(/data-guide-context-ref="([^"]+)" data-guide-ref-source="([^"]+)"/g)].map(m=>[m[1],m[2]]));
  assert.equal([...panels.values()].filter(p=>/^<details[^>]* open>/.test(p)).length,1,'start with one open original');
  const scopes=[...guide.readingScopes.staticStartup.flatMap(s=>s.readings),...Object.values(guide.readingScopes.loops).flat()];
  for(const r of scopes){
    const id=panels.has(r.context)?r.context:aliases.get(r.context),c=ctx.READING_HELP_DATA.contexts[r.context],shown=ctx.READING_HELP_DATA.contexts[id];
    assert.ok(panels.has(id),r.context+' source or same-page reference');
    assert.equal(c.source.path,shown.source.path);assert.ok(shown.source.start<=c.source.start&&c.source.end<=shown.source.end,r.context+' original range is retained');
  }
  for(const [id,panel]of panels){
    const c=ctx.READING_HELP_DATA.contexts[id];
    const rows=[...panel.matchAll(/class="guide-code-line"[^>]*data-source-line="(\d+)"><span class="guide-line-number" aria-hidden="true">\d+<\/span><code>([\s\S]*?)<\/code><\/span>/g)];
    assert.equal(rows.length,c.source.end-c.source.start+1,id+' complete range');
    assert.equal(rows.map(([,n,t])=>unescape(t)).join('\n'),c.source.code,id+' original text');
    assert.ok(panel.includes('data-source-hash="'+c.source.hash+'"'));
    for(const h of c.lines)assert.ok(panel.includes('data-comment-for="'+h.line+'"'),id+' adjacent comment');
  }
  const covered=new Set([...html.matchAll(/data-local-steps="([^"]+)"/g)].flatMap(m=>m[1].split(',')));
  for(const step of guide.steps)assert.ok(covered.has(step.id),step.id+' static counterpart');
});

test('standalone startup inline script remains compatible with the local guide CSP hash',async()=>{
  const html=await read('../../dist/startup.html'),server=await read('../server.mjs');
  const scripts=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m=>m[1]);
  const allowed=server.match(/const printScript="([^"]+)";/)?.[1];
  assert.equal(scripts.length,1);assert.equal(scripts[0],allowed,'served guide introduces no blocked inline script');
});

test('the startup claim ledger covers every authored field and binds it to real original lines',async()=>{
  const ledger=JSON.parse(await read('../../docs/startup-claim-source-ledger.json'));
  const keyed=new Map(ledger.claims.map(c=>[c.unit+':'+c.field,c]));
  const check=(unit,field,text)=>{const c=keyed.get(unit+':'+field);assert.ok(c,unit+':'+field+' missing from ledger');assert.equal(c.text,text);assert.ok(c.evidence.length);};
  for(const s of guide.steps){const unit='startup-step:'+s.id;for(const k of ['title','question','summary','input','output','boundary'])check(unit,k,s[k]);s.actions.forEach((v,i)=>check(unit,'actions.'+i,v));for(const [k,v]of Object.entries(s.check))check(unit,'check.'+k,v);for(const [k,v]of Object.entries(s.rust))check(unit,'rust.'+k,v);}
  for(const c of ledger.claims)for(const f of c.evidence){const actual=ctx.READING_HELP_DATA.contexts[f.context]?.source;assert.ok(actual,f.context+' canonical source');assert.ok(f.lines[0]>=actual.start&&f.lines[1]<=actual.end,c.unit+':'+c.field+' line scope');const lines=actual.code.split('\n');assert.equal(f.firstLine,lines[f.lines[0]-actual.start]);assert.equal(f.lastLine,lines[f.lines[1]-actual.start]);}
});

test('returning from a support source resolves its actual startup scope and selected file range',()=>{
  const previous=globalThis.READING_HELP_DATA;globalThis.READING_HELP_DATA=ctx.READING_HELP_DATA;
  try{
    for(const refs of Object.values(guide.readingScopes.steps))for(const ref of refs){
      const c=ctx.READING_HELP_DATA.contexts[ref.context];assert.ok(c,ref.context);
      const view=resolveView(guide,new URLSearchParams({path:c.source.path,line:c.source.start}).toString());
      assert.equal(view.kind,'step',ref.context+' can return to startup');assert.equal(view.origin.exact,true);
      const html=renderStep(guide,view);
      assert.ok(html.includes('data-reading-help="'+view.origin.context+'"'),'actual support source remains on the destination page');
      assert.ok(html.includes(sourceUrlForTest(view.origin.source)),ref.context+' file tool targets the selected support range');
    }
  }finally{globalThis.READING_HELP_DATA=previous;}
});
function sourceUrlForTest(source){return ('/files?'+new URLSearchParams({path:source.path,line:source.start,end:source.end})).replace(/&/g,'&amp;');}


test('a runtime scope beginning with an existing reference still opens its first unique original',()=>{
  const refs=guide.readingScopes.loops[2];
  const shared=refs[0],unique=refs.find(r=>r.context!==shared.context);
  const html=renderReadingScope(guide,[shared,unique],'test-scope',new Map([[shared.context,'existing-source-owner']]));
  assert.ok(html.includes('data-startup-context-ref="'+shared.context+'"'));
  assert.ok(html.includes('data-startup-read="existing-source-owner"'));
  assert.ok(html.includes('data-reading-help="'+unique.context+'" data-help-commit="'+guide.commit+'" data-help-open="true"'));
  assert.equal((html.match(/data-reading-help=/g)||[]).length,1);
});

test('network budget source reaches every startup claim producer and each unique original is a shared focus target',()=>{
  const budget='area:network-budget';
  const source=ctx.READING_HELP_DATA.contexts[budget]?.source;
  assert.ok(source,'macro original must be published, a placeholder host is insufficient');
  assert.equal(source.path,'crates/net/network/src/budget.rs');
  assert.equal(source.start,38);assert.equal(source.end,62);
  assert.match(source.code,/budget -= 1/);assert.match(source.code,/break true/);assert.match(source.code,/Poll::Pending => break false/);
  for(const [name,refs]of [['network step',guide.readingScopes.steps.network],['network loop',guide.readingScopes.loops['4']],['static network explanation',guide.readingScopes.staticRuntime[2].readings]]){
    assert.equal(refs.filter(r=>r.context===budget).length,1,name+' includes the macro exactly once');
    assert.ok(refs.find(r=>r.context===budget).purpose.includes('true'));
  }
  const step=renderStep(guide,resolveView(guide,'?step=network'));
  assert.ok(step.includes('data-startup-context="'+budget+'" data-reading-stage="'+budget+'"'));
  assert.ok(step.includes('data-startup-sequence="step-network" data-reading-navigation-scope="true"'),'whole step sequence is shared call-navigation scope');
  assert.doesNotMatch(step,/data-reading-back/,'the shared source renderer owns actual-call return; outer startup does not duplicate it');
  assert.ok(step.includes('data-startup-back hidden>直前の参照元へ戻る'),'startup reference return remains separate');
  const loops=renderLoops(guide);
  const sources=[...loops.matchAll(/data-startup-context="([^"]+)" data-reading-stage="([^"]+)"/g)];
  assert.equal(sources.length,new Set(sources.map(m=>m[1])).size,'one focusable owner per original');
  assert.ok(sources.some(m=>m[1]===budget&&m[2]===budget));
  assert.ok(loops.includes('id="startup-loops" data-reading-navigation-scope="true"'),'all five loops share existing original owners for calls');
  assert.doesNotMatch(loops,/data-startup-context-ref="[^"]+" data-reading-stage=/,'reference wrappers do not shadow the actual original target');
});
