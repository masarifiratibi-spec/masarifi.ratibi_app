import { resolveReportPeriod } from './reports';

test('monthly periods use inclusive dates and half-open instants', () => {
  const period = resolveReportPeriod({
    kind: 'monthly',
    anchorDate: '2026-08-09',
    timeZone: 'Asia/Riyadh',
    now: Date.UTC(2026, 7, 9, 12)
  });

  expect(period.startDate).toBe('2026-08-01');
  expect(period.endDate).toBe('2026-08-31');
  expect(new Date(period.startInstant).toISOString()).toBe(
    '2026-07-31T21:00:00.000Z'
  );
  expect(new Date(period.endExclusiveInstant).toISOString()).toBe(
    '2026-08-31T21:00:00.000Z'
  );
  expect(period.comparisonEndDate).toBe('2026-07-09');
});

test('period instants follow daylight-saving offsets in the captured timezone', () => {
  const period = resolveReportPeriod({
    kind: 'monthly',
    anchorDate: '2026-03-15',
    timeZone: 'America/New_York',
    now: Date.UTC(2026, 2, 15, 12)
  });

  expect(new Date(period.startInstant).toISOString()).toBe(
    '2026-03-01T05:00:00.000Z'
  );
  expect(new Date(period.endExclusiveInstant).toISOString()).toBe(
    '2026-04-01T04:00:00.000Z'
  );
  expect(period.comparisonEndDate).toBe('2026-02-15');
});

test.each([
  ['three_months', '2026-06-01'],
  ['half_year', '2026-03-01'],
  ['annual', '2025-09-01']
] as const)(
  '%s ends at the anchor month after the exact calendar span',
  (kind, startDate) => {
    const period = resolveReportPeriod({
      kind,
      anchorDate: '2026-08-22',
      timeZone: 'Asia/Riyadh',
      now: Date.UTC(2026, 7, 22, 12)
    });

    expect(period.startDate).toBe(startDate);
    expect(period.endDate).toBe('2026-08-31');
  }
);

test('clamps elapsed comparison days to a shorter leap-year month', () => {
  const period = resolveReportPeriod({
    kind: 'monthly',
    anchorDate: '2024-03-31',
    timeZone: 'Asia/Riyadh',
    now: Date.parse('2024-03-31T12:00:00.000Z')
  });

  expect(period.comparisonStartDate).toBe('2024-02-01');
  expect(period.comparisonEndDate).toBe('2024-02-29');
  expect(new Date(period.comparisonEndExclusiveInstant).toISOString()).toBe(
    '2024-02-29T21:00:00.000Z'
  );
});
