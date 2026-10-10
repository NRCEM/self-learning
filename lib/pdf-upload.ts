import { errorText } from './i18n.ts';
import { PDFDocument } from 'pdf-lib';
import { AnalysisError } from './analysis-errors.ts';
import { MAX_PDF_BYTES, MAX_PDF_BODY_BYTES } from './upload-limits.ts';
function fail(status: number, code: string, message: string): never { throw new AnalysisError(status, code, message); }
export async function readPdfForm(request: Request) {
    if (!request.headers.get('content-type')?.toLowerCase().startsWith('multipart/form-data;')) {
      fail(400, 'INVALID_FORM', errorText('en', 'INVALID_FORM'));
    }
    const length = Number(request.headers.get('content-length'));
    if (length > MAX_PDF_BODY_BYTES) fail(413, 'FILE_TOO_LARGE', errorText('en', 'FILE_TOO_LARGE'));
    if (!request.body) fail(400, 'MISSING_FILE', errorText('en', 'MISSING_FILE'));
    // Bound the actual stream, including requests with no Content-Length.
    const reader = request.body.getReader();
    const chunks: Uint8Array[] = []; let bytes = 0;
    try {
      while (true) {
        const { done, value } = await reader.read(); if (done) break;
        bytes += value.byteLength;
        if (bytes > MAX_PDF_BODY_BYTES) { await reader.cancel(); fail(413, 'FILE_TOO_LARGE', errorText('en', 'FILE_TOO_LARGE')); }
        chunks.push(value);
      }
    } finally { reader.releaseLock(); }
    let form: FormData;
    try { form = await new Response(Buffer.concat(chunks), { headers: { 'Content-Type': request.headers.get('content-type')! } }).formData(); }
    catch { fail(400, 'INVALID_FORM', errorText('en', 'INVALID_FORM')); }
    const entries = form.getAll('file');
    if (entries.length !== 1 || !(entries[0] instanceof File)) fail(400, 'MISSING_FILE', errorText('en', 'MISSING_FILE'));
    const file = entries[0];
    if (!file.size) fail(400, 'EMPTY_FILE', errorText('en', 'EMPTY_FILE'));
    if (file.size > MAX_PDF_BYTES) fail(413, 'FILE_TOO_LARGE', errorText('en', 'FILE_TOO_LARGE'));
    if (!/\.pdf$/i.test(file.name) || (file.type && !['application/pdf', 'application/octet-stream'].includes(file.type))) {
      fail(400, 'INVALID_PDF', errorText('en', 'INVALID_PDF'));
    }
    const pdf = Buffer.from(await file.arrayBuffer());
    if (pdf.subarray(0, 5).toString('ascii') !== '%PDF-') fail(400, 'INVALID_PDF', errorText('en', 'INVALID_PDF'));
let pageCount: number;
    try { pageCount = (await PDFDocument.load(pdf)).getPageCount(); }
    catch { fail(400, 'INVALID_PDF', errorText('en', 'INVALID_PDF')); }
    if (!pageCount) fail(400, 'EMPTY_PDF', errorText('en', 'EMPTY_PDF'));
return { pdf, form, pageCount };
}
