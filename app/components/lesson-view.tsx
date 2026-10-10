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
function Sources({ pages }: { pages: number[] | null }) { return <small className="source-pages">{pages?.length ? `Nguồn PDF · Trang ${pages.join(', ')}` : 'Trang nguồn chưa xác định'}</small>; }
export function LessonView({ analysis, selectedId, entries, videoEntry, onRetryVideos, onSelect, onBack, onRetry, onAnswer, onSubmit, onResetQuiz }: Props) {
  const topic = analysis.topics.find(t => t.id === selectedId)!;
  const entry = entries.get(selectedId); const lesson = entry?.lesson;
  const answered = lesson?.quiz.filter(q => entry?.answers[q.id] !== undefined).length ?? 0;
  return <section className="lesson-layout"><aside>
    <button className="back" onClick={onBack}>← Quay lại tổng quan</button>
    <div className="eyebrow toc-title">MỤC LỤC BÀI HỌC</div>
    <nav aria-label="Đề mục">{analysis.topics.map((t, i) => <button key={t.id} className={`toc-item ${selectedId === t.id ? 'active' : ''}`} aria-current={selectedId === t.id ? 'page' : undefined} onClick={() => onSelect(t.id)}><span>{String(i + 1).padStart(2, '0')}</span><span className="toc-name">{t.name}<small>{entries.get(t.id)?.status === 'loading' ? 'Đang tạo…' : entries.get(t.id)?.lesson ? 'Đã tạo' : 'Chưa tạo'}</small></span></button>)}</nav>
    <div className="aside-note">PDF gốc được dùng để tạo từng bài học.<br/>Bài đã tạo được giữ trong phiên này.</div>
  </aside><article className="lesson" key={selectedId}>
    <span className="tag">BÀI HỌC TỪ PDF · {analysis.subject}</span><h1>{lesson?.title ?? topic.name}</h1><p className="subtitle">{topic.description}</p>
    {(!entry || entry.status === 'loading') && <div className="lesson-status" role="status"><span className="spinner"/> Đang đọc PDF và tạo bài học, công thức cùng 5 câu quiz…<p>Anh có thể chuyển đề mục trong lúc chờ.</p></div>}
    {entry?.status === 'error' && <div role="alert" className="lesson-status"><p className="error">{entry.error}</p><button className="primary" onClick={onRetry}>Thử lại bài học</button></div>}
    {lesson && entry && <>
      <h2>Mục tiêu học</h2><ul className="lesson-list">{lesson.objectives.map((o, i) => <li key={i}><MathText text={o}/></li>)}</ul>
      {lesson.sections.map((section, i) => <section key={i} className="knowledge-section"><h2>{section.title}</h2><div className="lesson-prose"><MathText text={section.explanation}/></div><Sources pages={section.sourcePages}/></section>)}
      {lesson.formulas.length > 0 && <section><h2>Công thức và ký hiệu</h2>{lesson.formulas.map((f, i) => <div className="formula-card" key={i}><MathText text={f.latex} formula/><p><MathText text={f.meaning}/></p><div className="symbol-table"><table><thead><tr><th>Ký hiệu</th><th>Ý nghĩa</th><th>Đơn vị</th></tr></thead><tbody>{f.symbols.map((s, j) => <tr key={j}><td><MathText text={s.symbol} formula inline/></td><td><MathText text={s.meaning}/></td><td><MathText text={s.unit}/></td></tr>)}</tbody></table></div><Sources pages={f.sourcePages}/></div>)}</section>}
      <h2>Ví dụ từng bước</h2>{lesson.examples.map((example, i) => <div className="example" key={i}><span className="tag">{example.origin === 'document' ? 'VÍ DỤ TRONG PDF' : 'VÍ DỤ BỔ SUNG · KHÔNG TRÍCH TỪ PDF'}</span><h3>{example.title}</h3><p><MathText text={example.problem}/></p><ol className="lesson-list">{example.steps.map((step, j) => <li key={j}><MathText text={step}/></li>)}</ol><p><strong>Kết quả: </strong><MathText text={example.answer}/></p>{example.origin === 'document' && <Sources pages={example.sourcePages}/>}</div>)}
      <h2>Nhầm lẫn thường gặp</h2>{lesson.misconceptions.map((m, i) => <div className="misconception" key={i}><p><strong>Dễ nhầm: </strong><MathText text={m.mistake}/></p><p><strong>Hiểu đúng: </strong><MathText text={m.correction}/></p></div>)}
      <form onSubmit={event => { event.preventDefault(); onSubmit(); }}><div className="section-heading quiz-heading"><div><div className="eyebrow">QUIZ RIÊNG CHO ĐỀ MỤC</div><h2>Kiểm tra kiến thức</h2></div><span>{answered}/5 đã trả lời</span></div>
        {entry.submitted && <div className="result" role="status"><strong>{gradeLesson(lesson.quiz, entry.answers)}/5 câu đúng · {gradeLesson(lesson.quiz, entry.answers) * 2}/10 điểm</strong><span>Đáp án và giải thích ở bên dưới.</span></div>}
        {lesson.quiz.map((q, i) => <fieldset key={q.id}><legend><span>{String(i + 1).padStart(2, '0')}</span><MathText text={q.prompt}/></legend>{q.options.map((option, j) => <label key={j} className={`option ${entry.answers[q.id] === j ? 'chosen' : ''} ${entry.submitted && j === q.correctIndex ? 'correct' : ''} ${entry.submitted && entry.answers[q.id] === j && j !== q.correctIndex ? 'wrong' : ''}`}><input type="radio" aria-label={`${String.fromCharCode(65 + j)}. ${option}`} name={`${selectedId}-${q.id}`} checked={entry.answers[q.id] === j} disabled={entry.submitted} onChange={() => onAnswer(q.id, j)}/><span>{String.fromCharCode(65 + j)}.</span><MathText text={option}/>{entry.submitted && j === q.correctIndex && <b>✓</b>}</label>)}{entry.submitted && <div className="explanation"><strong>{entry.answers[q.id] === q.correctIndex ? 'Chính xác.' : `Đáp án đúng: ${String.fromCharCode(65 + q.correctIndex)}.`} </strong><MathText text={q.explanation}/><Sources pages={q.sourcePages}/></div>}</fieldset>)}
        <div className="quiz-actions">{entry.submitted ? <button type="button" className="primary" onClick={onResetQuiz}>Làm lại quiz ↻</button> : <button type="submit" className="primary" disabled={answered !== 5}>Nộp bài & xem kết quả →</button>}<span>{entry.submitted ? 'Bài học và điểm được giữ khi chuyển đề mục.' : 'Trả lời đủ 5 câu để nộp bài.'}</span></div>
      </form><p className="lesson-footnote">Bài học do AI tạo từ PDF. Hãy đối chiếu kiến thức và trang nguồn với tài liệu gốc.</p>
    </>}
    <TopicVideos entry={videoEntry} onRetry={onRetryVideos}/>
  </article></section>;
}
