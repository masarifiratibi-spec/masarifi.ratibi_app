import { z } from 'zod';

const id = z.string().uuid();
const version = z.number().int().positive();
const minor = z
  .string()
  .regex(/^-?[1-9]\d*$/u)
  .refine((value) => Number.isSafeInteger(Number(value)));
const nonnegative = z
  .string()
  .regex(/^\d+$/u)
  .refine((value) => Number.isSafeInteger(Number(value)));
const currency = z.string().regex(/^[A-Z]{3}$/u);
const date = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/u)
  .refine(
    (value) =>
      Number.isFinite(Date.parse(value)) &&
      new Date(value).toISOString().slice(0, 10) === value
  );
const nullableText = (size: number) => z.string().max(size).nullable();
const patch = z
  .object({
    amountMinor: z.number().int().safe().positive().optional(),
    accountId: id.optional(),
    categoryId: id.nullable().optional(),
    title: z.string().min(1).max(160).optional(),
    merchant: nullableText(160).optional(),
    paymentMethod: nullableText(80).optional(),
    note: nullableText(500).optional(),
    occurredAt: z.string().datetime({ offset: true }).optional()
  })
  .strict();
const effects: Record<string, z.ZodTypeAny> = {
  'transaction.create': z
    .object({
      amountMinor: minor,
      currency,
      accountId: id,
      categoryId: id.nullable(),
      date,
      merchant: nullableText(160),
      note: nullableText(500)
    })
    .strict(),
  'transaction.update': patch
    .extend({
      transactionId: id,
      expectedVersion: version,
      reason: z.string().min(1).max(500)
    })
    .refine((value) =>
      Object.keys(value).some(
        (key) => !['transactionId', 'expectedVersion', 'reason'].includes(key)
      )
    ),
  'budget.update': z
    .object({
      budgetId: id,
      expectedVersion: version,
      patch: z
        .object({
          name: z.string().min(1).max(120).optional(),
          periodStart: date.optional(),
          periodEnd: date.optional(),
          totalMinor: nonnegative.optional(),
          incomeTargetMinor: nonnegative.optional(),
          savingsTargetMinor: nonnegative.optional(),
          rolloverEnabled: z.boolean().optional(),
          rolloverMinor: nonnegative.optional(),
          status: z
            .enum(['draft', 'active', 'paused', 'closed', 'deleted'])
            .optional()
        })
        .strict()
        .refine((value) => Object.keys(value).length > 0)
    })
    .strict(),
  'savings_goal.create': z
    .object({
      name: z.string().min(1).max(160),
      targetMinor: minor.refine((value) => BigInt(value) > 0n),
      currencyCode: currency,
      openingTrackedMinor: nonnegative.optional(),
      targetDate: date.nullable().optional(),
      linkedAccountId: id.nullable().optional(),
      iconKey: z
        .string()
        .regex(/^[A-Za-z0-9._:-]{1,80}$/u)
        .nullable()
        .optional(),
      emergencyFund: z.boolean().optional()
    })
    .strict(),
  'obligation.payment.record': z
    .object({
      obligationId: id,
      transactionId: id,
      expectedVersion: version,
      paymentMethod: nullableText(80),
      paymentCase: z.enum([
        'partial',
        'full',
        'over',
        'early',
        'settlement',
        'correction'
      ]),
      allocationIntent: z.enum([
        'current',
        'later_installments',
        'principal',
        'correction',
        'settlement',
        'prepayment'
      ]),
      source: z.enum(['manual', 'automatic', 'voice', 'platform_assisted']),
      allocations: z
        .array(
          z
            .object({
              scheduleItemId: id,
              amountMinor: minor.refine((value) => BigInt(value) > 0n)
            })
            .strict()
        )
        .min(1)
        .max(100)
    })
    .strict(),
  'tracking.review.resolve': z
    .object({
      reviewId: id,
      decision: z.enum(['accept', 'reject', 'edit_accept']),
      expectedVersion: version,
      edit: patch.extend({ currency: currency.optional() })
    })
    .strict()
    .refine(
      (value) =>
        (value.decision === 'edit_accept') ===
        Object.keys(value.edit).length > 0
    )
};

export function hasCompleteAssistantEffect(
  action: string,
  payload: unknown
): boolean {
  return effects[action]?.safeParse(payload).success ?? false;
}
