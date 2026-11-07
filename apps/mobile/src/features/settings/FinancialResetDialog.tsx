import React from 'react';
import { ScrollView, StyleSheet } from 'react-native';

import { StyledText } from '@/components/StyledText';
import { ActionButton } from '@/design-system/components/ActionButton';
import { AppSheet } from '@/design-system/components/overlays/AppSheet';
import { spacing } from '@/design-system/tokens';
import { translate } from '@/localization/i18n';
import { usePreferenceStore } from '@/state/preferences';
import { useFinancialReset } from './useFinancialReset';

export function FinancialResetDialog({
  ownerId,
  onClose
}: {
  ownerId: string;
  onClose: () => void;
}) {
  const reset = useFinancialReset(ownerId);
  const locale = usePreferenceStore((state) => state.locale);
  const confirming = ['loading', 'review', 'retry'].includes(reset.stage);
  return (
    <AppSheet
      appearance="menu"
      visible
      title={translate(
        confirming ? 'financialReset.confirmTitle' : 'financialReset.title',
        locale
      )}
      onDismiss={onClose}
    >
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        {confirming ? (
          <>
            <StyledText>financialReset.confirmMessage</StyledText>
            <StyledText variant="caption">financialReset.external</StyledText>
            {reset.stage === 'retry' ? (
              <StyledText>financialReset.retryNotice</StyledText>
            ) : null}
            <ActionButton
              variant="destructive"
              label="financialReset.submit"
              loading={reset.busy}
              disabled={reset.stage === 'loading' || !!reset.error}
              onPress={() => void reset.submit()}
            />
          </>
        ) : null}
        {reset.stage === 'processing' ? (
          <StyledText accessibilityLiveRegion="polite">
            financialReset.processing
          </StyledText>
        ) : null}
        {reset.stage === 'stale' ? (
          <>
            <StyledText accessibilityRole="alert">
              financialReset.stale
            </StyledText>
            <ActionButton
              label="financialReset.reviewAgain"
              loading={reset.busy}
              onPress={() => void reset.reviewAgain()}
            />
          </>
        ) : null}
        {reset.stage === 'completed' ? (
          <>
            <StyledText accessibilityLiveRegion="polite">
              financialReset.complete
            </StyledText>
            <ActionButton
              label="financialReset.done"
              loading={reset.busy}
              onPress={() => void reset.finish(onClose)}
            />
          </>
        ) : null}
        {reset.error ? (
          <>
            <StyledText accessibilityRole="alert">{reset.error}</StyledText>
            <ActionButton
              label="financialReset.checkStatus"
              loading={reset.busy}
              variant="secondary"
              onPress={() => void reset.refresh()}
            />
          </>
        ) : null}
        {reset.stage !== 'completed' ? (
          <ActionButton
            label={confirming ? 'coreFinance.cancel' : 'financialReset.close'}
            variant="secondary"
            onPress={onClose}
          />
        ) : null}
      </ScrollView>
    </AppSheet>
  );
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 0, flexShrink: 1 },
  content: { paddingTop: spacing.sm, gap: spacing.md }
});
