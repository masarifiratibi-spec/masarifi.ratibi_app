import React from 'react';
import { useTheme } from '@/state/theme-context';
import { View, StyleSheet } from 'react-native';
import { SmallShieldIcon } from './AssistantIcons';
import { StyledText } from '@/components/StyledText';
import { translate } from '@/localization/i18n';
import { usePreferenceStore } from '@/state/preferences';
import { type ThemeColors, radius, spacing } from '@/design-system/tokens';

export function AssistantPrivacyFooter() {
  const { colors } = useTheme();
  const styles = React.useMemo(() => createStyles(colors), [colors]);
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
              <SmallShieldIcon size={12} color={colors.content.link} />
            </View>
          </>
        ) : (
          <>
            <View style={styles.iconCircle}>
              <SmallShieldIcon size={12} color={colors.content.link} />
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

const createStyles = (colors: ThemeColors) => StyleSheet.create({
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
    backgroundColor: colors.surfaces.brandSubtle,
    borderColor: colors.borders.subtle,
    borderRadius: radius.pill,
    borderWidth: 1,
    flexShrink: 0,
    height: 22,
    justifyContent: 'center',
    width: 22
  },
  privacyText: {
    color: colors.content.secondary,
    fontSize: 11.5,
    lineHeight: 16,
    textAlign: 'center'
  }
});
