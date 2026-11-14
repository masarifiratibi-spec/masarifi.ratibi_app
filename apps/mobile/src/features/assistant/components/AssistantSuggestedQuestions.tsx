import React from 'react';
import { useTheme } from '@/state/theme-context';
import {
  PixelRatio,
  View,
  Pressable,
  StyleSheet,
  useWindowDimensions
} from 'react-native';
import {
  BarChartIcon,
  PieChartIcon,
  CalendarIcon,
  WalletIcon
} from './AssistantIcons';
import { StyledText } from '@/components/StyledText';
import { translate } from '@/localization/i18n';
import { usePreferenceStore } from '@/state/preferences';
import { type ThemeColors, radius, spacing } from '@/design-system/tokens';
import type { AssistantQuestionIntent } from '@/services/contracts/assistant-notifications-service';

export interface AssistantSuggestedQuestionsProps {
  onSelectQuestion: (question: string, intent: AssistantQuestionIntent) => void;
  disabled?: boolean;
}

export function AssistantSuggestedQuestions({
  onSelectQuestion,
  disabled = false
}: AssistantSuggestedQuestionsProps) {
  const { colors } = useTheme();
  const styles = React.useMemo(() => createStyles(colors), [colors]);
  const direction = usePreferenceStore((state) => state.direction);
  const isRtl = direction === 'rtl';
  const largeText = PixelRatio.getFontScale() >= 1.5;
  const { width } = useWindowDimensions();
  const stacked = largeText || width < 350;

  const cards = [
    {
      id: 'spending',
      intent: 'spending_summary' as const,
      label: translate('assistant.suggestions.spending'),
      renderIcon: () => <BarChartIcon size={18} color={colors.content.link} />
    },
    {
      id: 'highest',
      intent: 'category_breakdown' as const,
      label: translate('assistant.suggestions.highest'),
      renderIcon: () => <PieChartIcon size={18} color={colors.content.link} />
    },
    {
      id: 'weekly',
      intent: 'recent_transactions' as const,
      label: translate('assistant.suggestions.weekly'),
      renderIcon: () => <CalendarIcon size={17} color={colors.content.link} />
    },
    {
      id: 'budget',
      intent: 'budget_status' as const,
      label: translate('assistant.suggestions.budget'),
      renderIcon: () => <WalletIcon size={17} color={colors.content.link} />
    }
  ];

  const renderCard = (item: (typeof cards)[0]) => (
    <Pressable
      key={item.id}
      testID={`suggestion-card-${item.id}`}
      onPress={() => !disabled && onSelectQuestion(item.label, item.intent)}
      disabled={disabled}
      style={({ pressed }) => [
        styles.card,
        stacked && styles.stackedCard,
        disabled && styles.cardDisabled,
        pressed && styles.cardPressed
      ]}
      accessibilityRole="button"
      accessibilityLabel={item.label}
      accessibilityState={{ disabled }}
    >
      {isRtl ? (
        <>
          <StyledText
            numberOfLines={largeText ? undefined : 2}
            style={[styles.questionText, styles.questionTextRtl]}
          >
            {item.label}
          </StyledText>
          <View style={styles.iconCircle}>{item.renderIcon()}</View>
        </>
      ) : (
        <>
          <View style={styles.iconCircle}>{item.renderIcon()}</View>
          <StyledText
            numberOfLines={largeText ? undefined : 2}
            style={[styles.questionText, styles.questionTextLtr]}
          >
            {item.label}
          </StyledText>
        </>
      )}
    </Pressable>
  );

  return (
    <View testID="assistant-suggested-questions" style={styles.container}>
      {/* Row 1 */}
      <View style={[styles.row, stacked && styles.stackedRow]}>
        {isRtl ? (
          <>
            {renderCard(cards[1])}
            {renderCard(cards[0])}
          </>
        ) : (
          <>
            {renderCard(cards[0])}
            {renderCard(cards[1])}
          </>
        )}
      </View>

      {/* Row 2 */}
      <View style={[styles.row, stacked && styles.stackedRow]}>
        {isRtl ? (
          <>
            {renderCard(cards[3])}
            {renderCard(cards[2])}
          </>
        ) : (
          <>
            {renderCard(cards[2])}
            {renderCard(cards[3])}
          </>
        )}
      </View>
    </View>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: {
      gap: 10
    },
    row: {
      flexDirection: 'row',
      direction: 'ltr',
      gap: spacing.sm
    },
    stackedRow: { flexDirection: 'column' },
    stackedCard: { flex: 0 },
    cardDisabled: { opacity: 0.5 },
    card: {
      alignItems: 'center',
      backgroundColor: 'transparent',
      borderColor: colors.borders.default,
      borderRadius: radius.pill,
      borderWidth: 1,
      flex: 1,
      flexDirection: 'row',
      direction: 'ltr',
      gap: 6,
      justifyContent: 'space-between',
      minHeight: 52,
      paddingHorizontal: 10,
      paddingVertical: 8
    },
    cardPressed: {
      backgroundColor: colors.surfaces.brandSubtle,
      borderColor: colors.borders.focus
    },
    questionText: {
      color: colors.content.primary,
      flex: 1,
      fontSize: 13,
      lineHeight: 20
    },
    questionTextRtl: {
      textAlign: 'right',
      writingDirection: 'rtl'
    },
    questionTextLtr: {
      textAlign: 'left',
      writingDirection: 'ltr'
    },
    iconCircle: {
      backgroundColor: colors.surfaces.brandSubtle,
      alignItems: 'center',
      borderRadius: radius.pill,
      flexShrink: 0,
      height: 30,
      justifyContent: 'center',
      width: 30
    }
  });
