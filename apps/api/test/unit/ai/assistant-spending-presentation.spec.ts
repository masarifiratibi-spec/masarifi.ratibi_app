function present<T>(input: T | null | undefined): T {
  if (input == null) throw new Error('Expected test result');
  return input;
}
import {
  buildSpendingPresentation,
  previousSpendingPeriod,
  selectSpendingSummaryRead,
  assistantPresentationLocale,
} from '../../../src/ai/assistant-spending-presentation';
import type { AssistantFact } from '../../../src/ai/assistant-agent';
import type { AssistantDataQuery } from '../../../src/ai/assistant-agent-data';

const read = (month: string, amount: string, category: string, currency = 'SAR') => ({
  query: { tool: 'summary', kind: 'expense', currency } as AssistantDataQuery,
  snapshot: {
    data: {
      status: 'ok',
      period: {
        startDate: `${month}-01`,
        endDate: `${month}-${month.endsWith('09') ? '30' : '31'}`,
        timezone: 'Asia/Riyadh',
      },
      summaries: [
        { kind: 'expense', status: 'confirmed', currency, amountMinor: amount, count: 3 },
      ],
      topExpenseCategories: {
        items: [
          {
            category: 'CATEGORY-1',
            labelAr: 'المطاعم',
            labelEn: 'Restaurants',
            currency,
            amountMinor: category,
          },
        ],
        count: 1,
        limit: 10,
        offset: 0,
        hasMore: false,
      },
    },
  },
});
const fact: AssistantFact = {
  key: 'F1',
  value: '2400 SAR',
  currency: 'SAR',
  path: 'reads[0].data.summaries[0].amountMinor',
};
const format = (value: string, _key: string, parent: Record<string, unknown>) =>
  typeof parent.currency === 'string' ? `${value} ${parent.currency}` : value;

it('accepts mixed overview/expense reads only after verifying the same expense basis', () => {
  const current = read('2026-10', '240000', '60000');
  delete current.query.kind;
  const previous = read('2026-09', '210000', '40000');
  const canonical = read('2026-09', '210000', '40000');
  delete canonical.query.kind;
  const facts = [fact, { ...fact, key: 'F2', path: 'reads[1].data.summaries[0].amountMinor' }];
  const input = {
    reads: [current, previous],
    answer: '{{F1}} {{F2}}',
    facts,
    locale: 'ar' as const,
    format,
  };
  expect(selectSpendingSummaryRead(input.reads, input.answer, facts)).toBe(current);
  expect(buildSpendingPresentation(input)).toBeUndefined();
  expect(
    buildSpendingPresentation({ ...input, additionalPrevious: canonical })?.cards[0],
  ).toMatchObject({
    amount: '240000 SAR',
    comparison: { difference: '30000 SAR' },
    saving: { target: '20000 SAR' },
  });
  present(canonical.snapshot.data.summaries[0]).amountMinor = '200000';
  expect(buildSpendingPresentation({ ...input, additionalPrevious: canonical })).toBeUndefined();
});

it('verifies an explicit currency filter against a canonical unfiltered currency read', () => {
  const current = read('2026-10', '240000', '60000');
  delete current.query.currency;
  const previous = read('2026-09', '210000', '40000');
  const canonical = read('2026-09', '210000', '40000');
  delete canonical.query.currency;
  const facts = [fact, { ...fact, key: 'F2', path: 'reads[1].data.summaries[0].amountMinor' }];
  const input = {
    reads: [current, previous],
    answer: '{{F1}} {{F2}}',
    facts,
    locale: 'ar' as const,
    format,
  };
  expect(selectSpendingSummaryRead(input.reads, input.answer, facts)).toBe(current);
  expect(buildSpendingPresentation(input)).toBeUndefined();
  expect(
    buildSpendingPresentation({ ...input, additionalPrevious: canonical })?.cards[0]?.comparison
      ?.difference,
  ).toBe('30000 SAR');
});

it('keeps mixed-basis category advice as prose when refunds change the referenced category', () => {
  const current = read('2026-10', '240000', '60000');
  delete current.query.kind;
  const previous = read('2026-09', '210000', '40000');
  const canonical = read('2026-09', '210000', '30000');
  delete canonical.query.kind;
  const facts = [
    fact,
    { ...fact, key: 'F2', path: 'reads[1].data.topExpenseCategories.items[0].amountMinor' },
  ];
  expect(
    buildSpendingPresentation({
      reads: [current, previous],
      answer: '{{F1}} {{F2}}',
      facts,
      additionalPrevious: canonical,
      locale: 'ar',
      format,
    }),
  ).toBeUndefined();
});

it.each(['previousMinor', 'differenceMinor', 'percentageBasisPoints'])(
  'preserves prose when a synthetic %s reference disagrees with the canonical comparison',
  (field) => {
    const overview = read('2026-10', '10000', '6000');
    delete overview.query.kind;
    const current = read('2026-10', '10000', '6000');
    const previous = read('2026-09', '9000', '4000');
    const canonical = read('2026-09', '8000', '3000');
    delete canonical.query.kind;
    const facts = [fact, { ...fact, key: 'F2', path: `reads[3].data.items[0].${field}` }];
    expect(
      buildSpendingPresentation({
        reads: [overview, current, previous],
        answer: '{{F1}} {{F2}}',
        facts,
        additionalPrevious: canonical,
        locale: 'ar',
        format,
      }),
    ).toBeUndefined();
  },
);

it.each([
  ['جاوب بالإنجليزي: كم صرفت هالشهر؟', 'en'],
  ['كم صرفت هالشهر؟ رد باللغة الإنجليزية', 'en'],
  ['كم صرفت في متجر English House؟', 'ar'],
  ['لا تجاوب بالإنجليزي، كم صرفت؟', 'ar'],
])('preserves the requested presentation language for %s', (question, expected) => {
  expect(assistantPresentationLocale(question)).toBe(expected);
});

it('uses exact confirmed records for amount, comparison, category explanation and a conditional baseline goal', () => {
  const current = read('2026-10', '240000', '60000');
  const previous = read('2026-09', '210000', '40000');
  const p = present(
    buildSpendingPresentation({
      reads: [current, previous],
      answer: '{{F1}}',
      facts: [fact],
      locale: 'ar',
      format: format,
    }),
  );
  expect(p.cards[0]).toMatchObject({
    amount: '240000 SAR',
    comparison: {
      direction: 'up',
      difference: '30000 SAR',
      percentage: '1428',
      previousAmount: '210000 SAR',
    },
    saving: { target: '20000 SAR' },
  });
  expect(present(p.cards[0]).explanation).toContain('20000 SAR');
  expect(present(present(p.cards[0]).saving).text).toContain('40000 SAR');
  expect(present(p.cards[0]).explanation).not.toMatch(/بسبب|السبب|أكبر/u);
});

it('does not treat a missing capped category as zero or invent a monetary saving goal', () => {
  const previous = read('2026-09', '210000', '40000');
  previous.snapshot.data.topExpenseCategories.items = [];
  const card = present(
    present(
      buildSpendingPresentation({
        reads: [read('2026-10', '240000', '60000'), previous],
        answer: '{{F1}}',
        facts: [fact],
        locale: 'ar',
        format: format,
      }),
    ).cards[0],
  );
  expect(card.saving?.target).toBeNull();
  expect(card.explanation).not.toContain('20000');
  expect(card.explanation).toContain('60000 SAR');
});

it('does not turn a failed previous source into a zero comparison', () => {
  const previous = read('2026-09', '0', '0');
  previous.snapshot.data.status = 'unavailable';
  const p = present(
    buildSpendingPresentation({
      reads: [read('2026-10', '240000', '60000'), previous],
      answer: '{{F1}}',
      facts: [fact],
      locale: 'en',
      format: format,
    }),
  );
  expect(present(p.cards[0]).comparison).toBeNull();
  expect(present(p.cards[0]).comparisonNotice).toContain('unavailable');
  expect(present(p.cards[0]).saving?.target).toBeNull();
});

it('keeps currencies and huge minor values exact, and never substitutes a differently filtered baseline', () => {
  const current = read('2026-10', '90071992547409931234', '0', 'KWD');
  const previous = read('2026-09', '2', '0', 'KWD');
  previous.query.account = 'ACCOUNT-2';
  const f = { ...fact, currency: 'KWD' };
  const card = present(
    present(
      buildSpendingPresentation({
        reads: [current, previous],
        answer: '{{F1}}',
        facts: [f],
        locale: 'en',
        format: format,
      }),
    ).cards[0],
  );
  expect(card.amount).toBe('90071992547409931234 KWD');
  expect(card.comparison).toBeNull();
});

it('keeps non-summary, mixed income and ambiguous multi-period answers intact', () => {
  const reads = [read('2026-10', '240000', '60000')];
  expect(
    selectSpendingSummaryRead(reads, '{{F1}}', [
      { ...fact, path: 'reads[0].data.transactions.items[0].amountMinor' },
    ]),
  ).toBeUndefined();
  expect(
    buildSpendingPresentation({
      reads: reads,
      answer: '{{F1}} {{F2}}',
      facts: [fact, { ...fact, key: 'F2', path: 'reads[0].data.financialEffects[0].incomeMinor' }],
      locale: 'ar',
      format: format,
    }),
  ).toBeUndefined();
  expect(
    buildSpendingPresentation({
      reads: [
        read('2026-10', '100', '40'),
        read('2026-09', '90', '30'),
        read('2026-08', '80', '20'),
      ],
      answer: '{{F1}}',
      facts: [fact],
      locale: 'ar',
      format: format,
    }),
  ).toBeUndefined();
});

it('handles complete zero spending without invented saving and zero baseline without a percent', () => {
  const current = read('2026-10', '0', '0');
  current.snapshot.data.topExpenseCategories.items = [];
  const card = present(
    present(
      buildSpendingPresentation({
        reads: [current],
        answer: '{{F1}}',
        facts: [fact],
        locale: 'ar',
        format: format,
      }),
    ).cards[0],
  );
  expect(card.amount).toBe('0 SAR');
  expect(card.saving).toBeNull();
  expect(
    present(
      present(
        buildSpendingPresentation({
          reads: [read('2026-10', '100', '40'), read('2026-09', '0', '0')],
          answer: '{{F1}}',
          facts: [fact],
          locale: 'en',
          format: format,
        }),
      ).cards[0],
    ).comparison?.percentage,
  ).toBeNull();
});

it('does not collapse separately requested account scopes or malformed financial amounts into a card', () => {
  const a = read('2026-10', '100', '40');
  a.query.account = 'ACCOUNT-1';
  const b = read('2026-10', '200', '50');
  b.query.account = 'ACCOUNT-2';
  expect(
    selectSpendingSummaryRead([a, b], '{{F1}} {{F2}}', [
      fact,
      { ...fact, key: 'F2', path: 'reads[1].data.summaries[0].amountMinor' },
    ]),
  ).toBeUndefined();
  present(a.snapshot.data.summaries[0]).amountMinor = 'invalid';
  expect(selectSpendingSummaryRead([a], '{{F1}}', [fact])).toBeUndefined();
});

it('renders distinct current totals for currencies without aggregating their minor units', () => {
  const a = read('2026-10', '100', '40');
  a.query.currency = null;
  a.snapshot.data.summaries.push({
    kind: 'expense',
    status: 'confirmed',
    currency: 'USD',
    amountMinor: '200',
    count: 1,
  });
  const p = present(
    buildSpendingPresentation({
      reads: [a],
      answer: '{{F1}} {{F2}}',
      facts: [
        fact,
        { ...fact, key: 'F2', currency: 'USD', path: 'reads[0].data.summaries[1].amountMinor' },
      ],
      locale: 'en',
      format: format,
    }),
  );
  expect(p.cards.map((c) => c.amount)).toEqual(['100 SAR', '200 USD']);
});

it('accepts current paginated category fact paths and duplicate equivalent reads, independent of reference order', () => {
  const current = read('2026-10', '240000', '60000'),
    previous = read('2026-09', '210000', '40000');
  const p = buildSpendingPresentation({
    reads: [previous, current, { ...previous }],
    answer: '{{F1}} {{F2}} {{F3}}',
    facts: [
      fact,
      { ...fact, key: 'F2', path: 'reads[1].data.summaries[0].amountMinor' },
      { ...fact, key: 'F3', path: 'reads[1].data.topExpenseCategories.items[0].amountMinor' },
    ],
    locale: 'ar',
    format,
  });
  expect(p?.cards[0]?.amount).toBe('240000 SAR');
  expect(p?.cards[0]?.saving?.target).toBe('20000 SAR');
});

it('abstains instead of replacing gross expenses with a net refund/fee total or dropping a requested count', () => {
  const current = read('2026-10', '10000', '6000');
  const net = {
    ...current,
    snapshot: {
      data: {
        ...current.snapshot.data,
        financialEffects: [{ currency: 'SAR', expenseMinor: '8100' }],
      },
    },
  };
  expect(selectSpendingSummaryRead([net], '{{F1}}', [fact])).toBeUndefined();
  expect(
    selectSpendingSummaryRead([current], '{{F1}} {{F2}}', [
      fact,
      { key: 'F2', path: 'reads[0].data.summaries[0].count', value: '3' },
    ]),
  ).toBeUndefined();
});

it.each([
  ['2026-10-01', '2026-10-31', { startDate: '2026-09-01', endDate: '2026-09-30' }],
  ['2026-03-01', '2026-03-15', { startDate: '2026-02-01', endDate: '2026-02-15' }],
  ['2024-03-01', '2024-03-31', { startDate: '2024-02-01', endDate: '2024-02-29' }],
  ['2026-09-01', '2026-09-30', { startDate: '2026-08-01', endDate: '2026-08-31' }],
  ['2026-02-01', '2026-02-28', { startDate: '2026-01-01', endDate: '2026-01-31' }],
  ['2026-10-15', '2026-10-31', undefined],
])('matches the prior calendar interval for %s to %s', (startDate, endDate, expected) => {
  expect(previousSpendingPeriod({ startDate, endDate })).toEqual(expected);
});
