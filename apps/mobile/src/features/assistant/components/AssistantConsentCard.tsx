import React from 'react';
import { View, StyleSheet } from 'react-native';
import { LockShieldIcon, SmallShieldIcon } from './AssistantIcons';
import { StyledText } from '@/components/StyledText';
import { ActionButton } from '@/design-system/components/ActionButton';
import { translate } from '@/localization/i18n';
import { usePreferenceStore } from '@/state/preferences';
import { colorTokens, radius, spacing } from '@/design-system/tokens';
import type { AssistantConsent } from '@/domain/assistant';

export interface AssistantConsentCardProps {
  consent?: AssistantConsent | null;
  onEnableConsent: () => void;
  loading?: boolean;
}

export function AssistantConsentCard({
  consent,
  onEnableConsent,
  loading = false
}: AssistantConsentCardProps) {
  const direction = usePreferenceStore((state) => state.direction);
  const isRtl = direction === 'rtl';
  const isEnabled = consent?.status === 'enabled';

  return (
    <View testID="assistant-consent-card" style={styles.card}>
      {/* Shield icon badge — centered, always at top */}
      <View style={styles.iconBadge}>
        <LockShieldIcon size={22} color={colorTokens.teal['700']} />
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
          <SmallShieldIcon size={15} color={colorTokens.teal['700']} />
          <StyledText style={styles.enabledText}>
            {translate('assistant.consent.enabled')}
          </StyledText>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    alignItems: 'center',
    backgroundColor: colorTokens.sand['50'],
    borderColor: colorTokens.sand['400'],
    borderRadius: radius.card,
    borderWidth: 1,
    gap: spacing.sm,
    marginHorizontal: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    shadowColor: colorTokens.teal['950'],
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2
  },
  iconBadge: {
    alignItems: 'center',
    backgroundColor: colorTokens.teal['50'],
    borderColor: colorTokens.teal['100'],
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
    color: colorTokens.ink['900'],
    fontSize: 15,
    fontWeight: '700'
  },
  description: {
    color: colorTokens.ink['500'],
    fontSize: 13,
    lineHeight: 18
  },
  ctaButton: {
    marginTop: spacing.xs,
    width: '100%'
  },
  enabledNotice: {
    alignItems: 'center',
    backgroundColor: colorTokens.teal['50'],
    borderColor: colorTokens.teal['100'],
    borderRadius: radius.sm,
    borderWidth: 1,
    gap: spacing.sm,
    justifyContent: 'center',
    marginTop: spacing.xs,
    paddingVertical: spacing.sm,
    width: '100%'
  },
  enabledText: {
    color: colorTokens.teal['700'],
    fontSize: 13,
    fontWeight: '600'
  }
});
