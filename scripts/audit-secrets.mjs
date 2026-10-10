import env from '@next/env';
import {execFileSync} from 'node:child_process';
import {readFile,readdir} from 'node:fs/promises';
import {join} from 'node:path';
env.loadEnvConfig(process.cwd());
const keys=['GEMINI_API_KEY','YOUTUBE_API_KEY'].map(name=>process.env[name]?.trim()).filter(Boolean);
const files=execFileSync('git',['ls-files','-z'],{encoding:'utf8'}).split('\0').filter(Boolean);
if(!files.length)throw Error('Stage files with git add before auditing.');
const violations=[];
const containsSecret=text=>keys.some(key=>text.includes(key))||/AIza[\w-]{35}/.test(text);
for(const file of files){
 if((/(^|\/)\.env/.test(file)&&file!=='.env.example')||/\.pdf$/i.test(file)||file.startsWith('tmp/'))violations.push(`${file}: private file staged`);
 const text=execFileSync('git',['show',`:${file}`],{encoding:'utf8',maxBuffer:20*1024*1024});
 if(containsSecret(text))violations.push(`${file}: API key detected`);
 if(file==='.env.example'&&/^\s*\w*API_KEY\s*=\s*[^\s#]+/m.test(text))violations.push(`${file}: example key must be empty`);
}
let clientFiles=0;
async function auditClient(path){let entries;try{entries=await readdir(path,{withFileTypes:true});}catch{return;}for(const entry of entries){const full=join(path,entry.name);if(entry.isDirectory())await auditClient(full);else if(/\.(js|json|html|map)$/.test(entry.name)){clientFiles++;if(containsSecret(await readFile(full,'utf8')))violations.push(`${full}: API key in browser asset`);}}}
await auditClient('.next/static');
console.log(JSON.stringify({stagedFiles:files.length,clientAssetsChecked:clientFiles,configuredKeysChecked:keys.length,violations},null,2));
if(violations.length)process.exitCode=1;
