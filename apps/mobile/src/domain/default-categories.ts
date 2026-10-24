import type { Category } from './core-finance';
const SYSTEM_CATEGORY_EPOCH = Date.UTC(2026, 7, 8, 12);
export const defaultCategorySeeds = [
  ['housing', 'السكن', 'Housing', 'expense'],
  ['food', 'الطعام', 'Food', 'expense'],
  ['restaurants', 'المطاعم', 'Restaurants', 'expense'],
  ['transportation', 'المواصلات', 'Transportation', 'expense'],
  ['fuel', 'الوقود', 'Fuel', 'expense'],
  ['shopping', 'التسوق', 'Shopping', 'expense'],
  ['health', 'الصحة', 'Health', 'expense'],
  ['education', 'التعليم', 'Education', 'expense'],
  ['entertainment', 'الترفيه', 'Entertainment', 'expense'],
  ['subscriptions', 'الاشتراكات الرقمية', 'Digital subscriptions', 'expense'],
  ['utilities', 'الخدمات', 'Utilities', 'expense'],
  [
    'communication',
    'الاتصالات والإنترنت',
    'Communication and internet',
    'expense'
  ],
  ['travel', 'السفر', 'Travel', 'expense'],
  ['charity', 'الصدقة', 'Charity', 'expense'],
  ['fees', 'الرسوم', 'Fees', 'expense'],
  ['salary', 'الراتب', 'Salary', 'income'],
  ['other-income', 'دخل آخر', 'Other income', 'income'],
  ['remittance', 'الحوالات المالية', 'Remittances', 'expense'],
  ['obligations', 'الالتزامات', 'Obligations', 'expense']
] as const;

export function createDefaultCategories(): Category[] {
  return defaultCategorySeeds.map(
    ([id, labelAr, labelEn, financialType], index) => ({
      id,
      kind: 'system',
      financialType,
      parentId: null,
      labelAr,
      labelEn,
      iconKey: id === 'remittance' ? 'transfers' : id,
      colorKey: `category-${index % 8}`,
      isFavorite: index < 4,
      status: 'active',
      mergedIntoId: null,
      createdAt: SYSTEM_CATEGORY_EPOCH,
      updatedAt: SYSTEM_CATEGORY_EPOCH
    })
  );
}
