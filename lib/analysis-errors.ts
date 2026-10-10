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
  if (status === 429) return new AnalysisError(429, 'QUOTA_EXCEEDED', 'Gemini đang giới hạn lượt gọi hoặc đã hết quota. Kiểm tra quota rồi thử lại sau.');
  if (status === 401 || status === 403) return new AnalysisError(503, 'API_ACCESS_ERROR', 'Gemini từ chối API key hoặc quyền truy cập. Kiểm tra cấu hình backend.');
  if (status === 404) return new AnalysisError(503, 'MODEL_UNAVAILABLE', 'Model Gemini chưa khả dụng. Kiểm tra GEMINI_MODEL trong .env.local.');
  if (status === 400) return new AnalysisError(422, 'DOCUMENT_REJECTED', 'Gemini không xử lý được PDF hoặc cấu hình model. Thử PDF không có mật khẩu, ngắn hơn và kiểm tra GEMINI_MODEL.');
  if (status === 503) return new AnalysisError(503, 'GEMINI_BUSY', 'Gemini đang quá tải hoặc tạm thời không khả dụng. Chờ một chút rồi thử lại.');
  if (status === 504) return new AnalysisError(504, 'GEMINI_TIMEOUT', 'Gemini hết thời gian xử lý tài liệu (90 giây). Vui lòng thử lại hoặc chọn model PDF khác trong cấu hình backend.');
  if (status >= 500 && status <= 599) return new AnalysisError(502, 'GEMINI_SERVER_ERROR', 'Dịch vụ Gemini gặp lỗi khi xử lý tài liệu. Vui lòng thử lại sau.');
  if (value.name === 'AbortError' || value.name === 'TimeoutError' || /timeout|timed out|aborted/i.test(String(value.message ?? ''))) {
    return new AnalysisError(504, 'GEMINI_TIMEOUT', 'Gemini chưa phản hồi trong thời gian cho phép (90 giây). Hãy thử lại hoặc dùng tài liệu ít trang hơn.');
  }
  return new AnalysisError(502, 'GEMINI_NETWORK_ERROR', 'Kết nối từ backend tới Gemini bị gián đoạn. Kiểm tra mạng của máy chạy server rồi thử lại.');
}
