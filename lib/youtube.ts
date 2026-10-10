import { errorText } from './i18n.ts';
import 'server-only';
import { z } from 'zod';
import { buildVideoQuery,decodeVideoText,videoSchema,type VideoSearch,type VideoResult } from './video-schema.ts';
import { VideoError,mapYouTubeError } from './video-errors.ts';
const itemSchema=z.object({id:z.object({videoId:z.string()}),snippet:z.object({title:z.string(),channelTitle:z.string(),thumbnails:z.record(z.string(),z.object({url:z.string()}))})});
const searchResponseSchema=z.object({items:z.array(z.unknown())});
export async function searchYouTube(input:VideoSearch,signal:AbortSignal,fetcher:typeof fetch=fetch):Promise<VideoResult> {
 const key=process.env.YOUTUBE_API_KEY?.trim();
 if(!key)throw new VideoError(503,'MISSING_YOUTUBE_KEY',errorText('en', 'MISSING_YOUTUBE_KEY'));
 const url=new URL('https://www.googleapis.com/youtube/v3/search');
 url.search=new URLSearchParams({key,part:'snippet',type:'video',q:buildVideoQuery(input),maxResults:'6',order:'relevance',relevanceLanguage:input.language??'en',safeSearch:'moderate'}).toString();
 const timeout=AbortSignal.timeout(15_000);
 try {
  const response=await fetcher(url,{signal:AbortSignal.any([signal,timeout]),cache:'no-store'});
  const payload=await response.json().catch(()=>null);
  if(!response.ok){const reasons=z.object({error:z.object({errors:z.array(z.object({reason:z.string()})).optional()})}).safeParse(payload);throw mapYouTubeError(response.status,reasons.success?reasons.data.error.errors?.map(e=>e.reason)??[]:[]);}
  const parsed=searchResponseSchema.safeParse(payload);if(!parsed.success)throw new VideoError(502,'INVALID_VIDEO_RESULT',errorText('en', 'INVALID_VIDEO_RESULT'));
  const videos:VideoResult['videos']=[];
  for(const raw of parsed.data.items){const item=itemSchema.safeParse(raw);if(!item.success)continue;const {videoId}=item.data.id;const snippet=item.data.snippet;const video=videoSchema.safeParse({id:videoId,title:decodeVideoText(snippet.title),channel:decodeVideoText(snippet.channelTitle),thumbnail:snippet.thumbnails.medium?.url||snippet.thumbnails.default?.url||snippet.thumbnails.high?.url});if(video.success&&!videos.some(v=>v.id===videoId))videos.push(video.data);if(videos.length===6)break;}
  if(parsed.data.items.length&&!videos.length)throw new VideoError(502,'INVALID_VIDEO_RESULT',errorText('en', 'INVALID_VIDEO_RESULT'));
  if(videos.length){
   const metadataUrl=new URL('https://www.googleapis.com/youtube/v3/videos');
   metadataUrl.search=new URLSearchParams({key,part:'snippet',id:videos.map(v=>v.id).join(',')}).toString();
   const metadataResponse=await fetcher(metadataUrl,{signal:AbortSignal.any([signal,timeout]),cache:'no-store'});
   if(!metadataResponse.ok){const body=await metadataResponse.json().catch(()=>null);const reasons=body?.error?.errors?.map((e:{reason?:string})=>e.reason).filter((r:unknown)=>typeof r==='string')??[];throw mapYouTubeError(metadataResponse.status,reasons);}
   const metadata=z.object({items:z.array(z.object({id:z.string(),snippet:z.object({defaultAudioLanguage:z.string().optional(),defaultLanguage:z.string().optional()})}))}).safeParse(await metadataResponse.json());
   if(!metadata.success)throw new VideoError(502,'INVALID_VIDEO_RESULT',errorText('en', 'INVALID_VIDEO_RESULT'));
   for(const video of videos){const snippet=metadata.data.items.find(v=>v.id===video.id)?.snippet;video.language=snippet?.defaultAudioLanguage??snippet?.defaultLanguage??null;}
   videos.sort((a,b)=>Number(b.language?.toLowerCase().split('-')[0]===input.language)-Number(a.language?.toLowerCase().split('-')[0]===input.language));
  }
  return {topicId:input.topicId,videos:videos.slice(0,3)};
 }catch(error){
  // Never log the upstream URL/body/error: the query URL contains the API key.
  if(error instanceof VideoError)throw error;
  if(timeout.aborted)throw new VideoError(504,'YOUTUBE_TIMEOUT',errorText('en', 'YOUTUBE_TIMEOUT'));
  throw new VideoError(502,'YOUTUBE_NETWORK',errorText('en', 'YOUTUBE_NETWORK'));
 }
}
