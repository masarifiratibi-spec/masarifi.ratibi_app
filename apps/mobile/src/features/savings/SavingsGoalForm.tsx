import { parseUserAmountToMinor as parseAmountToMinor } from '@/domain/user-amount';
import React, { useEffect, useRef, useState } from 'react';
import { Pressable, View } from 'react-native';

import { StyledText } from '@/components/StyledText';
import { ActionButton } from '@/design-system/components/ActionButton';
import { FormField } from '@/design-system/components/forms/FormField';
import { PickerField } from '@/design-system/components/forms/PickerField';
import { SwitchRow } from '@/design-system/components/forms/SelectionControls';
import { AppSheet } from '@/design-system/components/overlays/AppSheet';
import { minorToMajorAmountText } from '@/domain/currencies';
import { type Account } from '@/domain/core-finance';
import { normalizeLocalizedNumber } from '@/domain/localized-number';
import {
  localDateFromTimestamp,
  parseLocalDate,
  type LocalDate
} from '@/domain/financial-planning';
import { useAccounts } from '@/features/core-finance/core-finance-queries';
import {
  PlanningScreen,
  PlanningState
} from '@/features/financial-planning/PlanningScaffold';
import { usePlanningFormDraft } from '@/features/financial-planning/usePlanningDraft';
import { AccountPicker } from '@/features/transactions/AccountPicker';
import { TransactionDateField } from '@/features/transactions/TransactionDateField';
import { translate } from '@/localization/i18n';
import { financialPlanningService } from '@/services/financial-planning-service';
import { usePreferenceStore } from '@/state/preferences';
import { useTheme } from '@/state/theme-context';
import { DesignIcon } from '@/design-system/icons';
import { SurfaceCard } from '@/design-system/components/SurfaceCard';
import {
  SavingsHeader,
  SavingsInfo,
  savingsStyles as styles
} from './SavingsVisuals';
import { usePlanningMutation, useSavingsGoal } from './savings-queries';

export function SavingsGoalForm({ goalId = '' }: { goalId?: string }) {
  const existing = useSavingsGoal(goalId);
  const theme = useTheme();
  const hydrated = useRef<string | null>(null);
  const editVersion = useRef<number | undefined>(undefined);
  const saveLock = useRef(false);
  const [optionalOpen, setOptionalOpen] = useState(Boolean(goalId));
  const accounts = useAccounts();
  const currencyCode = usePreferenceStore((state) => state.baseCurrencyCode);
  const owningCurrencyCode = existing.data?.goal.currencyCode ?? currencyCode;
  const [title, setTitle] = useState('');
  const [target, setTarget] = useState('');
  const [opening, setOpening] = useState('0');
  const [targetDate, setTargetDate] = useState(
    () => `${new Date().getUTCFullYear() + 1}-01-01` as LocalDate
  );
  const [accountId, setAccountId] = useState('');
  const [accountPickerOpen, setAccountPickerOpen] = useState(false);
  const [emergencyFund, setEmergencyFund] = useState(false);
  const [error, setError] = useState<string>();
  const [saved, setSaved] = useState(false);
  const save = usePlanningMutation(
    (input: Parameters<typeof financialPlanningService.createGoal>[0]) =>
      existing.data
        ? financialPlanningService.updateGoal(
            goalId,
            editVersion.current ?? existing.data.goal.version,
            input,
            `goal:${goalId}:${Date.now()}`
          )
        : financialPlanningService.createGoal(input, `goal:new:${Date.now()}`)
  );

  useEffect(() => {
    const goal = existing.data?.goal;
    if (!goal || hydrated.current === goal.id) return;
    hydrated.current = goal.id;
    editVersion.current = goal.version;
    setTitle(goal.title);
    setTarget(minorToMajorAmountText(goal.targetMinor, goal.currencyCode));
    setOpening(
      minorToMajorAmountText(goal.openingTrackedMinor, goal.currencyCode)
    );
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
    meaningful:
      !saved && !save.isPending && Boolean(title || target || accountId),
    enabled: draftEnabled,
    restore: (payload) => {
      const draft = payload as Partial<{
        title: string;
        target: string;
        opening: string;
        targetDate: LocalDate;
        accountId: string;
        emergencyFund: boolean;
      }>;
      if (typeof draft.title === 'string') setTitle(draft.title);
      if (typeof draft.target === 'string') setTarget(draft.target);
      if (typeof draft.opening === 'string') setOpening(draft.opening);
      if (typeof draft.targetDate === 'string') setTargetDate(draft.targetDate);
      if (typeof draft.accountId === 'string') setAccountId(draft.accountId);
      if (typeof draft.emergencyFund === 'boolean')
        setEmergencyFund(draft.emergencyFund);
    },
    onError: () => setError(translate('planning.state.error'))
  });

  const submit = () => {
    if (saveLock.current || saved || save.isPending) return;
    const targetMinor = parseAmountToMinor(
      normalizeLocalizedNumber(target),
      owningCurrencyCode
    );
    const openingTrackedMinor = parseAmountToMinor(
      normalizeLocalizedNumber(opening),
      owningCurrencyCode
    );
    try {
      parseLocalDate(targetDate);
    } catch {
      setError(translate('planning.validation.required'));
      return;
    }
    if (
      !title.trim() ||
      !targetMinor ||
      openingTrackedMinor === null ||
      openingTrackedMinor > targetMinor ||
      !/^\d{4}-\d{2}-\d{2}$/.test(targetDate)
    ) {
      setError(translate('planning.validation.required'));
      return;
    }
    setError(undefined);
    saveLock.current = true;
    save.mutate(
      {
        title: title.trim(),
        targetMinor,
        openingTrackedMinor,
        currencyCode: owningCurrencyCode,
        targetDate,
        linkedAccountId: accountId || null,
        emergencyFund
      },
      {
        onSuccess: () => {
          setSaved(true);
          void discardDraft().catch(() =>
            setError(translate('planning.state.error'))
          );
        },
        onError: () => {
          saveLock.current = false;
          setError(translate('planning.state.error'));
        }
      }
    );
  };

  if (existing.isError || accounts.isError)
    return (
      <PlanningScreen
        titleKey={goalId ? 'planning.savings.edit' : 'planning.savings.new'}
      >
        <PlanningState
          state="error"
          onRetry={() => {
            void existing.refetch();
            void accounts.refetch();
          }}
        />
      </PlanningScreen>
    );
  if (
    (goalId && existing.isLoading) ||
    accounts.isLoading ||
    (draftEnabled && !draftReady)
  )
    return (
      <PlanningScreen
        titleKey={goalId ? 'planning.savings.edit' : 'planning.savings.new'}
      >
        <PlanningState state="loading" />
      </PlanningScreen>
    );
  const disabled = save.isPending || saved;
  return (
    <PlanningScreen
      titleKey={goalId ? 'planning.savings.edit' : 'planning.savings.new'}
      hideHeader
      backgroundColor={theme.colors.surfaces.page}
    >
      <SavingsHeader
        title={translate(
          goalId ? 'planning.savings.edit' : 'planning.savings.new'
        )}
        description={translate('planning.savings.setupSubtitle')}
      />
      <SurfaceCard style={styles.card}>
        <FormField
          label={translate('planning.savings.goalTitle')}
          onChangeText={setTitle}
          value={title}
          maxLength={120}
          editable={!disabled}
        />
        <FormField
          label={translate('planning.savings.targetAmount')}
          onChangeText={setTarget}
          value={target}
          variant="amount"
          helperText={owningCurrencyCode}
          editable={!disabled}
        />
        <TransactionDateField
          label={translate('planning.savings.targetDate')}
          value={Date.parse(`${targetDate}T12:00:00`)}
          disabled={disabled}
          onChange={(timestamp) =>
            setTargetDate(localDateFromTimestamp(timestamp))
          }
        />
      </SurfaceCard>
      <SurfaceCard style={styles.card}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={translate('planning.savings.optionalDetails')}
          accessibilityState={{ expanded: optionalOpen }}
          onPress={() => setOptionalOpen(!optionalOpen)}
          style={styles.optional}
        >
          <StyledText variant="subtitle">
            {translate('planning.savings.optionalDetails')}
          </StyledText>
          <DesignIcon
            name="chevronDown"
            decorative
            style={
              optionalOpen ? { transform: [{ rotate: '180deg' }] } : undefined
            }
          />
        </Pressable>
        {optionalOpen ? (
          <View style={styles.card}>
            <FormField
              label={translate('planning.savings.openingAmount')}
              onChangeText={setOpening}
              value={opening}
              variant="amount"
              helperText={owningCurrencyCode}
              editable={!disabled}
            />
            <PickerField
              label={translate('planning.savings.linkedAccount')}
              value={
                accounts.data?.find(
                  (account: Account) => account.id === accountId
                )?.name
              }
              placeholder={translate('reports.state.unavailable')}
              onPress={() => !disabled && setAccountPickerOpen(true)}
            />
            <SwitchRow
              label={translate('planning.savings.emergencyFund')}
              value={emergencyFund}
              disabled={disabled}
              onValueChange={setEmergencyFund}
            />
          </View>
        ) : null}
      </SurfaceCard>
      <AppSheet
        title={translate('planning.savings.linkedAccount')}
        visible={accountPickerOpen}
        onDismiss={() => setAccountPickerOpen(false)}
      >
        <AccountPicker
          selectedId={accountId}
          currencyCode={owningCurrencyCode}
          onSelect={(account) => {
            setAccountId(account.id);
            setAccountPickerOpen(false);
          }}
        />
        <ActionButton
          label={translate('planning.obligation.form.noAccount')}
          variant="quiet"
          onPress={() => {
            setAccountId('');
            setAccountPickerOpen(false);
          }}
        />
      </AppSheet>
      <SavingsInfo />
      {error ? (
        <StyledText accessibilityRole="alert">{error}</StyledText>
      ) : null}
      <ActionButton
        label={translate('planning.savings.saveGoal')}
        loading={save.isPending}
        disabled={saved}
        onPress={submit}
        style={styles.button}
      />
      {saved ? (
        <StyledText accessibilityRole="alert">
          {translate('planning.state.saved')}
        </StyledText>
      ) : null}
    </PlanningScreen>
  );
}
