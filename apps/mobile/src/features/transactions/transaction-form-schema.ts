import { z } from 'zod';

import { parseAmountToMinor, transactionTypes } from '@/domain/core-finance';

export const transactionFormSchema = z
  .object({
    type: z.enum(transactionTypes),
    amountText: z.string().trim().min(1),
    accountId: z.string().min(1),
    destinationAccountId: z.string().nullable().default(null),
    categoryId: z.string().nullable().default(null),
    title: z.string().trim().min(1),
    originalTransactionId: z.string().nullable().default(null)
  })
  .transform((value, context) => {
    const amountMinor = parseAmountToMinor(value.amountText);
    if (amountMinor === null || amountMinor <= 0) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['amountText'],
        message: 'coreFinance.validation.invalid'
      });
      return z.NEVER;
    }
    return { ...value, amountMinor };
  })
  .superRefine((value, context) => {
    if (
      value.type === 'transfer' &&
      (!value.destinationAccountId ||
        value.destinationAccountId === value.accountId)
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['destinationAccountId'],
        message: 'coreFinance.validation.transferAccounts'
      });
    }
    if (
      value.type !== 'transfer' &&
      value.type !== 'adjustment' &&
      !value.categoryId
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['categoryId'],
        message: 'coreFinance.validation.categoryRequired'
      });
    }
    if (value.type === 'refund' && !value.originalTransactionId) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['originalTransactionId'],
        message: 'coreFinance.validation.originalRequired'
      });
    }
  });

export type TransactionFormInput = z.input<typeof transactionFormSchema>;
