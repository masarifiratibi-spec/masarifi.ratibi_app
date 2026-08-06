/**
 * AccessibilityStateGallery — proves User Story 4.
 *
 * Renders the canonical async states with text/semantic cues beyond color, plus
 * the controls needed to verify language, theme, motion, and privacy behavior.
 * Status meaning never relies on color alone (Constitution Principle III,
 * UI Contract §8, §10).
 */

import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { StyledText } from '@/components/StyledText';
import { useTheme } from '@/state/theme-context';
import { translate } from '@/localization/i18n';
import type { MessageKey } from '@/localization/messages/en';
import type { FrontendStateKind } from '@/domain/foundation';
import { FoundationControls } from './FoundationControls';
import { minTouchTarget } from '@/design-system/tokens';

interface StateExample {
  kind: FrontendStateKind;
  labelKey: MessageKey;
  icon: string;
}

const STATES: readonly StateExample[] = [
  { kind: 'loading', labelKey: 'a11y.stateLoading', icon: '⟳' },
  { kind: 'success', labelKey: 'a11y.stateSuccess', icon: '✓' },
  { kind: 'empty', labelKey: 'a11y.stateEmpty', icon: '○' },
  { kind: 'error', labelKey: 'a11y.stateError', icon: '!' },
  { kind: 'offline', labelKey: 'a11y.stateOffline', icon: '⌧' },
  { kind: 'permission_required', labelKey: 'a11y.statePermission', icon: '🔒' },
  { kind: 'sync_pending', labelKey: 'a11y.stateSync', icon: '↻' }
];

export function AccessibilityStateGallery() {
  const theme = useTheme();
  const [retryRequested, setRetryRequested] = useState(false);

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      contentContainerStyle={styles.content}
    >
      <FoundationControls />

      <View style={styles.gallery}>
        {STATES.map((state) => (
          <View
            key={state.kind}
            style={[
              styles.stateCard,
              {
                backgroundColor: theme.colors.surface,
                borderColor: theme.colors.border
              }
            ]}
          >
            <StyledText
              variant="subtitle"
              accessibilityRole="text"
              accessibilityLabel={translate(state.labelKey)}
            >
              {state.icon} {translate(state.labelKey)}
            </StyledText>
            {state.kind === 'error' && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={translate('a11y.actionRetry')}
                onPress={() => setRetryRequested(true)}
                style={[
                  styles.retry,
                  {
                    minHeight: minTouchTarget,
                    borderColor: theme.colors.border
                  }
                ]}
              >
                <StyledText variant="body">
                  {translate('a11y.actionRetry')}
                </StyledText>
              </Pressable>
            )}
          </View>
        ))}
      </View>
      {retryRequested && (
        <StyledText variant="body" accessibilityLiveRegion="polite">
          {translate('a11y.retryRequested')}
        </StyledText>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, gap: 16 },
  gallery: { gap: 8 },
  stateCard: {
    padding: 12,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 8
  },
  retry: {
    alignSelf: 'flex-start',
    justifyContent: 'center',
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth
  }
});
