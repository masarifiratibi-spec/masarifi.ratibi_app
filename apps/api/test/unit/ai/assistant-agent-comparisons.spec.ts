import {
  assistantComparisons,
  assistantPeriodTotals,
} from '../../../src/ai/assistant-agent-comparisons';

it('supplies exact zero income and expense facts for a complete empty period in an owned currency', () => {
  const reads = [
    {
      query: { tool: 'overview' as const },
      snapshot: { data: { accounts: { items: [{ currency: 'SAR' }] } } },
    },
    {
      query: { tool: 'summary' as const },
      snapshot: {
        data: {
          status: 'ok',
          period: { startDate: '2026-10-16', endDate: '2026-10-16' },
          summaries: [],
        },
      },
    },
  ];
  expect(assistantPeriodTotals(reads)).toMatchObject([
    {
      readIndex: 1,
      currency: 'SAR',
      kind: 'expense',
      confirmedMinor: '0',
      confirmedCount: 0,
      completeConfirmedAggregate: true,
    },
    {
      readIndex: 1,
      currency: 'SAR',
      kind: 'income',
      confirmedMinor: '0',
      confirmedCount: 0,
      completeConfirmedAggregate: true,
    },
  ]);
});

it('does not turn absent, denied or filtered-out aggregates into zero facts', () => {
  expect(
    assistantPeriodTotals([
      {
        query: { tool: 'summary', currency: 'SAR' },
        snapshot: { data: { status: 'not_found', summaries: [] } },
      },
      {
        query: { tool: 'summary', currency: 'SAR' },
        snapshot: { data: { status: 'ok', summaries: null } },
      },
      {
        query: { tool: 'summary', currency: 'SAR', kind: 'refund' },
        snapshot: { data: { status: 'ok', summaries: [] } },
      },
    ]),
  ).toEqual([]);
});

it('uses no currency from the global catalog but permits an explicitly requested currency for an empty aggregate', () => {
  const data = { status: 'ok', summaries: [], currencyUnits: [{ currency: 'USD', minorUnit: 2 }] };
  expect(assistantPeriodTotals([{ query: { tool: 'summary' }, snapshot: { data } }])).toEqual([]);
  expect(
    assistantPeriodTotals([
      { query: { tool: 'summary', currency: 'SAR', kind: 'expense' }, snapshot: { data } },
    ]),
  ).toMatchObject([
    {
      readIndex: 0,
      currency: 'SAR',
      kind: 'expense',
      confirmedMinor: '0',
      confirmedCount: 0,
      completeConfirmedAggregate: true,
    },
  ]);
});

it('separates actual confirmed totals and currencies while pending-only income remains confirmed zero', () => {
  const summaries = [
    { currency: 'SAR', kind: 'expense', status: 'confirmed', amountMinor: '12345', count: 2 },
    { currency: 'SAR', kind: 'expense', status: 'pending', amountMinor: '400', count: 1 },
    { currency: 'SAR', kind: 'income', status: 'pending', amountMinor: '900000', count: 3 },
    { currency: 'USD', kind: 'income', status: 'confirmed', amountMinor: '5000', count: 1 },
  ];
  const totals = assistantPeriodTotals([
    { query: { tool: 'summary' }, snapshot: { data: { status: 'ok', summaries } } },
  ]);
  expect(totals).toMatchObject([
    {
      readIndex: 0,
      currency: 'SAR',
      kind: 'expense',
      confirmedMinor: '12345',
      confirmedCount: 2,
      completeConfirmedAggregate: true,
    },
    {
      readIndex: 0,
      currency: 'SAR',
      kind: 'income',
      confirmedMinor: '0',
      confirmedCount: 0,
      completeConfirmedAggregate: true,
    },
    {
      readIndex: 0,
      currency: 'USD',
      kind: 'expense',
      confirmedMinor: '0',
      confirmedCount: 0,
      completeConfirmedAggregate: true,
    },
    {
      readIndex: 0,
      currency: 'USD',
      kind: 'income',
      confirmedMinor: '5000',
      confirmedCount: 1,
      completeConfirmedAggregate: true,
    },
  ]);
});

it('does not invent income outside an expense-only query or merge two differently filtered reads', () => {
  const reads = [
    {
      query: {
        tool: 'summary' as const,
        currency: 'SAR',
        kind: 'expense' as const,
        account: 'ACCOUNT-1',
      },
      snapshot: { data: { status: 'ok', summaries: [] } },
    },
    {
      query: {
        tool: 'summary' as const,
        currency: 'SAR',
        kind: 'expense' as const,
        account: 'ACCOUNT-2',
      },
      snapshot: {
        data: {
          status: 'ok',
          summaries: [
            { currency: 'SAR', kind: 'expense', status: 'confirmed', amountMinor: '300', count: 1 },
          ],
        },
      },
    },
  ];
  expect(assistantPeriodTotals(reads)).toMatchObject([
    {
      readIndex: 0,
      currency: 'SAR',
      kind: 'expense',
      confirmedMinor: '0',
      confirmedCount: 0,
      completeConfirmedAggregate: true,
    },
    {
      readIndex: 1,
      currency: 'SAR',
      kind: 'expense',
      confirmedMinor: '300',
      confirmedCount: 1,
      completeConfirmedAggregate: true,
    },
  ]);
});

const snapshot = (startDate: string, amountMinor: string, currency = 'SAR') => ({
  query: { tool: 'summary' as const },
  snapshot: {
    data: {
      status: 'ok',
      period: { startDate, endDate: `${startDate.slice(0, 7)}-15` },
      summaries: [{ kind: 'expense', status: 'confirmed', currency, amountMinor }],
    },
  },
});

it('calculates exact same-currency spending differences from the two queried periods', () => {
  expect(
    assistantComparisons([snapshot('2026-09-01', '20000'), snapshot('2026-10-01', '25000')]),
  ).toEqual([
    expect.objectContaining({
      currency: 'SAR',
      kind: 'expense',
      previousMinor: '20000',
      currentMinor: '25000',
      differenceMinor: '5000',
      percentageBasisPoints: '2500',
    }),
  ]);
});
it('never divides by a zero baseline or combines two currencies', () => {
  expect(
    assistantComparisons([snapshot('2026-09-01', '0'), snapshot('2026-10-01', '25000')])[0]
      ?.percentageBasisPoints,
  ).toBeNull();
  const comparisons = assistantComparisons([
    snapshot('2026-09-01', '20000', 'USD'),
    snapshot('2026-10-01', '25000'),
  ]);
  expect(comparisons.map((entry) => entry.currency).sort()).toEqual(['SAR', 'USD']);
});
it('does not compare different account scopes as though they were the same finances', () => {
  const previous = snapshot('2026-09-01', '20000');
  const current = {
    ...snapshot('2026-10-01', '25000'),
    query: { tool: 'summary' as const, account: 'ACCOUNT-2' },
  };
  expect(assistantComparisons([previous, current])).toEqual([]);
});
