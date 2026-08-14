import {
  accountInputSchema,
  categoryInputSchema,
  conflictResolutionSchema,
  draftInputSchema,
  transactionInputSchema
} from './core-finance';

it('validates account identifiers and currency', () => {
  expect(
    accountInputSchema.safeParse({
      name: 'Main',
      type: 'bank',
      currencyCode: 'SAR',
      openingBalanceMinor: 0
    }).success
  ).toBe(true);
  expect(
    accountInputSchema.safeParse({
      name: '',
      type: 'bank',
      currencyCode: 'sar',
      openingBalanceMinor: 0
    }).success
  ).toBe(false);
});

it('requires bilingual category labels and rejects self-parenting', () => {
  expect(
    categoryInputSchema.safeParse({
      id: 'c1',
      labelAr: 'طعام',
      labelEn: 'Food',
      parentId: 'c1'
    }).success
  ).toBe(false);
  expect(
    categoryInputSchema.safeParse({ labelAr: '', labelEn: 'Food' }).success
  ).toBe(false);
});

it('rejects same-account transfers and unlinked refunds', () => {
  const base = {
    amountMinor: 100,
    currencyCode: 'SAR',
    accountId: 'a1',
    title: 'Item',
    occurredAt: 1
  };
  expect(
    transactionInputSchema.safeParse({
      ...base,
      type: 'transfer',
      destinationAccountId: 'a1'
    }).success
  ).toBe(false);
  expect(
    transactionInputSchema.safeParse({
      ...base,
      type: 'refund',
      categoryId: 'food'
    }).success
  ).toBe(false);
});

it('validates durable drafts and conflict choices', () => {
  expect(
    draftInputSchema.safeParse({
      id: 'draft',
      transactionType: 'expense',
      amountText: '10',
      accountId: null,
      destinationAccountId: null,
      categoryId: null,
      merchant: null,
      notes: null,
      occurredAt: null,
      status: 'editing',
      updatedAt: 1
    }).success
  ).toBe(true);
  expect(conflictResolutionSchema.safeParse('keep_both').success).toBe(true);
  expect(conflictResolutionSchema.safeParse('overwrite').success).toBe(false);
});
