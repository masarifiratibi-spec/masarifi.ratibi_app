import {
  customPeriod,
  periodFromRange,
  periodFilters,
  monthPeriod,
  todayPeriod,
  yesterdayPeriod,
  thisWeekPeriod,
  lastWeekPeriod,
  thisMonthPeriod,
  lastMonthPeriod,
  last3MonthsPeriod,
  last6MonthsPeriod,
  lastYearPeriod,
  formatDaySpan
} from './date-period';

const riyadh = { timeZone: 'Asia/Riyadh', monthStartDay: 28 } as const;

it('builds an inclusive UTC calendar month without hardcoding a year', () => {
  const period = monthPeriod(Date.UTC(2026, 7, 17, 12));

  expect(period).toEqual({
    kind: 'month',
    periodStart: Date.UTC(2026, 7, 1),
    periodEnd: Date.UTC(2026, 8, 1) - 1
  });
});

it.each([
  ['month', Date.UTC(2026, 7, 1), Date.UTC(2026, 8, 1) - 1, 'month'],
  [
    'custom',
    Date.UTC(2026, 7, 2),
    Date.UTC(2026, 7, 17, 23, 59, 59, 999),
    'custom'
  ]
] as const)('classifies an applied %s range', (_label, start, end, kind) => {
  expect(periodFromRange(start, end).kind).toBe(kind);
});

it('normalizes a custom range to inclusive UTC days', () => {
  const period = customPeriod(
    Date.UTC(2026, 7, 1, 18),
    Date.UTC(2026, 7, 17, 4)
  );

  expect(period).toEqual({
    kind: 'custom',
    periodStart: Date.UTC(2026, 7, 1),
    periodEnd: Date.UTC(2026, 7, 18) - 1
  });
  expect(periodFilters(period)).toMatchObject({
    periodStart: period.periodStart,
    periodEnd: period.periodEnd,
    accountIds: []
  });
});

it.each([
  'accountIds',
  'categoryIds',
  'types',
  'sources',
  'statuses',
  'syncStatuses'
] as const)('returns a fresh %s filter array', (field) => {
  const period = monthPeriod(Date.UTC(2026, 7, 17, 12));

  expect(periodFilters(period)[field]).not.toBe(periodFilters(period)[field]);
});

it('calculates preset date periods correctly for today, yesterday, this week, last week, this month, last month', () => {
  // Saturday, 22 August 2026
  const timestamp = Date.UTC(2026, 7, 22, 12);

  expect(todayPeriod(timestamp)).toEqual({
    kind: 'custom',
    periodStart: Date.UTC(2026, 7, 22),
    periodEnd: Date.UTC(2026, 7, 23) - 1
  });

  expect(yesterdayPeriod(timestamp)).toEqual({
    kind: 'custom',
    periodStart: Date.UTC(2026, 7, 21),
    periodEnd: Date.UTC(2026, 7, 22) - 1
  });

  // Monday 17 Aug to Saturday 22 Aug
  expect(thisWeekPeriod(timestamp)).toEqual({
    kind: 'custom',
    periodStart: Date.UTC(2026, 7, 17),
    periodEnd: Date.UTC(2026, 7, 23) - 1
  });

  // Monday 10 Aug to Sunday 16 Aug
  expect(lastWeekPeriod(timestamp)).toEqual({
    kind: 'custom',
    periodStart: Date.UTC(2026, 7, 10),
    periodEnd: Date.UTC(2026, 7, 17) - 1
  });

  // 1 Aug to 22 Aug
  expect(thisMonthPeriod(timestamp)).toEqual({
    kind: 'custom',
    periodStart: Date.UTC(2026, 7, 1),
    periodEnd: Date.UTC(2026, 7, 23) - 1
  });

  // 1 Jul to 31 Jul
  expect(lastMonthPeriod(timestamp)).toEqual({
    kind: 'custom',
    periodStart: Date.UTC(2026, 6, 1),
    periodEnd: Date.UTC(2026, 7, 1) - 1
  });
});

it('resolves calendar presets at Riyadh boundaries without applying the cycle start day', () => {
  const timestamp = Date.parse('2026-08-21T22:30:00.000Z');

  expect(todayPeriod(timestamp, riyadh)).toEqual({
    kind: 'custom',
    periodStart: Date.parse('2026-08-21T21:00:00.000Z'),
    periodEnd: Date.parse('2026-08-22T20:59:59.999Z')
  });
  expect(thisMonthPeriod(timestamp, riyadh)).toEqual({
    kind: 'custom',
    periodStart: Date.parse('2026-07-31T21:00:00.000Z'),
    periodEnd: Date.parse('2026-08-22T20:59:59.999Z')
  });
});

it.each([
  ['three', last3MonthsPeriod, '2026-06-01'],
  ['six', last6MonthsPeriod, '2026-03-01'],
  ['twelve', lastYearPeriod, '2025-09-01']
] as const)(
  '%s-month preset includes the current August 2026 month',
  (_label, preset, startDate) => {
    expect(preset(Date.UTC(2026, 7, 22, 12), riyadh)).toMatchObject({
      periodStart: Date.parse(`${startDate}T00:00:00+03:00`),
      periodEnd: Date.parse('2026-08-31T23:59:59.999+03:00')
    });
  }
);

it('formats day spans in en and ar', () => {
  expect(
    formatDaySpan(Date.UTC(2026, 7, 22), Date.UTC(2026, 7, 22), 'ar')
  ).toBe('22 أغسطس 2026');
  expect(
    formatDaySpan(Date.UTC(2026, 7, 17), Date.UTC(2026, 7, 22), 'ar')
  ).toBe('17 – 22 أغسطس 2026');
  expect(
    formatDaySpan(Date.UTC(2026, 7, 10), Date.UTC(2026, 7, 16), 'ar')
  ).toBe('10 – 16 أغسطس 2026');
  expect(formatDaySpan(Date.UTC(2026, 7, 1), Date.UTC(2026, 7, 22), 'ar')).toBe(
    '1 – 22 أغسطس 2026'
  );
  expect(formatDaySpan(Date.UTC(2026, 6, 1), Date.UTC(2026, 6, 31), 'ar')).toBe(
    '1 – 31 يوليو 2026'
  );
});
