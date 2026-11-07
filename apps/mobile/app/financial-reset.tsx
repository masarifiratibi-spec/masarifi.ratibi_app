import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';

import { StyledText } from '@/components/StyledText';
import { ActionButton } from '@/design-system/components/ActionButton';
import { FormField } from '@/design-system/components/forms/FormField';
import { AppBar } from '@/design-system/components/navigation/AppNavigation';
import { spacing } from '@/design-system/tokens';
import { translate } from '@/localization/i18n';
import { reconcileFinancialReset } from '@/services/financial-generation';
import {
  acknowledgeFinancialReset,
  fetchFinancialResetState,
  financialResetRuntimeAvailable,
  loadFinancialResetOperation,
  readFinancialReset,
  submitFinancialReset,
  type FinancialResetReceipt
} from '@/services/financial-reset';
import { HttpError } from '@/services/live/http-client';
import { useAppShellStore } from '@/state/app-shell';
import { usePreferenceStore } from '@/state/preferences';
import { useTheme } from '@/state/theme-context';

const leave = () =>
  router.canGoBack() ? router.back() : router.replace('/(tabs)/more');

export default function FinancialResetRoute() {
  const session = useAppShellStore((state) => state.session);
  if (session?.status !== 'authenticated' || !session.userId) return null;
  return <Review key={session.userId} ownerId={session.userId} />;
}

function Review({ ownerId }: { ownerId: string }) {
  const theme = useTheme();
  const locale = usePreferenceStore((state) => state.locale);
  const direction = usePreferenceStore((state) => state.direction);
  const [phrase, setPhrase] = React.useState('');
  const [reviewedGeneration, setReviewedGeneration] = React.useState(0);
  const [stage, setStage] = React.useState<
    'loading' | 'review' | 'retry' | 'stale' | 'processing' | 'completed'
  >('loading');
  const [busy, setBusy] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [receiptId, setReceiptId] = React.useState<string | null>(null);
  const active = React.useRef(false);
  const locked = React.useRef(false);
  const current = React.useCallback(
    () =>
      active.current && useAppShellStore.getState().session?.userId === ownerId,
    [ownerId]
  );

  const accept = React.useCallback(
    async (receipt: FinancialResetReceipt) => {
      if (!current()) return;
      setReceiptId(receipt.id);
      setStage('processing');
      if (receipt.status === 'completed') {
        const local = await reconcileFinancialReset(ownerId);
        if (local.generation < receipt.generation)
          throw new Error('generation not synchronized');
        if (current()) setStage('completed');
      }
    },
    [current, ownerId]
  );

  const run = React.useCallback(
    async (operation: () => Promise<void>) => {
      if (locked.current || !current()) return;
      locked.current = true;
      setBusy(true);
      setError(null);
      try {
        await operation();
      } catch (failure) {
        if (current())
          setError(
            failure instanceof HttpError && failure.code === 'session_expired'
              ? 'settings.deletion.sessionExpired'
              : failure instanceof HttpError &&
                  failure.code === 'recent_auth_required'
                ? 'financialReset.authExpired'
                : 'financialReset.error'
          );
      } finally {
        locked.current = false;
        if (current()) setBusy(false);
      }
    },
    [current]
  );

  const refresh = React.useCallback(async () => {
    if (!financialResetRuntimeAvailable()) throw new Error('unavailable');
    const saved = await loadFinancialResetOperation(ownerId);
    const state = await fetchFinancialResetState(ownerId);
    const id =
      saved?.id ?? (state.status === 'processing' ? state.requestId : null);
    const receipt = id && (await readFinancialReset(ownerId, id));
    if (!current()) return;
    setReviewedGeneration(state.generation);
    setPhrase('');
    if (receipt) await accept(receipt);
    else if (saved && saved.generation !== state.generation) {
      setReceiptId(saved.id);
      setStage('stale');
    } else setStage(id ? 'retry' : 'review');
  }, [accept, current, ownerId]);

  React.useEffect(() => {
    active.current = true;
    void run(refresh);
    return () => {
      active.current = false;
    };
  }, [refresh, run]);
  React.useEffect(() => {
    if (stage !== 'processing' || !receiptId || error || busy) return;
    const timer = setTimeout(
      () =>
        void run(async () => {
          const receipt = await readFinancialReset(ownerId, receiptId);
          if (!receipt) throw new Error('receipt unavailable');
          await accept(receipt);
        }),
      3000
    );
    return () => clearTimeout(timer);
  }, [accept, busy, error, ownerId, receiptId, run, stage]);

  const submit = async () => {
    try {
      const receipt = await submitFinancialReset(
        ownerId,
        reviewedGeneration,
        current
      );
      if (receipt) await accept(receipt);
    } catch (failure) {
      if (
        failure instanceof HttpError &&
        ['FINANCIAL_GENERATION_CHANGED', 'FINANCIAL_GENERATION_STALE'].includes(
          failure.domainCode ?? ''
        )
      ) {
        await refresh();
        if (current()) setError('financialReset.reviewChanged');
        return;
      }
      throw failure;
    }
  };
  const expected = locale === 'ar' ? 'تصفير' : 'RESET';
  const confirmed = phrase === expected;
  const showingReview = stage === 'review' || stage === 'retry';
  return (
    <ScrollView
      keyboardShouldPersistTaps="handled"
      style={{ backgroundColor: theme.colors.surfaces.page }}
      contentContainerStyle={styles.page}
    >
      <AppBar
        title={translate('financialReset.title', locale)}
        direction={direction}
        onBack={leave}
      />
      {showingReview ? (
        <>
          <View
            style={[
              styles.card,
              {
                backgroundColor: theme.colors.surface,
                borderColor: theme.colors.border
              }
            ]}
          >
            <StyledText variant="subtitle" accessibilityRole="header">
              financialReset.removedHeading
            </StyledText>
            <StyledText>financialReset.removed</StyledText>
            <StyledText>financialReset.external</StyledText>
          </View>
          <View
            style={[
              styles.card,
              {
                backgroundColor: theme.colors.surface,
                borderColor: theme.colors.border
              }
            ]}
          >
            <StyledText variant="subtitle" accessibilityRole="header">
              financialReset.keptHeading
            </StyledText>
            <StyledText>financialReset.kept</StyledText>
          </View>
          <StyledText>financialReset.warning</StyledText>
          {stage === 'retry' ? (
            <StyledText accessibilityRole="alert">
              financialReset.retryNotice
            </StyledText>
          ) : null}
          <FormField
            label="financialReset.phrase"
            value={phrase}
            onChangeText={setPhrase}
            autoCorrect={false}
            autoCapitalize="none"
            editable={!busy}
          />
          <ActionButton
            variant="destructive"
            label="financialReset.submit"
            disabled={!confirmed}
            loading={busy}
            onPress={() => void run(submit)}
          />
          <ActionButton
            variant="secondary"
            label="coreFinance.cancel"
            onPress={leave}
          />
        </>
      ) : null}
      {stage === 'loading' && busy ? (
        <StyledText accessibilityLiveRegion="polite">
          financialReset.checking
        </StyledText>
      ) : null}
      {stage === 'processing' ? (
        <StyledText accessibilityLiveRegion="polite">
          financialReset.processing
        </StyledText>
      ) : null}
      {stage === 'stale' ? (
        <>
          <StyledText accessibilityRole="alert">
            financialReset.stale
          </StyledText>
          <ActionButton
            variant="secondary"
            label="financialReset.reviewAgain"
            loading={busy}
            onPress={() =>
              void run(async () => {
                if (receiptId)
                  await acknowledgeFinancialReset(ownerId, receiptId);
                await refresh();
              })
            }
          />
        </>
      ) : null}
      {stage === 'completed' ? (
        <>
          <StyledText accessibilityLiveRegion="polite">
            financialReset.complete
          </StyledText>
          <ActionButton
            label="financialReset.done"
            loading={busy}
            onPress={() =>
              void run(async () => {
                if (receiptId)
                  await acknowledgeFinancialReset(ownerId, receiptId);
                if (current()) leave();
              })
            }
          />
        </>
      ) : null}
      {error ? (
        <>
          <StyledText accessibilityRole="alert">{error}</StyledText>
          <ActionButton
            label="financialReset.checkStatus"
            variant="secondary"
            loading={busy}
            onPress={() => void run(refresh)}
          />
        </>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { padding: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.md },
  card: {
    borderRadius: 18,
    padding: spacing.lg,
    gap: spacing.sm,
    borderWidth: StyleSheet.hairlineWidth
  }
});
