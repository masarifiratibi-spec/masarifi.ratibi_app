import React, { useEffect, useState } from 'react';

import { StyledText } from '@/components/StyledText';
import { ActionButton } from '@/design-system/components/ActionButton';
import { FormField } from '@/design-system/components/forms/FormField';
import { RadioCard, SwitchRow } from '@/design-system/components/forms/SelectionControls';
import { parseAmountToMinor, type Account } from '@/domain/core-finance';
import type { LocalDate } from '@/domain/financial-planning';
import { useAccounts } from '@/features/core-finance/core-finance-queries';
import { PlanningScreen, PlanningState } from '@/features/financial-planning/PlanningScaffold';
import { usePlanningFormDraft } from '@/features/financial-planning/usePlanningDraft';
import { translate } from '@/localization/i18n';
import { financialPlanningService } from '@/services/mocks/financial-planning-service';
import { usePreferenceStore } from '@/state/preferences';
import { usePlanningMutation, useSavingsGoal } from './savings-queries';

export function SavingsGoalForm({ goalId = '' }: { goalId?: string }) {
  const existing = useSavingsGoal(goalId);
  const accounts = useAccounts();
  const currencyCode = usePreferenceStore((state) => state.baseCurrencyCode);
  const [title, setTitle] = useState('');
  const [target, setTarget] = useState('');
  const [opening, setOpening] = useState('0');
  const [targetDate, setTargetDate] = useState(() => `${new Date().getUTCFullYear() + 1}-01-01` as LocalDate);
  const [accountId, setAccountId] = useState('');
  const [emergencyFund, setEmergencyFund] = useState(false);
  const [error, setError] = useState<string>();
  const [saved, setSaved] = useState(false);
  const save = usePlanningMutation((input: Parameters<typeof financialPlanningService.createGoal>[0]) =>
    existing.data
      ? financialPlanningService.updateGoal(goalId, existing.data.goal.version, input, `goal:${goalId}:${Date.now()}`)
      : financialPlanningService.createGoal(input, `goal:new:${Date.now()}`)
  );

  useEffect(() => {
    const goal = existing.data?.goal;
    if (!goal) return;
    setTitle(goal.title);
    setTarget(String(goal.targetMinor / 100));
    setOpening(String(goal.openingTrackedMinor / 100));
    setTargetDate(goal.targetDate);
    setAccountId(goal.linkedAccountId ?? '');
    setEmergencyFund(goal.emergencyFund);
  }, [existing.data]);
  const draftEnabled = !goalId || Boolean(existing.data);
  const { draftReady, discardDraft } = usePlanningFormDraft({
    id: `planning-form-goal:${goalId || 'new'}`,
    kind: 'goal',
    entityId: goalId || null,
    payload: { title, target, opening, targetDate, accountId, emergencyFund },
    meaningful: Boolean(title || target || accountId),
    enabled: draftEnabled,
    restore: (payload) => {
      const draft = payload as Partial<{ title: string; target: string; opening: string; targetDate: LocalDate; accountId: string; emergencyFund: boolean }>;
      if (typeof draft.title === 'string') setTitle(draft.title);
      if (typeof draft.target === 'string') setTarget(draft.target);
      if (typeof draft.opening === 'string') setOpening(draft.opening);
      if (typeof draft.targetDate === 'string') setTargetDate(draft.targetDate);
      if (typeof draft.accountId === 'string') setAccountId(draft.accountId);
      if (typeof draft.emergencyFund === 'boolean') setEmergencyFund(draft.emergencyFund);
    },
    onError: () => setError(translate('planning.state.error'))
  });

  const submit = () => {
    const targetMinor = parseAmountToMinor(target);
    const openingTrackedMinor = parseAmountToMinor(opening);
    if (!title.trim() || !targetMinor || openingTrackedMinor === null || openingTrackedMinor > targetMinor || !/^\d{4}-\d{2}-\d{2}$/.test(targetDate)) {
      setError(translate('planning.validation.required'));
      return;
    }
    save.mutate({
      title: title.trim(),
      targetMinor,
      openingTrackedMinor,
      currencyCode: existing.data?.goal.currencyCode ?? currencyCode,
      targetDate,
      linkedAccountId: accountId || null,
      emergencyFund
    }, { onSuccess: () => { setSaved(true); void discardDraft(); }, onError: () => setError(translate('planning.state.error')) });
  };

  if (existing.isError || accounts.isError) return <PlanningScreen titleKey={goalId ? 'planning.savings.edit' : 'planning.savings.new'}><PlanningState state="error" onRetry={() => { void existing.refetch(); void accounts.refetch(); }} /></PlanningScreen>;
  if ((goalId && existing.isLoading) || accounts.isLoading || (draftEnabled && !draftReady)) return <PlanningScreen titleKey={goalId ? 'planning.savings.edit' : 'planning.savings.new'}><PlanningState state="loading" /></PlanningScreen>;
  return (
    <PlanningScreen titleKey={goalId ? 'planning.savings.edit' : 'planning.savings.new'}>
      <FormField label={translate('planning.savings.goalTitle')} onChangeText={setTitle} value={title} />
      <FormField label={translate('planning.savings.targetAmount')} onChangeText={setTarget} value={target} variant="amount" />
      <FormField label={translate('planning.savings.openingAmount')} onChangeText={setOpening} value={opening} variant="amount" />
      <FormField label={translate('planning.savings.targetDate')} onChangeText={(value) => setTargetDate(value as LocalDate)} value={targetDate} errorText={error} />
      {accounts.data?.map((account: Account) => <RadioCard key={account.id} label={`${account.name} · ${account.currencyCode}`} selected={accountId === account.id} onPress={() => setAccountId(account.id)} />)}
      <SwitchRow label={translate('planning.savings.emergencyFund')} value={emergencyFund} onValueChange={setEmergencyFund} />
      <StyledText>{translate('planning.savings.trackingOnly')}</StyledText>
      <ActionButton label={translate('planning.action.save')} loading={save.isPending} onPress={submit} />
      {saved ? <StyledText accessibilityRole="alert">{translate('planning.state.saved')}</StyledText> : null}
    </PlanningScreen>
  );
}
