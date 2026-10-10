import type { DocumentAnalysis } from '@/lib/analysis-schema';

export function DocumentOverview({ analysis, onSelect }: { analysis: DocumentAnalysis; onSelect: (id: string) => void }) {
  return <section>
    <span className="tag">{analysis.subject} · PHÂN TÍCH TỪ PDF</span>
    <h1 className="overview-title">{analysis.title}</h1>
    <p>Tổng quan được Gemini tạo từ tài liệu bạn đã chọn.</p>
    <div className="summary">
      <div><div className="eyebrow">TÓM TẮT TÀI LIỆU</div><h2>Những ý chính</h2><p className="analysis-summary">{analysis.summary}</p></div>
      <div className="stats"><b>{String(analysis.topics.length).padStart(2, '0')}<span>đề mục từ PDF</span></b></div>
    </div>
    <div className="section-heading"><h2>Đề mục trong tài liệu</h2><span>Trang nguồn tính từ trang đầu PDF</span></div>
    <div className="topic-grid">{analysis.topics.map((topic, index) => <button type="button" key={topic.id} className="topic-card" onClick={() => onSelect(topic.id)}>
      <div className="topic-number">{String(index + 1).padStart(2, '0')}</div>
      <h3>{topic.name}</h3><p>{topic.description}</p>
      <div className="topic-meta">{topic.sourcePages?.length ? `Trang ${topic.sourcePages.join(', ')}` : 'Chưa xác định được trang nguồn'}</div>
      <small className="pending-label">Mở bài học & quiz →</small>
    </button>)}</div>
    <p className="lesson-footnote">Bài học chỉ được tạo khi anh chọn đề mục. Bài đã tạo được giữ trong phiên. Video liên quan được tìm riêng khi mở đề mục.</p>
  </section>;
}
