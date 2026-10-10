export class VideoError extends Error {
 readonly status:number;readonly code:string;constructor(status:number,code:string,message:string){super(message);this.status=status;this.code=code;}
}
export function mapYouTubeError(status:number,reasons:string[]) {
 if(reasons.some(r=>['quotaExceeded','dailyLimitExceeded','rateLimitExceeded','userRateLimitExceeded'].includes(r))||status===429)return new VideoError(429,'YOUTUBE_QUOTA','YouTube đã hết hạn mức hoặc đang giới hạn lượt tìm. Anh vẫn đọc bài và làm quiz bình thường; thử lại sau.');
 if(reasons.includes('accessNotConfigured'))return new VideoError(503,'YOUTUBE_DISABLED','Chưa bật YouTube Data API v3 cho project chứa key. Bật API rồi thử lại.');
 if(status===400||status===401||status===403)return new VideoError(503,'YOUTUBE_CONFIGURATION','YouTube từ chối key hoặc quyền truy cập. Kiểm tra key, API đã bật và giới hạn key ở backend.');
 return new VideoError(502,'YOUTUBE_UNAVAILABLE','Dịch vụ YouTube chưa phản hồi được. Anh vẫn có thể học và làm quiz; thử lại video sau.');
}
