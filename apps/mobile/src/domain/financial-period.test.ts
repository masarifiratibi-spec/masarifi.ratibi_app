import { buildFinancialPeriod } from './financial-period';

const context = { timeZone: 'Asia/Riyadh', monthStartDay: 1 } as const;

describe('financial period boundaries', () => {
  it('uses inclusive Riyadh day boundaries when UTC is still on the prior day', () => {
    const period = buildFinancialPeriod({
      ...context,
      preset: 'today',
      anchorDate: '2026-08-22'
    });

    expect(period).toEqual({
      startDate: '2026-08-22',
      endDate: '2026-08-22',
      startInstant: Date.parse('2026-08-21T21:00:00.000Z'),
      endInstant: Date.parse('2026-08-22T20:59:59.999Z')
    });
  });

  it.each([
    ['three_months', '2025-11-01'],
    ['six_months', '2025-08-01'],
    ['twelve_months', '2025-02-01']
  ] as const)(
    '%s includes January 2026 and only its preceding calendar months',
    (preset, expectedStartDate) => {
      expect(
        buildFinancialPeriod({
          ...context,
          preset,
          anchorDate: '2026-01-15'
        })
      ).toMatchObject({
        startDate: expectedStartDate,
        endDate: '2026-01-31',
        endInstant: Date.parse('2026-01-31T20:59:59.999Z')
      });
    }
  );

  it('includes leap day at the inclusive end of a February calendar preset', () => {
    expect(
      buildFinancialPeriod({
        ...context,
        preset: 'three_months',
        anchorDate: '2024-02-29'
      })
    ).toEqual({
      startDate: '2023-12-01',
      endDate: '2024-02-29',
      startInstant: Date.parse('2023-11-30T21:00:00.000Z'),
      endInstant: Date.parse('2024-02-29T20:59:59.999Z')
    });
  });

  it.each([
    [1, '2026-08-22', '2026-08-01', '2026-08-31'],
    [28, '2026-08-22', '2026-07-28', '2026-08-27'],
    [28, '2026-08-28', '2026-08-28', '2026-09-27']
  ] as const)(
    'builds the current cycle for start day %i at %s',
    (monthStartDay, anchorDate, startDate, endDate) => {
      expect(
        buildFinancialPeriod({
          timeZone: 'Asia/Riyadh',
          monthStartDay,
          preset: 'current_cycle',
          anchorDate
        })
      ).toMatchObject({ startDate, endDate });
    }
  );
});
