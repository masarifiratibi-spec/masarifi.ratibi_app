import React, { useEffect, useState } from 'react';

import { StyledText } from '@/components/StyledText';
import { ActionButton } from '@/design-system/components/ActionButton';
import { FormField } from '@/design-system/components/forms/FormField';
import { RadioCard, SwitchRow } from '@/design-system/components/forms/SelectionControls';
import { parseAmountToMinor, type Account } from '@/domain/core-finance';
import type { LocalDate, Obligation } from '@/domain/financial-planning';
import { useAccounts } from '@/features/core-finance/core-finance-queries';
import { PlanningScreen, PlanningState } from '@/features/financial-planning/PlanningScaffold';
import { usePlanningFormDraft } from '@/features/financial-planning/usePlanningDraft';
import { translate, type MessageKey } from '@/localization/i18n';
import { financialPlanningService } from '@/services/mocks/financial-planning-service';
import { usePreferenceStore } from '@/state/preferences';
import { useObligation, usePlanningMutation } from './obligation-queries';

const obligationTypes: Obligation['type'][] = ['car_installment', 'personal_loan', 'rent', 'subscription', 'debt', 'custom'];
const scheduleKinds: Obligation['scheduleKind'][] = ['fixed_term', 'open_ended', 'irregular'];

export function ObligationForm({ obligationId = '' }: { obligationId?: string }) {
  const existing = useObligation(obligationId);
  const accounts = useAccounts();
  const currencyCode = usePreferenceStore((state) => state.baseCurrencyCode);
  const [direction, setDirection] = useState<Obligation['direction']>('payable');
  const [type, setType] = useState<Obligation['type']>('car_installment');
  const [scheduleKind, setScheduleKind] = useState<Obligation['scheduleKind']>('fixed_term');
  const [title, setTitle] = useState('');
  const [provider, setProvider] = useState('');
  const [total, setTotal] = useState('');
  const [installment, setInstallment] = useState('');
  const [count, setCount] = useState('');
  const [dueDay, setDueDay] = useState('1');
  const [accountId, setAccountId] = useState('');
  const [automaticMatchingEnabled, setAutomaticMatchingEnabled] = useState(false);
  const [error, setError] = useState<string>();
  const [saved, setSaved] = useState(false);
  const save = usePlanningMutation((input: Parameters<typeof financialPlanningService.createObligation>[0]) =>
    existing.data
      ? financialPlanningService.updateObligation(obligationId, existing.data.obligation.version, input, `obligation:${obligationId}:${Date.now()}`)
      : financialPlanningService.createObligation(input, `obligation:new:${Date.now()}`)
  );

  useEffect(() => {
    const item = existing.data?.obligation;
    if (!item) return;
    setDirection(item.direction);
    setType(item.type);
    setScheduleKind(item.scheduleKind);
    setTitle(item.title);
    setProvider(item.provider ?? '');
    setTotal(item.contractedTotalMinor === null ? '' : String(item.contractedTotalMinor / 100));
    setInstallment(item.installmentAmountMinor === null ? '' : String(item.installmentAmountMinor / 100));
    setCount(item.installmentCount === null ? '' : String(item.installmentCount));
    setDueDay(String(item.dueDay ?? 1));
    setAccountId(item.fundingAccountId ?? '');
    setAutomaticMatchingEnabled(item.automaticMatchingEnabled);
  }, [existing.data]);
  const draftEnabled = !obligationId || Boolean(existing.data);
  const { draftReady, discardDraft } = usePlanningFormDraft({
    id: `planning-form-obligation:${obligationId || 'new'}`,
    kind: 'obligation',
    entityId: obligationId || null,
    payload: { direction, type, scheduleKind, title, provider, total, installment, count, dueDay, accountId, automaticMatchingEnabled },
    meaningful: Boolean(title || provider || total || installment || accountId),
    enabled: draftEnabled,
    restore: (payload) => {
      const draft = payload as Partial<{
        direction: Obligation['direction'];
        type: Obligation['type'];
        scheduleKind: Obligation['scheduleKind'];
        title: string;
        provider: string;
        total: string;
        installment: string;
        count: string;
        dueDay: string;
        accountId: string;
        automaticMatchingEnabled: boolean;
      }>;
      if (draft.direction === 'payable' || draft.direction === 'receivable') setDirection(draft.direction);
      if (draft.type && obligationTypes.includes(draft.type)) setType(draft.type);
      if (draft.scheduleKind && scheduleKinds.includes(draft.scheduleKind)) setScheduleKind(draft.scheduleKind);
      if (typeof draft.title === 'string') setTitle(draft.title);
      if (typeof draft.provider === 'string') setProvider(draft.provider);
      if (typeof draft.total === 'string') setTotal(draft.total);
      if (typeof draft.installment === 'string') setInstallment(draft.installment);
      if (typeof draft.count === 'string') setCount(draft.count);
      if (typeof draft.dueDay === 'string') setDueDay(draft.dueDay);
      if (typeof draft.accountId === 'string') setAccountId(draft.accountId);
      if (typeof draft.automaticMatchingEnabled === 'boolean') setAutomaticMatchingEnabled(draft.automaticMatchingEnabled);
    },
    onError: () => setError(translate('planning.state.error'))
  });

  const submit = () => {
    const contractedTotalMinor = total ? parseAmountToMinor(total) : null;
    const installmentAmountMinor = installment ? parseAmountToMinor(installment) : null;
    const installmentCount = count ? Number(count) : null;
    const day = Number(dueDay);
    if (!title.trim() || day < 1 || day > 31 || (scheduleKind === 'fixed_term' && (!contractedTotalMinor || !installmentAmountMinor || !installmentCount))) {
      setError(translate('planning.validation.required'));
      return;
    }
    save.mutate({
      direction,
      type,
      scheduleKind,
      title: title.trim(),
      provider: provider.trim() || null,
      currencyCode: existing.data?.obligation.currencyCode ?? currencyCode,
      contractedTotalMinor, openingPaidMinor: existing.data?.obligation.openingPaidMinor ?? 0,
      installmentAmountMinor, installmentCount, dueDay: day,
      startDate: existing.data?.obligation.startDate ?? new Date().toISOString().slice(0, 10) as LocalDate,
      endDate: existing.data?.obligation.endDate ?? null,
      fundingAccountId: accountId || accounts.data?.[0]?.id || null,
      automaticMatchingEnabled
    }, { onSuccess: () => { setSaved(true); void discardDraft(); }, onError: () => setError(translate('planning.state.error')) });
  };

  if (existing.isError || accounts.isError) return <PlanningScreen titleKey={obligationId ? 'planning.obligations.edit' : 'planning.obligations.new'}><PlanningState state="error" onRetry={() => { void existing.refetch(); void accounts.refetch(); }} /></PlanningScreen>;
  if ((obligationId && existing.isLoading) || accounts.isLoading || (draftEnabled && !draftReady)) return <PlanningScreen titleKey={obligationId ? 'planning.obligations.edit' : 'planning.obligations.new'}><PlanningState state="loading" /></PlanningScreen>;
  return (
    <PlanningScreen titleKey={obligationId ? 'planning.obligations.edit' : 'planning.obligations.new'}>
      <StyledText variant="subtitle">{translate('planning.obligation.direction')}</StyledText>
      {(['payable', 'receivable'] as const).map((item) => <RadioCard key={item} label={translate(`planning.obligation.direction.${item}` as MessageKey)} selected={direction === item} onPress={() => setDirection(item)} />)}
      <StyledText variant="subtitle">{translate('planning.obligation.type')}</StyledText>
      {obligationTypes.map((item) => <RadioCard key={item} label={translate(`planning.obligation.type.${item}` as MessageKey)} selected={type === item} onPress={() => setType(item)} />)}
      <StyledText variant="subtitle">{translate('planning.obligation.schedule')}</StyledText>
      {scheduleKinds.map((item) => <RadioCard key={item} label={translate(`planning.obligation.schedule.${item}` as MessageKey)} selected={scheduleKind === item} onPress={() => setScheduleKind(item)} />)}
      <FormField label={translate('planning.obligation.title')} onChangeText={setTitle} value={title} />
      <FormField label={translate('planning.obligation.provider')} onChangeText={setProvider} value={provider} />
      {scheduleKind === 'fixed_term' ? <><FormField label={translate('planning.obligation.total')} onChangeText={setTotal} value={total} variant="amount" /><FormField label={translate('planning.obligation.installment')} onChangeText={setInstallment} value={installment} variant="amount" /><FormField label={translate('planning.obligation.count')} onChangeText={setCount} value={count} variant="amount" /></> : null}
      <FormField label={translate('planning.obligation.dueDay')} onChangeText={setDueDay} value={dueDay} variant="amount" errorText={error} />
      {accounts.data?.map((account: Account) => <RadioCard key={account.id} label={`${account.name} · ${account.currencyCode}`} selected={(accountId || accounts.data?.[0]?.id) === account.id} onPress={() => setAccountId(account.id)} />)}
      <SwitchRow label={translate('planning.obligation.automaticMatching')} value={automaticMatchingEnabled} onValueChange={setAutomaticMatchingEnabled} />
      <ActionButton label={translate('planning.action.save')} loading={save.isPending} onPress={submit} />
      {saved ? <StyledText accessibilityRole="alert">{translate('planning.state.saved')}</StyledText> : null}
    </PlanningScreen>
  );
}
