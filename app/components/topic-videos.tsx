import type {VideoEntry} from '@/lib/video-session';
export function TopicVideos({entry,onRetry}:{entry?:VideoEntry;onRetry:()=>void}){
 return <section className="topic-videos" aria-label="Video YouTube liên quan"><h2>Học thêm qua video</h2><p className="video-intro">Video liên quan từ YouTube · Ưu tiên tiếng Việt, có thể có tiếng Anh.</p>
 {(!entry||entry.status==='loading')&&<p role="status"><span className="spinner"/> Đang tìm video cho đề mục này…</p>}
 {entry?.status==='error'&&<div role="alert"><p className="error">{entry.error}</p><button type="button" className="secondary" onClick={onRetry}>Thử lại video</button></div>}
 {entry?.status==='ready'&&(entry.result?.videos.length?<div className="related-video-grid">{entry.result.videos.map(video=><div className="related-video-card" key={video.id}><a href={`https://www.youtube.com/watch?v=${video.id}`} target="_blank" rel="noopener noreferrer" aria-label={`Mở video: ${video.title}`}><img src={video.thumbnail} alt={`Thumbnail: ${video.title}`} width={320} height={180} loading="lazy" referrerPolicy="no-referrer"/></a><h3>{video.title}</h3><p>{video.channel}</p><a href={`https://www.youtube.com/watch?v=${video.id}`} target="_blank" rel="noopener noreferrer">Mở trên YouTube ↗</a></div>)}</div>:<p role="status">Chưa tìm thấy video phù hợp với đề mục này. Anh vẫn có thể đọc bài và làm quiz.</p>)}
 </section>;
}
