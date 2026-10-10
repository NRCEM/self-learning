'use client';
import { useRef, useState, useSyncExternalStore } from 'react';
import { analysisSchema, MAX_PDF_BYTES, type DocumentAnalysis } from '@/lib/analysis-schema';
import { lessonSchema } from '@/lib/lesson-schema';
import { VideoSession } from '@/lib/video-session';
import { videoResultSchema } from '@/lib/video-schema';
import { LessonSession } from '@/lib/lesson-session';
import { DocumentOverview } from './components/document-overview';
import { LessonView } from './components/lesson-view';
function readableError(error: unknown) {
 return error instanceof Error && error.name === 'AbortError' ? 'Quá trình mất quá nhiều thời gian. Vui lòng thử lại.' : error instanceof TypeError ? 'Không kết nối được với backend. Kiểm tra mạng và server rồi thử lại.' : error instanceof Error ? error.message : 'Kết nối bị gián đoạn. Vui lòng thử lại.';
}
export default function Home() {
 const [file,setFile] = useState<File|null>(null);
 const [screen,setScreen] = useState<'upload'|'loading'|'overview'|'lesson'>('upload');
 const [selectedId,setSelectedId] = useState<string|null>(null);
 const [error,setError] = useState('');
 const [analysis,setAnalysis] = useState<DocumentAnalysis|null>(null);
 const [session] = useState(()=>new LessonSession());
 const entries = useSyncExternalStore(session.subscribe,session.getSnapshot,session.getSnapshot);
 const [videoSession] = useState(()=>new VideoSession());
 const videoEntries = useSyncExternalStore(videoSession.subscribe,videoSession.getSnapshot,videoSession.getSnapshot);
 const analysisRequest = useRef<AbortController|null>(null);
 function reset() { analysisRequest.current?.abort(); analysisRequest.current=null; session.clear();videoSession.clear();setFile(null);setAnalysis(null);setSelectedId(null);setScreen('upload');setError(''); }
 function chooseFile(next: File|undefined) {
  session.clear();videoSession.clear();setAnalysis(null);setSelectedId(null);setError('');setFile(null);
  if(!next) return;
  if(!/\.pdf$/i.test(next.name)){setError('Vui lòng chọn file PDF.');return;}
  if(!next.size){setError('File PDF đang rỗng.');return;}
  if(next.size>MAX_PDF_BYTES){setError('PDF vượt giới hạn 10 MB.');return;}
  setFile(next);
 }
 async function analyze() {
  if(!file || analysisRequest.current) return;
  session.clear();videoSession.clear();setError('');setAnalysis(null);setScreen('loading');
  const controller = new AbortController();analysisRequest.current=controller;
  const timeout = setTimeout(()=>controller.abort(),110_000);
  try {
   const form = new FormData();form.append('file',file);
   const response = await fetch('/api/analyze',{method:'POST',body:form,signal:controller.signal});
   const payload = await response.json().catch(()=>null);
   if(!response.ok) throw new Error(payload?.error?.message || 'Không thể phân tích PDF. Vui lòng thử lại.');
   const parsed = analysisSchema.safeParse(payload?.data);
   if(!parsed.success) throw new Error('Kết quả phân tích chưa đúng cấu trúc. Vui lòng thử lại.');
   if(analysisRequest.current===controller){setAnalysis(parsed.data);setScreen('overview');}
  } catch(error) { if(analysisRequest.current===controller){setError(readableError(error));setScreen('upload');} }
  finally {clearTimeout(timeout);if(analysisRequest.current===controller)analysisRequest.current=null;}
 }
 function loadVideos(id:string,retry=false) {
  const topic=analysis?.topics.find(t=>t.id===id);if(!topic||!analysis)return;
  void videoSession.load(id,async signal=>{
   try{
    const response=await fetch('/api/videos',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({topicId:id,name:topic.name,subject:analysis.subject,concepts:[topic.description.slice(0,160)]}),signal:AbortSignal.any([signal,AbortSignal.timeout(20_000)])});
    const payload=await response.json().catch(()=>null);
    if(!response.ok)throw new Error(payload?.error?.message||'Không thể tìm video. Bài học và quiz vẫn dùng được.');
    const result=videoResultSchema.safeParse(payload?.data);
    if(!result.success||result.data.topicId!==id)throw new Error('Kết quả video chưa đúng cấu trúc hoặc đề mục.');
    return result.data;
   }catch(error){throw new Error(readableError(error));}
  },retry);
 }
 function openTopic(id: string) {
  const topic = analysis?.topics.find(t=>t.id===id);if(!topic||!file)return;
  setSelectedId(id);setScreen('lesson');loadVideos(id);
  void session.load(id,async signal=>{
   const controller = new AbortController();const cancel=()=>controller.abort();signal.addEventListener('abort',cancel,{once:true});if(signal.aborted)cancel();
   const timeout=setTimeout(cancel,110_000);
   try {
    const form=new FormData();form.append('file',file);form.append('topic',JSON.stringify(topic));
    const response=await fetch('/api/lesson',{method:'POST',body:form,signal:controller.signal});
    const payload=await response.json().catch(()=>null);
    if(!response.ok)throw new Error(payload?.error?.message||'Không thể tạo bài học. Vui lòng thử lại.');
    const parsed=lessonSchema.safeParse(payload?.data);
    if(!parsed.success||parsed.data.topicId!==id)throw new Error('Bài học chưa đúng cấu trúc hoặc đề mục. Vui lòng thử lại.');
    return parsed.data;
   }catch(error){throw new Error(readableError(error));}
   finally{clearTimeout(timeout);signal.removeEventListener('abort',cancel);}
  });
 }
 return <><header><a className="brand" href="/"><span className="logo">sl</span>self-learning<span className="dot">.</span></a><span className="header-label">KHÔNG GIAN HỌC TẬP CỦA BẠN</span><span className="badge">● Gemini</span></header><main><div className="notice">Tổng quan, bài học và quiz được tạo từ PDF của bạn · Video liên quan được tìm riêng trên YouTube.</div>
 {screen==='upload'||screen==='loading'?<section className="upload-layout"><div className="intro"><div className="eyebrow">TỪ TÀI LIỆU ĐẾN KIẾN THỨC</div><h1>Học điều mới.<br/><em>Theo cách của bạn.</em></h1><p>Biến tài liệu thành những bài học dễ hiểu.<br/>Khám phá từng đề mục và tự kiểm tra kiến thức.</p><div className="steps">{['Chọn tài liệu','Khám phá bài học','Kiểm tra kiến thức'].map((s,i)=><div key={s}><b>0{i+1}</b><span>{s}</span></div>)}</div><p className="footnote">Một tài liệu. Nhiều cách để hiểu sâu hơn.</p></div><div className="upload-card"><div className="card-top"><span>BẮT ĐẦU HỌC</span><span>01 / 03</span></div><h2>Tài liệu của bạn</h2><p>Chọn một file PDF để bắt đầu hành trình.</p><label className="dropzone"><input type="file" accept=".pdf,application/pdf" disabled={screen==='loading'} onChange={e=>{chooseFile(e.target.files?.[0]);e.target.value='';}}/><span className="file-icon">▤</span><strong>{file?.name||'Chọn tài liệu PDF'}</strong><span>{file?`${(file.size/1048576).toFixed(2)} MB · Nhấn để đổi file`:'Nhấn vào đây để chọn file từ thiết bị'}</span><small>Định dạng .pdf · Tối đa 10 MB</small></label>{error&&<p role="alert" className="error">{error}</p>}<button className="primary analyze" disabled={!file||screen==='loading'} onClick={analyze}>{screen==='loading'?<><span className="spinner"/> Đang phân tích PDF…</>:<>{error?'Thử lại':'Phân tích bài giảng'} <span>↗</span></>}</button><p className="privacy" role="status">{screen==='loading'?'Gemini đang đọc tài liệu, quá trình có thể mất khoảng một phút.':'Khi bấm phân tích, PDF sẽ được gửi tới Gemini.'}</p></div></section>:<><div className="workspace-top"><div><div className="eyebrow">TÀI LIỆU ĐANG HỌC</div><p className="filename">▤ {file?.name}</p></div><button className="secondary" onClick={reset}>Chọn PDF khác ↗</button></div>
 {screen==='overview'&&analysis?<DocumentOverview analysis={analysis} onSelect={openTopic}/>:analysis&&selectedId?<LessonView analysis={analysis} selectedId={selectedId} entries={entries} videoEntry={videoEntries.get(selectedId)} onRetryVideos={()=>loadVideos(selectedId,true)} onSelect={openTopic} onBack={()=>setScreen('overview')} onRetry={()=>openTopic(selectedId)} onAnswer={(q,c)=>session.answer(selectedId,q,c)} onSubmit={()=>session.submit(selectedId)} onResetQuiz={()=>session.resetQuiz(selectedId)}/>:null}</>}
 </main><footer><span>self-learning.</span><span>Học chủ động, hiểu sâu hơn.</span><span>BÀI HỌC & QUIZ TỪ PDF</span></footer></>;
}
