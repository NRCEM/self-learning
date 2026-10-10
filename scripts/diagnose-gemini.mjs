// Backend-only diagnostic. One attempt per stage; no PDF from the user is used.
import env from '@next/env';
import { GoogleGenAI } from '@google/genai';
import { analysisJsonSchema, analysisSchema } from '../lib/analysis-schema.ts';
import { DEFAULT_GEMINI_MODEL } from '../lib/gemini-config.ts';
env.loadEnvConfig(process.cwd());
const apiKey = process.env.GEMINI_API_KEY?.trim();
if (!apiKey) throw new Error('GEMINI_API_KEY is missing');
const currentModel = process.env.GEMINI_MODEL?.trim() || DEFAULT_GEMINI_MODEL;
if (!['gemini-3.8-flash', 'gemini-3.5-flash-lite'].includes(currentModel)) throw new Error('Configured model is not in the verified free-tier allowlist');
const pdfOnly = process.argv.includes('--pdf-only');
const alternative = process.argv.slice(2).find(arg => arg !== '--pdf-only');
// Only the documented free-tier alternative is permitted by this diagnostic.
if (alternative && alternative !== 'gemini-3.5-flash-lite') throw new Error('Alternative model is not in the verified free-tier allowlist');
const ai = new GoogleGenAI({ apiKey, httpOptions: { timeout: pdfOnly ? 90_000 : 45_000, retryOptions: { attempts: 1 } } });
function redact(value) {
  return String(value ?? '').split(apiKey).join('[REDACTED]').replace(/AIza[\w-]+/g, '[REDACTED]').replace(/([?&]key=)[^&\s"']+/gi, '$1[REDACTED]');
}
function errorDetail(error) {
  let upstream; try { upstream = JSON.parse(error.message).error; } catch {}
  return { httpStatus: error.status ?? null, apiStatus: upstream?.status ?? null, message: redact(upstream?.message ?? error.message).slice(0, 2000) };
}
// Valid, one-page PDF with ordinary public diagnostic text and correct xref offsets.
function tinyPdf() {
  const text = 'BT /F1 14 Tf 50 750 Td (Algebra basics: A linear equation has the form ax+b=0.) Tj ET';
  const objects = ['<< /Type /Catalog /Pages 2 0 R >>', '<< /Type /Pages /Kids [3 0 R] /Count 1 >>', '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>', '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>', `<< /Length ${Buffer.byteLength(text)} >>\nstream\n${text}\nendstream`];
  let pdf = '%PDF-1.4\n'; const offsets = [0];
  objects.forEach((object, i) => { offsets.push(Buffer.byteLength(pdf)); pdf += `${i + 1} 0 obj\n${object}\nendobj\n`; });
  const start = Buffer.byteLength(pdf);
  pdf += `xref\n0 6\n0000000000 65535 f \n${offsets.slice(1).map(o => `${String(o).padStart(10, '0')} 00000 n \n`).join('')}trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${start}\n%%EOF\n`;
  return Buffer.from(pdf);
}
async function run(model, stage, contents, config = {}) {
  const start = Date.now();
  try {
    const result = await ai.models.generateContent({ model, contents, config: { maxOutputTokens: 2048, ...config } });
    const text = result.text;
    if (!text || result.candidates?.[0]?.finishReason !== 'STOP') throw new Error('No complete response: ' + result.candidates?.[0]?.finishReason);
    if (stage === 'structured') { if (JSON.parse(text).answer !== 'OK') throw new Error('Unexpected structured answer'); }
    if (stage === 'pdf') { analysisSchema.parse(JSON.parse(text)); }
    console.log(JSON.stringify({ model, stage, ok: true, seconds: (Date.now() - start) / 1000, response: text.slice(0, 1500) }));
    return { ok: true, stage };
  } catch (error) {
    const detail = errorDetail(error);
    console.log(JSON.stringify({ model, stage, ok: false, seconds: (Date.now() - start) / 1000, ...detail }));
    return { ok: false, status: detail.httpStatus, stage };
  }
}
async function sequence(model) {
  const plain = await run(model, 'text', 'Reply with only OK.');
  if (!plain.ok) { console.log(JSON.stringify({ model, skipped: ['structured', 'pdf'], reason: 'Plain text already failed' })); return plain; }
  const structured = await run(model, 'structured', 'Return an object with answer equal to OK.', { responseMimeType: 'application/json', responseJsonSchema: { type: 'object', properties: { answer: { type: 'string' } }, required: ['answer'] } });
  if (!structured.ok) { console.log(JSON.stringify({ model, skipped: ['pdf'], reason: 'Structured output failed' })); return structured; }
  return run(model, 'pdf', [{ inlineData: { mimeType: 'application/pdf', data: tinyPdf().toString('base64') } }, { text: 'Create a Vietnamese learning overview from this PDF only. Return title, subject, summary, topics with unique id, name, description and sourcePages counted from 1.' }], { responseMimeType: 'application/json', responseJsonSchema: analysisJsonSchema });
}
const result = pdfOnly
  ? await run(currentModel, 'pdf', [{ inlineData: { mimeType: 'application/pdf', data: tinyPdf().toString('base64') } }, { text: 'Create a Vietnamese learning overview from this PDF only. Return title, subject, summary, topics with unique id, name, description and sourcePages counted from 1.' }], { responseMimeType: 'application/json', responseJsonSchema: analysisJsonSchema })
  : await sequence(currentModel);
if (!result.ok && result.stage === 'text' && result.status === 503 && alternative) {
  try {
    const model = await ai.models.get({ model: alternative });
    console.log(JSON.stringify({ alternative, accessible: true, methods: model.supportedGenerationMethods }));
    await sequence(alternative);
  } catch (error) { console.log(JSON.stringify({ alternative, accessible: false, ...errorDetail(error) })); }
}
