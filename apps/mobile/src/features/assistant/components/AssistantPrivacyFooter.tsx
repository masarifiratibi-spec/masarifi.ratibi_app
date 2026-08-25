import React from 'react';
import { View, StyleSheet } from 'react-native';
import { SmallShieldIcon } from './AssistantIcons';
import { StyledText } from '@/components/StyledText';
import { translate } from '@/localization/i18n';
import { usePreferenceStore } from '@/state/preferences';
import { colorTokens, radius, spacing } from '@/design-system/tokens';

export function AssistantPrivacyFooter() {
  const direction = usePreferenceStore((state) => state.direction);
  const isRtl = direction === 'rtl';

  return (
    <View testID="assistant-privacy-footer" style={styles.container}>
      <View style={styles.innerRow}>
        {isRtl ? (
          <>
            <StyledText style={styles.privacyText}>
              {translate('assistant.privacy.note')}
            </StyledText>
            <View style={styles.iconCircle}>
              <SmallShieldIcon size={12} color={colorTokens.teal['700']} />
            </View>
          </>
        ) : (
          <>
            <View style={styles.iconCircle}>
              <SmallShieldIcon size={12} color={colorTokens.teal['700']} />
            </View>
            <StyledText style={styles.privacyText}>
              {translate('assistant.privacy.note')}
            </StyledText>
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs
  },
  innerRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
    justifyContent: 'center'
  },
  iconCircle: {
    alignItems: 'center',
    backgroundColor: colorTokens.teal['50'],
    borderColor: colorTokens.teal['100'],
    borderRadius: radius.pill,
    borderWidth: 1,
    flexShrink: 0,
    height: 22,
    justifyContent: 'center',
    width: 22
  },
  privacyText: {
    color: colorTokens.ink['500'],
    fontSize: 11.5,
    lineHeight: 16,
    textAlign: 'center'
  }
});
