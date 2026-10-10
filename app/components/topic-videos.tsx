import type {VideoEntry} from '@/lib/video-session';
import { videoLanguageName } from '@/lib/i18n';
import { useLanguage } from './language-provider';
export function TopicVideos({entry,onRetry}:{entry?:VideoEntry;onRetry:()=>void}){
 const {t,language}=useLanguage();
 return <section className="topic-videos" aria-label={t('videoTitle')}><h2>{t('videoTitle')}</h2><p className="video-intro">{t('videoIntro')}</p>
 {(!entry||entry.status==='loading')&&<p role="status"><span className="spinner"/> {t('videoLoading')}</p>}
 {entry?.status==='error'&&<div role="alert"><p className="error">{entry.error}</p><button type="button" className="secondary" onClick={onRetry}>{t('retryVideo')}</button></div>}
 {entry?.status==='ready'&&(entry.result?.videos.length?<div className="related-video-grid">{entry.result.videos.map(video=><div className="related-video-card" key={video.id}><a href={`https://www.youtube.com/watch?v=${video.id}`} target="_blank" rel="noopener noreferrer" aria-label={t('videoLink',{title:video.title})}><img src={video.thumbnail} alt={t('videoThumb',{title:video.title})} width={320} height={180} loading="lazy" referrerPolicy="no-referrer"/></a><h3>{video.title}</h3><p>{video.channel}</p><small>{video.language?t(video.language.toLowerCase().split('-')[0]===language?'videoLanguage':'otherLanguage',{language:videoLanguageName(video.language)}):t('unknownVideoLanguage')}</small><a href={`https://www.youtube.com/watch?v=${video.id}`} target="_blank" rel="noopener noreferrer">{t('openVideo')}</a></div>)}</div>:<p role="status">{t('noVideos')}</p>)}
 </section>;
}
