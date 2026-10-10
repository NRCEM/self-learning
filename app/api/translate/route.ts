import { handleTranslate } from '@/lib/translate-handler';
import { translateContent } from '@/lib/gemini';
export const runtime = 'nodejs';
export const maxDuration = 120;
export async function POST(request: Request) { return handleTranslate(request, translateContent); }
