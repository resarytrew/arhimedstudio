import { readFile, writeFile, readdir, mkdir, copyFile } from 'node:fs/promises';
import { join } from 'node:path';
const lock=JSON.parse(await readFile('package-lock.json','utf8'));
const records=[];
for(const [path,entry] of Object.entries(lock.packages)){
 if(!path)continue;
 const name=path.split('node_modules/').at(-1);
 const files=await readdir(path).catch(e=>{if(e.code==="ENOENT" && entry.optional)return [];throw e;});
 const licenses=files.filter(f=>/^(license|licence|copying|notice)(\.|$)/i.test(f));
 const target=join('public/licenses',name.replaceAll('/','_'));
 await mkdir(target,{recursive:true});
 for(const file of licenses)await copyFile(join(path,file),join(target,file));
 records.push({name,version:entry.version,license:entry.license??'UNKNOWN',integrity:entry.integrity,development:!!entry.dev,notices:licenses.map(f=>`${name.replaceAll('/','_')}/${f}`)});
}
await writeFile('public/licenses/components.json',JSON.stringify(records,null,2)+'\n');
console.log(`Recorded ${records.length} dependencies and notices; unknown licenses: ${records.filter(r=>r.license==='UNKNOWN').length}`);
