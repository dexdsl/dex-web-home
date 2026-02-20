import { z } from 'zod';

export const BUCKETS = ['A', 'B', 'C', 'D', 'E', 'X'];

const linkSchema = z.object({ label: z.string().min(1), href: z.string().min(1) });
const personSchema = z.object({ name: z.string().default(''), links: z.array(linkSchema).default([]) });

export const sidebarConfigSchema = z.object({
  lookupNumber: z.string().min(1),
  buckets: z.array(z.enum(BUCKETS)).min(1),
  specialEventImage: z.string().nullable().optional(),
  attributionSentence: z.string().min(1),
  credits: z.object({
    artist: personSchema,
    artistAlt: z.string().nullable().optional(),
    instruments: z.array(personSchema).default([]),
    video: z.object({ director: personSchema, cinematography: personSchema, editing: personSchema }),
    audio: z.object({ recording: personSchema, mix: personSchema, master: personSchema }),
    year: z.number().int(),
    season: z.string().min(1),
    location: z.string().min(1),
  }),
  fileSpecs: z.object({
    bitDepth: z.number().int().default(24),
    sampleRate: z.number().int().default(48000),
    channels: z.enum(['mono', 'stereo', 'multichannel']).default('stereo'),
    staticSizes: z.object({ A: z.string().default(''), B: z.string().default(''), C: z.string().default(''), D: z.string().default(''), E: z.string().default(''), X: z.string().default('') }),
  }),
  metadata: z.object({ sampleLength: z.string().default(''), tags: z.array(z.string()).default([]) }),
});

export const entrySchema = z.object({
  slug: z.string().min(1),
  title: z.string().min(1),
  video: z.object({ mode: z.enum(['url', 'embed']), dataUrl: z.string().default(''), dataHtml: z.string().default('') }),
  sidebarPageConfig: sidebarConfigSchema,
});

export function manifestSchemaForFormats(audioKeys = [], videoKeys = []) {
  const recordFor = (keys) => (keys.length
    ? z.object(Object.fromEntries(keys.map((k) => [k, z.string().default('')]))).passthrough()
    : z.record(z.string(), z.string().default('')));
  return z.object({ audio: z.record(recordFor(audioKeys)).default({}), video: z.record(recordFor(videoKeys)).default({}) });
}

export function slugify(input) {
  return String(input).toLowerCase().replace(/[\s_]+/g, '-').replace(/[^a-z0-9-]/g, '').replace(/-+/g, '-').replace(/^-|-$/g, '');
}

export function formatZodError(error, where) {
  return `${where}: ${error.issues.map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`).join('; ')}`;
}
