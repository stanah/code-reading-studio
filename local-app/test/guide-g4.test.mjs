import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import vm from 'node:vm';
import {inspectGuideG4,sharedGuideHelp} from '../../scripts/check-guide-g4.mjs';
const read=p=>readFile(new URL(p,import.meta.url),'utf8');
const scope=await sharedGuideHelp(),commit=scope.READING_HELP_DATA.commit;
vm.runInNewContext(await read('../public/guide-reading.js'),scope);
test('every guide original binds to two independent shared controls; the actual previous panel is rejected',async()=>{
  const html=await read('../../dist/startup.html'),report=inspectGuideG4(html,scope.ReadingHelp,commit);
  assert.equal(report.status,'pass',JSON.stringify(report.issues));assert.equal(report.panels,report.boundContexts);assert.equal(report.panels,report.sharedControlsConfirmed);
  const old=inspectGuideG4(await read('./fixtures/guide-before-independent-controls.html'),scope.ReadingHelp,commit);
  assert.equal(old.status,'fail');assert.equal(old.boundContexts,0);assert.ok(old.issues.some(x=>x.startsWith('unbound assistance:')));
});
test('guide adapter rejects mismatched version, raw text or hash before replacing the original',()=>{
  for(const [id,c]of Object.entries(scope.READING_HELP_DATA.contexts)){
    assert.ok(scope.GuideReading.evidence(id,commit,c.source.code,c.source.hash));
    assert.equal(scope.GuideReading.evidence(id,'0'.repeat(40),c.source.code,c.source.hash),undefined);
    assert.equal(scope.GuideReading.evidence(id,commit,c.source.code+'changed',c.source.hash),undefined);
    assert.equal(scope.GuideReading.evidence(id,commit,c.source.code,'bad-hash'),undefined);
  }
});
test('portable/static/local guide dependencies are identical, revisioned, and allowed by local CSP',async()=>{
  const html=await read('../../dist/startup.html'),server=await read('../server.mjs');
  for(const name of ['studio.css','reading-help-data.js','reading-help.js','guide-reading.js']){
    const content=await read('../../dist/'+name),hash=createHash('sha256').update(content).digest('hex').slice(0,12);
    assert.ok(html.includes(name+'?v='+hash),name+' served content revision');
    assert.equal(content,await read('../../docs/'+name),name+' portable docs dependency');
    assert.equal(content,await read('../public/'+name),name+' local guide dependency');
  }
  assert.match(server,/script-src 'self' 'sha256-/);assert.ok(server.includes("'/guide-reading.js':'guide-reading.js'"));
});
