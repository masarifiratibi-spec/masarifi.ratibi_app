import { z } from 'zod';

const text = z.string().min(1).max(2000);
export const spendingPresentationSchema = z
  .object({
    version: z.literal(1),
    locale: z.enum(['ar', 'en']),
    cards: z
      .array(
        z
          .object({
            title: text,
            amount: text,
            period: text,
            comparisonNotice: text.nullable().optional(),
            comparison: z
              .object({
                direction: z.enum(['up', 'down', 'flat']),
                difference: text,
                percentage: text.nullable(),
                previousAmount: text,
                previousPeriod: text
              })
              .strict()
              .nullable(),
            explanation: text.nullable(),
            saving: z
              .object({ text, target: text.nullable() })
              .strict()
              .nullable()
          })
          .strict()
      )
      .min(1)
      .max(5)
  })
  .strict();
export type SpendingPresentation = z.infer<typeof spendingPresentationSchema>;

// Older text is still usable when a newer server sends an unknown presentation version.
export const optionalSpendingPresentationSchema = z
  .unknown()
  .optional()
  .transform((value) => {
    const result = spendingPresentationSchema.safeParse(value);
    return result.success ? result.data : undefined;
  });
