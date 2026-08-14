import React, { useEffect, useState } from 'react';

import { StyledText } from '@/components/StyledText';
import { ActionButton } from '@/design-system/components/ActionButton';
import { FormField } from '@/design-system/components/forms/FormField';
import { SwitchRow } from '@/design-system/components/forms/SelectionControls';
import { parseAmountToMinor, type Category } from '@/domain/core-finance';
import type { CategoryBudget } from '@/domain/financial-planning';
import { useCategories } from '@/features/core-finance/core-finance-queries';
import { PlanningScreen, PlanningState } from '@/features/financial-planning/PlanningScaffold';
import { usePlanningFormDraft } from '@/features/financial-planning/usePlanningDraft';
import { currentLocale, translate } from '@/localization/i18n';
import { financialPlanningService } from '@/services/mocks/financial-planning-service';
import { usePreferenceStore } from '@/state/preferences';
import { useBudgetById, usePlanningMutation } from './budget-queries';

interface BudgetDraftPayload {
  configuredExpenseLimitMinor?: number;
  incomeTargetMinor?: number;
  savingsTargetMinor?: number;
  rolloverEnabled?: boolean;
  copiedFromBudgetId?: string;
  categories?: CategoryBudget[];
}

export function BudgetForm({ budgetId = '' }: { budgetId?: string }) {
  const existing = useBudgetById(budgetId);
  const categories = useCategories();
  const currencyCode = usePreferenceStore((state) => state.baseCurrencyCode);
  const [periodKey, setPeriodKey] = useState(() => new Date().toISOString().slice(0, 7));
  const [expenseLimit, setExpenseLimit] = useState('');
  const [incomeTarget, setIncomeTarget] = useState('');
  const [savingsTarget, setSavingsTarget] = useState('');
  const [categoryLimits, setCategoryLimits] = useState<Record<string, string>>({});
  const [rolloverEnabled, setRolloverEnabled] = useState(false);
  const [copiedFromBudgetId, setCopiedFromBudgetId] = useState<string | null>(null);
  const [copying, setCopying] = useState(false);
  const [error, setError] = useState<string>();
  const [saved, setSaved] = useState(false);
  const save = usePlanningMutation((input: Parameters<typeof financialPlanningService.saveBudget>[0]) =>
    financialPlanningService.saveBudget(input, `budget:${budgetId || input.periodKey}:${Date.now()}`)
  );

  useEffect(() => {
    if (!existing.data) return;
    setPeriodKey(existing.data.budget.periodKey);
    setExpenseLimit(String(existing.data.budget.configuredExpenseLimitMinor / 100));
    setIncomeTarget(String(existing.data.budget.incomeTargetMinor / 100));
    setSavingsTarget(String(existing.data.budget.savingsTargetMinor / 100));
    setRolloverEnabled(existing.data.budget.rolloverEnabled);
    setCopiedFromBudgetId(existing.data.budget.copiedFromBudgetId);
    setCategoryLimits(Object.fromEntries(existing.data.categories.map((item: CategoryBudget) => [item.categoryId, String(item.limitMinor / 100)])));
  }, [existing.data]);
  const draftEnabled = !budgetId || Boolean(existing.data);
  const { draftReady, discardDraft } = usePlanningFormDraft({
    id: `planning-form-budget:${budgetId || 'new'}`,
    kind: 'budget',
    entityId: budgetId || null,
    payload: { periodKey, expenseLimit, incomeTarget, savingsTarget, categoryLimits, rolloverEnabled, copiedFromBudgetId },
    meaningful: Boolean(expenseLimit || incomeTarget || savingsTarget || Object.keys(categoryLimits).length),
    enabled: draftEnabled,
    restore: (payload) => {
      const draft = payload as Partial<{ periodKey: string; expenseLimit: string; incomeTarget: string; savingsTarget: string; categoryLimits: Record<string, string>; rolloverEnabled: boolean; copiedFromBudgetId: string | null }>;
      if (typeof draft.periodKey === 'string') setPeriodKey(draft.periodKey);
      if (typeof draft.expenseLimit === 'string') setExpenseLimit(draft.expenseLimit);
      if (typeof draft.incomeTarget === 'string') setIncomeTarget(draft.incomeTarget);
      if (typeof draft.savingsTarget === 'string') setSavingsTarget(draft.savingsTarget);
      if (draft.categoryLimits && typeof draft.categoryLimits === 'object') setCategoryLimits(draft.categoryLimits);
      if (typeof draft.rolloverEnabled === 'boolean') setRolloverEnabled(draft.rolloverEnabled);
      if (typeof draft.copiedFromBudgetId === 'string' || draft.copiedFromBudgetId === null) setCopiedFromBudgetId(draft.copiedFromBudgetId);
    },
    onError: () => setError(translate('planning.state.error'))
  });

  const copyPrevious = async () => {
    setCopying(true);
    setError(undefined);
    try {
      const draft = await financialPlanningService.createBudgetDraftFromPrevious(periodKey);
      const payload = draft.payload as BudgetDraftPayload;
      if (payload.configuredExpenseLimitMinor === undefined) {
        setError(translate('planning.budget.noPrevious'));
        return;
      }
      setExpenseLimit(String(payload.configuredExpenseLimitMinor / 100));
      setIncomeTarget(String((payload.incomeTargetMinor ?? 0) / 100));
      setSavingsTarget(String((payload.savingsTargetMinor ?? 0) / 100));
      setRolloverEnabled(payload.rolloverEnabled ?? false);
      setCopiedFromBudgetId(payload.copiedFromBudgetId ?? null);
      setCategoryLimits(Object.fromEntries((payload.categories ?? []).map((item) => [item.categoryId, String(item.limitMinor / 100)])));
    } catch {
      setError(translate('planning.state.error'));
    } finally {
      setCopying(false);
    }
  };

  const submit = () => {
    const configuredExpenseLimitMinor = parseAmountToMinor(expenseLimit);
    const incomeTargetMinor = parseAmountToMinor(incomeTarget);
    const savingsTargetMinor = parseAmountToMinor(savingsTarget);
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(periodKey) || configuredExpenseLimitMinor === null || incomeTargetMinor === null || savingsTargetMinor === null) {
      setError(translate('planning.validation.required'));
      return;
    }
    const now = Date.now();
    const budgetCategories = Object.entries(categoryLimits).flatMap(([categoryId, value]) => {
      const limitMinor = parseAmountToMinor(value);
      if (!limitMinor) return [];
      const prior = existing.data?.categories.find((item: CategoryBudget) => item.categoryId === categoryId);
      return [{
        id: prior?.id ?? `category-budget-${budgetId || periodKey}-${categoryId}`,
        version: prior?.version ?? 1,
        syncStatus: prior?.syncStatus ?? 'pending' as const,
        createdAt: prior?.createdAt ?? now,
        updatedAt: now,
        budgetId: budgetId || 'pending',
        categoryId,
        limitMinor,
        alertThresholds: prior?.alertThresholds ?? [80, 90, 100],
        status: 'active' as const
      }];
    });
    save.mutate({
      periodKey,
      currencyCode: existing.data?.budget.currencyCode ?? currencyCode,
      configuredExpenseLimitMinor,
      incomeTargetMinor,
      savingsTargetMinor,
      rolloverEnabled,
      rolloverCreditMinor: existing.data?.budget.rolloverCreditMinor ?? 0,
      categories: budgetCategories,
      copiedFromBudgetId
    }, {
      onSuccess: () => { setSaved(true); void discardDraft(); },
      onError: () => setError(translate('planning.state.error'))
    });
  };

  if (existing.isError || categories.isError) return <PlanningScreen titleKey={budgetId ? 'planning.budgets.edit' : 'planning.budgets.new'}><PlanningState state="error" onRetry={() => { void existing.refetch(); void categories.refetch(); }} /></PlanningScreen>;
  if ((budgetId && existing.isLoading) || categories.isLoading || (draftEnabled && !draftReady)) return <PlanningScreen titleKey={budgetId ? 'planning.budgets.edit' : 'planning.budgets.new'}><PlanningState state="loading" /></PlanningScreen>;
  return (
    <PlanningScreen titleKey={budgetId ? 'planning.budgets.edit' : 'planning.budgets.new'}>
      <FormField label={translate('planning.budget.period')} onChangeText={setPeriodKey} value={periodKey} />
      {!budgetId ? <ActionButton label={translate('planning.budget.copyPrevious')} loading={copying} onPress={() => void copyPrevious()} variant="secondary" /> : null}
      <FormField label={translate('planning.budget.expenseLimit')} onChangeText={setExpenseLimit} value={expenseLimit} variant="amount" />
      <FormField label={translate('planning.budget.incomeTarget')} onChangeText={setIncomeTarget} value={incomeTarget} variant="amount" />
      <FormField label={translate('planning.budget.savingsTarget')} onChangeText={setSavingsTarget} value={savingsTarget} variant="amount" errorText={error} />
      <StyledText variant="subtitle">{translate('planning.budget.categoryLimits')}</StyledText>
      {categories.data?.filter((category: Category) => !['salary', 'other-income', 'transfers'].includes(category.id)).map((category: Category) => (
        <FormField
          key={category.id}
          label={`${currentLocale() === 'ar' ? category.labelAr : category.labelEn} · ${translate('planning.budget.categoryLimit')}`}
          onChangeText={(value) => setCategoryLimits((current) => ({ ...current, [category.id]: value }))}
          value={categoryLimits[category.id] ?? ''}
          variant="amount"
        />
      ))}
      <SwitchRow label={translate('planning.budget.rollover')} value={rolloverEnabled} onValueChange={setRolloverEnabled} />
      <ActionButton label={translate('planning.action.save')} loading={save.isPending} onPress={submit} />
      {saved ? <StyledText accessibilityRole="alert">{translate('planning.state.saved')}</StyledText> : null}
    </PlanningScreen>
  );
}
