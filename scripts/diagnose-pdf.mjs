// Runs the exact production analyzer or the HTTP endpoint against a supplied PDF.
import env from '@next/env';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve, basename } from 'node:path';
import { createHash } from 'node:crypto';
import { analyzePdf } from '../lib/gemini.ts';
import { analysisSchema } from '../lib/analysis-schema.ts';
import { DEFAULT_GEMINI_MODEL, GEMINI_TIMEOUT_MS, GEMINI_RETRY_ATTEMPTS } from '../lib/gemini-config.ts';
env.loadEnvConfig(process.cwd());
const mode = process.argv[2];
const filename = process.argv[3];
const override = process.argv[4];
if (override) {
  if (!['gemini-3.8-flash', 'gemini-3.5-flash-lite'].includes(override)) throw new Error('Model override is not in the verified free-tier allowlist');
  if (mode !== 'direct') throw new Error('Model override is only allowed for direct mode; endpoint uses server configuration');
  process.env.GEMINI_MODEL = override;
}
if (!['direct', 'endpoint'].includes(mode) || !filename) throw new Error('Usage: node --conditions=react-server --experimental-strip-types scripts/diagnose-pdf.mjs direct|endpoint file.pdf');
const pdf = await readFile(resolve(filename));
const model = process.env.GEMINI_MODEL?.trim() || DEFAULT_GEMINI_MODEL;
if (!['gemini-3.8-flash', 'gemini-3.5-flash-lite'].includes(model)) throw new Error('Model is not in the documented free-tier allowlist');
console.log(JSON.stringify({ mode, file: basename(filename), bytes: pdf.length, sha256: createHash('sha256').update(pdf).digest('hex'), model, sdkTimeoutMs: GEMINI_TIMEOUT_MS, httpTimeoutMs: mode === 'endpoint' ? 110000 : null, retryAttempts: GEMINI_RETRY_ATTEMPTS, outputLimit: 'model default' }));
const started = Date.now();
try {
  let data;
  if (mode === 'direct') data = await analyzePdf(pdf, AbortSignal.timeout(110000));
  else {
    const form = new FormData();form.append('file', new File([pdf], basename(filename), { type: 'application/pdf' }));
    const response = await fetch('http://localhost:3000/api/analyze', { method: 'POST', body: form, signal: AbortSignal.timeout(110000) });
    const body = await response.json();
    console.log(JSON.stringify({ mode, httpStatus: response.status, error: body.error ?? null }));
    if (!response.ok) { process.exitCode = 1; console.log(JSON.stringify({ mode, ok: false, seconds: (Date.now()-started)/1000 })); process.exit(); }
    data = body.data;
  }
  const parsed = analysisSchema.parse(data);
  await mkdir('tmp/diagnostics', { recursive: true });
  await writeFile(`tmp/diagnostics/${mode}-06-light.json`, JSON.stringify(parsed, null, 2));
  console.log(JSON.stringify({ mode, ok: true, seconds: (Date.now()-started)/1000, title: parsed.title, subject: parsed.subject, topicCount: parsed.topics.length, result: `tmp/diagnostics/${mode}-06-light.json` }));
} catch (error) {
  console.log(JSON.stringify({ mode, ok: false, seconds: (Date.now()-started)/1000, code: error.code ?? error.name, message: error.message }));
  process.exitCode = 1;
}
