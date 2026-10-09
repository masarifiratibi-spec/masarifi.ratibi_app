import {
  addKeywordRule,
  deleteKeywordRule,
  disableKeywordRule,
  editKeywordRule
} from './keyword-rules';
import { keywordRuleSchema, type KeywordRule } from '@/domain/app-shell';
const builtin: KeywordRule = {
  id: 'built-in',
  origin: 'default',
  group: 'expense',
  language: 'en',
  value: 'purchase',
  normalizedValue: 'purchase',
  enabled: true
};
describe('published keyword overrides', () => {
  it('keeps a disabled default row instead of deleting its override', () => {
    expect(deleteKeywordRule([builtin], builtin.id)).toEqual([
      { ...builtin, enabled: false }
    ]);
  });
  it('does not rewrite the published default wording', () => {
    expect(editKeywordRule([builtin], builtin.id, 'mystery').rules).toEqual([
      builtin
    ]);
  });
  it('can disable the final action keyword', () => {
    expect(disableKeywordRule([builtin], builtin.id).rules[0]?.enabled).toBe(
      false
    );
  });
  it('does not disable protected lifecycle safety', () => {
    const lifecycle = {
      ...builtin,
      group: 'failed_transaction' as const,
      value: 'failed'
    };
    expect(disableKeywordRule([lifecycle], lifecycle.id).rules).toEqual([
      lifecycle
    ]);
  });
  it('rejects duplicate phrase ownership across groups and language labels', () => {
    expect(
      addKeywordRule([builtin], {
        value: ' PURCHASE ',
        group: 'income',
        language: 'ar'
      }).error
    ).toBe('duplicate');
  });
  it('accepts neutral custom financial discovery wording without a fabricated direction', () => {
    expect(
      keywordRuleSchema.safeParse({
        ...builtin,
        origin: 'custom',
        group: 'financial'
      }).success
    ).toBe(true);
  });
});
