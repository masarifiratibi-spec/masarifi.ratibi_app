import React from 'react';
import { PixelRatio, Pressable, StyleSheet, View } from 'react-native';

import { StyledText } from '@/components/StyledText';
import { translate } from '@/localization/i18n';
import { usePreferenceStore } from '@/state/preferences';
import { useTheme } from '@/state/theme-context';
import { useSensitiveVisibility } from '@/state/SensitiveVisibilityProvider';
import { radius, spacing } from '@/design-system/tokens';
import type { DesignIconName } from '@/design-system/icons';
import {
  AmountText,
  CategoryIcon,
  financialAmountNeedsFullWidth,
  financialMinorAmountNeedsFullWidth,
  type FinancialMeaning
} from './FinancialPrimitives';
import { categoryIconName } from './category-visuals';

export function TransactionRow({
  title,
  category,
  categoryIcon,
  categoryVisualKey,
  categoryColor,
  date,
  account,
  source,
  meaning,
  statusLabel,
  amount,
  amountMinor,
  currency,
  groupedPosition,
  onPress
}: {
  title: string;
  category: string;
  categoryIcon?: DesignIconName;
  categoryVisualKey?: string | null;
  categoryColor?: string;
  date: string;
  account: string;
  source: string;
  meaning: FinancialMeaning;
  statusLabel?: string;
  amount?: number;
  amountMinor?: number;
  currency: string;
  groupedPosition?: 'first' | 'middle' | 'last' | 'only';
  onPress?: () => void;
}) {
  const theme = useTheme();
  const hideBalances = usePreferenceStore((state) => state.hideBalances);
  const { revealed } = useSensitiveVisibility();
  const direction = usePreferenceStore((state) => state.direction);
  const locale = usePreferenceStore((state) => state.locale);
  const largeText = PixelRatio.getFontScale() >= 1.5;
  const masked = hideBalances && !revealed;
  const stacked =
    largeText ||
    (!masked &&
      (amountMinor === undefined
        ? financialAmountNeedsFullWidth(amount ?? 0, currency, locale)
        : financialMinorAmountNeedsFullWidth(
            amountMinor,
            currency,
            locale
          )));
  const meaningLabel = translate(`coreFinance.meaning.${meaning}` as never);
  const announcement = `${title}, ${category}, ${date}, ${account}, ${source}, ${statusLabel ?? meaningLabel}`;

  return (
    <Pressable
      testID="transaction-row"
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={announcement}
      onPress={onPress}
      style={[
        styles.row,
        styles.physicalLtr,
        {
          alignItems: stacked ? 'stretch' : 'center',
          backgroundColor: groupedPosition
            ? theme.colors.surfaces.card
            : undefined,
          borderColor: theme.colors.borders.subtle,
          flexDirection: stacked
            ? 'column'
            : direction === 'rtl'
              ? 'row-reverse'
              : 'row'
        },
        groupedPosition === 'first' && styles.groupedFirst,
        groupedPosition === 'middle' && styles.groupedMiddle,
        groupedPosition === 'last' && styles.groupedLast,
        groupedPosition === 'only' && styles.groupedOnly
      ]}
    >
      <CategoryIcon
        label={category}
        icon={categoryIcon ?? categoryIconName(categoryVisualKey ?? null)}
        size="md"
        visualKey={categoryVisualKey}
        color={categoryColor}
      />
      <View
        testID="transaction-row-main"
        style={[
          styles.main,
          direction === 'rtl' ? styles.semanticRtl : styles.physicalLtr,
          {
            alignItems: 'flex-start'
          }
        ]}
      >
        <StyledText
          variant="title"
          numberOfLines={largeText ? undefined : 1}
          style={[
            styles.title,
            {
              color: theme.colors.textPrimary,
              textAlign: direction === 'rtl' ? 'right' : 'left',
              writingDirection: direction
            }
          ]}
        >
          {title}
        </StyledText>
        <StyledText
          testID="transaction-category-label"
          variant="subtitle"
          numberOfLines={largeText ? undefined : 1}
          style={[
            styles.category,
            {
              color: theme.colors.content.secondary,
              textAlign: direction === 'rtl' ? 'right' : 'left',
              writingDirection: direction
            }
          ]}
        >
          {category}
        </StyledText>
        <View style={styles.accountLine}>
          <StyledText
            numberOfLines={largeText ? undefined : 1}
            style={{ color: theme.colors.textSecondary, flexShrink: 1 }}
          >
            {account}
          </StyledText>
          <View
            testID="transaction-account-indicator"
            style={[
              styles.accountIndicator,
              { backgroundColor: theme.colors.accent }
            ]}
          />
        </View>
        {statusLabel ? (
          <StyledText
            variant="caption"
            style={{ color: theme.colors.status.warning }}
          >
            {statusLabel}
          </StyledText>
        ) : null}
      </View>
      <View
        testID="transaction-row-amount"
        style={[
          styles.amount,
          {
            alignItems: direction === 'rtl' ? 'flex-start' : 'flex-end',
            maxWidth: stacked ? '100%' : '36%'
          }
        ]}
      >
        <AmountText
          value={amount}
          minorUnits={amountMinor}
          currency={currency}
          meaning={meaning}
          masked={masked}
          size="row"
        />
        <StyledText
          variant="caption"
          numberOfLines={largeText ? undefined : 1}
          style={[
            styles.date,
            {
              color: theme.colors.content.muted,
              writingDirection: direction
            }
          ]}
        >
          {date}
        </StyledText>
      </View>
      {groupedPosition === 'first' || groupedPosition === 'middle' ? (
        <View
          testID="transaction-row-divider"
          style={[
            styles.divider,
            { backgroundColor: theme.colors.borders.subtle }
          ]}
        />
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  physicalLtr: { direction: 'ltr', display: 'flex', writingDirection: 'ltr' },
  semanticRtl: { direction: 'rtl', display: 'flex', writingDirection: 'rtl' },
  row: {
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: spacing.sm,
    minHeight: 88,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md
  },
  groupedFirst: {
    borderBottomWidth: 0,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderRightWidth: StyleSheet.hairlineWidth,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    borderTopWidth: StyleSheet.hairlineWidth
  },
  groupedMiddle: {
    borderBottomWidth: 0,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderRightWidth: StyleSheet.hairlineWidth,
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
    borderTopWidth: 0
  },
  groupedLast: {
    borderBottomLeftRadius: radius.lg,
    borderBottomRightRadius: radius.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderRightWidth: StyleSheet.hairlineWidth,
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
    borderTopWidth: 0
  },
  groupedOnly: {
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth
  },
  divider: {
    bottom: 0,
    height: StyleSheet.hairlineWidth,
    left: spacing.md,
    position: 'absolute',
    right: spacing.md
  },
  main: {
    flex: 1,
    gap: 2,
    minWidth: 0
  },
  amount: { flexShrink: 1, gap: 2 },
  accountLine: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.xs,
    maxWidth: '100%'
  },
  accountIndicator: { borderRadius: 999, height: 6, width: 6 },
  category: {
    fontSize: 11.5,
    lineHeight: 15
  },
  title: {
    fontSize: 14.5,
    lineHeight: 20
  },
  date: { fontSize: 11, lineHeight: 15 }
});
