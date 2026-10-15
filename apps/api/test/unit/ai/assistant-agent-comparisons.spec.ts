import { assistantComparisons } from '../../../src/ai/assistant-agent-comparisons';

const snapshot = (startDate: string, amountMinor: string, currency = 'SAR') => ({
  query: { tool: 'summary' as const },
  snapshot: { data: { status: 'ok', period: { startDate, endDate: `${startDate.slice(0, 7)}-15` },
    summaries: [{ kind: 'expense', status: 'confirmed', currency, amountMinor }] } },
});

it('calculates exact same-currency spending differences from the two queried periods', () => {
  expect(assistantComparisons([snapshot('2026-09-01', '20000'), snapshot('2026-10-01', '25000')])).toEqual([
    expect.objectContaining({ currency: 'SAR', kind: 'expense', previousMinor: '20000', currentMinor: '25000', differenceMinor: '5000', percentageBasisPoints: '2500' }),
  ]);
});
it('never divides by a zero baseline or combines two currencies', () => {
  expect(assistantComparisons([snapshot('2026-09-01', '0'), snapshot('2026-10-01', '25000')])[0]?.percentageBasisPoints).toBeNull();
  const comparisons = assistantComparisons([snapshot('2026-09-01', '20000', 'USD'), snapshot('2026-10-01', '25000')]);
  expect(comparisons.map(entry => entry.currency).sort()).toEqual(['SAR', 'USD']);
});
it('does not compare different account scopes as though they were the same finances', () => {
  const previous = snapshot('2026-09-01', '20000');
  const current = { ...snapshot('2026-10-01', '25000'), query: { tool: 'summary' as const, account: 'ACCOUNT-2' } };
  expect(assistantComparisons([previous, current])).toEqual([]);
});
