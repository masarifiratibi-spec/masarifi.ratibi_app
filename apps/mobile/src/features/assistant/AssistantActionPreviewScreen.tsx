/* eslint-disable @typescript-eslint/no-var-requires */
import React from 'react';
import { ScrollView, View } from 'react-native';
import { router } from 'expo-router';

import { ActionButton } from '@/design-system/components/ActionButton';
import { FinancialPulse } from '@/design-system/components/financial/FinancialPulse';
import { GroupedList, NavigationRow } from '@/design-system/components/navigation/GroupedList';
import { ConfirmationDialog } from '@/design-system/components/overlays/ConfirmationDialog';
import type { AssistantActionPreview } from '@/domain/assistant';
import { StyledText } from '@/components/StyledText';
import { currentLocale, translateDynamic } from '@/localization/i18n';
import { formatMinorAmount } from '@/utils/format-financial-value';
import { useAssistantFinancialVisibility } from './useAssistantFinancialVisibility';

type AssistantQueries = typeof import('./assistant-queries');

export function AssistantActionPreviewScreen({ previewId, inline = false, fallback, onReviewAction }: { conversationId: string; previewId: string; inline?: boolean; fallback?: React.ReactNode; onReviewAction?: (id: string) => void }) {
  const queries = require('./assistant-queries') as AssistantQueries;
  const previewQuery = queries.useAssistantActionPreview(previewId);
  const confirm = queries.useConfirmAssistantAction();
  const cancel = queries.useCancelAssistantAction();
  const [decisionResult, setDecisionResult] = React.useState<AssistantActionPreview | null>(null);
  const preview = decisionResult ?? previewQuery.data as AssistantActionPreview | undefined;
  const submitting = React.useRef(false);
  const [submitted, setSubmitted] = React.useState(false);
  const [confirmVisible, setConfirmVisible] = React.useState(false);
  const [confirmationBlocked, setConfirmationBlocked] = React.useState(false);
  const [reviewedSignature, setReviewedSignature] = React.useState<string | null>(null);
  const [checking, setChecking] = React.useState(false);
  const [checkFailed, setCheckFailed] = React.useState(false);
  const { hidden: effectsHidden, reveal: revealEffects } = useAssistantFinancialVisibility(previewId);
  const moneyInput = isMoneyInput(preview?.input) ? preview.input : null;
  const amountMinor = moneyInput?.amountMinor ?? 0;
  const currency = moneyInput?.currency ?? 'SAR';
  const formattedAmount = effectsHidden ? `•••• ${currency}` : formatMinorAmount(amountMinor, currency, currentLocale());
  const queryError = previewQuery.error as { code?: string } | null;
  const confirmationError = confirm.error as {code?: string} | null;
  const outcomeUnknown = ['outcome_unknown', 'confirmation_result_pending'].includes(confirmationError?.code ?? '');
  const disclosure = preview?.disclosure;
  const signature = JSON.stringify([preview?.id, preview?.version, preview?.effect, disclosure]);
  const compact = inline && preview?.kind === 'create_transaction';
  const accountName = disclosure?.fields.find(field => field.key === 'accountName')?.value;
  const canConfirm = preview?.status === 'ready' && preview.confirmationAllowed !== false && (!preview.effect || disclosure?.complete === true) && (preview.expiresAt === null || preview.expiresAt > Date.now()) && !effectsHidden && !submitted && !confirm.isPending && !outcomeUnknown && !checking;
  const checkStatus = async () => {
    setChecking(true); setCheckFailed(false); setConfirmVisible(false);
    try {
      const result = await previewQuery.refetch();
      if (result.isError) { setCheckFailed(true); return; }
      confirm.reset?.(); setConfirmationBlocked(false); setSubmitted(false);
      if (result.data?.status === 'succeeded') {
        if (compact) setDecisionResult(result.data); else routeSuccess(result.data);
      }
    } catch { setCheckFailed(true); }
    finally { setChecking(false); }
  };
  const submitConfirmation = (expectedSignature: string | null) => {
    if (submitting.current || submitted || confirm.isPending || !preview) return;
    if (!canConfirm || expectedSignature !== signature || (compact && !accountName)) { setConfirmationBlocked(true); setConfirmVisible(false); return; }
    submitting.current = true;
    setSubmitted(true);
    confirm.mutate(
      { previewId, expectedVersion: preview.version, operationId: `preview-confirm-${previewId}-${preview.version}` },
      {
        onSuccess: (result: { value: AssistantActionPreview }) => {
          setConfirmVisible(false);
          if (compact) setDecisionResult(result.value); else routeSuccess(result.value);
        },
        onError: () => { submitting.current = false; setSubmitted(false); setConfirmVisible(false); }
      }
    );
  };

  if (previewQuery.isError && !decisionResult) return <><StyledText>{queryError?.code === 'offline' ? 'assistant.actionPreview.state.offline' : 'assistant.actionPreview.state.error'}</StyledText><ActionButton label="assistant.actionPreview.action.checkStatus" variant="secondary" loading={checking} onPress={checkStatus} /></>;
  if (!preview) return <StyledText>assistant.actionPreview.state.loading</StyledText>;
  if (inline && !compact) return <>{fallback}<ActionButton label="assistant.proposal.review" onPress={() => onReviewAction?.(previewId)} /></>;
  if (compact && moneyInput) {
    const kind = translateDynamic(`assistant.actionPreview.value.${amountMinor < 0 ? 'income' : 'expense'}`);
    const amount = effectsHidden ? `•••• ${currency}` : formatMinorAmount(Math.abs(amountMinor), currency, currentLocale());
    const terminal = preview.status === 'succeeded' && Boolean(preview.resultReference);
    const cancellable = ['ready', 'draft'].includes(preview.status) && !confirm.isPending && !submitted && !outcomeUnknown && !cancel.isPending && !checking;
    return <View style={{gap: 8}}>
      {terminal ? <StyledText testID="assistant-transaction-result">{effectsHidden ? '••••' : translateDynamic('assistant.transactionReview.added', {kind, amount})}</StyledText> : preview.status === 'cancelled' ? <StyledText>assistant.transactionReview.cancelled</StyledText> : <>
        <StyledText>{kind}</StyledText>
        <StyledText variant="subtitle">{amount}</StyledText>
        <StyledText>{effectsHidden ? '••••' : accountName ?? translateDynamic('assistant.transactionReview.accountUnavailable')}</StyledText>
        {!effectsHidden ? <StyledText>{[preview.effect?.date, preview.effect?.merchant, preview.effect?.note].filter(value => typeof value === 'string' && value.length > 0).join(' · ')}</StyledText> : null}
        {effectsHidden ? <ActionButton label="assistant.actionPreview.action.revealEffects" variant="secondary" onPress={revealEffects} /> : null}
        {preview.status !== 'ready' || preview.confirmationAllowed === false || !disclosure?.complete || !accountName ? <StyledText>{`assistant.actionPreview.state.${['expired','stale','failed'].includes(preview.status) ? preview.status : 'incomplete'}`}</StyledText> : null}
        <View style={{flexDirection: 'row', gap: 8}}>
          <ActionButton label="assistant.transactionReview.confirm" style={{flex: 1}} disabled={!canConfirm || !accountName || cancel.isPending} loading={confirm.isPending} onPress={() => submitConfirmation(signature)} />
          <ActionButton label="assistant.transactionReview.cancel" style={{flex: 1}} variant="secondary" disabled={!cancellable} loading={cancel.isPending} onPress={() => cancel.mutate({previewId, expectedVersion: preview.version, operationId: `preview-cancel-${previewId}-${preview.version}`}, {onSuccess: (result: {value: AssistantActionPreview}) => setDecisionResult(result.value)})} />
        </View>
      </>}
      {confirm.isError || cancel.isError || confirmationBlocked || checkFailed || outcomeUnknown ? <StyledText>{outcomeUnknown ? 'assistant.actionPreview.state.unknown' : 'assistant.actionPreview.state.error'}</StyledText> : null}
      {!terminal && preview.status !== 'cancelled' && (outcomeUnknown || confirm.isError || cancel.isError || checkFailed || !canConfirm) ? <ActionButton label="assistant.actionPreview.action.checkStatus" variant="secondary" loading={checking} onPress={checkStatus} /> : null}
    </View>;
  }
  if (preview.status === 'stale') return <StyledText>assistant.actionPreview.state.stale</StyledText>;
  if (preview.status === 'expired') return <StyledText>assistant.actionPreview.state.expired</StyledText>;
  if (preview.status === 'failed') return <StyledText>{preview.safeFailure === 'review_required' ? 'assistant.actionPreview.failure.reviewRequired' : 'assistant.actionPreview.state.failed'}</StyledText>;

  return (
    <ScrollView contentContainerStyle={{ gap: 12, padding: 16 }}>
      {moneyInput ? (
        <FinancialPulse
          accessibilityLabel={`${translateDynamic(`assistant.actionPreview.destination.${preview.affectedDestination.kind}`)}, ${formattedAmount}`}
          scope={translateDynamic(`assistant.actionPreview.destination.${preview.affectedDestination.kind}`)}
          statement={formattedAmount}
          supportingValue={translateDynamic('assistant.actionPreview.confirm.message')}
        />
      ) : <StyledText>{`assistant.actionPreview.destination.${preview.affectedDestination.kind}`}</StyledText>}
      {moneyInput ? (
        <GroupedList label={translateDynamic('assistant.actionPreview.value.amount')}>
          <NavigationRow label={translateDynamic('assistant.actionPreview.value.amount')} description={translateDynamic('assistant.actionPreview.confirm.message')} />
        </GroupedList>
      ) : null}
      {preview.effect ? <GroupedList label={translateDynamic('assistant.actionPreview.field.scope')}>
        <NavigationRow label={translateDynamic('assistant.actionPreview.field.scope')} description={translateDynamic(disclosure?.scopeKey ?? 'assistant.actionPreview.scope.unavailable')} />
        {disclosure?.fields.map(field => <NavigationRow key={field.key} label={translateDynamic(field.labelKey)} description={effectsHidden ? '••••' : field.before !== undefined ? `${translateDynamic('assistant.actionPreview.field.before')}: ${displayValue(field.before, field.key)}\n${translateDynamic('assistant.actionPreview.field.after')}: ${displayValue(field.value, field.key)}` : displayValue(field.value, field.key)} />)}
      </GroupedList> : null}
      {effectsHidden ? <ActionButton label="assistant.actionPreview.action.revealEffects" variant="secondary" onPress={revealEffects} /> : null}
      {preview.effect && preview.status === 'ready' && !disclosure?.complete ? <StyledText>{disclosure?.reason === 'stale' ? 'assistant.actionPreview.state.stale' : 'assistant.actionPreview.state.incomplete'}</StyledText> : null}
      {preview.status === 'succeeded' ? <StyledText>assistant.actionPreview.state.completed</StyledText> : null}
      {preview.status === 'cancelled' ? <StyledText>assistant.actionPreview.state.cancelled</StyledText> : null}
      {confirm.isPending || preview.status === 'confirming' || confirm.isError || cancel.isError || confirmationBlocked || checkFailed ? <StyledText>{outcomeUnknown ? 'assistant.actionPreview.state.unknown' : confirm.isError || cancel.isError || confirmationBlocked || checkFailed ? 'assistant.actionPreview.state.error' : 'assistant.actionPreview.state.pending'}</StyledText> : null}
      <ActionButton
        label="assistant.actionPreview.action.confirm"
        disabled={!canConfirm}
        onPress={() => {
          if (!canConfirm) return;
          setReviewedSignature(signature);
          setConfirmVisible(true);
        }}
      />
      <ActionButton
        label="assistant.actionPreview.action.cancel"
        variant="secondary"
        disabled={!['ready', 'draft'].includes(preview.status) || confirm.isPending || submitted || outcomeUnknown || cancel.isPending || checking}
        onPress={() => cancel.mutate({ previewId, expectedVersion: preview.version, operationId: `preview-cancel-${previewId}-${preview.version}` })}
      />
      {preview.effect || outcomeUnknown || checkFailed ? <ActionButton label="assistant.actionPreview.action.checkStatus" variant="secondary" loading={checking} onPress={checkStatus} /> : null}
      <ActionButton label="assistant.actionPreview.action.back" variant="secondary" onPress={() => router.back()} />
      <ConfirmationDialog
        visible={confirmVisible}
        title="assistant.actionPreview.confirm.title"
        message="assistant.actionPreview.confirm.message"
        confirmLabel="assistant.actionPreview.action.confirmNow"
        onCancel={() => setConfirmVisible(false)}
        onConfirm={() => submitConfirmation(reviewedSignature)}
      />
    </ScrollView>
  );
}

function displayValue(value: string | null, key: string) {
  if (value === null) return translateDynamic('assistant.actionPreview.value.none');
  const enumFields = ['status', 'kind', 'decision', 'source', 'paymentCase', 'allocationIntent', 'direction', 'transactionEffect', 'emergencyFund', 'rolloverEnabled'];
  const translated = enumFields.includes(key.split('.').at(-1) ?? key) ? translateDynamic(`assistant.actionPreview.value.${value}`) : value;
  const result = translated === `assistant.actionPreview.value.${value}` ? value : translated;
  return /^[A-Za-z0-9-]/u.test(result) ? `\u2066${result}\u2069` : result;
}

function routeSuccess(preview: AssistantActionPreview) {
  const destination = preview.affectedDestination;
  if (destination.kind === 'goal' && preview.resultReference) router.push(`/savings/${preview.resultReference}`);
  if (destination.kind === 'subscriptions') router.push('/subscriptions');
  if (destination.kind === 'transactions') router.push('/transactions');
  if (destination.kind === 'budget') router.push(`/budgets/${destination.budgetId}`);
  if (destination.kind === 'obligation') router.push(`/obligations/${destination.obligationId}`);
}

function isMoneyInput(input: unknown): input is { amountMinor: number; currency: string } {
  return Boolean(input) && typeof (input as { amountMinor?: unknown }).amountMinor === 'number' && typeof (input as { currency?: unknown }).currency === 'string';
}
