import { parseVoiceWorkerOutput, type VoiceWorkerOutput } from './ai.schemas';

// Transport only: basic typed fields avoid relying on Vertex union/constraint translation.
const properties = {
  outcome: { type: 'string', enum: ['supported', 'unsupported'] },
  transcript: { type: 'string' },
  language: { type: 'string', enum: ['ar', 'en'] },
  confidence: { type: 'number', description: 'Transcript confidence from 0 to 1.' },
  unsupportedReason: {
    type: 'string',
    description: 'Empty for supported; otherwise transfer, multiple, obligation, or unclear.',
  },
  amountMinor: {
    type: 'string',
    description:
      'Signed integer minor units: expenses positive, income negative. Empty if unsupported.',
  },
  currency: {
    type: 'string',
    description: 'Three uppercase currency letters; empty if unsupported.',
  },
  accountId: { type: 'string', description: 'Supplied ACCOUNT alias; empty if unsupported.' },
  categoryId: {
    type: 'string',
    description: 'Supplied CATEGORY alias; empty if absent or unsupported.',
  },
  date: {
    type: 'string',
    description: 'YYYY-MM-DD using supplied capture context; empty if unsupported.',
  },
  merchant: { type: 'string', description: 'Empty if absent or unsupported.' },
  note: { type: 'string', description: 'Empty if absent or unsupported.' },
  proposalConfidence: {
    type: 'number',
    description: 'Proposal confidence from 0 to 1; zero if unsupported.',
  },
} as const;

export const VERTEX_VOICE_OUTPUT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: Object.keys(properties),
  properties,
} as const;

const financialFields = [
  'amountMinor',
  'currency',
  'accountId',
  'categoryId',
  'date',
  'merchant',
  'note',
] as const;

export function normalizeVertexVoiceOutput(input: unknown): VoiceWorkerOutput {
  if (!input || typeof input !== 'object' || Array.isArray(input))
    throw new Error('AI_SCHEMA_INVALID');
  const value = input as Record<string, unknown>;
  const keys = Object.keys(value);
  const expected = VERTEX_VOICE_OUTPUT_SCHEMA.required;
  if (
    keys.length !== expected.length ||
    keys.some((key) => !expected.includes(key)) ||
    ['outcome', 'transcript', 'language', 'unsupportedReason', ...financialFields].some(
      (key) => typeof value[key] !== 'string',
    ) ||
    ['confidence', 'proposalConfidence'].some(
      (key) => typeof value[key] !== 'number' || !Number.isFinite(value[key]),
    )
  )
    throw new Error('AI_SCHEMA_INVALID');

  const common = {
    schemaVersion: 1,
    outcome: value.outcome,
    transcript: value.transcript,
    language: value.language,
    confidence: value.confidence,
  };
  if (value.outcome === 'unsupported') {
    if (financialFields.some((key) => value[key] !== '') || value.proposalConfidence !== 0)
      throw new Error('AI_SCHEMA_INVALID');
    return parseVoiceWorkerOutput({ ...common, unsupportedReason: value.unsupportedReason });
  }
  if (value.outcome !== 'supported' || value.unsupportedReason !== '')
    throw new Error('AI_SCHEMA_INVALID');

  return parseVoiceWorkerOutput({
    ...common,
    proposal: {
      schemaVersion: 1,
      type: 'transaction.create',
      amountMinor: value.amountMinor,
      currency: value.currency,
      accountId: value.accountId,
      categoryId: value.categoryId === '' ? null : value.categoryId,
      date: value.date,
      merchant: value.merchant === '' ? null : value.merchant,
      note: value.note === '' ? null : value.note,
      confidence: value.proposalConfidence,
    },
  });
}
