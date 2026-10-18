const fs=require('fs'),vm=require('vm');const ctx={window:{}};for(const f of ['reth-data.js','drill-data.js'])vm.runInNewContext(fs.readFileSync('dist/'+f,'utf8'),ctx);
const pack=ctx.window.RETH_PACK,components=ctx.window.RETH_DRILL.components;
const steps=pack.steps.map(({code,...s})=>{for(const [area,list] of Object.entries(components)){const c=list.find(c=>c.files.includes(s.path));if(c)return {...s,structureUrl:'zoom.html?'+new URLSearchParams({area,c:c.id,f:s.path})};}throw Error('No component for '+s.path)});
fs.writeFileSync('dist/lenses-pack.js','window.LENSES_PACK = '+JSON.stringify({commit:pack.commit,steps})+';');
fs.copyFileSync('local-app/public/lenses.js','dist/lenses.js');fs.copyFileSync('local-app/public/style.css','dist/lenses-style.css');
fs.copyFileSync('ui/lenses-page.js','dist/lenses-page.js');
