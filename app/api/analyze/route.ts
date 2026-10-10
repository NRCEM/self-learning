import { handleAnalyze } from '@/lib/analyze-handler';
import { analyzePdf } from '@/lib/gemini';

export const runtime = 'nodejs';
export const maxDuration = 120;
export async function POST(request: Request) { return handleAnalyze(request, analyzePdf); }
