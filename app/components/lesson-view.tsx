import { useLanguage } from './language-provider';
import type { DocumentAnalysis } from '@/lib/analysis-schema';
import { gradeLesson } from '@/lib/lesson-schema';
import type { LessonEntry } from '@/lib/lesson-session';
import type { VideoEntry } from '@/lib/video-session';
import { TopicVideos } from './topic-videos';
import { MathText } from './math-text';
type Props = {
  analysis: DocumentAnalysis; selectedId: string; entries: Map<string, LessonEntry>;
  videoEntry?: VideoEntry; onRetryVideos: () => void; onSelect: (id: string) => void; onBack: () => void; onRetry: () => void;
  onAnswer: (questionId: string, choice: number) => void; onSubmit: () => void; onResetQuiz: () => void;
};
function Sources({ pages }: { pages: number[] | null }) { const {t}=useLanguage(); return <small className="source-pages">{pages?.length ? t('source',{pages:pages.join(', ')}) : t('unknownPages')}</small>; }
export function LessonView({ analysis, selectedId, entries, videoEntry, onRetryVideos, onSelect, onBack, onRetry, onAnswer, onSubmit, onResetQuiz }: Props) {
  const {t}=useLanguage();
  const topic = analysis.topics.find(t => t.id === selectedId)!;
  const entry = entries.get(selectedId); const lesson = entry?.lesson;
  const answered = lesson?.quiz.filter(q => entry?.answers[q.id] !== undefined).length ?? 0;
  return <section className="lesson-layout"><aside>
    <button className="back" onClick={onBack}>{t('back')}</button>
    <div className="eyebrow toc-title">{t('toc')}</div>
    <nav aria-label={t('topics')}>{analysis.topics.map((item, i) => <button key={item.id} className={`toc-item ${selectedId === item.id ? 'active' : ''}`} aria-current={selectedId === item.id ? 'page' : undefined} onClick={() => onSelect(item.id)}><span>{String(i + 1).padStart(2, '0')}</span><span className="toc-name">{item.name}<small>{entries.get(item.id)?.status === 'loading' ? t('creating') : entries.get(item.id)?.lesson ? t('created') : t('notCreated')}</small></span></button>)}</nav>
    <div className="aside-note">{t('asideNote')}</div>
  </aside><article className="lesson" key={selectedId}>
    <span className="tag">{t('lessonTag')} · {analysis.subject}</span><h1>{lesson?.title ?? topic.name}</h1><p className="subtitle">{topic.description}</p>
    {(!entry || entry.status === 'loading') && <div className="lesson-status" role="status"><span className="spinner"/> {t('lessonLoading')}<p>{t('switchHint')}</p></div>}
    {entry?.status === 'error' && <div role="alert" className="lesson-status"><p className="error">{entry.error}</p><button className="primary" onClick={onRetry}>{t('retryLesson')}</button></div>}
    {lesson && entry && <>
      <h2>{t('objectives')}</h2><ul className="lesson-list">{lesson.objectives.map((o, i) => <li key={i}><MathText text={o}/></li>)}</ul>
      {lesson.sections.map((section, i) => <section key={i} className="knowledge-section"><h2>{section.title}</h2><div className="lesson-prose"><MathText text={section.explanation}/></div><Sources pages={section.sourcePages}/></section>)}
      {lesson.formulas.length > 0 && <section><h2>{t('formulas')}</h2>{lesson.formulas.map((f, i) => <div className="formula-card" key={i}><MathText text={f.latex} formula/><p><MathText text={f.meaning}/></p><div className="symbol-table"><table><thead><tr><th>{t('symbol')}</th><th>{t('meaning')}</th><th>{t('unit')}</th></tr></thead><tbody>{f.symbols.map((s, j) => <tr key={j}><td><MathText text={s.symbol} formula inline/></td><td><MathText text={s.meaning}/></td><td><MathText text={s.unit}/></td></tr>)}</tbody></table></div><Sources pages={f.sourcePages}/></div>)}</section>}
      <h2>{t('examples')}</h2>{lesson.examples.map((example, i) => <div className="example" key={i}><span className="tag">{example.origin === 'document' ? t('documentExample') : t('supplementaryExample')}</span><h3>{example.title}</h3><p><MathText text={example.problem}/></p><ol className="lesson-list">{example.steps.map((step, j) => <li key={j}><MathText text={step}/></li>)}</ol><p><strong>{t('answer')}</strong><MathText text={example.answer}/></p>{example.origin === 'document' && <Sources pages={example.sourcePages}/>}</div>)}
      <h2>{t('misconceptions')}</h2>{lesson.misconceptions.map((m, i) => <div className="misconception" key={i}><p><strong>{t('mistake')}</strong><MathText text={m.mistake}/></p><p><strong>{t('correction')}</strong><MathText text={m.correction}/></p></div>)}
      <form onSubmit={event => { event.preventDefault(); onSubmit(); }}><div className="section-heading quiz-heading"><div><div className="eyebrow">{t('quizTag')}</div><h2>{t('quizTitle')}</h2></div><span>{t('answered',{count:answered})}</span></div>
        {entry.submitted && <div className="result" role="status"><strong>{t('score',{count:gradeLesson(lesson.quiz,entry.answers),score:gradeLesson(lesson.quiz,entry.answers)*2})}</strong><span>{t('resultHint')}</span></div>}
        {lesson.quiz.map((q, i) => <fieldset key={q.id}><legend><span>{String(i + 1).padStart(2, '0')}</span><MathText text={q.prompt}/></legend>{q.options.map((option, j) => <label key={j} className={`option ${entry.answers[q.id] === j ? 'chosen' : ''} ${entry.submitted && j === q.correctIndex ? 'correct' : ''} ${entry.submitted && entry.answers[q.id] === j && j !== q.correctIndex ? 'wrong' : ''}`}><input type="radio" aria-label={`${String.fromCharCode(65 + j)}. ${option}`} name={`${selectedId}-${q.id}`} checked={entry.answers[q.id] === j} disabled={entry.submitted} onChange={() => onAnswer(q.id, j)}/><span>{String.fromCharCode(65 + j)}.</span><MathText text={option}/>{entry.submitted && j === q.correctIndex && <b>✓</b>}</label>)}{entry.submitted && <div className="explanation"><strong>{entry.answers[q.id] === q.correctIndex ? t('correct') : t('correctAnswer',{letter:String.fromCharCode(65+q.correctIndex)})} </strong><MathText text={q.explanation}/><Sources pages={q.sourcePages}/></div>}</fieldset>)}
        <div className="quiz-actions">{entry.submitted ? <button type="button" className="primary" onClick={onResetQuiz}>{t('resetQuiz')}</button> : <button type="submit" className="primary" disabled={answered !== 5}>{t('submitQuiz')}</button>}<span>{entry.submitted ? t('quizSaved') : t('completeQuiz')}</span></div>
      </form><p className="lesson-footnote">{t('aiNote')}</p>
    </>}
    <TopicVideos entry={videoEntry} onRetry={onRetryVideos}/>
  </article></section>;
}
