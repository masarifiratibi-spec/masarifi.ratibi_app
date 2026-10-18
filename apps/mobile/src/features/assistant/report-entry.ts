import { z } from 'zod';
import type { Locale } from '@/domain/foundation';
import { translate, translateDynamic } from '@/localization/i18n';

const actions = {
  explain: 'reports.action.explain',
  spending_increase: 'reports.action.spendingIncrease',
  find_savings: 'reports.action.findSavings',
  compare: 'reports.action.compare',
  create_plan: 'reports.action.createPlan'
} as const;

const localDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/u).refine(value => {
  const at = Date.parse(`${value}T00:00:00Z`);
  return Number.isFinite(at) && new Date(at).toISOString().slice(0, 10) === value;
});
const contextSchema = z.object({
  startDate: localDate,
  endDate: localDate,
  currencyCode: z.string().regex(/^[A-Z]{3}$/u),
  accountName: z.string().trim().min(1).max(160).nullable()
}).strict().refine(value => value.startDate <= value.endDate);

// Route values prepare editable question text; they never supply financial facts or authorization.
export function reportEntryQuestion(
  params: {action?: string | string[]; reportContext?: string | string[]},
  locale: Locale
): string | undefined {
  if (typeof params.action !== 'string' || !Object.hasOwn(actions, params.action) ||
      typeof params.reportContext !== 'string' || params.reportContext.length > 1500) return undefined;
  try {
    const context = contextSchema.parse(JSON.parse(params.reportContext));
    const scope = context.accountName === null
      ? translate('coreFinance.home.allAccounts', locale)
      : JSON.stringify(context.accountName);
    return `${translate(actions[params.action as keyof typeof actions], locale)}. ${translateDynamic('assistant.report.scope', {
      start: context.startDate, end: context.endDate, currency: context.currencyCode, account: scope
    }, locale)}`;
  } catch { return undefined; }
}
