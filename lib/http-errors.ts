// Hosting-level errors may arrive as HTML or plain text before a route handler runs.
export function responseErrorCode(status: number, payload: unknown): string {
 if (payload && typeof payload === 'object' && 'error' in payload) {
  const error = payload.error;
  if (error && typeof error === 'object' && 'code' in error && typeof error.code === 'string' && /^[A-Z_]{1,80}$/.test(error.code)) return error.code;
 }
 if (status === 413) return 'FILE_TOO_LARGE';
 if (status === 408 || status === 504) return 'TIMEOUT';
 return status >= 500 ? 'HOSTING_UNAVAILABLE' : 'INTERNAL_ERROR';
}
