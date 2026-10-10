import test from 'node:test';
import assert from 'node:assert/strict';
import {PDFDocument} from 'pdf-lib';
import {MAX_PDF_BYTES,MAX_PDF_BODY_BYTES,MAX_TRANSLATION_BYTES} from '../lib/upload-limits.ts';
import {readPdfForm} from '../lib/pdf-upload.ts';
import {responseErrorCode} from '../lib/http-errors.ts';
import {errorText,translator} from '../lib/i18n.ts';

test('largest accepted PDF plus translation context stays below Vercel payload cap',async()=>{
 const document=await PDFDocument.create();document.addPage();const bytes=await document.save();
 const padded=new Uint8Array(MAX_PDF_BYTES);padded.set(bytes);
 const form=new FormData();form.append('file',new File([padded],'physics.pdf',{type:'application/pdf'}));form.append('language','vi');form.append('kind','lesson');form.append('source',' '.repeat(MAX_TRANSLATION_BYTES));
 const request=new Request('http://local/api/translate',{method:'POST',body:form});
 const serializedBytes=(await request.clone().arrayBuffer()).byteLength;
 assert.ok(serializedBytes<=MAX_PDF_BODY_BYTES);assert.ok(MAX_PDF_BODY_BYTES<4_500_000);
 const result=await readPdfForm(request);assert.equal(result.pdf.length,MAX_PDF_BYTES);assert.equal(result.pageCount,1);
});

test('oversized multipart stream is rejected even without Content-Length',async()=>{
 const request=new Request('http://local/api/analyze',{method:'POST',headers:{'Content-Type':'multipart/form-data; boundary=test'},body:new Uint8Array(MAX_PDF_BODY_BYTES+1)});
 await assert.rejects(readPdfForm(request),error=>error.status===413&&error.code==='FILE_TOO_LARGE');
});

test('non-JSON hosting errors produce localized actionable messages',()=>{
 assert.equal(responseErrorCode(413,null),'FILE_TOO_LARGE');assert.equal(responseErrorCode(504,null),'TIMEOUT');assert.equal(responseErrorCode(502,'Bad gateway'),'HOSTING_UNAVAILABLE');
 assert.equal(responseErrorCode(503,{error:{code:'GEMINI_BUSY'}}),'GEMINI_BUSY');assert.equal(responseErrorCode(500,{error:{code:'<script>secret</script>'}}),'HOSTING_UNAVAILABLE');
 for(const language of ['en','vi']){assert.match(errorText(language,'FILE_TOO_LARGE'),/3 MiB/);assert.match(translator(language)('fileLimit'),/3 MiB/);assert.ok(errorText(language,'HOSTING_UNAVAILABLE').length>20);}
});
