import { makeTransaction, fixtureCategories } from '@/test-utils/core-finance-fixtures';

export const reportFixtureCategories = fixtureCategories;

export function makeReportTransactions(count = 24) {
  return Array.from({ length: count }, (_, index) =>
    makeTransaction(index, {
      id: `report-transaction-${index}`,
      occurredAt: Date.UTC(2026, 7, Math.max(1, 8 - (index % 8)), 12),
      reviewStatus: 'none',
      syncStatus: 'synced'
    })
  );
}

export const completeReportFixture = makeReportTransactions(48);
export const emptyReportFixture = [];
export const partialReportFixture = [
  makeTransaction(1, { reviewStatus: 'required', occurredAt: Date.UTC(2026, 7, 8, 12) })
];
export const tenThousandReportFixture = makeReportTransactions(10_000);
