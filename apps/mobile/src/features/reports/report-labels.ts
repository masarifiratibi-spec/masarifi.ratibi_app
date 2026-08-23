import type { MessageKey } from '@/localization/i18n';
import { translate } from '@/localization/i18n';
import type { ReportBreakdownItem } from '@/domain/reports';

const systemCategoryLabelKeys: Record<string, MessageKey> = {
  housing: 'coreFinance.category.housing',
  food: 'coreFinance.category.food',
  restaurants: 'coreFinance.category.restaurants',
  transportation: 'coreFinance.category.transportation',
  fuel: 'coreFinance.category.fuel',
  shopping: 'coreFinance.category.shopping',
  health: 'coreFinance.category.health',
  education: 'coreFinance.category.education',
  entertainment: 'coreFinance.category.entertainment',
  subscriptions: 'coreFinance.category.subscriptions',
  utilities: 'coreFinance.category.utilities',
  communication: 'coreFinance.category.communication',
  travel: 'coreFinance.category.travel',
  charity: 'coreFinance.category.charity',
  fees: 'coreFinance.category.fees',
  salary: 'coreFinance.category.salary',
  'other-income': 'coreFinance.category.otherIncome',
  transfers: 'coreFinance.category.transfers',
  obligations: 'coreFinance.category.obligations'
};

export function reportBreakdownItemLabel(
  breakdownItem: ReportBreakdownItem
): string {
  return reportBreakdownLabel(breakdownItem.id, breakdownItem.label);
}

export function reportBreakdownMemberLabels(
  breakdownItem: ReportBreakdownItem
): string[] {
  return (breakdownItem.memberIds ?? []).map((id, index) =>
    reportBreakdownLabel(id, breakdownItem.memberLabels?.[index] ?? id)
  );
}

function reportBreakdownLabel(id: string, fallback: string): string {
  if (id === 'other') return translate('designSystem.chart.other');
  const key = systemCategoryLabelKeys[id];
  return key ? translate(key) : fallback;
}
