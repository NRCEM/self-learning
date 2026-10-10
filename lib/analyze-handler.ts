import { errorText } from './i18n.ts';
import { readLanguage, type Language } from './language.ts';
import { AnalysisError } from './analysis-errors.ts';
import { analysisSchema } from './analysis-schema.ts';
import { readPdfForm } from './pdf-upload.ts';

type Analyzer = (pdf: Buffer, signal: AbortSignal, language: Language) => Promise<unknown>;

function fail(status: number, code: string, message: string): never { throw new AnalysisError(status, code, message); }

export async function handleAnalyze(request: Request, analyze: Analyzer): Promise<Response> {
  try {
    const { pdf, form, pageCount } = await readPdfForm(request);
    const result = analysisSchema.safeParse(await analyze(pdf, request.signal, readLanguage(form)));
    if (!result.success) fail(502, 'INVALID_RESULT', errorText('en', 'INVALID_RESULT'));
    if (result.data.topics.some(topic => topic.sourcePages?.some(page => page > pageCount))) fail(502, 'INVALID_SOURCE_PAGES', errorText('en', 'INVALID_SOURCE_PAGES'));
    return Response.json({ data: result.data }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    const known = error instanceof AnalysisError ? error : new AnalysisError(500, 'INTERNAL_ERROR', errorText('en', 'INTERNAL_ERROR'));
    // Never send upstream error bodies, PDF data or credentials to the browser/logs.
    return Response.json({ error: { code: known.code, message: known.message } }, { status: known.status, headers: { 'Cache-Control': 'no-store' } });
  }
}
