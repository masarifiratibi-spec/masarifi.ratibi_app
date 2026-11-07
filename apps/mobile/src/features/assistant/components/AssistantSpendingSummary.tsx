import React from 'react';
import { StyleSheet, View } from 'react-native';
import { StyledText } from '@/components/StyledText';
import { spacing } from '@/design-system/tokens';
import type { SpendingPresentation } from '@/domain/assistant-presentation';
import { translate } from '@/localization/i18n';
import { useTheme } from '@/state/theme-context';

export function AssistantSpendingSummary({
  presentation
}: {
  presentation: SpendingPresentation;
}) {
  const { colors } = useTheme();
  const locale = presentation.locale;
  const direction: 'rtl' | 'ltr' = locale === 'ar' ? 'rtl' : 'ltr';
  const align = {
    textAlign: locale === 'ar' ? ('right' as const) : ('left' as const),
    writingDirection: direction
  };
  return (
    <View style={styles.container}>
      {presentation.cards.map((card, index) => (
        <View
          key={`${index}-${card.period}`}
          style={[
            styles.currencyGroup,
            index > 0 && {
              borderTopWidth: StyleSheet.hairlineWidth,
              borderTopColor: colors.borders.subtle,
              paddingTop: spacing.md
            }
          ]}
        >
          <StyledText variant="subtitle" style={align}>
            {card.title}
          </StyledText>
          <StyledText
            testID={`assistant-summary-amount-${index}`}
            variant="amount"
            style={[
              styles.amount,
              { color: colors.content.primary, textAlign: align.textAlign }
            ]}
          >
            {card.amount}
          </StyledText>
          <StyledText
            variant="caption"
            style={[align, { color: colors.content.secondary }]}
          >
            {card.period}
          </StyledText>
          {card.comparison && (
            <View style={styles.comparison}>
              <StyledText
                variant="subtitle"
                style={[
                  align,
                  {
                    color:
                      card.comparison.direction === 'up'
                        ? colors.financial.expense
                        : card.comparison.direction === 'down'
                          ? colors.financial.savings
                          : colors.content.primary
                  }
                ]}
              >
                {`${card.comparison.direction === 'up' ? '↑' : card.comparison.direction === 'down' ? '↓' : '='} ${card.comparison.difference} ${translate(`assistant.response.${card.comparison.direction}`, locale)}${card.comparison.percentage ? ` · ${card.comparison.percentage}` : ''}`}
              </StyledText>
              <StyledText
                variant="caption"
                style={[align, { color: colors.content.secondary }]}
              >{`${translate('assistant.response.previous', locale)}: ${card.comparison.previousAmount}\n${card.comparison.previousPeriod}`}</StyledText>
            </View>
          )}
          {card.comparisonNotice && (
            <StyledText style={[align, { color: colors.content.secondary }]}>
              {card.comparisonNotice}
            </StyledText>
          )}
          {card.explanation && (
            <View style={styles.section}>
              <StyledText variant="subtitle" style={align}>
                {translate('assistant.response.explanation', locale)}
              </StyledText>
              <StyledText style={align}>{card.explanation}</StyledText>
            </View>
          )}
          {card.saving && (
            <View style={styles.section}>
              <StyledText variant="subtitle" style={align}>
                {translate('assistant.response.saving', locale)}
              </StyledText>
              <StyledText style={align}>{card.saving.text}</StyledText>
              {card.saving.target && (
                <StyledText
                  variant="subtitle"
                  style={[align, { color: colors.financial.savings }]}
                >{`${translate('assistant.response.target', locale)}: ${card.saving.target}`}</StyledText>
              )}
            </View>
          )}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.lg },
  currencyGroup: { gap: spacing.xs, minWidth: 0 },
  amount: { fontVariant: ['tabular-nums'], writingDirection: 'ltr' },
  comparison: { gap: spacing.xs, marginTop: spacing.sm },
  section: { gap: spacing.xs, marginTop: spacing.md }
});
