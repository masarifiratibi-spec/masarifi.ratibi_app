import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { DesignIcon } from '@/design-system/icons';
import { radius, spacing } from '@/design-system/tokens';
import { translateDynamic } from '@/localization/i18n';
import { usePreferenceStore } from '@/state/preferences';
import { colorTokens } from '@/design-system/tokens';

export function CardEducationCard() {
  const direction = usePreferenceStore((state) => state.direction);
  const locale = usePreferenceStore((state) => state.locale);
  const isRtl = direction === 'rtl';

  const t = (key: string) => translateDynamic(key, {}, locale);

  return (
    <View
      style={[
        styles.card,
        styles.physicalLtr,
        {
          backgroundColor: colorTokens.raw["F3F8F5"],
          borderColor: colorTokens.raw["D2E8DC"],
          flexDirection: isRtl ? 'row-reverse' : 'row'
        }
      ]}
    >
      <View style={styles.iconContainer}>
        <DesignIcon
          name="notifications"
          label={t('common.tip')}
          color={colorTokens.raw["1F7A5A"]}
          size="sm"
          decorative
        />
      </View>

      <View
        style={[
          styles.textContainer,
          { alignItems: isRtl ? 'flex-end' : 'flex-start' }
        ]}
      >
        <Text
          style={[
            styles.title,
            {
              color: colorTokens.raw["103F37"],
              textAlign: isRtl ? 'right' : 'left',
              writingDirection: direction
            }
          ]}
        >
          {t('coreFinance.accounts.setup.educationTitle')}
        </Text>
        <Text
          style={[
            styles.body,
            {
              color: colorTokens.raw["2D4B41"],
              textAlign: isRtl ? 'right' : 'left',
              writingDirection: direction
            }
          ]}
        >
          {t('coreFinance.accounts.setup.educationBody')}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  physicalLtr: {
    direction: 'ltr',
    display: 'flex',
    writingDirection: 'ltr'
  },
  card: {
    borderRadius: radius.card,
    borderWidth: 1,
    padding: spacing.md,
    gap: spacing.sm,
    alignItems: 'flex-start'
  },
  iconContainer: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: colorTokens.raw["E2F0E8"],
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1
  },
  textContainer: {
    flex: 1,
    gap: 3
  },
  title: {
    fontSize: 13,
    fontWeight: '700'
  },
  body: {
    fontSize: 12,
    lineHeight: 17
  }
});
