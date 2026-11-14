import {
  classifyFinancialMessage,
  defaultSnapshot,
  validateRuleSnapshot,
} from '@masarifi/transaction-parser';

describe('database configured lifecycle wording', () => {
  it.each([
    'Deposit request AED10 account XX4242',
    'Refund request AED1 card XX4242 original reference BANKREF1234',
    'طلب إيداع SAR ١٠ حساب XX4242',
    'طلب استرداد EGP ١ بطاقة XX4242',
    'طلب refund AED1 card XX4242',
  ])('never treats an uncompleted request as settled: %s', (text) => {
    expect(classifyFinancialMessage({ text })).toMatchObject({
      status: 'pending',
      disposition: 'review',
    });
  });
  it('accepts added pending wording without permitting removal of safety phrases', () => {
    const configured = structuredClone(defaultSnapshot);
    const pending = configured.rules.find((rule) => rule.ruleKey === 'lifecycle.pending');
    if (!pending) throw new Error('PENDING_RULE_REQUIRED');
    pending.any.push('awaiting settlement', 'في انتظار التسوية');
    expect(validateRuleSnapshot(configured)).toEqual(configured);
    expect(
      classifyFinancialMessage({ text: 'purchase AED 4 awaiting settlement' }, configured),
    ).toMatchObject({
      subtype: 'purchase',
      status: 'pending',
      disposition: 'review',
      amountMinor: 400,
      currency: 'AED',
    });
    expect(
      classifyFinancialMessage({ text: 'شراء SAR ٤ في انتظار التسوية' }, configured),
    ).toMatchObject({
      subtype: 'purchase',
      status: 'pending',
      disposition: 'review',
      amountMinor: 400,
      currency: 'SAR',
    });
    pending.any = ['awaiting settlement'];
    expect(() => validateRuleSnapshot(configured)).toThrow('TRACKING_RULE_SNAPSHOT_INVALID');
  });

  it('keeps failure precedence when custom rules claim a completed transaction', () => {
    const configured = structuredClone(defaultSnapshot);
    const failed = configured.rules.find((rule) => rule.ruleKey === 'lifecycle.failed');
    if (!failed) throw new Error('FAILED_RULE_REQUIRED');
    failed.any.push('could not complete');
    configured.rules.push({
      ruleKey: 'custom.completed',
      family: 'status',
      enabled: true,
      priority: 9999,
      any: ['purchase'],
      effects: { status: 'completed', disposition: 'capture_candidate' },
    });
    expect(
      classifyFinancialMessage({ text: 'purchase AED 4 could not complete' }, configured),
    ).toMatchObject({
      status: 'failed',
      disposition: 'ignore',
    });
  });
});
