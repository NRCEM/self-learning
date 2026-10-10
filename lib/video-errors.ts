import { errorText } from './i18n.ts';
export class VideoError extends Error {
 readonly status:number;readonly code:string;constructor(status:number,code:string,message:string){super(message);this.status=status;this.code=code;}
}
export function mapYouTubeError(status:number,reasons:string[]) {
 if(reasons.some(r=>['quotaExceeded','dailyLimitExceeded','rateLimitExceeded','userRateLimitExceeded'].includes(r))||status===429)return new VideoError(429,'YOUTUBE_QUOTA',errorText('en', 'YOUTUBE_QUOTA'));
 if(reasons.includes('accessNotConfigured'))return new VideoError(503,'YOUTUBE_DISABLED',errorText('en', 'YOUTUBE_DISABLED'));
 if(status===400||status===401||status===403)return new VideoError(503,'YOUTUBE_CONFIGURATION',errorText('en', 'YOUTUBE_CONFIGURATION'));
 return new VideoError(502,'YOUTUBE_UNAVAILABLE',errorText('en', 'YOUTUBE_UNAVAILABLE'));
}
