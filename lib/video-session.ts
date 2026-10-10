import type {VideoResult} from './video-schema.ts';
export type VideoEntry={status:'loading'|'ready'|'error';result?:VideoResult;error?:string};
export class VideoSession {
 private snapshot=new Map<string,VideoEntry>();private listeners=new Set<()=>void>();
 private pending=new Map<string,Promise<void>>();private controllers=new Map<string,AbortController>();private version=0;
 getSnapshot=()=>this.snapshot;
 subscribe=(listener:()=>void)=>{this.listeners.add(listener);return()=>{this.listeners.delete(listener);};};
 private put(id:string,value:VideoEntry){this.snapshot=new Map(this.snapshot).set(id,value);this.listeners.forEach(l=>l());}
 clear(){this.version++;this.controllers.forEach(c=>c.abort());this.controllers.clear();this.pending.clear();this.snapshot=new Map();this.listeners.forEach(l=>l());}
 load(id:string,search:(signal:AbortSignal)=>Promise<VideoResult>,retry=false):Promise<void>{
  const existing=this.pending.get(id);if(existing)return existing;
  // Cache empty results and failures too: revisiting a topic must not spend quota.
  if(!retry&&this.snapshot.has(id))return Promise.resolve();
  if(this.snapshot.get(id)?.status==='ready')return Promise.resolve();
  const version=this.version,controller=new AbortController();this.controllers.set(id,controller);this.put(id,{status:'loading'});
  const task=Promise.resolve().then(()=>search(controller.signal)).then(result=>{if(version!==this.version)return;if(result.topicId!==id)throw Error('Video topic does not match the request.');this.put(id,{status:'ready',result});}).catch(error=>{if(version===this.version)this.put(id,{status:'error',error:error instanceof Error?error.message:'Unable to find videos. Try again.'});}).finally(()=>{if(version===this.version){this.pending.delete(id);this.controllers.delete(id);}});
  this.pending.set(id,task);return task;
 }
}
