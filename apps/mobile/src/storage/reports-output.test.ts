import {
  buildFinancialReport,
  buildSnapshot,
  resolveReportPeriod
} from '@/domain/reports';
import { createReportOutputAttempt } from '@/services/mocks/report-delivery-adapter';
import {
  completeReportFixture,
  reportFixtureCategories
} from '@/test-utils/report-fixtures';
import { ReportsRepository } from './reports-repository';

test('attempt snapshots are append-only and replayed by operation id', async () => {
  const period = resolveReportPeriod({
    kind: 'monthly',
    anchorDate: '2026-08-09',
    timeZone: 'Asia/Riyadh',
    now: Date.UTC(2026, 7, 9)
  });
  const report = buildFinancialReport({
    period,
    currencyCode: 'SAR',
    categories: reportFixtureCategories,
    transactions: completeReportFixture
  });
  const snapshot = buildSnapshot({
    report,
    detailLevel: 'summary',
    language: 'en',
    transactions: completeReportFixture,
    categoryLabel: () => 'Food'
  });
  const repository = new ReportsRepository();
  const attempt = createReportOutputAttempt({
    kind: 'send_now',
    operationId: 'op',
    snapshot
  });

  expect(await repository.saveAttempt(attempt)).toBe(
    await repository.saveAttempt(attempt)
  );
});

test('rejects a retry whose source attempt already succeeded', async () => {
  const period = resolveReportPeriod({
    kind: 'monthly',
    anchorDate: '2026-08-09',
    timeZone: 'Asia/Riyadh',
    now: Date.UTC(2026, 7, 9)
  });
  const report = buildFinancialReport({
    period,
    currencyCode: 'SAR',
    categories: reportFixtureCategories,
    transactions: completeReportFixture
  });
  const snapshot = buildSnapshot({
    report,
    detailLevel: 'summary',
    language: 'en',
    transactions: completeReportFixture,
    categoryLabel: () => 'Food'
  });
  const repository = new ReportsRepository();
  const sent = createReportOutputAttempt({
    kind: 'send_now',
    operationId: 'sent',
    snapshot
  });
  await repository.saveAttempt(sent);

  await expect(
    repository.saveAttempt(
      createReportOutputAttempt({
        kind: 'retry',
        operationId: 'invalid-retry',
        snapshot,
        retryOfAttemptId: sent.id
      })
    )
  ).rejects.toThrow('duplicate_request');
});
