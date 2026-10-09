import { z } from 'zod';
import { transactionSources } from '../../domain/core-finance';

const uuid = z.string().uuid();
const instant = z.string().datetime({ offset: true });
const nullableInstant = instant.nullable();
const safeMinor = z.number().int().safe();

export const serverKind = z.enum([
  'income',
  'expense',
  'transfer',
  'opening',
  'refund',
  'reversal',
  'adjustment'
]);
export const serverStatus = z.enum([
  'draft',
  'pending',
  'confirmed',
  'reversed',
  'deleted'
]);
export const ledgerSummarySchema = z
  .object({
    id: uuid,
    kind: serverKind,
    status: serverStatus,
    amountMinor: safeMinor.positive(),
    currency: z.string().regex(/^[A-Z]{3}$/u),
    accountIds: z
      .array(uuid)
      .min(1)
      .max(3)
      .refine((ids) => new Set(ids).size === ids.length),
    sourceAccountId: uuid,
    destinationAccountId: uuid.nullable(),
    feeMinor: safeMinor.nonnegative(),
    categoryId: uuid.nullable().optional().default(null),
    title: z.string().min(1).max(160),
    merchant: z.string().max(160).nullable().optional().default(null),
    paymentMethod: z.string().max(80).nullable().optional().default(null),
    note: z.string().max(500).nullable().optional().default(null),
    occurredAt: instant,
    source: z.enum(transactionSources),
    originalTransactionId: uuid.nullable().optional().default(null),
    version: z.number().int().safe().positive(),
    deletedAt: nullableInstant.optional().default(null),
    undoExpiresAt: nullableInstant.optional().default(null)
  })
  .strict();
const postingSchema = z
  .object({
    id: uuid,
    accountId: uuid,
    amountMinor: safeMinor,
    clearingState: z.enum(['pending', 'confirmed']),
    postingRole: z.enum([
      'source',
      'destination',
      'fee',
      'opening',
      'refund',
      'reversal',
      'adjustment'
    ]),
    occurredAt: instant
  })
  .strict();
const revisionSchema = z
  .object({
    revisionNo: z.number().int().positive(),
    reason: z.string().min(1).max(500),
    createdAt: instant
  })
  .strict();
export const ledgerDetailSchema = z
  .object({
    transaction: ledgerSummarySchema,
    postings: z.array(postingSchema).max(1_000),
    revisions: z.array(revisionSchema).max(1_000),
    ledgerVersion: z.number().int().safe().nonnegative(),
    requestId: z.string().min(1).max(128)
  })
  .strict()
  .superRefine(({ transaction, postings }, context) => {
    const accounts = new Set(transaction.accountIds);
    if (
      postings.length === 0 ||
      postings.some((posting) => !accounts.has(posting.accountId)) ||
      transaction.accountIds.some(
        (accountId) =>
          !postings.some((posting) => posting.accountId === accountId)
      )
    )
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'posting account mismatch'
      });
    const source = postings.find((posting) => posting.postingRole === 'source');
    const destination = postings.find(
      (posting) => posting.postingRole === 'destination'
    );
    const fee = postings.find((posting) => posting.postingRole === 'fee');
    if (transaction.kind === 'transfer') {
      if (
        !source ||
        !destination ||
        source.accountId === destination.accountId ||
        source.amountMinor >= 0 ||
        destination.amountMinor <= 0 ||
        Math.abs(destination.amountMinor) !== transaction.amountMinor ||
        (fee
          ? fee.amountMinor !== -transaction.feeMinor
          : transaction.feeMinor !== 0)
      )
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'invalid transfer postings'
        });
    } else if (
      transaction.kind === 'expense' &&
      (!source || source.amountMinor !== -transaction.amountMinor)
    )
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'invalid expense posting'
      });
    else if (
      transaction.kind === 'income' &&
      (!destination || destination.amountMinor !== transaction.amountMinor)
    )
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'invalid income posting'
      });
  });
