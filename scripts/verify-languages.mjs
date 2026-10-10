import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {analysisSchema} from '../lib/analysis-schema.ts';import {lessonSchema} from '../lib/lesson-schema.ts';import {translationPreserves} from '../lib/translate-handler.ts';
const path=process.argv[2];if(!path)throw Error('Usage: node --experimental-strip-types scripts/verify-languages.mjs <PDF path> [base URL]');
const baseUrl=process.argv[3]??'http://localhost:3000';
const pdf=await readFile(path);const results={};
function form(language){const f=new FormData();f.append('file',new File([pdf],'document.pdf',{type:'application/pdf'}));f.append('language',language);return f;}
async function post(endpoint,body){const start=Date.now();const response=await fetch(`${baseUrl}/api/${endpoint}`,{method:'POST',body,headers:typeof body==='string'?{'Content-Type':'application/json'}:undefined,signal:AbortSignal.timeout(110000)});const payload=await response.json();console.log({endpoint,status:response.status,seconds:(Date.now()-start)/1000,code:payload.error?.code});if(!response.ok)throw Error(payload.error?.code??'Request failed');return payload.data;}
results.en=analysisSchema.parse(await post('analyze',form('en')));const topic=results.en.topics[0];const f=form('en');f.append('topic',JSON.stringify(topic));results.lessonEn=lessonSchema.parse(await post('lesson',f));
for(const [kind,source,key] of [['overview',results.en,'vi'],['lesson',results.lessonEn,'lessonVi']]){const f=form('vi');f.append('kind',kind);f.append('source',JSON.stringify(source));results[key]=await post('translate',f);if(!translationPreserves(source,results[key]))throw Error('Protected content changed');}
for(const language of ['en','vi']){const overview=results[language],t=overview.topics.find(t=>t.id===topic.id);results[`videos${language}`]=await post('videos',JSON.stringify({topicId:t.id,name:t.name,subject:overview.subject,concepts:[t.description.slice(0,160)],language}));}
await mkdir('tmp/diagnostics',{recursive:true});await writeFile('tmp/diagnostics/language-verification.json',JSON.stringify(results,null,2));console.log({passed:true,topicId:topic.id,questions:results.lessonEn.quiz.length});
