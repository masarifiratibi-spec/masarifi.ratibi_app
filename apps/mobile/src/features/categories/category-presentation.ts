import { normalizeSearch, type Category } from '@/domain/core-finance';
import type { Locale } from '@/domain/foundation';
import type { DesignIconName } from '@/design-system/icons';
import {
  categoryIconName as sharedCategoryIconName,
  categoryIconOptions
} from '@/design-system/components/financial/category-visuals';

export { categoryIconOptions };

export function categoryIconName(iconKey: string | null): DesignIconName {
  return sharedCategoryIconName(iconKey);
}

export interface CategoryPresentation {
  category: Category;
  label: string;
  parentLabel: string | null;
  statusLabelKey: string | null;
  originLabelKey: string;
  searchText: string;
}

export function projectCategory(
  category: Category,
  locale: Locale,
  parent?: Category
): CategoryPresentation {
  const label = locale === 'ar' ? category.labelAr : category.labelEn;
  const parentLabel = parent
    ? locale === 'ar'
      ? parent.labelAr
      : parent.labelEn
    : null;

  return {
    category,
    label,
    parentLabel,
    statusLabelKey:
      category.status === 'active'
        ? null
        : `coreFinance.categories.${category.status}`,
    originLabelKey: `coreFinance.categories.origin.${category.kind}`,
    searchText: normalizeSearch(`${category.labelAr} ${category.labelEn}`)
  };
}

export function matchesCategorySearch(
  presentation: CategoryPresentation,
  query: string
): boolean {
  return presentation.searchText.includes(normalizeSearch(query));
}
