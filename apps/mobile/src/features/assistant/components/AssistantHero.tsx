import React from 'react';
import { useTheme } from '@/state/theme-context';
import { View, StyleSheet } from 'react-native';
import { AssistantBotAvatar } from './AssistantBotAvatar';
import { StyledText } from '@/components/StyledText';
import { translate } from '@/localization/i18n';
import { type ThemeColors, spacing } from '@/design-system/tokens';
import { SparkleIcon } from './AssistantIcons';

export function AssistantHero() {
  const { colors } = useTheme();
  const styles = React.useMemo(() => createStyles(colors), [colors]);
  return (
    <View testID="assistant-hero" style={styles.heroContainer}>
      <View style={styles.avatarCircle}>
        <AssistantBotAvatar size={104} testID="assistant-hero-avatar" />
        <View style={[styles.sparkleDot, styles.sparkleTop]}>
          <SparkleIcon size={16} color={colors.content.link} />
        </View>
        <View style={[styles.sparkleDot, styles.sparkleRight]}>
          <SparkleIcon size={12} color={colors.content.link} />
        </View>
      </View>

      {/* Typography matching reference */}
      <View style={styles.textSection}>
        <StyledText variant="headline" style={styles.heroTitle}>
          {translate('assistant.hero.heading')}
        </StyledText>
        <StyledText variant="body" style={styles.heroSubtitle}>
          {translate('assistant.hero.subtitle')}
        </StyledText>
      </View>
    </View>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    heroContainer: {
      alignItems: 'center',
      backgroundColor: 'transparent',
      gap: spacing.lg,
      justifyContent: 'center',
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.lg
    },
    avatarCircle: {
      alignItems: 'center',
      height: 124,
      justifyContent: 'center',
      position: 'relative',
      width: 136
    },
    sparkleDot: {
      opacity: 0.35,
      position: 'absolute'
    },
    sparkleTop: {
      left: 0,
      top: 18
    },
    sparkleRight: {
      bottom: 14,
      right: 2
    },
    textSection: {
      alignItems: 'center',
      gap: spacing.xs,
      maxWidth: 360
    },
    heroTitle: {
      color: colors.content.link,
      fontSize: 26,
      lineHeight: 38,
      textAlign: 'center'
    },
    heroSubtitle: {
      color: colors.content.secondary,
      fontSize: 14,
      lineHeight: 22,
      textAlign: 'center'
    }
  });
