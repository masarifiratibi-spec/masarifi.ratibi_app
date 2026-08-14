import { normalizeMerchant } from '@/domain/voice-capture';
import { VoiceCategoryPreferenceRepository } from '@/storage/voice-category-preference-repository';

const knownMerchants: Record<string, string> = {
  netflix: 'subscriptions',
  fuel: 'fuel',
  coffee: 'restaurants',
  groceries: 'food'
};

const keywordRules: readonly [string, string][] = [
  ['salary', 'salary'],
  ['coffee', 'restaurants'],
  ['fuel', 'fuel'],
  ['installment', 'obligations']
];

export function createVoiceCategoryService(
  preferences = new VoiceCategoryPreferenceRepository()
) {
  return {
    async suggest(merchant: string, transcript: string, smartSuggestion: string | null) {
      const preference = await preferences.get(merchant);
      if (preference) return { categoryId: preference.categoryId, source: 'user' as const };
      const known = knownMerchants[normalizeMerchant(merchant)];
      if (known) return { categoryId: known, source: 'merchant' as const };
      const normalizedTranscript = transcript.toLocaleLowerCase('en');
      const keyword = keywordRules.find(([value]) => normalizedTranscript.includes(value));
      if (keyword) return { categoryId: keyword[1], source: 'keyword' as const };
      return { categoryId: smartSuggestion, source: 'smart' as const };
    },
    savePreference: (merchant: string, categoryId: string) =>
      preferences.save(merchant, categoryId)
  };
}

export const voiceCategoryService = createVoiceCategoryService();
