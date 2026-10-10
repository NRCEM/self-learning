import 'server-only';
import { z } from 'zod';
import { buildVideoQuery,decodeVideoText,videoSchema,type VideoSearch,type VideoResult } from './video-schema.ts';
import { VideoError,mapYouTubeError } from './video-errors.ts';
const itemSchema=z.object({id:z.object({videoId:z.string()}),snippet:z.object({title:z.string(),channelTitle:z.string(),thumbnails:z.record(z.string(),z.object({url:z.string()}))})});
const searchResponseSchema=z.object({items:z.array(z.unknown())});
export async function searchYouTube(input:VideoSearch,signal:AbortSignal,fetcher:typeof fetch=fetch):Promise<VideoResult> {
 const key=process.env.YOUTUBE_API_KEY?.trim();
 if(!key)throw new VideoError(503,'MISSING_YOUTUBE_KEY','Video chưa được cấu hình: thêm YOUTUBE_API_KEY trong .env.local rồi khởi động lại server. Bài học và quiz vẫn dùng được.');
 const url=new URL('https://www.googleapis.com/youtube/v3/search');
 url.search=new URLSearchParams({key,part:'snippet',type:'video',q:buildVideoQuery(input),maxResults:'3',order:'relevance',relevanceLanguage:'vi',safeSearch:'moderate'}).toString();
 const timeout=AbortSignal.timeout(15_000);
 try {
  const response=await fetcher(url,{signal:AbortSignal.any([signal,timeout]),cache:'no-store'});
  const payload=await response.json().catch(()=>null);
  if(!response.ok){const reasons=z.object({error:z.object({errors:z.array(z.object({reason:z.string()})).optional()})}).safeParse(payload);throw mapYouTubeError(response.status,reasons.success?reasons.data.error.errors?.map(e=>e.reason)??[]:[]);}
  const parsed=searchResponseSchema.safeParse(payload);if(!parsed.success)throw new VideoError(502,'INVALID_VIDEO_RESULT','YouTube trả dữ liệu chưa hợp lệ. Vui lòng thử lại video.');
  const videos:VideoResult['videos']=[];
  for(const raw of parsed.data.items){const item=itemSchema.safeParse(raw);if(!item.success)continue;const {videoId}=item.data.id;const snippet=item.data.snippet;const video=videoSchema.safeParse({id:videoId,title:decodeVideoText(snippet.title),channel:decodeVideoText(snippet.channelTitle),thumbnail:snippet.thumbnails.medium?.url||snippet.thumbnails.default?.url||snippet.thumbnails.high?.url});if(video.success&&!videos.some(v=>v.id===videoId))videos.push(video.data);if(videos.length===3)break;}
  if(parsed.data.items.length&&!videos.length)throw new VideoError(502,'INVALID_VIDEO_RESULT','YouTube trả dữ liệu video chưa hợp lệ. Vui lòng thử lại video.');
  return {topicId:input.topicId,videos};
 }catch(error){
  // Never log the upstream URL/body/error: the query URL contains the API key.
  if(error instanceof VideoError)throw error;
  if(timeout.aborted)throw new VideoError(504,'YOUTUBE_TIMEOUT','Tìm video mất quá nhiều thời gian. Vui lòng thử lại video.');
  throw new VideoError(502,'YOUTUBE_NETWORK','Không kết nối được với YouTube. Bài học và quiz vẫn dùng được.');
 }
}
