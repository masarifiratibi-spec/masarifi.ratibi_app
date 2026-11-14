import React from 'react';
import { router } from 'expo-router';
import { useTheme } from '@/state/theme-context';
import { View, StyleSheet } from 'react-native';
import { LockShieldIcon, SmallShieldIcon } from './AssistantIcons';
import { layoutDirectionStyle } from '@/design-system/direction';
import { StyledText } from '@/components/StyledText';
import { ActionButton } from '@/design-system/components/ActionButton';
import { translate } from '@/localization/i18n';
import { usePreferenceStore } from '@/state/preferences';
import { type ThemeColors, radius, spacing } from '@/design-system/tokens';
import type { AssistantConsent } from '@/domain/assistant';

export interface AssistantConsentCardProps {
  consent?: AssistantConsent | null;
  onEnableConsent: () => void;
  onDisableConsent?: () => void;
  loading?: boolean;
}

export function AssistantConsentCard({
  consent,
  onEnableConsent,
  onDisableConsent,
  loading = false
}: AssistantConsentCardProps) {
  const { colors } = useTheme();
  const styles = React.useMemo(() => createStyles(colors), [colors]);
  const direction = usePreferenceStore((state) => state.direction);
  const isRtl = direction === 'rtl';
  const isEnabled = consent?.status === 'enabled';

  return (
    <View testID="assistant-consent-card" style={styles.card}>
      {/* Shield icon badge — centered, always at top */}
      <View style={styles.iconBadge}>
        <LockShieldIcon size={22} color={colors.content.link} />
      </View>

      {/* Text block: title + description */}
      <View style={[styles.textBlock, { alignItems: 'center' }]}>
        <StyledText
          variant="subtitle"
          style={[styles.title, { textAlign: 'center' }]}
        >
          {translate('assistant.consent.title')}
        </StyledText>
        <StyledText
          variant="caption"
          style={[styles.description, { textAlign: 'center' }]}
        >
          {translate('assistant.privacy.transactions')}
        </StyledText>
        <ActionButton label="privacy.details" variant="quiet"
          onPress={() => router.push({ pathname: '/(public)/legal', params: { document: 'privacy' } })} />
      </View>

      {/* CTA: enable button OR enabled confirmation */}
      {!isEnabled ? (
        <ActionButton
          testID="assistant-consent-enable-button"
          label={translate('assistant.action.enable')}
          variant="primary"
          disabled={loading}
          onPress={onEnableConsent}
          style={styles.ctaButton}
        />
      ) : (
        <View
          style={[
            styles.enabledNotice,
            { flexDirection: isRtl ? 'row-reverse' : 'row' }
          ]}
        >
          <SmallShieldIcon size={15} color={colors.content.link} />
          <StyledText style={styles.enabledText}>
            {translate('assistant.consent.enabled')}
          </StyledText>
        </View>
      )}
      {isEnabled && onDisableConsent ? (
        <ActionButton label="assistant.consent.withdraw" variant="secondary" disabled={loading}
          onPress={onDisableConsent} />
      ) : !isEnabled ? (
        <ActionButton label="appShell.permission.manualFallback" variant="quiet"
          onPress={() => router.replace('/(tabs)/add')} />
      ) : null}
    </View>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  card: {
    alignItems: 'center',
    backgroundColor: colors.surfaces.card,
    borderColor: colors.borders.default,
    borderRadius: radius.card,
    borderWidth: 1,
    gap: spacing.sm,
    marginHorizontal: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    shadowColor: colors.effects.shadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2
  },
  iconBadge: {
    alignItems: 'center',
    backgroundColor: colors.surfaces.brandSubtle,
    borderColor: colors.borders.subtle,
    borderRadius: radius.pill,
    borderWidth: 1,
    height: 48,
    justifyContent: 'center',
    width: 48
  },
  textBlock: {
    gap: spacing.xs,
    width: '100%'
  },
  title: {
    color: colors.content.primary,
    fontSize: 15,
    fontWeight: '700'
  },
  description: {
    color: colors.content.secondary,
    fontSize: 13,
    lineHeight: 18
  },
  ctaButton: {
    marginTop: spacing.xs,
    width: '100%'
  },
  enabledNotice: {
    alignItems: 'center',
    backgroundColor: colors.surfaces.brandSubtle,
    borderColor: colors.borders.subtle,
    borderRadius: radius.sm,
    borderWidth: 1,
    ...layoutDirectionStyle('ltr'),
    gap: spacing.sm,
    justifyContent: 'center',
    marginTop: spacing.xs,
    paddingVertical: spacing.sm,
    width: '100%'
  },
  enabledText: {
    color: colors.content.link,
    fontSize: 13,
    fontWeight: '600'
  }
});
