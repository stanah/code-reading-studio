// A generation/binding gate, not a substitute for real UI or meaning review.
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {pathToFileURL} from 'node:url';
export function inspectGuideG4(html, help, commit) {
  const panels=[...html.matchAll(/<details\b[^>]*data-guide-context="([^"]+)"[\s\S]*?<\/details>/g)];
  const issues=[];
  if(!panels.length)issues.push('no original-source panels');
  let bound=0,controls=0;
  for(const [panel,id]of panels){
    if(!panel.includes(`data-guide-reading-context="${id}"`)||!panel.includes(`data-guide-commit="${commit}"`)){issues.push('unbound assistance: '+id);continue;}
    bound++;
    const rendered=help.render(id,commit,{openCode:true});
    if((rendered.match(/data-rh-basics/g)||[]).length!==1||(rendered.match(/data-rh-trace/g)||[]).length!==1||!rendered.includes('class="rh-code"'))issues.push('shared controls/original missing: '+id);
    else controls++;
  }
  for(const name of ['studio.css','reading-help-data.js','reading-help.js','guide-reading.js']) {
    if(!html.includes(name+'?v='))issues.push('required revisioned dependency absent: '+name);
  }
  return {status:issues.length?'fail':'pass',panels:panels.length,boundContexts:bound,sharedControlsConfirmed:controls,issues};
}
export async function sharedGuideHelp(root=new URL('../',import.meta.url)){
  const scope={URLSearchParams};scope.window=scope;
  for(const path of ['dist/reading-help-data.js','dist/reading-help.js'])vm.runInNewContext(await readFile(new URL(path,root),'utf8'),scope);
  return scope;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  const scope=await sharedGuideHelp(),html=await readFile(process.argv[2]||new URL('../dist/startup.html',import.meta.url),'utf8');
  const report=inspectGuideG4(html,scope.ReadingHelp,scope.READING_HELP_DATA.commit);
  process.stdout.write(JSON.stringify(report,null,2)+'\n');if(report.status!=='pass')process.exitCode=1;
}
