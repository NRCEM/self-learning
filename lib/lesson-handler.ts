import { readPdfForm } from './pdf-upload.ts';
import { topicSchema } from './analysis-schema.ts';
import { AnalysisError } from './analysis-errors.ts';
import { lessonSchema, lessonFitsContext } from './lesson-schema.ts';
import type { DocumentAnalysis } from './analysis-schema.ts';
type Generator = (pdf: Buffer, topic: DocumentAnalysis['topics'][number], signal: AbortSignal) => Promise<unknown>;
export async function handleLesson(request: Request, generate: Generator) {
  try {
    const { pdf, form, pageCount } = await readPdfForm(request);
    let input: unknown;
    try { const raw = form.getAll('topic'); if (raw.length !== 1 || typeof raw[0] !== 'string') throw new Error(); input = JSON.parse(raw[0]); }
    catch { throw new AnalysisError(400, 'INVALID_TOPIC', 'Đề mục gửi lên không hợp lệ. Hãy quay lại tổng quan và chọn lại.'); }
    const topic = topicSchema.safeParse(input);
    if (!topic.success) throw new AnalysisError(400, 'INVALID_TOPIC', 'Đề mục gửi lên chưa đúng cấu trúc.');
    if (!pageCount || topic.data.sourcePages?.some(page => page > pageCount)) throw new AnalysisError(400, 'INVALID_SOURCE_PAGES', 'Trang nguồn của đề mục không có trong PDF. Hãy phân tích lại tài liệu.');
    const result = lessonSchema.safeParse(await generate(pdf, topic.data, request.signal));
    if (!result.success || !lessonFitsContext(result.data, topic.data.id, pageCount)) throw new AnalysisError(502, 'INVALID_LESSON', 'Bài học trả về chưa đúng cấu trúc, đề mục hoặc trang nguồn. Vui lòng thử lại.');
    return Response.json({ data: result.data }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    const known = error instanceof AnalysisError ? error : new AnalysisError(500, 'INTERNAL_ERROR', 'Không thể tạo bài học lúc này. Vui lòng thử lại.');
    return Response.json({ error: { code: known.code, message: known.message } }, { status: known.status, headers: { 'Cache-Control': 'no-store' } });
  }
}
