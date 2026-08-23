import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { DesignIcon } from '@/design-system/icons';
import { spacing } from '@/design-system/tokens';
import { getCurrencyDetails } from '@/domain/currencies';
import { translateDynamic } from '@/localization/i18n';
import { usePreferenceStore } from '@/state/preferences';
import { useTheme } from '@/state/theme-context';
import { colorTokens } from '@/design-system/tokens';
export function CurrencyRow({
  currencyCode,
  editable = true,
  onPress
}: {
  currencyCode: string;
  editable?: boolean;
  onPress?: () => void;
}) {
  const theme = useTheme();
  const direction = usePreferenceStore((state) => state.direction);
  const locale = usePreferenceStore((state) => state.locale);
  const isRtl = direction === 'rtl';

  const t = (key: string) => translateDynamic(key, {}, locale);
  const currency = getCurrencyDetails(currencyCode);
  const name = locale === 'ar' ? currency.nameAr : currency.nameEn;

  return (
    <View style={styles.wrapper}>
      <Text
        style={[
          styles.label,
          {
            color: theme.colors.textSecondary,
            textAlign: isRtl ? 'right' : 'left',
            writingDirection: direction
          }
        ]}
      >
        {t('coreFinance.accounts.currency')}
      </Text>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${t('coreFinance.accounts.currency')}: ${currency.flag} ${currency.code} - ${name}`}
        disabled={!editable}
        onPress={editable ? onPress : undefined}
        style={({ pressed }) => [
          styles.row,
          styles.physicalLtr,
          {
            backgroundColor: editable
              ? pressed
                ? theme.colors.surfaceMuted
                : theme.colors.surface
              : theme.colors.surfaces?.grouped ?? colorTokens.raw["F8FAFB"],
            borderColor: theme.colors.borders?.subtle ?? colorTokens.raw["E7E9E6"],
            flexDirection: isRtl ? 'row-reverse' : 'row',
            opacity: editable ? 1 : 0.7
          }
        ]}
      >
        {/* Flag + Code + Name */}
        <View
          style={[
            styles.content,
            styles.physicalLtr,
            { flexDirection: isRtl ? 'row-reverse' : 'row' }
          ]}
        >
          <Text style={styles.flag}>{currency.flag}</Text>
          <Text
            style={[
              styles.code,
              {
                color: theme.colors.textPrimary,
                textAlign: isRtl ? 'right' : 'left',
                writingDirection: direction
              }
            ]}
          >
            {currency.code}
          </Text>
          <Text
            style={[
              styles.separator,
              { color: theme.colors.textSecondary }
            ]}
          >
            ·
          </Text>
          <Text
            style={[
              styles.name,
              {
                color: theme.colors.textSecondary,
                textAlign: isRtl ? 'right' : 'left',
                writingDirection: direction
              }
            ]}
            numberOfLines={1}
          >
            {name}
          </Text>
        </View>

        {/* Chevron if editable */}
        {editable ? (
          <DesignIcon
            name="chevronEnd"
            label={currency.code}
            color={colorTokens.raw["A0A8A4"]}
            size="sm"
            direction={direction}
            decorative
          />
        ) : null}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  physicalLtr: {
    display: 'flex',
    writingDirection: 'ltr'
  },
  wrapper: {
    gap: spacing.xs
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    paddingHorizontal: 2
  },
  row: {
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1,
    justifyContent: 'space-between',
    minHeight: 52,
    paddingHorizontal: spacing.md
  },
  content: {
    alignItems: 'center',
    gap: spacing.sm,
    flex: 1
  },
  flag: {
    fontSize: 20
  },
  code: {
    fontSize: 15,
    fontWeight: '700'
  },
  separator: {
    fontSize: 14
  },
  name: {
    fontSize: 13,
    flex: 1
  }
});
