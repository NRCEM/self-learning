import { errorText } from './i18n.ts';
export class AnalysisError extends Error {
  readonly status: number;
  readonly code: string;
  constructor(status: number, code: string, message: string) {
    super(message); this.status = status; this.code = code;
  }
}

// Extract only Google's JSON error fields; never log arbitrary SDK messages/stacks.
export function getGeminiErrorDetails(error: unknown, apiKey: string) {
  if (!(error instanceof Error)) return null;
  try {
    const upstream = JSON.parse(error.message)?.error;
    if (!upstream || typeof upstream.message !== 'string') return null;
    const message = upstream.message
      .split(apiKey || '\u0000').join('[REDACTED]')
      .replace(/AIza[\w-]+/g, '[REDACTED]')
      .replace(/([?&]key=)[^&\s"']+/gi, '$1[REDACTED]')
      .slice(0, 2000);
    return {
      code: typeof upstream.code === 'number' ? upstream.code : null,
      status: typeof upstream.status === 'string' && /^[A-Z_]+$/.test(upstream.status) ? upstream.status : null,
      message,
    };
  } catch { return null; }
}

export function mapGeminiError(error: unknown): AnalysisError {
  if (error instanceof AnalysisError) return error;
  const value = typeof error === 'object' && error !== null ? error as { status?: unknown; name?: unknown; message?: unknown; cause?: { code?: unknown } } : {};
  const status = Number(value.status);
  if (status === 429) return new AnalysisError(429, 'QUOTA_EXCEEDED', errorText('en', 'QUOTA_EXCEEDED'));
  if (status === 401 || status === 403) return new AnalysisError(503, 'API_ACCESS_ERROR', errorText('en', 'API_ACCESS_ERROR'));
  if (status === 404) return new AnalysisError(503, 'MODEL_UNAVAILABLE', errorText('en', 'MODEL_UNAVAILABLE'));
  if (status === 400) return new AnalysisError(422, 'DOCUMENT_REJECTED', errorText('en', 'DOCUMENT_REJECTED'));
  if (status === 503) return new AnalysisError(503, 'GEMINI_BUSY', errorText('en', 'GEMINI_BUSY'));
  if (status === 504) return new AnalysisError(504, 'GEMINI_TIMEOUT', errorText('en', 'GEMINI_TIMEOUT'));
  if (status >= 500 && status <= 599) return new AnalysisError(502, 'GEMINI_SERVER_ERROR', errorText('en', 'GEMINI_SERVER_ERROR'));
  if (value.name === 'AbortError' || value.name === 'TimeoutError' || /timeout|timed out|aborted/i.test(String(value.message ?? ''))) {
    return new AnalysisError(504, 'GEMINI_TIMEOUT', errorText('en', 'GEMINI_TIMEOUT'));
  }
  return new AnalysisError(502, 'GEMINI_NETWORK_ERROR', errorText('en', 'GEMINI_NETWORK_ERROR'));
}
