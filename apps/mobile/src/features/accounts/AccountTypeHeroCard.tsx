import React from 'react';
import { StyleSheet, View } from 'react-native';

import { StyledText } from '@/components/StyledText';
import { type AppIconName, DesignIcon } from '@/design-system/icons';
import { radius, spacing } from '@/design-system/tokens';
import type { AccountType } from '@/domain/core-finance';
import { translateDynamic } from '@/localization/i18n';
import { usePreferenceStore } from '@/state/preferences';
import { useTheme } from '@/state/theme-context';
import { colorTokens } from '@/design-system/tokens';

export interface AccountTypeInfo {
  type: AccountType;
  titleKey: string;
  descKey: string;
  icon: AppIconName;
  iconBg: string;
  iconFg: string;
}

export const accountTypeMetadata: Record<string, AccountTypeInfo> = {
  bank: {
    type: 'bank',
    titleKey: 'coreFinance.accounts.typeSelect.bank',
    descKey: 'coreFinance.accounts.typeSelect.bank.desc',
    icon: 'wallet',
    iconBg: colorTokens.raw["EBF5EC"],
    iconFg: colorTokens.raw["1F7A5A"]
  },
  credit_card: {
    type: 'credit_card',
    titleKey: 'coreFinance.accounts.typeSelect.credit_card',
    descKey: 'coreFinance.accounts.typeSelect.credit_card.desc',
    icon: 'card',
    iconBg: colorTokens.raw["EAF4F4"],
    iconFg: colorTokens.raw["227D72"]
  },
  cash: {
    type: 'cash',
    titleKey: 'coreFinance.accounts.typeSelect.cash',
    descKey: 'coreFinance.accounts.typeSelect.cash.desc',
    icon: 'salary',
    iconBg: colorTokens.raw["EBF7EE"],
    iconFg: colorTokens.raw["2E8A57"]
  },
  debit_card: {
    type: 'debit_card',
    titleKey: 'coreFinance.accounts.typeSelect.bank',
    descKey: 'coreFinance.accounts.typeSelect.bank.desc',
    icon: 'wallet',
    iconBg: colorTokens.raw["EBF5EC"],
    iconFg: colorTokens.raw["1F7A5A"]
  }
};

export function AccountTypeHeroCard({ type }: { type: AccountType }) {
  const theme = useTheme();
  const direction = usePreferenceStore((state) => state.direction);
  const locale = usePreferenceStore((state) => state.locale);
  const isRtl = direction === 'rtl';

  const t = (key: string) => translateDynamic(key, {}, locale);
  const meta = accountTypeMetadata[type] ?? accountTypeMetadata.bank;

  const title = t(meta.titleKey);
  const desc = t(meta.descKey);

  return (
    <View
      style={[
        styles.container,
        styles.physicalLtr,
        {
          backgroundColor: theme.colors.surface,
          borderColor: theme.colors.border,
          flexDirection: isRtl ? 'row-reverse' : 'row'
        }
      ]}
    >
      <View style={[styles.iconContainer, { backgroundColor: meta.iconBg }]}>
        <DesignIcon
          name={meta.icon}
          label={title}
          color={meta.iconFg}
          size="md"
          direction={direction}
          decorative
        />
      </View>

      <View
        style={[
          styles.textContainer,
          { alignItems: isRtl ? 'flex-end' : 'flex-start' }
        ]}
      >
        <StyledText
          style={[
            styles.title,
            {
              textAlign: isRtl ? 'right' : 'left',
              writingDirection: direction
            }
          ]}
        >
          {title}
        </StyledText>
        <StyledText
          style={[
            styles.desc,
            {
              textAlign: isRtl ? 'right' : 'left',
              writingDirection: direction
            }
          ]}
        >
          {desc}
        </StyledText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  physicalLtr: {
    display: 'flex',
    writingDirection: 'ltr'
  },
  container: {
    borderRadius: radius.card,
    borderWidth: 1,
    padding: spacing.md,
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 70
  },
  iconContainer: {
    width: 46,
    height: 46,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center'
  },
  textContainer: {
    flex: 1,
    gap: 2
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: colorTokens.raw["10231F"]
  },
  desc: {
    fontSize: 12,
    color: colorTokens.raw["707870"],
    lineHeight: 16
  }
});
