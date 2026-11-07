import React from 'react';
import { Modal, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { StyledText } from '@/components/StyledText';
import { ActionButton } from '@/design-system/components/ActionButton';
import { spacing } from '@/design-system/tokens';
import { translate } from '@/localization/i18n';
import { usePreferenceStore } from '@/state/preferences';
import { useTheme } from '@/state/theme-context';
import { useFinancialReset } from './useFinancialReset';

export function FinancialResetDialog({
  ownerId,
  onClose
}: {
  ownerId: string;
  onClose: () => void;
}) {
  const reset = useFinancialReset(ownerId);
  const theme = useTheme();
  const direction = usePreferenceStore((state) => state.direction);
  const locale = usePreferenceStore((state) => state.locale);
  const reducedMotion = usePreferenceStore((state) => state.reducedMotion);
  const confirming = reset.stage === 'review' || reset.stage === 'retry';
  return (
    <Modal
      visible
      transparent
      animationType={reducedMotion ? 'none' : 'fade'}
      onRequestClose={onClose}
    >
      <SafeAreaView
        style={[
          styles.backdrop,
          { backgroundColor: theme.colors.horizon.scrim }
        ]}
      >
        <View
          accessibilityViewIsModal
          accessibilityLabel={translate('financialReset.confirmTitle', locale)}
          style={[
            styles.dialog,
            {
              backgroundColor: theme.colors.surface,
              borderColor: theme.colors.border,
              direction
            }
          ]}
        >
          <ScrollView contentContainerStyle={styles.content}>
            <StyledText variant="subtitle" accessibilityRole="header">
              {confirming
                ? 'financialReset.confirmTitle'
                : 'financialReset.title'}
            </StyledText>
            {confirming ? (
              <>
                <StyledText>financialReset.confirmMessage</StyledText>
                <StyledText variant="caption">
                  financialReset.external
                </StyledText>
                {reset.stage === 'retry' ? (
                  <StyledText>financialReset.retryNotice</StyledText>
                ) : null}
                <ActionButton
                  variant="destructive"
                  label="financialReset.submit"
                  loading={reset.busy}
                  onPress={() => void reset.submit()}
                />
              </>
            ) : null}
            {reset.stage === 'loading' ? (
              <StyledText>financialReset.checking</StyledText>
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
                label={
                  confirming ? 'coreFinance.cancel' : 'financialReset.close'
                }
                variant="secondary"
                onPress={onClose}
              />
            ) : null}
          </ScrollView>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'center', padding: spacing.lg },
  dialog: {
    maxHeight: '85%',
    width: '100%',
    maxWidth: 480,
    alignSelf: 'center',
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth
  },
  content: { padding: spacing.lg, gap: spacing.md }
});
