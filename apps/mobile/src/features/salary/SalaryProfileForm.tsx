import React, { useState } from 'react';

import { StyledText } from '@/components/StyledText';
import { ActionButton } from '@/design-system/components/ActionButton';
import { FormField } from '@/design-system/components/forms/FormField';
import { RadioCard, SwitchRow } from '@/design-system/components/forms/SelectionControls';
import { parseAmountToMinor, type Account } from '@/domain/core-finance';
import { useAccounts } from '@/features/core-finance/core-finance-queries';
import { PlanningScreen, PlanningState } from '@/features/financial-planning/PlanningScaffold';
import { usePlanningFormDraft } from '@/features/financial-planning/usePlanningDraft';
import { translate } from '@/localization/i18n';
import { financialPlanningService } from '@/services/mocks/financial-planning-service';
import { usePreferenceStore } from '@/state/preferences';
import { usePlanningMutation } from './salary-queries';

export function SalaryProfileForm() {
  const accounts = useAccounts();
  const currencyCode = usePreferenceStore((state) => state.baseCurrencyCode);
  const [amount, setAmount] = useState('');
  const [salaryDay, setSalaryDay] = useState('1');
  const [sourceName, setSourceName] = useState('');
  const [accountId, setAccountId] = useState('');
  const [automaticDetectionEnabled, setAutomaticDetectionEnabled] = useState(false);
  const [error, setError] = useState<string>();
  const [saved, setSaved] = useState(false);
  const save = usePlanningMutation((input: Parameters<typeof financialPlanningService.saveSalaryProfile>[0]) =>
    financialPlanningService.saveSalaryProfile(input, `salary-profile:${Date.now()}`)
  );
  const { draftReady, discardDraft } = usePlanningFormDraft({
    id: 'planning-form-salary',
    kind: 'salary',
    entityId: null,
    payload: { amount, salaryDay, sourceName, accountId, automaticDetectionEnabled },
    meaningful: Boolean(amount || sourceName || accountId),
    restore: (payload) => {
      const draft = payload as Partial<{ amount: string; salaryDay: string; sourceName: string; accountId: string; automaticDetectionEnabled: boolean }>;
      if (typeof draft.amount === 'string') setAmount(draft.amount);
      if (typeof draft.salaryDay === 'string') setSalaryDay(draft.salaryDay);
      if (typeof draft.sourceName === 'string') setSourceName(draft.sourceName);
      if (typeof draft.accountId === 'string') setAccountId(draft.accountId);
      if (typeof draft.automaticDetectionEnabled === 'boolean') setAutomaticDetectionEnabled(draft.automaticDetectionEnabled);
    },
    onError: () => setError(translate('planning.state.error'))
  });

  const submit = () => {
    const expectedAmountMinor = parseAmountToMinor(amount);
    const day = Number(salaryDay);
    const receivingAccountId = accountId || accounts.data?.[0]?.id;
    if (!expectedAmountMinor || day < 1 || day > 31 || !sourceName.trim() || !receivingAccountId) {
      setError(translate('planning.validation.required'));
      return;
    }
    setError(undefined);
    save.mutate({
      expectedAmountMinor,
      currencyCode,
      salaryDay: day,
      sourceName: sourceName.trim(),
      receivingAccountId,
      automaticDetectionEnabled
    }, { onSuccess: () => { setSaved(true); void discardDraft(); }, onError: () => setError(translate('planning.state.error')) });
  };

  return (
    <PlanningScreen titleKey="planning.salary.setup">
      {accounts.isLoading || !draftReady ? <PlanningState state="loading" /> : accounts.isError ? <PlanningState state="error" onRetry={() => void accounts.refetch()} /> : (
        <>
          <FormField label={translate('planning.salary.amount')} onChangeText={setAmount} value={amount} variant="amount" errorText={error} />
          <FormField label={translate('planning.salary.day')} onChangeText={setSalaryDay} value={salaryDay} variant="amount" />
          <FormField label={translate('planning.salary.source')} onChangeText={setSourceName} value={sourceName} />
          <StyledText variant="subtitle">{translate('planning.salary.account')}</StyledText>
          {accounts.data?.map((account: Account) => (
            <RadioCard key={account.id} label={`${account.name} · ${account.currencyCode}`} selected={(accountId || accounts.data?.[0]?.id) === account.id} onPress={() => setAccountId(account.id)} />
          ))}
          <SwitchRow label={translate('planning.salary.automaticDetection')} value={automaticDetectionEnabled} onValueChange={setAutomaticDetectionEnabled} />
          <ActionButton label={translate('planning.action.save')} loading={save.isPending} onPress={submit} />
          {saved ? <StyledText accessibilityRole="alert">{translate('planning.state.saved')}</StyledText> : null}
        </>
      )}
    </PlanningScreen>
  );
}
