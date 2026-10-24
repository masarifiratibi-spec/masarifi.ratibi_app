import type { Locale } from '@/domain/foundation';
export {
  createDefaultCategories,
  defaultCategorySeeds
} from '@/domain/default-categories';
export {
  isLegacyFixtureAccount,
  isLegacyFixtureTransaction
} from '@/domain/legacy-fixture-identity';
export const localizedDemoAccountName = (_id: string, _locale: Locale): null =>
  null;
export const localizedDemoTransactionTitle = (
  _id: string,
  _locale: Locale
): null => null;
