import { PDFDocument } from 'pdf-lib';
import { AnalysisError } from './analysis-errors.ts';
import { MAX_PDF_BYTES } from './analysis-schema.ts';
const MAX_BODY_BYTES = MAX_PDF_BYTES + 64 * 1024;
function fail(status: number, code: string, message: string): never { throw new AnalysisError(status, code, message); }
export async function readPdfForm(request: Request) {
    if (!request.headers.get('content-type')?.toLowerCase().startsWith('multipart/form-data;')) {
      fail(400, 'INVALID_FORM', 'Vui lòng gửi PDF bằng FormData.');
    }
    const length = Number(request.headers.get('content-length'));
    if (length > MAX_BODY_BYTES) fail(413, 'FILE_TOO_LARGE', 'PDF vượt giới hạn 10 MB. Vui lòng chọn file nhỏ hơn.');
    if (!request.body) fail(400, 'MISSING_FILE', 'Vui lòng chọn một file PDF.');
    // Bound the actual stream, including requests with no Content-Length.
    const reader = request.body.getReader();
    const chunks: Uint8Array[] = []; let bytes = 0;
    try {
      while (true) {
        const { done, value } = await reader.read(); if (done) break;
        bytes += value.byteLength;
        if (bytes > MAX_BODY_BYTES) { await reader.cancel(); fail(413, 'FILE_TOO_LARGE', 'PDF vượt giới hạn 10 MB. Vui lòng chọn file nhỏ hơn.'); }
        chunks.push(value);
      }
    } finally { reader.releaseLock(); }
    let form: FormData;
    try { form = await new Response(Buffer.concat(chunks), { headers: { 'Content-Type': request.headers.get('content-type')! } }).formData(); }
    catch { fail(400, 'INVALID_FORM', 'Dữ liệu tải lên không hợp lệ. Vui lòng chọn lại PDF.'); }
    const entries = form.getAll('file');
    if (entries.length !== 1 || !(entries[0] instanceof File)) fail(400, 'MISSING_FILE', 'Vui lòng gửi đúng một file PDF.');
    const file = entries[0];
    if (!file.size) fail(400, 'EMPTY_FILE', 'File PDF đang rỗng. Vui lòng chọn tài liệu có nội dung.');
    if (file.size > MAX_PDF_BYTES) fail(413, 'FILE_TOO_LARGE', 'PDF vượt giới hạn 10 MB. Vui lòng chọn file nhỏ hơn.');
    if (!/\.pdf$/i.test(file.name) || (file.type && !['application/pdf', 'application/octet-stream'].includes(file.type))) {
      fail(400, 'INVALID_PDF', 'File phải có định dạng PDF (.pdf).');
    }
    const pdf = Buffer.from(await file.arrayBuffer());
    if (pdf.subarray(0, 5).toString('ascii') !== '%PDF-') fail(400, 'INVALID_PDF', 'Nội dung file không phải PDF hợp lệ. Vui lòng chọn lại.');
let pageCount: number;
    try { pageCount = (await PDFDocument.load(pdf)).getPageCount(); }
    catch { fail(400, 'INVALID_PDF', 'Không đọc được PDF. Vui lòng chọn tài liệu không bị hỏng và không có mật khẩu.'); }
    if (!pageCount) fail(400, 'EMPTY_PDF', 'PDF không có trang. Vui lòng chọn tài liệu có nội dung.');
return { pdf, form, pageCount };
}
