import React from 'react';
import { ScrollView, Pressable, StyleSheet, Text } from 'react-native';
import { StyledText } from '@/components/StyledText';
import { translate } from '@/localization/i18n';
import { usePreferenceStore } from '@/state/preferences';
import { radius, spacing } from '@/design-system/tokens';
import { colorTokens } from '@/design-system/tokens';

export interface AssistantFollowUpSuggestionsProps {
  onSelectSuggestion: (prompt: string) => void;
  disabled?: boolean;
}

export function AssistantFollowUpSuggestions({
  onSelectSuggestion,
  disabled = false
}: AssistantFollowUpSuggestionsProps) {
  const direction = usePreferenceStore((state) => state.direction);

  const followUps = [
    {
      id: 'highest',
      label: translate('assistant.suggestions.highest'),
      emoji: '📈'
    },
    {
      id: 'saving',
      label: translate('assistant.capabilities.savings'),
      emoji: '✨'
    },
    {
      id: 'summary',
      label: translate('assistant.suggestions.spending'),
      emoji: '⏱️'
    }
  ];

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={[
        styles.container,
        {
          direction: 'ltr',
          flexDirection: direction === 'rtl' ? 'row-reverse' : 'row'
        }
      ]}
      style={styles.scrollView}
    >
      {followUps.map((item) => (
        <Pressable
          key={item.id}
          testID={`follow-up-${item.id}`}
          onPress={() => !disabled && onSelectSuggestion(item.label)}
          disabled={disabled}
          style={({ pressed }) => [
            styles.chip,
            pressed && styles.chipPressed
          ]}
          accessibilityRole="button"
          accessibilityLabel={item.label}
        >
          <Text style={styles.emoji}>{item.emoji}</Text>
          <StyledText style={styles.chipText}>{item.label}</StyledText>
        </Pressable>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollView: {
    maxHeight: 44,
    minHeight: 40
  },
  container: {
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md
  },
  chip: {
    alignItems: 'center',
    backgroundColor: colorTokens.raw["FFFFFF"],
    borderColor: colorTokens.raw["D7E1DC"],
    borderRadius: radius.pill,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 7,
    shadowColor: colorTokens.raw["103F37"],
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 3,
    elevation: 1
  },
  chipPressed: {
    backgroundColor: colorTokens.raw["E6F4EE"],
    borderColor: colorTokens.raw["0D684A"]
  },
  emoji: {
    fontSize: 12
  },
  chipText: {
    color: colorTokens.raw["10231F"],
    fontSize: 12,
    fontWeight: '600'
  }
});
