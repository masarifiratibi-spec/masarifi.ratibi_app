import { AssistantFinancialTools } from '../../../src/ai/ai-financial-tools';

const owner = { userId: 'owner', sessionId: 'session', factorAgeSeconds: 0 };
const report = {
  metadata: {
    generatedAt: '2026-09-15T00:00:00.000Z',
    ledgerVersion: 12,
    range: { startDate: '2026-09-01', endDate: '2026-09-30', timezone: 'Asia/Riyadh' },
    dataState: 'complete',
    evidence: [{ kind: 'ledger', version: 12, asOf: '2026-09-15T00:00:00.000Z' }],
  },
  summaries: [
    {
      income: { amountMinor: 800_000, currency: 'SAR' },
      expense: { amountMinor: 235_000, currency: 'SAR' },
      netCashFlow: { amountMinor: 565_000, currency: 'SAR' },
      savingsRateBasisPoints: 7062,
      transactionCount: 14,
    },
  ],
  breakdowns: [
    {
      categoryId: 'category-id',
      labelAr: 'المطاعم',
      labelEn: 'Restaurants',
      currencyCode: 'SAR',
      expenseMinor: 130_000,
      transactionCount: 4,
    },
  ],
};
const planning = {
  period: '2026-09',
  dataState: 'ready',
  ledgerVersion: 12,
  salary: {
    currencyCode: 'SAR',
    actualIncomeMinor: '800000',
    actualExpenseMinor: '235000',
    reservedObligationMinor: '245000',
  },
  budgets: [
    {
      name: 'المطاعم',
      currencyCode: 'SAR',
      totalMinor: '172000',
      spentMinor: '130000',
      remainingMinor: '42000',
    },
  ],
  obligations: {
    payables: [
      {
        name: 'إيجار',
        currencyCode: 'SAR',
        remainingMinor: '245000',
        nextDueAmountMinor: '245000',
        nextDueAt: '2026-09-20T00:00:00.000Z',
      },
    ],
    receivables: [],
  },
  savings: [
    {
      name: 'طوارئ',
      currencyCode: 'SAR',
      targetMinor: '1000000',
      progressMinor: '300000',
      remainingMinor: '700000',
    },
  ],
};

describe('AssistantFinancialTools', () => {
  const reports = {
    getReportSummary: jest.fn(() => Promise.resolve(report)),
    getAssistantContext: jest.fn(() => Promise.resolve({ timezone: 'Asia/Riyadh' })),
    getAssistantSummary: jest.fn(() => Promise.resolve(report)),
  };
  const planningService = { getPlanningSummary: jest.fn(() => Promise.resolve(planning)) };
  const ledger = {
    listTransactions: jest.fn(() => Promise.resolve({ items: [], ledgerVersion: 12 })),
  };
  const tools = new AssistantFinancialTools(
    reports as never,
    planningService as never,
    ledger as never,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-09-15T12:00:00Z'));
  });
  afterEach(() => jest.useRealTimers());

  it('does not silently use monthly Planning data for weekly advice', async () => {
    const result = await tools.resolve(
      owner,
      'financial_advice',
      'How is my budget this week?',
      'sample',
      ['budgets'],
    );
    expect(result.context.missingDataReason).toBe('planning_period_unsupported');
    expect(planningService.getPlanningSummary).not.toHaveBeenCalled();
  });

  it('uses owner-local report boundaries for confirmed salary income', async () => {
    reports.getAssistantSummary.mockResolvedValueOnce({
      ...report,
      summaries: [
        {
          ...(report.summaries[0] as (typeof report.summaries)[number]),
          income: { amountMinor: 10000, currency: 'SAR' },
        },
      ],
    });
    const result = await tools.resolve(owner, 'salary_status', 'راتبي الشهر الماضي', 'sample', [
      'accounts_summary',
    ]);
    expect(result.context.salary).toMatchObject({ actualIncomeMinor: '10000' });
    expect(result.answer).not.toContain('هذا الشهر');
    expect(reports.getAssistantSummary).toHaveBeenCalledWith(
      owner,
      expect.objectContaining({
        startDate: '2026-08-01',
        endDate: '2026-08-31',
        timezone: 'Asia/Riyadh',
      }),
      'sample',
    );
  });

  it('rejects partial Planning rows rather than claiming complete evidence', async () => {
    planningService.getPlanningSummary.mockResolvedValueOnce({ ...planning, dataState: 'partial' });
    await expect(
      tools.resolve(owner, 'savings_status', 'طوارئ', 'sample', ['budgets']),
    ).rejects.toMatchObject({ status: 409, response: { code: 'AI_EVIDENCE_INCOMPLETE' } });
  });

  it('inherits the earlier period and currency for an explicit short follow-up', async () => {
    await tools.resolve(
      owner,
      'spending_summary',
      'And restaurants?',
      'sample',
      ['recent_transactions'],
      'How much did I spend in August 2026 in USD?',
    );
    expect(reports.getAssistantSummary).toHaveBeenCalledWith(
      owner,
      expect.objectContaining({
        startDate: '2026-08-01',
        endDate: '2026-08-31',
        currency: 'USD',
        locale: 'en',
      }),
      'sample',
    );
  });

  it('does not combine obligation currencies', async () => {
    planningService.getPlanningSummary.mockResolvedValueOnce({
      ...planning,
      obligations: {
        payables: [
          {
            name: 'A',
            currencyCode: 'SAR',
            remainingMinor: '10000',
            nextDueAmountMinor: '10000',
            nextDueAt: '2026-09-20T00:00:00Z',
          },
          {
            name: 'B',
            currencyCode: 'USD',
            remainingMinor: '10000',
            nextDueAmountMinor: '10000',
            nextDueAt: '2026-09-20T00:00:00Z',
          },
        ],
        receivables: [],
      },
    });
    const result = await tools.resolve(owner, 'obligations_status', 'My obligations', 'sample', [
      'obligations',
    ]);
    expect(result.context.totals).toEqual([
      { currency: 'SAR', amountMinor: '10000' },
      { currency: 'USD', amountMinor: '10000' },
    ]);
  });
  it('does not hide the second report currency', async () => {
    reports.getAssistantSummary.mockResolvedValueOnce({
      ...report,
      summaries: [
        ...report.summaries,
        {
          ...(report.summaries[0] as (typeof report.summaries)[number]),
          expense: { amountMinor: 10000, currency: 'USD' },
        },
      ],
    });
    const result = await tools.resolve(
      owner,
      'spending_summary',
      'How much did I spend?',
      'sample',
      ['recent_transactions'],
    );
    expect(result.answer).toContain('USD');
    expect(result.answer).toContain('SAR');
  });
  it('treats salary:null as missing rather than zero purchase funds', async () => {
    planningService.getPlanningSummary.mockResolvedValueOnce({
      ...planning,
      salary: null,
    } as never);
    const result = await tools.resolve(
      owner,
      'purchase_affordability',
      'Can I buy it for 200 SAR?',
      'sample',
      ['accounts_summary', 'obligations'],
    );
    expect(result.context).not.toHaveProperty('availableAfterObligationsMinor');
    expect(result.answer).not.toBeNull();
  });
  it('does not answer an unmatched named category using the first category', async () => {
    const result = await tools.resolve(
      owner,
      'category_breakdown',
      'How much did I spend on transport?',
      'sample',
      ['recent_transactions'],
    );
    expect(result.answer).not.toContain('Restaurants');
    expect(result.context).not.toHaveProperty('category');
  });
  it('does not substitute the first savings goal for a named goal', async () => {
    const result = await tools.resolve(
      owner,
      'savings_status',
      'How is my Emergency goal?',
      'sample',
      ['budgets'],
    );
    expect(result.context).not.toHaveProperty('savings');
  });

  it('answers monthly spending from the Reports owner result', async () => {
    await expect(
      tools.resolve(owner, 'spending_summary', 'صرفي كام الشهر ده؟', 'request-id', [
        'recent_transactions',
      ]),
    ).resolves.toMatchObject({
      answer: 'صرفت 2,350 ريال هذا الشهر.',
      context: { monthlySpendingMinor: '235000', currency: 'SAR' },
      evidence: [{ kind: 'ledger', version: 12 }],
    });
  });

  it('answers budget remaining from the Planning owner result', async () => {
    await expect(
      tools.resolve(owner, 'budget_status', 'كم باقي من ميزانية المطاعم؟', 'request-id', [
        'budgets',
      ]),
    ).resolves.toMatchObject({
      answer: 'باقي لك 420 ريال من ميزانية المطاعم.',
      context: { budgets: [{ remainingMinor: '42000' }] },
    });
  });

  it('answers upcoming obligations without provider arithmetic', async () => {
    await expect(
      tools.resolve(owner, 'upcoming_obligations', 'كم عندي التزامات جاية؟', 'request-id', [
        'obligations',
      ]),
    ).resolves.toMatchObject({
      answer: 'الأقساط التالية المستحقة في الفترة: 2,450 ريال (2026-09-01 – 2026-09-30).',
      context: {
        count: 1,
        totalMinor: '245000',
        currency: 'SAR',
        dueCoverage: 'next_installment_only',
      },
    });
  });

  it('answers salary and savings status from Planning owner values', async () => {
    await expect(
      tools.resolve(owner, 'salary_status', 'كم راتبي هذا الشهر؟', 'request-id', [
        'accounts_summary',
      ]),
    ).resolves.toMatchObject({ answer: 'دخلك المؤكد 8,000 ريال (2026-09-01 – 2026-09-30).' });
    await expect(
      tools.resolve(owner, 'savings_status', 'كيف ادخاري؟', 'request-id', ['budgets']),
    ).resolves.toMatchObject({ answer: 'ادخرت 3,000 ريال من هدف بقيمة 10,000 ريال.' });
  });

  it('discloses missing liquidity rather than treating salary cash flow as funds', async () => {
    await expect(
      tools.resolve(
        owner,
        'purchase_affordability',
        'هل أقدر أشتري جوال بـ5000 ريال؟',
        'request-id',
        ['accounts_summary', 'obligations'],
      ),
    ).resolves.toMatchObject({
      answer: expect.any(String) as unknown,
      context: {
        purchasePriceMinor: '500000',
        liquidityAvailable: false,
        currency: 'SAR',
      },
    });
  });

  it('answers an empty recent-transaction quick question deterministically', async () => {
    await expect(
      tools.resolve(owner, 'recent_transactions', 'آخر معاملاتي', 'request-id', [
        'recent_transactions',
      ]),
    ).resolves.toMatchObject({
      answer: 'لا توجد معاملات حديثة مؤكدة في الفترة المطلوبة.',
      context: { recentTransactions: [] },
    });
  });

  it('keeps broad financial advice within the explicitly selected context', async () => {
    const result = await tools.resolve(
      owner,
      'financial_advice',
      'كيف وضعي المالي؟',
      'request-id',
      ['budgets'],
    );

    expect(result).toMatchObject({
      answer: null,
      context: { planning: { budgets: planning.budgets, savings: planning.savings } },
    });
    expect(result.context).not.toHaveProperty('report');
    expect(result.context.planning).not.toHaveProperty('salary');
    expect(result.context.planning).not.toHaveProperty('obligations');
    expect(reports.getReportSummary).not.toHaveBeenCalled();
  });
});
