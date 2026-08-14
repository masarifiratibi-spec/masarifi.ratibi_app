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
});
