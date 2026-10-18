// Keep the local reader's explanations identical to the static reading data.
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const root=path.resolve(__dirname,'..'),ctx={window:{}};
for(const file of ['reth-data.js','atlas-data.js','drill-data.js'])vm.runInNewContext(fs.readFileSync(path.join(root,'dist',file),'utf8'),ctx);
const {RETH_PACK:pack,RETH_ATLAS:atlas,RETH_DRILL:drill}=ctx.window;
if(pack.commit!==atlas.commit)throw Error('Reading data commits differ');
const annotations={commit:pack.commit,roles:drill.roles,pathAreas:Object.fromEntries(atlas.files.map(f=>[f.path,f.area])),areas:atlas.areas,steps:pack.steps.map(({code,...step})=>step),version:pack.version};
fs.writeFileSync(path.join(root,'local-app/annotations.json'),JSON.stringify(annotations,null,2)+'\n');
console.log(`Synced ${annotations.steps.length} steps, ${annotations.areas.length} areas, ${Object.keys(annotations.roles).length} module roles`);
