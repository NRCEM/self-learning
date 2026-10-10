import { AnalysisError } from './analysis-errors.ts';
import { analysisSchema } from './analysis-schema.ts';
import { readPdfForm } from './pdf-upload.ts';

type Analyzer = (pdf: Buffer, signal: AbortSignal) => Promise<unknown>;

function fail(status: number, code: string, message: string): never { throw new AnalysisError(status, code, message); }

export async function handleAnalyze(request: Request, analyze: Analyzer): Promise<Response> {
  try {
    const { pdf, pageCount } = await readPdfForm(request);
    const result = analysisSchema.safeParse(await analyze(pdf, request.signal));
    if (!result.success) fail(502, 'INVALID_RESULT', 'Gemini trả kết quả chưa đúng cấu trúc. Vui lòng thử lại.');
    if (result.data.topics.some(topic => topic.sourcePages?.some(page => page > pageCount))) fail(502, 'INVALID_SOURCE_PAGES', 'Gemini trả trang nguồn không có trong PDF. Vui lòng thử lại phân tích.');
    return Response.json({ data: result.data }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    const known = error instanceof AnalysisError ? error : new AnalysisError(500, 'INTERNAL_ERROR', 'Không thể xử lý tài liệu lúc này. Vui lòng thử lại.');
    // Never send upstream error bodies, PDF data or credentials to the browser/logs.
    return Response.json({ error: { code: known.code, message: known.message } }, { status: known.status, headers: { 'Cache-Control': 'no-store' } });
  }
}
