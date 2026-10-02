import { z } from 'zod';
const uuid = z.string().uuid();
const timestamp = z.string().datetime({ offset: true });
export const sessionSchema = z
  .object({
    id: uuid,
    locale: z.enum(['ar', 'en']),
    status: z.enum([
      'uploaded',
      'processing',
      'proposed',
      'confirmed',
      'expired',
      'failed'
    ]),
    durationMs: z.number().int().min(1).max(120_000),
    expiresAt: timestamp,
    confirmedAt: timestamp.nullable().optional(),
    failureCode: z.string().max(64).nullable().optional(),
    version: z.number().int().positive(),
    createdAt: timestamp
  })
  .strict();
export const uploadResponseSchema = z
  .object({
    session: sessionSchema,
    upload: z
      .object({
        method: z.literal('PUT'),
        path: z
          .string()
          .regex(/^\/api\/v1\/voice\/sessions\/[0-9a-f-]+\/audio$/u),
        expiresAt: timestamp
      })
      .strict()
  })
  .strict();
export const acceptedWorkSchema = z
  .object({
    id: uuid,
    status: z.enum(['queued', 'processing', 'completed', 'failed', 'cancelled'])
  })
  .strict();
const payloadSchema = z
  .object({
    schemaVersion: z.literal(1),
    type: z.literal('transaction.create'),
    amountMinor: z.string().regex(/^-?[1-9][0-9]{0,18}$/u),
    currency: z.string().regex(/^[A-Z]{3}$/u),
    categoryId: uuid.nullable(),
    accountId: uuid.nullable(),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/u),
    merchant: z.string().max(160).nullable(),
    note: z.string().max(500).nullable(),
    confidence: z.number().min(0).max(1)
  })
  .strict();
export const fieldSchema = z
  .object({
    name: z.enum([
      'amountMinor',
      'currency',
      'categoryId',
      'accountId',
      'date',
      'merchant',
      'note'
    ]),
    value: z.unknown(),
    confidence: z.number().min(0).max(1).nullable(),
    sourceSpan: z.string().max(160).nullable().optional()
  })
  .strict();
export const proposalSchema = z
  .object({
    id: uuid,
    redactedTranscript: z.string().max(16_384),
    schemaVersion: z.literal(1),
    type: z.literal('transaction.create'),
    payload: payloadSchema,
    fields: z.array(fieldSchema).max(10),
    status: z.enum([
      'draft',
      'validated',
      'confirmed',
      'executed',
      'rejected',
      'expired'
    ]),
    expiresAt: timestamp,
    confirmedAt: timestamp.nullable().optional(),
    executedTransactionId: uuid.nullable().optional(),
    version: z.number().int().positive()
  })
  .strict();
export const executedActionSchema = z
  .object({
    sourceId: uuid,
    actionType: z.literal('transaction.create'),
    resourceId: uuid,
    status: z.literal('executed'),
    replayed: z.boolean()
  })
  .strict();

export const recoverySchema = z
  .object({
    phase: z.enum([
      'awaiting_audio',
      'uploaded',
      'queued',
      'processing',
      'proposed',
      'confirming',
      'confirmed',
      'cancelled',
      'expired',
      'failed'
    ]),
    session: sessionSchema,
    proposal: proposalSchema.nullable(),
    recordedAt: timestamp,
    timezoneOffsetMinutes: z.number().int().min(-840).max(840),
    captureContextLegacy: z.boolean(),
    transcriptLanguage: z.enum(['ar', 'en', 'mixed', 'unsupported']).nullable(),
    transcriptConfidence: z.number().min(0).max(1).nullable(),
    transactionId: uuid.nullable()
  })
  .strict();
export const uploadReceiptSchema = z
  .object({
    id: uuid,
    version: z.number().int().positive(),
    contentHash: z.string().regex(/^[0-9a-f]{64}$/u),
    sizeBytes: z.number().int().positive()
  })
  .strict();
