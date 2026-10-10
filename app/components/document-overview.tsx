import { useLanguage } from './language-provider';
import type { DocumentAnalysis } from '@/lib/analysis-schema';

export function DocumentOverview({ analysis, onSelect }: { analysis: DocumentAnalysis; onSelect: (id: string) => void }) {
  const {t}=useLanguage();
  return <section>
    <span className="tag">{analysis.subject} · {t('fromPdf')}</span>
    <h1 className="overview-title">{analysis.title}</h1>
    <p>{t('overviewDescription')}</p>
    <div className="summary">
      <div><div className="eyebrow">{t('summary')}</div><h2>{t('keyIdeas')}</h2><p className="analysis-summary">{analysis.summary}</p></div>
      <div className="stats"><b>{String(analysis.topics.length).padStart(2, '0')}<span>{t('topicsCount')}</span></b></div>
    </div>
    <div className="section-heading"><h2>{t('topics')}</h2><span>{t('pagesHint')}</span></div>
    <div className="topic-grid">{analysis.topics.map((topic, index) => <button type="button" key={topic.id} className="topic-card" onClick={() => onSelect(topic.id)}>
      <div className="topic-number">{String(index + 1).padStart(2, '0')}</div>
      <h3>{topic.name}</h3><p>{topic.description}</p>
      <div className="topic-meta">{topic.sourcePages?.length ? t('pages',{pages:topic.sourcePages.join(', ')}) : t('unknownPages')}</div>
      <small className="pending-label">{t('openLesson')}</small>
    </button>)}</div>
    <p className="lesson-footnote">{t('overviewNote')}</p>
  </section>;
}
