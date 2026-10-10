import type { Language } from './language.ts';
import type { DocumentAnalysis } from './analysis-schema.ts';
import type { Lesson } from './lesson-schema.ts';
import type { VideoResult } from './video-schema.ts';
export type Entry<T>={status:'loading'|'ready'|'error';data?:T;error?:string};
type Quiz={answers:Record<string,number>;submitted:boolean};
type Snapshot={overviews:Map<Language,Entry<DocumentAnalysis>>;lessons:Map<string,Entry<Lesson>>;videos:Map<string,Entry<VideoResult>>;quizzes:Map<string,Quiz>};
const empty=():Snapshot=>({overviews:new Map(),lessons:new Map(),videos:new Map(),quizzes:new Map()});
export const contentKey=(language:Language,id:string)=>`${language}:${id}`;
// Canonical content is created once. Language variants share the same quiz state.
export class DocumentSession {
 private snapshot=empty();private listeners=new Set<()=>void>();private pending=new Map<string,Promise<void>>();private originals=new Map<string,Promise<{language:Language;data:DocumentAnalysis|Lesson}>>();private controllers=new Set<AbortController>();private version=0;
 getSnapshot=()=>this.snapshot;
 subscribe=(listener:()=>void)=>{this.listeners.add(listener);return()=>{this.listeners.delete(listener);};};
 private emit(){this.listeners.forEach(listener=>listener());}
 private put<T>(kind:'overviews'|'lessons'|'videos',key:string,entry:Entry<T>){this.snapshot={...this.snapshot,[kind]:new Map(this.snapshot[kind] as Map<string,Entry<unknown>>).set(key,entry)};this.emit();}
 clear(){this.version++;this.controllers.forEach(c=>c.abort());this.controllers.clear();this.pending.clear();this.originals.clear();this.snapshot=empty();this.emit();}
 private load<T>(kind:'overviews'|'lessons'|'videos',key:string,generate:(signal:AbortSignal)=>Promise<T>,retry:boolean){
  const jobKey=`${kind}:${key}`;const existing=this.pending.get(jobKey);if(existing)return existing;
  const entry=(this.snapshot[kind] as Map<string,Entry<T>>).get(key);if(entry && (entry.status==='ready'||!retry))return Promise.resolve();
  const version=this.version;const controller=new AbortController();this.controllers.add(controller);this.put(kind,key,{status:'loading'});
  const job=Promise.resolve().then(()=>{if(version!==this.version||controller.signal.aborted)throw new Error('TIMEOUT');return generate(controller.signal);}).then(data=>{if(version===this.version)this.put(kind,key,{status:'ready',data});}).catch(error=>{if(version===this.version)this.put(kind,key,{status:'error',error:error instanceof Error?error.message:'INTERNAL_ERROR'});}).finally(()=>{if(version===this.version)this.pending.delete(jobKey);this.controllers.delete(controller);});
  this.pending.set(jobKey,job);return job;
 }
 private content<T extends DocumentAnalysis|Lesson>(kind:'overviews'|'lessons',id:string,language:Language,generate:(signal:AbortSignal)=>Promise<T>,translate:(source:T,signal:AbortSignal)=>Promise<T>,retry:boolean){
  const canonical=`${kind}:${id}`;const version=this.version;
  return this.load(kind,kind==='overviews'?language:contentKey(language,id),async signal=>{
   let original=this.originals.get(canonical);
   if(!original){original=Promise.resolve().then(()=>generate(signal)).then(data=>({language,data}));this.originals.set(canonical,original);original.catch(()=>{if(version===this.version && this.originals.get(canonical)===original)this.originals.delete(canonical);});}
   const base=await original;if(signal.aborted||version!==this.version)throw new Error('TIMEOUT');
   return base.language===language?base.data as T:translate(base.data as T,signal);
  },retry);
 }
 overview(language:Language,generate:(signal:AbortSignal)=>Promise<DocumentAnalysis>,translate:(source:DocumentAnalysis,signal:AbortSignal)=>Promise<DocumentAnalysis>,retry=false){return this.content('overviews','document',language,generate,translate,retry);}
 lesson(id:string,language:Language,generate:(signal:AbortSignal)=>Promise<Lesson>,translate:(source:Lesson,signal:AbortSignal)=>Promise<Lesson>,retry=false){return this.content('lessons',id,language,async signal=>{const data=await generate(signal);if(data.topicId!==id)throw new Error('INVALID_LESSON');return data;},translate,retry);}
 videos(id:string,language:Language,generate:(signal:AbortSignal)=>Promise<VideoResult>,retry=false){return this.load('videos',contentKey(language,id),async signal=>{const data=await generate(signal);if(data.topicId!==id)throw new Error('INVALID_VIDEO_RESULT');return data;},retry);}
 private quiz(id:string,value:Quiz){this.snapshot={...this.snapshot,quizzes:new Map(this.snapshot.quizzes).set(id,value)};this.emit();}
 answer(id:string,language:Language,questionId:string,choice:number){const lesson=this.snapshot.lessons.get(contentKey(language,id))?.data;const quiz=this.snapshot.quizzes.get(id)??{answers:{},submitted:false};if(!lesson||quiz.submitted||!Number.isInteger(choice)||choice<0||choice>3||!lesson.quiz.some(q=>q.id===questionId))return;this.quiz(id,{...quiz,answers:{...quiz.answers,[questionId]:choice}});}
 submit(id:string,language:Language){const lesson=this.snapshot.lessons.get(contentKey(language,id))?.data;const quiz=this.snapshot.quizzes.get(id);if(lesson&&quiz&&lesson.quiz.every(q=>Number.isInteger(quiz.answers[q.id])))this.quiz(id,{...quiz,submitted:true});}
 resetQuiz(id:string){this.quiz(id,{answers:{},submitted:false});}
}
