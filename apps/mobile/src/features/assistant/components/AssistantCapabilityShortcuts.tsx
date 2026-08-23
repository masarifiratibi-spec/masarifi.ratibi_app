import React from 'react';
import { View, Pressable, StyleSheet, Text } from 'react-native';
import { StyledText } from '@/components/StyledText';
import { translate } from '@/localization/i18n';
import { usePreferenceStore } from '@/state/preferences';
import { spacing } from '@/design-system/tokens';
import { colorTokens } from '@/design-system/tokens';

export interface AssistantCapabilityShortcutsProps {
  onSelectCapability: (prompt: string) => void;
  disabled?: boolean;
}

export function AssistantCapabilityShortcuts({
  onSelectCapability,
  disabled = false
}: AssistantCapabilityShortcutsProps) {
  const direction = usePreferenceStore((state) => state.direction);

  const capabilities = [
    {
      id: 'reports',
      label: translate('assistant.capabilities.reports'),
      emoji: '📄',
      prompt: translate('assistant.capabilities.reports')
    },
    {
      id: 'analytics',
      label: translate('assistant.capabilities.analytics'),
      emoji: '📊',
      prompt: translate('assistant.capabilities.analytics')
    },
    {
      id: 'reminders',
      label: translate('assistant.capabilities.reminders'),
      emoji: '🔔',
      prompt: translate('assistant.capabilities.reminders')
    },
    {
      id: 'savings',
      label: translate('assistant.capabilities.savings'),
      emoji: '💡',
      prompt: translate('assistant.capabilities.savings')
    }
  ];

  return (
    <View testID="assistant-capability-shortcuts" style={styles.container}>
      <View
        style={[
          styles.row,
          { flexDirection: direction === 'rtl' ? 'row-reverse' : 'row' }
        ]}
      >
        {capabilities.map((item) => (
          <Pressable
            key={item.id}
            testID={`capability-shortcut-${item.id}`}
            onPress={() => !disabled && onSelectCapability(item.prompt)}
            disabled={disabled}
            style={({ pressed }) => [
              styles.card,
              pressed && styles.cardPressed
            ]}
            accessibilityRole="button"
            accessibilityLabel={item.label}
          >
            <View style={styles.iconCircle}>
              <Text style={styles.emoji}>{item.emoji}</Text>
            </View>
            <StyledText numberOfLines={2} style={styles.label}>
              {item.label}
            </StyledText>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colorTokens.raw["FFFFFF"],
    borderColor: colorTokens.raw["D7E1DC"],
    borderRadius: 22,
    borderWidth: 1,
    marginHorizontal: spacing.md,
    padding: spacing.md,
    shadowColor: colorTokens.raw["103F37"],
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1
  },
  row: {
    alignItems: 'flex-start',
    justifyContent: 'space-between'
  },
  card: {
    alignItems: 'center',
    flex: 1,
    gap: spacing.xs,
    paddingHorizontal: 2
  },
  cardPressed: {
    opacity: 0.7
  },
  iconCircle: {
    alignItems: 'center',
    backgroundColor: colorTokens.raw["E6F4EE"],
    borderRadius: 16,
    height: 48,
    justifyContent: 'center',
    width: 48
  },
  emoji: {
    fontSize: 22
  },
  label: {
    color: colorTokens.raw["10231F"],
    fontSize: 11,
    fontWeight: '600',
    lineHeight: 14,
    textAlign: 'center'
  }
});
