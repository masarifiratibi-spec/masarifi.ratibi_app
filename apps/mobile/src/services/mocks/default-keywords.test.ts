import { defaultKeywordRules, keywordGroups } from './default-keywords';

describe('default keyword fixtures', () => {
  it('covers all eleven approved groups in Arabic and English', () => {
    expect(keywordGroups).toHaveLength(11);

    for (const group of keywordGroups) {
      expect(defaultKeywordRules).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ group, language: 'ar', enabled: true }),
          expect.objectContaining({ group, language: 'en', enabled: true })
        ])
      );
    }
  });

  it('ships classified Arabic and English banking terms without balance-only triggers', () => {
    const terms = defaultKeywordRules.map((rule) => rule.normalizedValue);

    expect(terms).toEqual(
      expect.arrayContaining([
        'used for',
        'debit transaction',
        'cr. transaction',
        'incoming transfer',
        'cash withdrawal',
        'foreign transaction fee',
        'declined',
        'insufficient funds',
        'شراء إنترنت',
        'تحويل وارد',
        'سحب نقدي',
        'عمولة',
        'لم تتم',
        'غير ناجحة'
      ])
    );
    expect(terms).not.toEqual(
      expect.arrayContaining([
        'balance',
        'available balance',
        'avl.bal',
        'الرصيد',
        'الرصيد المتاح'
      ])
    );
  });

  it('uses unique stable identifiers and normalized values', () => {
    expect(new Set(defaultKeywordRules.map((rule) => rule.id)).size).toBe(
      defaultKeywordRules.length
    );
    expect(
      defaultKeywordRules.every(
        (rule) =>
          rule.normalizedValue ===
          rule.value.normalize('NFKC').toLocaleLowerCase(rule.language)
      )
    ).toBe(true);
  });
});
