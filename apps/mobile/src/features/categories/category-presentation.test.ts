import { fixtureCategories } from '@/test-utils/core-finance-fixtures';
import {
  categoryIconName,
  matchesCategorySearch,
  projectCategory
} from './category-presentation';

it('projects localized labels without inventing usage or sync state', () => {
  const parent = fixtureCategories[0];
  const child = { ...fixtureCategories[1], parentId: parent.id };
  const presentation = projectCategory(child, 'en', parent);

  expect(presentation).toMatchObject({
    label: child.labelEn,
    parentLabel: parent.labelEn,
    originLabelKey: `coreFinance.categories.origin.${child.kind}`
  });
  expect(matchesCategorySearch(presentation, child.labelAr)).toBe(true);
  expect(matchesCategorySearch(presentation, 'missing')).toBe(false);
});

it('resolves every system category icon and falls back safely', () => {
  expect(fixtureCategories.map((category) => categoryIconName(category.iconKey)))
    .toEqual([
      'home',
      'restaurant',
      'restaurant',
      'car',
      'car',
      'shopping',
      'health',
      'education',
      'entertainment',
      'receipt',
      'receipt',
      'communication',
      'travel',
      'charity',
      'receipt',
      'accounts',
      'accounts',
      'transactions',
      'receipt'
    ]);
  expect(categoryIconName(null)).toBe('category');
  expect(categoryIconName('unknown-custom-key')).toBe('category');
});
