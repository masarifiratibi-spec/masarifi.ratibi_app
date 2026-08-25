import type { ImageSourcePropType } from 'react-native';

import type { DesignIconName } from '@/design-system/icons';

export type CategoryVisualSize = 'sm' | 'md' | 'lg';

export const categoryVisualSizes: Record<CategoryVisualSize, number> = {
  sm: 36,
  md: 48,
  lg: 56
};

export const categoryIconOptions: DesignIconName[] = [
  'category',
  'home',
  'restaurant',
  'car',
  'shopping',
  'health',
  'education',
  'entertainment',
  'receipt',
  'communication',
  'travel',
  'charity',
  'accounts',
  'transactions'
];

export interface CategoryVisualDescriptor {
  asset: ImageSourcePropType;
  fallbackIcon: DesignIconName;
  key: string;
  labelKey?: string;
  tone: number;
}

const assets = {
  charity: require('../../../../assets/category-visuals/openmoji-17.0/charity.png'),
  communication: require('../../../../assets/category-visuals/openmoji-17.0/communication.png'),
  education: require('../../../../assets/category-visuals/openmoji-17.0/education.png'),
  entertainment: require('../../../../assets/category-visuals/openmoji-17.0/entertainment.png'),
  food: require('../../../../assets/category-visuals/openmoji-17.0/food.png'),
  fuel: require('../../../../assets/category-visuals/openmoji-17.0/fuel.png'),
  generic: require('../../../../assets/category-visuals/openmoji-17.0/generic-finance.png'),
  health: require('../../../../assets/category-visuals/openmoji-17.0/health.png'),
  housing: require('../../../../assets/category-visuals/openmoji-17.0/housing.png'),
  obligations: require('../../../../assets/category-visuals/openmoji-17.0/obligations.png'),
  otherIncome: require('../../../../assets/category-visuals/openmoji-17.0/other-income.png'),
  receipt: require('../../../../assets/category-visuals/openmoji-17.0/receipt.png'),
  restaurants: require('../../../../assets/category-visuals/openmoji-17.0/restaurants.png'),
  salary: require('../../../../assets/category-visuals/openmoji-17.0/salary.png'),
  shopping: require('../../../../assets/category-visuals/openmoji-17.0/shopping.png'),
  subscriptions: require('../../../../assets/category-visuals/openmoji-17.0/subscriptions.png'),
  transfers: require('../../../../assets/category-visuals/openmoji-17.0/transfers.png'),
  transportation: require('../../../../assets/category-visuals/openmoji-17.0/transportation.png'),
  travel: require('../../../../assets/category-visuals/openmoji-17.0/travel.png')
} as const;

const visual = (
  key: string,
  asset: ImageSourcePropType,
  fallbackIcon: DesignIconName,
  tone: number,
  labelKey?: string
): CategoryVisualDescriptor => ({ asset, fallbackIcon, key, labelKey, tone });

const categoryVisuals: Record<string, CategoryVisualDescriptor> = {
  housing: visual(
    'housing',
    assets.housing,
    'home',
    0,
    'coreFinance.category.housing'
  ),
  food: visual(
    'food',
    assets.food,
    'restaurant',
    1,
    'coreFinance.category.food'
  ),
  restaurants: visual(
    'restaurants',
    assets.restaurants,
    'restaurant',
    2,
    'coreFinance.category.restaurants'
  ),
  restaurant: visual('restaurant', assets.restaurants, 'restaurant', 2),
  transportation: visual(
    'transportation',
    assets.transportation,
    'car',
    2,
    'coreFinance.category.transportation'
  ),
  fuel: visual('fuel', assets.fuel, 'car', 4, 'coreFinance.category.fuel'),
  shopping: visual(
    'shopping',
    assets.shopping,
    'shopping',
    1,
    'coreFinance.category.shopping'
  ),
  health: visual(
    'health',
    assets.health,
    'health',
    3,
    'coreFinance.category.health'
  ),
  healthcare: visual('healthcare', assets.health, 'health', 3),
  education: visual(
    'education',
    assets.education,
    'education',
    2,
    'coreFinance.category.education'
  ),
  entertainment: visual(
    'entertainment',
    assets.entertainment,
    'entertainment',
    4,
    'coreFinance.category.entertainment'
  ),
  subscriptions: visual(
    'subscriptions',
    assets.subscriptions,
    'receipt',
    0,
    'coreFinance.category.subscriptions'
  ),
  utilities: visual(
    'utilities',
    assets.receipt,
    'receipt',
    3,
    'coreFinance.category.utilities'
  ),
  bills: visual('bills', assets.receipt, 'receipt', 3),
  communication: visual(
    'communication',
    assets.communication,
    'communication',
    2,
    'coreFinance.category.communication'
  ),
  travel: visual(
    'travel',
    assets.travel,
    'travel',
    0,
    'coreFinance.category.travel'
  ),
  charity: visual(
    'charity',
    assets.charity,
    'charity',
    1,
    'coreFinance.category.charity'
  ),
  fees: visual(
    'fees',
    assets.receipt,
    'receipt',
    4,
    'coreFinance.category.fees'
  ),
  salary: visual(
    'salary',
    assets.salary,
    'accounts',
    0,
    'coreFinance.category.salary'
  ),
  income: visual('income', assets.salary, 'accounts', 0),
  'other-income': visual(
    'other-income',
    assets.otherIncome,
    'accounts',
    1,
    'coreFinance.category.otherIncome'
  ),
  transfers: visual(
    'transfers',
    assets.transfers,
    'transactions',
    2,
    'coreFinance.category.transfers'
  ),
  transfer: visual('transfer', assets.transfers, 'transactions', 2),
  obligations: visual(
    'obligations',
    assets.obligations,
    'receipt',
    4,
    'coreFinance.category.obligations'
  )
};

const genericVisual = visual('generic-finance', assets.generic, 'category', 0);

export function categoryIconName(iconKey: string | null): DesignIconName {
  if (!iconKey) return 'category';
  if (categoryIconOptions.includes(iconKey as DesignIconName)) {
    return iconKey as DesignIconName;
  }
  return categoryVisuals[iconKey]?.fallbackIcon ?? 'category';
}

export function resolveCategoryVisual(
  visualKey: string | null | undefined,
  fallbackIcon: DesignIconName
): CategoryVisualDescriptor | undefined {
  if (visualKey === undefined) return undefined;
  return (
    categoryVisuals[visualKey ?? ''] ??
    (fallbackIcon === 'category' ? genericVisual : undefined)
  );
}
