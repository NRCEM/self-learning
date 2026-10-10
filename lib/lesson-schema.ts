import { z } from 'zod';
const text = z.string().trim().min(1).max(6000);
const pages = z.array(z.number().int().min(1).max(1000)).max(100).nullable();
const questionSchema = z.strictObject({
  id: z.string().trim().min(1).max(80), prompt: text,
  options: z.array(z.string().trim().min(1).max(1500)).length(4),
  correctIndex: z.number().int().min(0).max(3), explanation: text, sourcePages: pages,
});
export const lessonBaseSchema = z.strictObject({
  topicId: z.string().trim().min(1).max(80), title: z.string().trim().min(1).max(300),
  objectives: z.array(text).min(1).max(8),
  sections: z.array(z.strictObject({ title: text, explanation: text, sourcePages: pages })).min(1).max(10),
  formulas: z.array(z.strictObject({
    latex: text, meaning: text, sourcePages: pages,
    symbols: z.array(z.strictObject({ symbol: text, meaning: text, unit: text })).min(1).max(15),
  })).max(10),
  examples: z.array(z.strictObject({
    title: text, origin: z.enum(['document', 'supplementary']), sourcePages: pages,
    problem: text, steps: z.array(text).min(1).max(12), answer: text,
  })).min(1).max(4),
  misconceptions: z.array(z.strictObject({ mistake: text, correction: text })).min(1).max(8),
  quiz: z.array(questionSchema).length(5),
});
export const lessonSchema = lessonBaseSchema
  .refine(data => new Set(data.quiz.map(q => q.id)).size === 5, { message: 'Question IDs must be unique', path: ['quiz'] })
  .refine(data => data.quiz.every(q => new Set(q.options.map(s => s.toLocaleLowerCase())).size === 4), { message: 'Quiz options must be distinct', path: ['quiz'] })
  .refine(data => data.examples.every(e => e.origin !== 'supplementary' || e.sourcePages === null), { message: 'Supplementary examples cannot claim PDF pages', path: ['examples'] });
export const lessonJsonSchema = compactSchema(z.toJSONSchema(lessonBaseSchema)) as object;
export type Lesson = z.infer<typeof lessonSchema>;
export function lessonFitsContext(lesson: Lesson, topicId: string, pageCount: number) {
  const lists = [...lesson.sections, ...lesson.formulas, ...lesson.examples, ...lesson.quiz];
  return lesson.topicId === topicId && lists.every(item => !item.sourcePages || item.sourcePages.every(page => page <= pageCount));
}
export function gradeLesson(quiz: Lesson['quiz'], answers: Record<string, number>) {
  return quiz.reduce((score, q) => score + Number(answers[q.id] === q.correctIndex), 0);
}
// Keep Gemini's generation schema compact; enforce all bounds/refinements with Zod.
function compactSchema(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(compactSchema);
  if (!value || typeof value !== 'object') return value;
  const node = value as Record<string, unknown>;
  if (Array.isArray(node.anyOf) && node.anyOf.length === 2) {
    const branches = node.anyOf as Record<string, unknown>[];
    const nonNull = branches.find(branch => branch.type !== 'null');
    if (nonNull && branches.some(branch => branch.type === 'null')) return { ...(compactSchema(nonNull) as object), type: [nonNull.type, 'null'] };
  }
  return Object.fromEntries(Object.entries(node).filter(([key]) => !['$schema', 'minLength', 'maxLength', 'minItems', 'maxItems'].includes(key)).map(([key, child]) => [key, compactSchema(child)]));
}
