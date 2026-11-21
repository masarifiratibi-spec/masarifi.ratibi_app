import {
  classifyFinancialMessage,
  defaultSnapshot,
  validateRuleSnapshot
} from '../../../../../packages/transaction-parser';
import corpus from '../../../../../packages/transaction-parser/corpus.json';

describe('financial-message screenshot and synthetic corpus', () => {
  it.each(['all', 'not', 'countries', 'providers', 'channels'])(
    'rejects predicates that disable protected failed-message safety: %s',
    (key) => {
      const snapshot = JSON.parse(JSON.stringify(defaultSnapshot));
      snapshot.rules.find(
        (rule: { ruleKey: string }) => rule.ruleKey === 'lifecycle.failed'
      )[key] = ['unmatchable'];
      expect(() => validateRuleSnapshot(snapshot)).toThrow(
        'TRACKING_RULE_SNAPSHOT_INVALID'
      );
    }
  );
  it('a custom completed status cannot override a failed purchase', () => {
    const snapshot = JSON.parse(JSON.stringify(defaultSnapshot));
    snapshot.rules.push({
      ruleKey: 'custom.completed',
      family: 'status',
      enabled: true,
      priority: 9999,
      any: ['purchase'],
      effects: { status: 'completed', disposition: 'capture_candidate' }
    });
    expect(
      classifyFinancialMessage({ text: 'Purchase AED15.00 failed' }, snapshot)
    ).toMatchObject({ status: 'failed', disposition: 'ignore' });
  });
  it.each(corpus)('$id ($evidence)', ({ text, sender, country, expected }) => {
    expect(classifyFinancialMessage({ text, sender, country })).toMatchObject(
      expected
    );
  });
  it('does not mistake credit card wording for income or a balance for the amount', () => {
    expect(
      classifyFinancialMessage({
        text: 'Available Balance AED 200.00. Credit card XX4242 was used for USD10.00 at SAMPLE SHOP'
      })
    ).toMatchObject({
      direction: 'outgoing',
      amountMinor: 1000,
      currency: 'USD'
    });
  });
  it('holds excess precision instead of rounding money', () => {
    expect(
      classifyFinancialMessage({ text: 'Purchase AED 1.005 card XX4242' })
    ).toMatchObject({ amountMinor: null, disposition: 'review' });
  });
  it('preserves refund lifecycle and does not save promised credit', () => {
    expect(
      classifyFinancialMessage({
        text: 'AED 12.00 refunded; amount will be credited within 2-3 working days'
      })
    ).toMatchObject({
      subtype: 'refund',
      status: 'pending',
      disposition: 'review'
    });
  });
  it('extracts all explicit instrument hints rather than using the first four digits', () => {
    expect(
      classifyFinancialMessage({
        text: 'Debit card XXX4242 linked to acc. XXX004242 was used for AED37.00'
      }).instruments
    ).toEqual([
      { role: 'card', suffix: '4242' },
      { role: 'account', suffix: '004242' }
    ]);
  });
});
