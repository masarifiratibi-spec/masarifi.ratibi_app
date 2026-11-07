import React from 'react';
import { useTheme } from '@/state/theme-context';
import { View, StyleSheet, Text } from 'react-native';
import { AssistantBotAvatar } from './AssistantBotAvatar';
import { StyledText } from '@/components/StyledText';
import { translate } from '@/localization/i18n';
import { type ThemeColors, radius, spacing } from '@/design-system/tokens';

export function AssistantHero() {
  const { colors } = useTheme();
  const styles = React.useMemo(() => createStyles(colors), [colors]);
  return (
    <View testID="assistant-hero" style={styles.heroContainer}>
      {/* Soft circular mint badge for avatar */}
      <View style={styles.avatarCircle}>
        <AssistantBotAvatar size={52} testID="assistant-hero-avatar" />
        {/* Subtle sparkle ambient accents */}
        <Text style={[styles.sparkleDot, styles.sparkleTop]}>✦</Text>
        <Text style={[styles.sparkleDot, styles.sparkleRight]}>✦</Text>
      </View>

      {/* Typography matching reference */}
      <View style={styles.textSection}>
        <StyledText variant="body" style={styles.heroSubtitle}>
          {translate('assistant.hero.subtitle')}
        </StyledText>
      </View>
    </View>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  heroContainer: {
    alignItems: 'center',
    backgroundColor: 'transparent',
    gap: spacing.sm,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm
  },
  avatarCircle: {
    alignItems: 'center',
    backgroundColor: colors.surfaces.brandSubtle,
    borderColor: colors.borders.subtle,
    borderRadius: radius.pill,
    borderWidth: 1,
    height: 90,
    justifyContent: 'center',
    position: 'relative',
    width: 90
  },
  sparkleDot: {
    color: colors.borders.focus,
    fontSize: 10,
    opacity: 0.6,
    position: 'absolute'
  },
  sparkleTop: {
    left: 20,
    top: 14
  },
  sparkleRight: {
    bottom: 20,
    right: 14
  },
  textSection: {
    alignItems: 'center',
    gap: spacing.xs,
    maxWidth: 300
  },
  heroSubtitle: {
    color: colors.content.secondary,
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center'
  }
});
