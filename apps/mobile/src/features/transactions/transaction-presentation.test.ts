import {
  fixtureAccounts,
  fixtureCategories,
  fixtureTransactions
} from '@/test-utils/core-finance-fixtures';
import { createDemoTransactions } from '@/domain/core-finance-seeds';
import {
  formatTransactionMonth,
  formatTransactionTimestamp,
  projectTransaction
} from './transaction-presentation';

it.each([
  ['adjustment', 1, 'income'], ['adjustment', -1, 'expense'],
  ['reversal', 1, 'income'], ['reversal', -1, 'expense']
] as const)('preserves %s posting direction %i in financial presentation', (type, adjustmentSign, meaning) => {
  const transaction = { ...fixtureTransactions[0], type, amountMinor: 100000, adjustmentSign };
  expect(projectTransaction(transaction, 'en').meaning).toBe(meaning);
});

it.each([
  ['adjustment', 'Opening balance', 'الرصيد الافتتاحي'],
  ['voice', 'Voice transaction', 'معاملة صوتية'],
  ['manual', 'Opening balance', 'Opening balance'],
  ['manual', 'Voice transaction', 'Voice transaction']
] as const)('localizes only the system fallback %s / %s', (source, title, expected) => {
  const transaction = { ...fixtureTransactions[0], id: 'qa-system-title', source, title };
  expect(projectTransaction(transaction, 'ar').title).toBe(expected);
});

it('projects transaction display data without changing ledger meaning', () => {
  const transaction = fixtureTransactions.find((item) => item.type === 'expense')!;
  const account = fixtureAccounts.find((item) => item.id === transaction.accountId);
  const category = fixtureCategories.find((item) => item.id === transaction.categoryId);

  expect(projectTransaction(transaction, 'en', account, category)).toMatchObject({
    transaction,
    title: transaction.title,
    accountName: account?.name,
    categoryName: category?.labelEn,
    meaning: 'expense',
    sourceLabelKey: `coreFinance.source.${transaction.source}`
  });
});

it('keeps unsynced status caller-supplied and explicit', () => {
  const transaction = { ...fixtureTransactions[0], syncStatus: 'failed' as const };

  expect(projectTransaction(transaction, 'ar').syncLabelKey).toBe(
    'coreFinance.sync.failed'
  );
  expect(
    projectTransaction({ ...transaction, syncStatus: 'synced' }, 'ar')
      .syncLabelKey
  ).toBeNull();
});

it.each([
  ['ar', 'فاتورة الكهرباء'],
  ['en', 'Electricity bill']
] as const)('localizes demo transaction titles in %s', (locale, title) => {
  const englishDemo = createDemoTransactions(Date.UTC(2026, 8, 18), 'en')[6];

  expect(projectTransaction(englishDemo, locale).title).toBe(title);
});

it('formats the visible month and relative transaction timestamps', () => {
  const now = Date.UTC(2026, 7, 16, 12);

  expect(formatTransactionMonth(now, 'en', 'UTC')).toBe('August 2026');
  expect(
    formatTransactionTimestamp(Date.UTC(2026, 7, 16, 9, 5), now, 'en', 'UTC')
  ).toMatch(/^Today, .*09:05/);
  expect(
    formatTransactionTimestamp(Date.UTC(2026, 7, 15, 9, 5), now, 'en', 'UTC')
  ).toMatch(/^Yesterday, .*09:05/);
  expect(
    formatTransactionTimestamp(Date.UTC(2026, 7, 10, 9, 5), now, 'en', 'UTC')
  ).toContain('Aug 10, 2026');
});

it.each(['ar', 'en'] as const)('uses the saved timezone for the transaction date in %s', (locale) => {
  const transaction = { ...fixtureTransactions[0], occurredAt: Date.parse('2026-10-07T21:05:00Z') };
  const options = { year: 'numeric', month: 'short', day: 'numeric' } as const;
  expect(projectTransaction(transaction, locale, undefined, undefined, 'Asia/Riyadh').dateLabel)
    .toBe(new Intl.DateTimeFormat(locale === 'ar' ? 'ar-u-nu-latn' : 'en-US-u-nu-latn', { ...options, timeZone: 'Asia/Riyadh' }).format(transaction.occurredAt));
  expect(projectTransaction(transaction, locale, undefined, undefined, 'UTC').dateLabel)
    .not.toBe(projectTransaction(transaction, locale, undefined, undefined, 'Asia/Riyadh').dateLabel);
});
