import { resolveAssistantContext } from '../../../src/ai/assistant-context';
import { routeAssistantMessage } from '../../../src/ai/ai-routing';

describe('assistant request semantics', () => {
  const clock = new Date('2026-09-30T22:30:00Z');
  it.each([
    'How much did I spend today?',
    'كم صرفت اليوم؟',
    'daily expenses',
    'مصروفاتي اليومية',
    'September and October 2026',
    'سبتمبر وأكتوبر ٢٠٢٦',
    'this week and last month',
    'هذا الأسبوع والشهر الماضي',
  ])('clarifies unsupported or conflicting periods: %s', (question) => {
    expect(resolveAssistantContext(question, 'Asia/Riyadh', clock).clarification).toBe(
      'period_required',
    );
  });
  it.each([
    ['What about my income this month?', 'spending_summary', 'income_summary'],
    ['طيب التزاماتي؟', 'income_summary', 'obligations_status'],
    ['What about last month?', 'income_summary', 'income_summary'],
  ] as const)('prioritizes explicit follow-up intent: %s', (content, previous, expected) => {
    expect(
      routeAssistantMessage({
        content,
        recentTurns: [{ role: 'user', content: 'prior', intent: previous }],
      }).intent,
    ).toBe(expected);
  });
  it('uses the owner timezone at month rollover', () => {
    expect(
      resolveAssistantContext('How much did I spend this month?', 'Asia/Riyadh', clock),
    ).toMatchObject({ locale: 'en', startDate: '2026-10-01', endDate: '2026-10-31' });
  });
  it.each([
    ['How much did I spend in September 2026?', '2026-09-01', '2026-09-30'],
    ['كم صرفت في سبتمبر ٢٠٢٦؟', '2026-09-01', '2026-09-30'],
    ['last month', '2026-09-01', '2026-09-30'],
    ['this week', '2026-09-28', '2026-10-04'],
    ['from 2026-08-01 to 2026-08-05', '2026-08-01', '2026-08-05'],
  ])('resolves %s without monthly substitution', (question, startDate, endDate) => {
    expect(resolveAssistantContext(question, 'Asia/Riyadh', clock)).toMatchObject({
      startDate,
      endDate,
      clarification: null,
    });
  });
  it('extracts the price adjacent to a currency, rather than a model number', () => {
    expect(
      resolveAssistantContext('Can I afford an iPhone 16 for 2000 SAR?', 'Asia/Riyadh', clock),
    ).toMatchObject({ currency: 'SAR', purchasePriceMinor: '200000' });
  });
  it.each(['buy it for 200 SAR or 300 USD', 'buy iPhone 16', 'from 2026-02-30 to 2026-03-02'])(
    'clarifies ambiguous context: %s',
    (question) => {
      expect(resolveAssistantContext(question, 'Asia/Riyadh', clock).clarification).not.toBeNull();
    },
  );
  it.each([
    ['Can I buy a laptop for 2000 SAR?', 'purchase_affordability'],
    ['Create a savings goal', 'create_savings_goal'],
    ['What are my recent transactions?', 'recent_transactions'],
    ['آخر معاملاتي', 'recent_transactions'],
    ['How much did I spend on transport?', 'category_breakdown'],
    ['How much did I spend last month?', 'spending_summary'],
  ])('routes %s to %s', (content, intent) => {
    expect(routeAssistantMessage({ content }).intent).toBe(intent);
  });
  it('clarifies grouped purchase numbers instead of reading thousands as a decimal', () => {
    expect(
      resolveAssistantContext('Can I buy it for 2,000 KWD?', 'Asia/Riyadh', clock).clarification,
    ).toBe('price_required');
  });
});
