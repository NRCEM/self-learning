import { z } from 'zod';

export { MAX_PDF_BYTES } from './upload-limits.ts';
export const topicSchema = z.strictObject({
  id: z.string().trim().min(1).max(80),
  name: z.string().trim().min(1).max(200),
  description: z.string().trim().min(1).max(1200),
  sourcePages: z.array(z.number().int().min(1).max(1000)).max(100).nullable(),
});
export const analysisSchema = z.strictObject({
  title: z.string().trim().min(1).max(300),
  subject: z.string().trim().min(1).max(200),
  summary: z.string().trim().min(1).max(8000),
  topics: z.array(topicSchema).min(1).max(30),
}).refine(data => new Set(data.topics.map(topic => topic.id)).size === data.topics.length, {
  message: 'Topic IDs must be unique', path: ['topics'],
});
export type DocumentAnalysis = z.infer<typeof analysisSchema>;

// Kept separate from runtime refinements so Gemini receives a supported JSON Schema.
export const analysisJsonSchema = {
  type: 'object', additionalProperties: false,
  required: ['title', 'subject', 'summary', 'topics'],
  properties: {
    title: { type: 'string' }, subject: { type: 'string' }, summary: { type: 'string' },
    topics: {
      type: 'array', minItems: 1, maxItems: 30,
      items: {
        type: 'object', additionalProperties: false,
        required: ['id', 'name', 'description', 'sourcePages'],
        properties: {
          id: { type: 'string' }, name: { type: 'string' }, description: { type: 'string' },
          sourcePages: { type: ['array', 'null'], items: { type: 'integer', minimum: 1, maximum: 1000 } },
        },
      },
    },
  },
};
