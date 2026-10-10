import {videoSearchSchema,videoResultSchema,type VideoSearch} from './video-schema.ts';
import {VideoError} from './video-errors.ts';
type Search=(input:VideoSearch,signal:AbortSignal)=>Promise<unknown>;
export async function handleVideos(request:Request,search:Search){
 try{
  if(!request.headers.get('content-type')?.toLowerCase().startsWith('application/json'))throw new VideoError(400,'INVALID_VIDEO_SEARCH','Dữ liệu tìm video phải là JSON.');
  // Bound the stream even when Content-Length is absent.
  if(Number(request.headers.get('content-length'))>8192)throw new VideoError(413,'SEARCH_TOO_LARGE','Yêu cầu tìm video quá dài.');
  const reader=request.body?.getReader();if(!reader)throw new VideoError(400,'INVALID_VIDEO_SEARCH','Thiếu đề mục để tìm video.');
  const chunks:Uint8Array[]=[];let length=0;
  try{while(true){const {done,value}=await reader.read();if(done)break;length+=value.byteLength;if(length>8192){await reader.cancel();throw new VideoError(413,'SEARCH_TOO_LARGE','Yêu cầu tìm video quá dài.');}chunks.push(value);}}finally{reader.releaseLock();}
  let raw:unknown;try{raw=JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{throw new VideoError(400,'INVALID_VIDEO_SEARCH','Đề mục tìm video chưa hợp lệ.');}
  const input=videoSearchSchema.safeParse(raw);if(!input.success)throw new VideoError(400,'INVALID_VIDEO_SEARCH','Đề mục tìm video chưa đúng cấu trúc.');
  const result=videoResultSchema.safeParse(await search(input.data,request.signal));
  if(!result.success||result.data.topicId!==input.data.topicId)throw new VideoError(502,'INVALID_VIDEO_RESULT','Kết quả video chưa đúng đề mục hoặc cấu trúc.');
  return Response.json({data:result.data},{headers:{'Cache-Control':'no-store'}});
 }catch(error){const known=error instanceof VideoError?error:new VideoError(500,'VIDEO_ERROR','Không thể tìm video lúc này. Bài học và quiz vẫn dùng được.');return Response.json({error:{code:known.code,message:known.message}},{status:known.status,headers:{'Cache-Control':'no-store'}});}
}
