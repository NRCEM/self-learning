import { handleLesson } from '@/lib/lesson-handler';
import { generateLesson } from '@/lib/gemini';
export const runtime = 'nodejs';
export const maxDuration = 120;
export async function POST(request: Request) { return handleLesson(request, generateLesson); }
