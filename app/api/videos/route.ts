import {handleVideos} from '@/lib/video-handler';
import {searchYouTube} from '@/lib/youtube';
export const runtime='nodejs';
export const maxDuration=30;
export async function POST(request:Request){return handleVideos(request,searchYouTube);}
