import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {basename} from 'node:path';
import {analysisSchema} from '../lib/analysis-schema.ts';
import {lessonSchema,lessonFitsContext} from '../lib/lesson-schema.ts';
import {PDFDocument} from 'pdf-lib';
const filename=process.argv[2]||'06_light.pdf',index=Number(process.argv[3]||0);
const pdf=await readFile(filename);const pageCount=(await PDFDocument.load(pdf)).getPageCount();
function form(){const f=new FormData();f.append('file',new File([pdf],basename(filename),{type:'application/pdf'}));return f;}
async function post(path,body){const start=Date.now();const response=await fetch(`http://localhost:3000/api/${path}`,{method:'POST',body,signal:AbortSignal.timeout(110000)});const payload=await response.json();console.log({path,httpStatus:response.status,seconds:(Date.now()-start)/1000,error:payload.error});if(!response.ok)throw Error(payload.error?.message||'Endpoint failed');return payload.data;}
const analysis=analysisSchema.parse(await post('analyze',form()));const topic=analysis.topics[index];if(!topic)throw Error('Invalid topic index');
const body=form();body.append('topic',JSON.stringify(topic));const lesson=lessonSchema.parse(await post('lesson',body));if(!lessonFitsContext(lesson,topic.id,pageCount))throw Error('Context mismatch');
await mkdir('tmp/diagnostics',{recursive:true});await writeFile('tmp/diagnostics/lesson-06-light.json',JSON.stringify(lesson,null,2));console.log({title:lesson.title,sections:lesson.sections.length,formulas:lesson.formulas.length,quiz:lesson.quiz.length,examples:lesson.examples.map(e=>({origin:e.origin,pages:e.sourcePages}))});
