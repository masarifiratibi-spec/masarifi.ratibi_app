import {
  assistantScopeNotice,
  directAssistantScopeNotice,
} from '../../../src/ai/assistant-domain-policy';

describe('Saudi assistant server notices', () => {
  it.each(['ازيك', 'السلام عليكم', 'أهلاً!', 'هلا', 'هلا والله!', 'حيّاك الله', 'كيف الحال؟'])(
    'greets %s in neutral Saudi Arabic without a provider',
    (question) => {
      expect(directAssistantScopeNotice(question)?.content).toBe(
        'حيّاك! وش ودّك نراجع في مصاريفك؟',
      );
    },
  );

  it('redirects unrelated work with the same Saudi voice', () => {
    expect(directAssistantScopeNotice('اكتب برنامج بايثون')?.content).toBe(
      'أنا متخصص في مصاريفك ودخلك وميزانيتك داخل مصاريفي. وش ودّك تعرف عن بياناتك المالية؟',
    );
  });

  it.each([
    'صرفت كام النهارده؟',
    'السلام عليكم، وش أكثر شي صرفت عليه؟',
    'هلا، كم صرفت هالشهر؟',
    'ابحث عن معاملة عند متجر النهارده',
  ])('preserves financial understanding for %s', (question) => {
    expect(directAssistantScopeNotice(question)).toBeNull();
  });

  it('preserves English and the nonfinancial metadata contract', () => {
    expect(assistantScopeNotice('hello', true)).toMatchObject({
      content:
        'Hello! I help analyze your spending, income and financial data. What would you like to know about them?',
      metadata: { locale: 'en', values: [], currencies: [], reasons: ['assistant_introduction'] },
    });
  });
});
