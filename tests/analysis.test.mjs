import { PDFDocument } from 'pdf-lib';
import test from 'node:test';
import assert from 'node:assert/strict';
import { handleAnalyze } from '../lib/analyze-handler.ts';
import { analysisSchema, MAX_PDF_BYTES } from '../lib/analysis-schema.ts';
import { AnalysisError, mapGeminiError, getGeminiErrorDetails } from '../lib/analysis-errors.ts';
import { analyzePdf } from '../lib/gemini.ts';
import { gradeQuiz } from '../lib/demo-data.ts';

const valid = { title: 'Đại số', subject: 'Toán học', summary: 'Giới thiệu phương trình.', topics: [{ id: 'equations', name: 'Phương trình', description: 'Giải phương trình bậc nhất.', sourcePages: [1, 2] }] };
function upload(file) {
  const form = new FormData(); if (file !== undefined) form.append('file', file);
  return new Request('http://localhost/api/analyze', { method: 'POST', body: form });
}
const fixtureDocument = await PDFDocument.create();fixtureDocument.addPage();fixtureDocument.addPage();const fixtureBytes = await fixtureDocument.save();
const pdf = () => new File([fixtureBytes], 'math.pdf', { type: 'application/pdf' });
test('backend upstream diagnostics preserve original code/status but redact keys', () => {
  const error = new Error(JSON.stringify({ error: { code: 503, status: 'UNAVAILABLE', message: 'ServiceUnavailable: fake-secret https://example.test?key=another-secret' }, request: { pdf: 'private-file' } }));
  const details = getGeminiErrorDetails(error, 'fake-secret');
  assert.equal(details.code, 503); assert.equal(details.status, 'UNAVAILABLE');
  assert.ok(details.message.includes('ServiceUnavailable'));
  assert.ok(!JSON.stringify(details).includes('fake-secret'));
  assert.ok(!JSON.stringify(details).includes('another-secret'));
  assert.ok(!JSON.stringify(details).includes('private-file'));
});
test('diagnostics never emit arbitrary SDK messages or stacks', () => {
  assert.equal(getGeminiErrorDetails(new Error('private PDF bytes'), 'key'), null);
  assert.equal(getGeminiErrorDetails({ message: 'secret' }, 'key'), null);
});
test('Gemini errors distinguish overload, server error, timeout and network', () => {
  assert.equal(mapGeminiError({ status: 503 }).code, 'GEMINI_BUSY');
  assert.equal(mapGeminiError({ status: 504 }).code, 'GEMINI_TIMEOUT');
  assert.equal(mapGeminiError({ status: 504 }).status, 504);
  assert.equal(mapGeminiError({ status: 500 }).code, 'GEMINI_SERVER_ERROR');
  assert.equal(mapGeminiError({ name: 'TimeoutError' }).status, 504);
  assert.equal(mapGeminiError({ name: 'AbortError' }).code, 'GEMINI_TIMEOUT');
  assert.equal(mapGeminiError(new TypeError('fetch failed')).code, 'GEMINI_NETWORK_ERROR');
  assert.equal(mapGeminiError({ status: 429 }).code, 'QUOTA_EXCEEDED');
  assert.equal(mapGeminiError({ status: 403 }).code, 'API_ACCESS_ERROR');
  assert.equal(mapGeminiError({ status: 404 }).code, 'MODEL_UNAVAILABLE');
  assert.equal(mapGeminiError({ status: 400 }).code, 'DOCUMENT_REJECTED');
});
async function rejected(request, status, code) {
  let called = false;
  const response = await handleAnalyze(request, async () => { called = true; return valid; });
  assert.equal(response.status, status); assert.equal((await response.json()).error.code, code);
  assert.equal(called, false, 'invalid uploads must never reach Gemini');
}
test('validated real result reaches frontend, preserving topic and pages', async () => {
  const response = await handleAnalyze(upload(pdf()), async (bytes, signal) => {
    assert.equal(bytes.subarray(0, 5).toString(), '%PDF-'); assert.ok(signal instanceof AbortSignal); return valid;
  });
  assert.equal(response.status, 200); assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.deepEqual((await response.json()).data, valid);
});
test('missing file', () => rejected(upload(), 400, 'MISSING_FILE'));
test('string instead of file', () => rejected(upload('fake.pdf'), 400, 'MISSING_FILE'));
test('empty PDF', () => rejected(upload(new File([], 'empty.pdf', { type: 'application/pdf' })), 400, 'EMPTY_FILE'));
test('non-PDF extension', () => rejected(upload(new File(['%PDF-'], 'file.txt', { type: 'application/pdf' })), 400, 'INVALID_PDF'));
test('spoofed PDF content', () => rejected(upload(new File(['hello'], 'fake.pdf', { type: 'application/pdf' })), 400, 'INVALID_PDF'));
test('incorrect MIME', () => rejected(upload(new File(['%PDF-'], 'file.pdf', { type: 'image/png' })), 400, 'INVALID_PDF'));
test('hosting PDF file limit enforced without content-length', () => rejected(upload(new File([new Uint8Array(MAX_PDF_BYTES + 1)], 'big.pdf', { type: 'application/pdf' })), 413, 'FILE_TOO_LARGE'));
test('stream limit enforced without trusting headers', () => rejected(upload(new File([new Uint8Array(MAX_PDF_BYTES + 100_000)], 'big.pdf')), 413, 'FILE_TOO_LARGE'));
test('early declared body limit', () => {
  const request = upload(pdf()); request.headers.set('content-length', String(MAX_PDF_BYTES * 2));
  return rejected(request, 413, 'FILE_TOO_LARGE');
});
test('malformed multipart', () => rejected(new Request('http://localhost/api/analyze', { method: 'POST', headers: { 'content-type': 'multipart/form-data; boundary=test' }, body: 'broken' }), 400, 'INVALID_FORM'));
test('wrong body format', () => rejected(new Request('http://localhost/api/analyze', { method: 'POST', body: '{}' }), 400, 'INVALID_FORM'));
test('multiple files', () => {
  const form = new FormData(); form.append('file', pdf()); form.append('file', pdf());
  return rejected(new Request('http://localhost/api/analyze', { method: 'POST', body: form }), 400, 'MISSING_FILE');
});
test('invalid Gemini schema never becomes a successful overview', async () => {
  for (const result of [null, {}, { ...valid, topics: [] }, { ...valid, topics: [valid.topics[0], valid.topics[0]] }, { ...valid, title: '   ' }, { ...valid, topics: [{ ...valid.topics[0], sourcePages: [0, 1.5] }] }]) {
    const response = await handleAnalyze(upload(pdf()), async () => result);
    assert.equal(response.status, 502); const body = await response.json();
    assert.equal(body.error.code, 'INVALID_RESULT'); assert.equal(body.data, undefined);
  }
});
test('unknown source pages supported explicitly', () => {
  assert.ok(analysisSchema.safeParse({ ...valid, topics: [{ ...valid.topics[0], sourcePages: null }] }).success);
});
test('quota/API/timeout errors preserve failure without demo fallback', async () => {
  for (const [status, code] of [[429, 'QUOTA_EXCEEDED'], [503, 'API_ACCESS_ERROR'], [502, 'GEMINI_UNAVAILABLE']]) {
    const response = await handleAnalyze(upload(pdf()), async () => { throw new AnalysisError(status, code, 'Vui lòng thử lại.'); });
    assert.equal(response.status, status); const body = await response.json(); assert.equal(body.error.code, code); assert.equal(body.data, undefined);
  }
});
test('unexpected internal errors do not expose credentials or upstream messages', async () => {
  const response = await handleAnalyze(upload(pdf()), async () => { throw new Error('secret-api-key PDF bytes'); });
  assert.equal(response.status, 500); assert.ok(!(await response.text()).includes('secret-api-key'));
});
test('missing backend key produces actionable error without network', async () => {
  const original = process.env.GEMINI_API_KEY;
  delete process.env.GEMINI_API_KEY;
  try { await assert.rejects(analyzePdf(Buffer.from('%PDF-'), new AbortController().signal), error => error instanceof AnalysisError && error.code === 'MISSING_API_KEY'); }
  finally { if (original !== undefined) process.env.GEMINI_API_KEY = original; }
});
test('existing demo scoring still works', () => {
  assert.equal(gradeQuiz({0:1,1:2,2:0,3:3,4:1}), 5); assert.equal(gradeQuiz({0:0,1:0,2:0,3:0,4:0}), 1); assert.equal(gradeQuiz({}), 0);
});

test('broken PDF with correct signature rejected before Gemini',async()=>{let calls=0;const response=await handleAnalyze(upload(new File(['%PDF-1.7\nbroken'],'broken.pdf',{type:'application/pdf'})),async()=>{calls++;return valid;});assert.equal(response.status,400);assert.equal(calls,0);});
test('overview source page beyond PDF rejected',async()=>{const response=await handleAnalyze(upload(pdf()),async()=>({...valid,topics:[{...valid.topics[0],sourcePages:[3]}]}));assert.equal(response.status,502);assert.equal((await response.json()).error.code,'INVALID_SOURCE_PAGES');});
