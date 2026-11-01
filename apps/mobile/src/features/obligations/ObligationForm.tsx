import { parseUserAmountToMinor as parseAmountToMinor } from '@/domain/user-amount';
import React, { useEffect, useRef, useState } from 'react';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View
} from 'react-native';

import { StyledText } from '@/components/StyledText';
import { ActionButton } from '@/design-system/components/ActionButton';
import { FormField } from '@/design-system/components/forms/FormField';
import { PickerField } from '@/design-system/components/forms/PickerField';
import { SwitchRow } from '@/design-system/components/forms/SelectionControls';
import { AppSheet } from '@/design-system/components/overlays/AppSheet';
import { DesignIcon } from '@/design-system/icons';
import { radius, spacing } from '@/design-system/tokens';
import { minorToMajorAmountText } from '@/domain/currencies';
import {
  addMonthsClamped,
  localDateFromTimestamp,
  parseLocalDate,
  type LocalDate,
  type Obligation
} from '@/domain/financial-planning';
import { useAccounts } from '@/features/core-finance/core-finance-queries';
import {
  PlanningScreen,
  PlanningState
} from '@/features/financial-planning/PlanningScaffold';
import { usePlanningFormDraft } from '@/features/financial-planning/usePlanningDraft';
import { AccountPicker } from '@/features/transactions/AccountPicker';
import { TransactionDateField } from '@/features/transactions/TransactionDateField';
import {
  currentLocale,
  translate,
  translateDynamic,
  type MessageKey
} from '@/localization/i18n';
import { financialPlanningService } from '@/services/financial-planning-service';
import { hasReadableSnapshot } from '@/services/read-snapshot';
import { usePreferenceStore } from '@/state/preferences';
import { normalizeLocalizedNumber } from '@/domain/localized-number';
import { useTheme } from '@/state/theme-context';
import { formatDate, formatMinorAmount } from '@/utils/format-financial-value';
import { useObligation, usePlanningMutation } from './obligation-queries';

const obligationTypes: Obligation['type'][] = [
  'custom',
  'car_installment',
  'personal_loan',
  'rent',
  'subscription',
  'debt',
  'utility',
  'buy_now_pay_later',
  'credit_card_installment'
];
const frequencies: NonNullable<Obligation['frequency']>[] = [
  'monthly',
  'yearly',
  'weekly',
  'biweekly',
  'quarterly',
  'custom',
  'irregular'
];
const paymentKinds = [
  'once',
  'installments',
  'recurring',
  'irregular'
] as const;
type PaymentKind = (typeof paymentKinds)[number];
type RetainedPlan = { amount: string; installment: string; count: number };
type FieldErrors = Partial<
  Record<'title' | 'amount' | 'installment' | 'date', MessageKey>
>;

function kindFor(
  scheduleKind: Obligation['scheduleKind'],
  count: number | null
): PaymentKind {
  return scheduleKind === 'irregular'
    ? 'irregular'
    : scheduleKind === 'open_ended'
      ? 'recurring'
      : count === 1
        ? 'once'
        : 'installments';
}

export function ObligationForm({
  obligationId = '',
  onBack
}: {
  obligationId?: string;
  onBack?: () => void;
}) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const currencyCode = usePreferenceStore((state) => state.baseCurrencyCode);
  const direction = usePreferenceStore((state) => state.direction);
  const existing = useObligation(obligationId);
  const accounts = useAccounts();
  const item = existing.data?.obligation;
  const owningCurrencyCode = item?.currencyCode ?? currencyCode;
  const [paymentKind, setPaymentKind] = useState<PaymentKind>('once');
  const [obligationDirection, setObligationDirection] =
    useState<Obligation['direction']>('payable');
  const [type, setType] = useState<Obligation['type']>('custom');
  const [frequency, setFrequency] =
    useState<NonNullable<Obligation['frequency']>>('monthly');
  const [title, setTitle] = useState('');
  const [provider, setProvider] = useState('');
  const [amount, setAmount] = useState('');
  const [installment, setInstallment] = useState('');
  const [retainedPlan, setRetainedPlan] = useState<RetainedPlan | null>(null);
  const [recurringPrincipal, setRecurringPrincipal] = useState(0);
  const [startDate, setStartDate] = useState(() =>
    localDateFromTimestamp(Date.now())
  );
  const [accountId, setAccountId] = useState('');
  const [automaticMatchingEnabled, setAutomaticMatchingEnabled] =
    useState(false);
  const [optionalOpen, setOptionalOpen] = useState(false);
  const [typePickerOpen, setTypePickerOpen] = useState(false);
  const [accountPickerOpen, setAccountPickerOpen] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [error, setError] = useState<string>();
  const [saved, setSaved] = useState(false);
  const saveLock = useRef(false);
  const save = usePlanningMutation(
    (input: Parameters<typeof financialPlanningService.createObligation>[0]) =>
      item
        ? financialPlanningService.updateObligation(
            obligationId,
            item.version,
            input,
            `obligation:${obligationId}:${Date.now()}`
          )
        : financialPlanningService.createObligation(
            input,
            `obligation:new:${Date.now()}`
          )
  );

  useEffect(() => {
    if (!item) return;
    const total =
      item.contractedTotalMinor === null
        ? ''
        : minorToMajorAmountText(item.contractedTotalMinor, item.currencyCode);
    const payment =
      item.installmentAmountMinor === null
        ? ''
        : minorToMajorAmountText(
            item.installmentAmountMinor,
            item.currencyCode
          );
    setPaymentKind(kindFor(item.scheduleKind, item.installmentCount));
    setObligationDirection(item.direction);
    setType(item.type);
    setFrequency(item.frequency ?? 'monthly');
    setTitle(item.title);
    setProvider(item.provider ?? '');
    setAmount(item.scheduleKind === 'open_ended' ? payment : total);
    setInstallment(payment);
    setRecurringPrincipal(item.contractedTotalMinor ?? 0);
    setRetainedPlan(
      item.installmentCount
        ? { amount: total, installment: payment, count: item.installmentCount }
        : null
    );
    if (item.startDate) setStartDate(item.startDate);
    setAccountId(item.fundingAccountId ?? '');
    setAutomaticMatchingEnabled(item.automaticMatchingEnabled);
  }, [item]);

  const { draftReady, discardDraft } = usePlanningFormDraft({
    id: `planning-form-obligation:${obligationId || 'new'}`,
    kind: 'obligation',
    entityId: obligationId || null,
    payload: {
      paymentKind,
      direction: obligationDirection,
      type,
      frequency,
      title,
      provider,
      amount,
      installment,
      retainedPlan,
      recurringPrincipal,
      startDate,
      accountId,
      automaticMatchingEnabled
    },
    meaningful:
      !saved &&
      !save.isPending &&
      Boolean(title || provider || amount || installment || accountId),
    enabled: !obligationId || Boolean(item),
    restore: (payload) => {
      const draft = payload as Record<string, unknown>;
      if (!draft || typeof draft !== 'object') return;
      const oldSchedule = draft.scheduleKind;
      const oldCount =
        typeof draft.count === 'string' ? Number(draft.count) : null;
      if (paymentKinds.includes(draft.paymentKind as PaymentKind))
        setPaymentKind(draft.paymentKind as PaymentKind);
      else if (
        oldSchedule === 'fixed_term' ||
        oldSchedule === 'open_ended' ||
        oldSchedule === 'irregular'
      )
        setPaymentKind(kindFor(oldSchedule, oldCount));
      if (draft.direction === 'payable' || draft.direction === 'receivable')
        setObligationDirection(draft.direction);
      if (obligationTypes.includes(draft.type as Obligation['type']))
        setType(draft.type as Obligation['type']);
      if (
        frequencies.includes(
          draft.frequency as NonNullable<Obligation['frequency']>
        )
      )
        setFrequency(draft.frequency as NonNullable<Obligation['frequency']>);
      if (typeof draft.title === 'string') setTitle(draft.title);
      if (typeof draft.provider === 'string') setProvider(draft.provider);
      if (typeof draft.amount === 'string') setAmount(draft.amount);
      else if (
        oldSchedule === 'open_ended' &&
        typeof draft.installment === 'string'
      )
        setAmount(draft.installment);
      else if (typeof draft.total === 'string') setAmount(draft.total);
      if (typeof draft.installment === 'string')
        setInstallment(draft.installment);
      if (typeof draft.recurringPrincipal === 'number')
        setRecurringPrincipal(draft.recurringPrincipal);
      else if (oldSchedule === 'open_ended' && typeof draft.total === 'string')
        setRecurringPrincipal(
          parseAmountToMinor(draft.total, owningCurrencyCode) ?? 0
        );
      if (
        typeof draft.total === 'string' &&
        typeof draft.installment === 'string' &&
        Number.isInteger(oldCount) &&
        oldCount! > 0
      )
        setRetainedPlan({
          amount: draft.total,
          installment: draft.installment,
          count: oldCount!
        });
      else if (draft.retainedPlan && typeof draft.retainedPlan === 'object') {
        const plan = draft.retainedPlan as RetainedPlan;
        if (
          typeof plan.amount === 'string' &&
          typeof plan.installment === 'string' &&
          Number.isInteger(plan.count)
        )
          setRetainedPlan(plan);
      }
      if (typeof draft.startDate === 'string') {
        try {
          parseLocalDate(draft.startDate);
          setStartDate(draft.startDate as LocalDate);
        } catch {
          /* Ignore an invalid saved date. */
        }
      }
      if (typeof draft.accountId === 'string') setAccountId(draft.accountId);
      if (typeof draft.automaticMatchingEnabled === 'boolean')
        setAutomaticMatchingEnabled(draft.automaticMatchingEnabled);
    },
    onError: () => setError(translate('planning.state.error'))
  });

  const amountMinor = parseAmountToMinor(
    normalizeLocalizedNumber(amount),
    owningCurrencyCode
  );
  const installmentMinor = parseAmountToMinor(
    normalizeLocalizedNumber(installment),
    owningCurrencyCode
  );
  const openingPaidMinor = item?.openingPaidMinor ?? 0;
  const remaining = (amountMinor ?? 0) - openingPaidMinor;
  const keepCount =
    retainedPlan !== null &&
    parseAmountToMinor(
      normalizeLocalizedNumber(retainedPlan.amount),
      owningCurrencyCode
    ) === amountMinor &&
    parseAmountToMinor(
      normalizeLocalizedNumber(retainedPlan.installment),
      owningCurrencyCode
    ) === installmentMinor &&
    retainedPlan.count > 0 &&
    retainedPlan.count <= 1200 &&
    installmentMinor !== null &&
    (retainedPlan.count - 1) * installmentMinor < remaining;
  const remainder =
    installmentMinor && remaining > 0 ? remaining % installmentMinor : 0;
  const calculatedCount =
    installmentMinor && remaining > 0
      ? (remaining - remainder) / installmentMinor + (remainder > 0 ? 1 : 0)
      : 0;
  const installmentCount =
    paymentKind === 'once'
      ? 1
      : keepCount
        ? retainedPlan!.count
        : calculatedCount;
  const finalPayment =
    remaining - (installmentMinor ?? 0) * (installmentCount - 1);
  const validInstallments = Boolean(
    installmentMinor &&
    Number.isSafeInteger(installmentMinor) &&
    installmentMinor > 0 &&
    installmentMinor <= remaining &&
    Number.isInteger(installmentCount) &&
    installmentCount > 0 &&
    installmentCount <= 1200 &&
    Number.isSafeInteger(finalPayment) &&
    finalPayment > 0
  );
  const money = (minor: number) =>
    formatMinorAmount(minor, owningCurrencyCode, currentLocale());
  const clearErrors = () => {
    setErrors({});
    setError(undefined);
  };
  const back = onBack ?? (() => router.back());

  const submit = () => {
    if (saveLock.current || save.isPending || saved) return;
    const nextErrors: FieldErrors = {};
    if (!title.trim())
      nextErrors.title = 'planning.obligation.form.nameRequired';
    if (!Number.isSafeInteger(amountMinor) || amountMinor! <= 0)
      nextErrors.amount = 'planning.obligation.form.amountRequired';
    else if (paymentKind !== 'recurring' && remaining <= 0)
      nextErrors.amount = 'planning.obligation.form.amountAlreadyPaid';
    if (paymentKind === 'installments' && !validInstallments)
      nextErrors.installment = 'planning.obligation.form.installmentInvalid';
    if (paymentKind === 'installments' && installmentCount > 1200)
      nextErrors.installment = 'planning.obligation.form.planTooLong';
    try {
      parseLocalDate(startDate);
    } catch {
      nextErrors.date = 'planning.obligation.form.dateRequired';
    }
    setErrors(nextErrors);
    setError(undefined);
    if (Object.keys(nextErrors).length) return;
    const scheduleKind =
      paymentKind === 'recurring'
        ? 'open_ended'
        : paymentKind === 'irregular'
          ? 'irregular'
          : 'fixed_term';
    const chosenFrequency =
      paymentKind === 'irregular' ? 'irregular' : frequency;
    const dueDay =
      chosenFrequency === item?.frequency &&
      ['weekly', 'biweekly', 'custom'].includes(chosenFrequency)
        ? item.dueDay
        : Number(startDate.slice(8, 10));
    const count = scheduleKind === 'fixed_term' ? installmentCount : null;
    const endDate =
      scheduleKind === 'fixed_term' &&
      ['monthly', 'quarterly', 'yearly'].includes(chosenFrequency)
        ? addMonthsClamped(
            startDate,
            (count! - 1) *
              (chosenFrequency === 'yearly'
                ? 12
                : chosenFrequency === 'quarterly'
                  ? 3
                  : 1),
            Number(startDate.slice(8, 10))
          )
        : (item?.endDate ?? null);
    saveLock.current = true;
    save.mutate(
      {
        direction: obligationDirection,
        type,
        scheduleKind,
        frequency: chosenFrequency,
        customIntervalDays: item?.customIntervalDays ?? null,
        title: title.trim(),
        provider: provider.trim() || null,
        currencyCode: owningCurrencyCode,
        contractedTotalMinor:
          paymentKind === 'recurring' ? recurringPrincipal : amountMinor,
        openingPaidMinor,
        installmentAmountMinor:
          paymentKind === 'recurring'
            ? amountMinor
            : paymentKind === 'once'
              ? remaining
              : paymentKind === 'irregular'
                ? null
                : installmentMinor,
        installmentCount: count,
        dueDay,
        startDate,
        endDate,
        fundingAccountId: accountId || null,
        automaticMatchingEnabled,
        providerKeywords: item?.providerKeywords,
        reminderTiming: item?.reminderTiming,
        notes: item?.notes
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

  if (
    (existing.isError && !hasReadableSnapshot(existing)) ||
    (accounts.isError && !hasReadableSnapshot(accounts))
  )
    return (
      <PlanningScreen titleKey="planning.obligations.new">
        <PlanningState
          state="error"
          onRetry={() => {
            void existing.refetch();
            void accounts.refetch();
          }}
        />
      </PlanningScreen>
    );
  if ((obligationId && existing.isLoading) || accounts.isLoading || !draftReady)
    return (
      <PlanningScreen titleKey="planning.obligations.new">
        <PlanningState state="loading" />
      </PlanningScreen>
    );
  const disabled = save.isPending || saved;
  const selectedAccount = accounts.data?.find(
    (account) => account.id === accountId
  );
  const dateLabel = translate(
    paymentKind === 'once'
      ? 'planning.obligation.form.dueDate'
      : 'planning.obligation.firstDueDate'
  );
  const amountLabel = translate(
    paymentKind === 'installments' || paymentKind === 'irregular'
      ? 'planning.obligation.total'
      : paymentKind === 'recurring'
        ? 'planning.obligation.form.paymentAmount'
        : 'planning.obligation.form.amount'
  );
  const choices =
    paymentKind === 'irregular'
      ? paymentKinds
      : paymentKinds.filter((kind) => kind !== 'irregular');
  const frequencyChoices = [
    'monthly',
    'yearly',
    ...(!['monthly', 'yearly', 'irregular'].includes(frequency)
      ? [frequency]
      : [])
  ] as NonNullable<Obligation['frequency']>[];
  const fieldError = (field: keyof FieldErrors) =>
    errors[field] ? translate(errors[field]!) : undefined;

  return (
    <KeyboardAvoidingView
      style={styles.page}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={insets.top + spacing.sm}
    >
      <ScrollView
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
        contentContainerStyle={styles.scroll}
        style={{ backgroundColor: theme.colors.surfaces.page }}
      >
        <View
          testID="obligation-form-header"
          style={[
            styles.header,
            { backgroundColor: theme.colors.horizon.referenceEnd }
          ]}
        >
          <View style={styles.headerTop}>
            <StyledText
              variant="caption"
              style={{ color: theme.colors.textInverse }}
            >
              {translate('googleAuth.brand')}
            </StyledText>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={translate('common.back')}
              onPress={back}
              style={styles.back}
            >
              <DesignIcon
                name="back"
                decorative
                direction={direction}
                color={theme.colors.textInverse}
              />
            </Pressable>
          </View>
          <StyledText
            variant="title"
            style={{ color: theme.colors.textInverse }}
          >
            {translate(
              obligationId
                ? 'planning.obligations.edit'
                : 'planning.obligation.form.title'
            )}
          </StyledText>
          <StyledText style={{ color: theme.colors.textInverse }}>
            {translate('planning.obligation.form.subtitle')}
          </StyledText>
        </View>
        <View style={styles.form}>
          <View
            style={[
              styles.direction,
              { backgroundColor: theme.colors.surfaces.brandSubtle }
            ]}
          >
            {(['payable', 'receivable'] as const).map((value) => (
              <Pressable
                key={value}
                disabled={disabled}
                accessibilityRole="button"
                accessibilityState={{
                  selected: obligationDirection === value,
                  disabled
                }}
                accessibilityLabel={translate(
                  value === 'payable'
                    ? 'planning.obligation.iOwe'
                    : 'planning.obligation.owedToMe'
                )}
                onPress={() => {
                  setObligationDirection(value);
                  clearErrors();
                }}
                style={[
                  styles.directionChoice,
                  obligationDirection === value && {
                    backgroundColor: theme.colors.surfaces.card
                  }
                ]}
              >
                <StyledText
                  style={{
                    color:
                      obligationDirection === value
                        ? theme.colors.primary
                        : theme.colors.textSecondary
                  }}
                >
                  {translate(
                    value === 'payable'
                      ? 'planning.obligation.iOwe'
                      : 'planning.obligation.owedToMe'
                  )}
                </StyledText>
              </Pressable>
            ))}
          </View>
          <FormField
            label={translate('planning.obligation.form.name')}
            placeholder={translate('planning.obligation.form.namePlaceholder')}
            value={title}
            maxLength={120}
            editable={!disabled}
            onChangeText={(value) => {
              setTitle(value);
              clearErrors();
            }}
            errorText={fieldError('title')}
          />
          <View style={styles.fieldGroup}>
            <StyledText>
              {translate('planning.obligation.form.paymentMethod')}
            </StyledText>
            <View style={styles.choiceRow}>
              {choices.map((kind) => (
                <Pressable
                  key={kind}
                  disabled={disabled}
                  accessibilityRole="button"
                  accessibilityState={{
                    selected: paymentKind === kind,
                    disabled
                  }}
                  accessibilityLabel={translate(
                    `planning.obligation.form.kind.${kind}` as MessageKey
                  )}
                  onPress={() => {
                    setPaymentKind(kind);
                    if (kind !== paymentKind) setFrequency('monthly');
                    clearErrors();
                  }}
                  style={[
                    styles.choice,
                    {
                      borderColor:
                        paymentKind === kind
                          ? theme.colors.primary
                          : theme.colors.borders.subtle,
                      backgroundColor:
                        paymentKind === kind
                          ? theme.colors.surfaces.brandSubtle
                          : theme.colors.surfaces.card
                    }
                  ]}
                >
                  <StyledText
                    variant="caption"
                    style={{
                      color:
                        paymentKind === kind
                          ? theme.colors.primary
                          : theme.colors.textSecondary
                    }}
                  >
                    {translate(
                      `planning.obligation.form.kind.${kind}` as MessageKey
                    )}
                  </StyledText>
                </Pressable>
              ))}
            </View>
          </View>
          <FormField
            label={amountLabel}
            placeholder={translate(
              'planning.obligation.form.amountPlaceholder'
            )}
            helperText={owningCurrencyCode}
            value={amount}
            variant="amount"
            editable={!disabled}
            onChangeText={(value) => {
              setAmount(value);
              clearErrors();
            }}
            errorText={fieldError('amount')}
          />
          {paymentKind === 'installments' ? (
            <>
              <FormField
                label={translate(
                  frequency === 'monthly'
                    ? 'planning.obligation.form.monthlyInstallment'
                    : 'planning.obligation.installment'
                )}
                helperText={owningCurrencyCode}
                value={installment}
                variant="amount"
                editable={!disabled}
                onChangeText={(value) => {
                  setInstallment(value);
                  clearErrors();
                }}
                errorText={fieldError('installment')}
              />
              <StyledText
                variant="caption"
                style={{ color: theme.colors.textSecondary }}
              >
                {validInstallments
                  ? translateDynamic(
                      'planning.obligation.form.calculatedPlan',
                      { count: installmentCount, amount: money(finalPayment) }
                    )
                  : translate('planning.obligation.form.installmentHint')}
              </StyledText>
            </>
          ) : null}
          {paymentKind === 'recurring' ? (
            <View style={styles.fieldGroup}>
              <StyledText>
                {translate('planning.obligation.form.repeat')}
              </StyledText>
              <View style={styles.choiceRow}>
                {frequencyChoices.map((value) => (
                  <Pressable
                    key={value}
                    disabled={disabled}
                    accessibilityRole="button"
                    accessibilityState={{
                      selected: frequency === value,
                      disabled
                    }}
                    accessibilityLabel={translate(
                      `planning.obligation.form.frequency.${value}` as MessageKey
                    )}
                    onPress={() => {
                      setFrequency(value);
                      clearErrors();
                    }}
                    style={[
                      styles.choice,
                      {
                        borderColor:
                          frequency === value
                            ? theme.colors.primary
                            : theme.colors.borders.subtle,
                        backgroundColor:
                          frequency === value
                            ? theme.colors.surfaces.brandSubtle
                            : theme.colors.surfaces.card
                      }
                    ]}
                  >
                    <StyledText>
                      {translate(
                        `planning.obligation.form.frequency.${value}` as MessageKey
                      )}
                    </StyledText>
                  </Pressable>
                ))}
              </View>
            </View>
          ) : null}
          <TransactionDateField
            label={dateLabel}
            value={Date.parse(`${startDate}T12:00:00`)}
            disabled={disabled}
            onChange={(value) => {
              setStartDate(localDateFromTimestamp(value));
              clearErrors();
            }}
          />
          {fieldError('date') ? (
            <StyledText
              accessibilityRole="alert"
              style={{ color: theme.colors.status.danger }}
            >
              {fieldError('date')}
            </StyledText>
          ) : null}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={translate('planning.obligation.form.optional')}
            accessibilityState={{ expanded: optionalOpen }}
            onPress={() => setOptionalOpen(!optionalOpen)}
            style={[
              styles.optionalToggle,
              { borderTopColor: theme.colors.borders.subtle }
            ]}
          >
            <StyledText style={{ color: theme.colors.primary }}>
              {translate('planning.obligation.form.optional')}
            </StyledText>
            <View
              style={
                optionalOpen ? { transform: [{ rotate: '180deg' }] } : undefined
              }
            >
              <DesignIcon
                name="chevronDown"
                decorative
                color={theme.colors.primary}
              />
            </View>
          </Pressable>
          {optionalOpen ? (
            <View style={styles.optionalFields}>
              <FormField
                label={translate('planning.obligation.provider')}
                value={provider}
                maxLength={120}
                editable={!disabled}
                onChangeText={setProvider}
              />
              <PickerField
                label={translate('planning.obligation.type')}
                value={translate(
                  `planning.obligation.type.${type}` as MessageKey
                )}
                onPress={() => !disabled && setTypePickerOpen(true)}
              />
              <PickerField
                label={translate('voice.review.account')}
                value={selectedAccount?.name}
                placeholder={translate('planning.obligation.form.noAccount')}
                onPress={() => !disabled && setAccountPickerOpen(true)}
              />
              <SwitchRow
                icon="tracking"
                label="planning.obligation.automaticMatching"
                subtext="planning.obligation.automaticMatchingSubtitle"
                value={automaticMatchingEnabled}
                onValueChange={(value) => {
                  if (!disabled) setAutomaticMatchingEnabled(value);
                }}
              />
            </View>
          ) : null}
          {title.trim() && amountMinor && amountMinor > 0 ? (
            <View
              style={[
                styles.summary,
                { backgroundColor: theme.colors.surfaces.brandSubtle }
              ]}
            >
              <StyledText variant="caption">
                {title.trim()} · {money(amountMinor)} ·{' '}
                {formatDate(
                  Date.parse(`${startDate}T12:00:00`),
                  currentLocale()
                )}
                {paymentKind === 'recurring'
                  ? ` · ${translate(`planning.obligation.form.frequency.${frequency}` as MessageKey)}`
                  : ''}
              </StyledText>
            </View>
          ) : null}
          {error ? (
            <StyledText
              accessibilityRole="alert"
              style={{ color: theme.colors.status.danger }}
            >
              {error}
            </StyledText>
          ) : null}
          {saved ? (
            <StyledText accessibilityRole="alert">
              {translate('planning.state.saved')}
            </StyledText>
          ) : null}
          <ActionButton
            label={translate('planning.obligation.form.save')}
            loading={save.isPending}
            disabled={saved}
            onPress={submit}
            icon={
              <DesignIcon
                name="check"
                decorative
                color={theme.colors.textInverse}
              />
            }
          />
        </View>
      </ScrollView>
      <AppSheet
        title={translate('planning.obligation.type')}
        visible={typePickerOpen}
        onDismiss={() => setTypePickerOpen(false)}
      >
        <View style={styles.sheetOptions}>
          {obligationTypes.map((value) => (
            <Pressable
              key={value}
              accessibilityRole="radio"
              accessibilityState={{ selected: type === value }}
              onPress={() => {
                setType(value);
                setTypePickerOpen(false);
              }}
              style={styles.sheetOption}
            >
              <StyledText>
                {translate(`planning.obligation.type.${value}` as MessageKey)}
              </StyledText>
              {type === value ? <DesignIcon name="check" decorative /> : null}
            </Pressable>
          ))}
        </View>
      </AppSheet>
      <AppSheet
        title={translate('voice.review.account')}
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
          variant="quiet"
          label={translate('planning.obligation.form.noAccount')}
          onPress={() => {
            setAccountId('');
            setAccountPickerOpen(false);
          }}
        />
      </AppSheet>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1 },
  scroll: { paddingBottom: spacing.xxl },
  header: { gap: spacing.sm, padding: spacing.lg, paddingBottom: spacing.xl },
  headerTop: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between'
  },
  back: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
    minWidth: 48
  },
  form: { gap: spacing.lg, padding: spacing.lg },
  direction: {
    borderRadius: radius.control,
    flexDirection: 'row',
    padding: 4,
    gap: 4
  },
  directionChoice: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    borderRadius: radius.control,
    minHeight: 48
  },
  fieldGroup: { gap: spacing.sm },
  choiceRow: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
  choice: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.control,
    borderWidth: 1,
    flex: 1,
    minHeight: 48,
    minWidth: 80,
    padding: spacing.sm
  },
  optionalToggle: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: StyleSheet.hairlineWidth,
    minHeight: 48,
    paddingTop: spacing.sm
  },
  optionalFields: { gap: spacing.md },
  summary: { borderRadius: radius.control, padding: spacing.md },
  sheetOptions: { gap: spacing.sm },
  sheetOption: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 48,
    paddingHorizontal: spacing.md
  }
});
