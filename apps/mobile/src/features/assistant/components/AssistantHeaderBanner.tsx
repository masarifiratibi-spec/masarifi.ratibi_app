import React from 'react';
import { PixelRatio, View, StyleSheet, Text } from 'react-native';
import { AssistantBotAvatar } from './AssistantBotAvatar';
import { layoutDirectionStyle } from '@/design-system/direction';
import { StyledText } from '@/components/StyledText';
import { translate } from '@/localization/i18n';
import { usePreferenceStore } from '@/state/preferences';
import { radius, spacing } from '@/design-system/tokens';
import { useTheme } from '@/state/theme-context';
import type { ThemeColors } from '@/design-system/tokens';
import type { AssistantAvailability } from '../AssistantFunctionalStatus';

export function AssistantHeaderBanner({availability}: {availability?: AssistantAvailability | null} = {}) {
  const { colors } = useTheme();
  const styles = React.useMemo(() => createStyles(colors), [colors]);
  const direction = usePreferenceStore((state) => state.direction);
  const largeText = PixelRatio.getFontScale() >= 1.5;

  return (
    <View
      testID="assistant-header-banner"
      style={[
        styles.banner,
        {
          alignItems: largeText ? 'stretch' : 'center',
          flexDirection: largeText
            ? 'column'
            : direction === 'rtl'
              ? 'row-reverse'
              : 'row'
        }
      ]}
    >
      {/* Mini Bot Avatar with status dot */}
      <AssistantBotAvatar
        size={44}
        showStatusDot={availability === undefined ? true : availability?.capabilities?.provider === 'available'}
        testID="assistant-banner-avatar"
      />

      {/* Title & Subtitle */}
      <View
        style={[
          styles.textGroup,
          {
            alignItems: direction === 'rtl' ? 'flex-end' : 'flex-start'
          }
        ]}
      >
        <StyledText variant="subtitle" style={styles.title}>
          {translate('assistant.chat.banner.title')}
        </StyledText>
        <StyledText
          variant="caption"
          style={styles.subtitle}
          numberOfLines={largeText ? undefined : 2}
        >
          {translate('assistant.chat.banner.subtitle')}
        </StyledText>
      </View>

      {/* Security Badge Pill */}
      <View style={styles.securityBadge}>
        <Text style={styles.securityIcon}>🛡️</Text>
        <StyledText style={styles.securityText}>
          {translate('assistant.chat.banner.security')}
        </StyledText>
      </View>
    </View>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  banner: {
    alignItems: 'center',
    backgroundColor: colors.surfaces.card,
    borderColor: colors.borders.default,
    borderRadius: 20,
    borderWidth: 1,
    ...layoutDirectionStyle('ltr'),
    gap: spacing.sm,
    marginHorizontal: spacing.md,
    marginTop: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    shadowColor: colors.effects.shadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1
  },
  textGroup: {
    flex: 1,
    gap: 2
  },
  title: {
    color: colors.content.primary,
    fontSize: 14.5,
    fontWeight: '700'
  },
  subtitle: {
    color: colors.content.secondary,
    fontSize: 11.5,
    lineHeight: 15
  },
  securityBadge: {
    alignItems: 'center',
    backgroundColor: colors.surfaces.brandSubtle,
    borderRadius: radius.pill,
    flexDirection: 'row',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4
  },
  securityIcon: {
    fontSize: 12
  },
  securityText: {
    color: colors.content.link,
    fontSize: 10.5,
    fontWeight: '600'
  }
});
