import { transactionFormSchema } from './transaction-form-schema';

const base = {
  type: 'expense' as const,
  amountText: '12.50',
  accountId: 'account-bank',
  destinationAccountId: null,
  categoryId: 'food',
  title: 'Lunch',
  originalTransactionId: null
};

it('parses amount text and keeps localized issue keys on invalid fields', () => {
  expect(transactionFormSchema.parse(base).amountMinor).toBe(1250);
  const result = transactionFormSchema.safeParse({
    ...base,
    amountText: '12.345'
  });
  expect(result.success).toBe(false);
  if (!result.success)
    expect(result.error.issues[0].message).toBe(
      'coreFinance.validation.invalid'
    );
});

it('enforces transfer, refund, category, and required title rules', () => {
  expect(
    transactionFormSchema.safeParse({
      ...base,
      type: 'transfer',
      destinationAccountId: 'account-bank',
      categoryId: null
    }).success
  ).toBe(false);
  expect(
    transactionFormSchema.safeParse({
      ...base,
      type: 'refund',
      originalTransactionId: null
    }).success
  ).toBe(false);
  expect(
    transactionFormSchema.safeParse({ ...base, categoryId: null }).success
  ).toBe(false);
});
