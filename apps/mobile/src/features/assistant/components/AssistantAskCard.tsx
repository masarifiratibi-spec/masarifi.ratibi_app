import React from 'react';
import { useTheme } from '@/state/theme-context';
import {
  View,
  TextInput,
  Pressable,
  StyleSheet
} from 'react-native';
import { SparkleIcon } from './AssistantIcons';
import { translate } from '@/localization/i18n';
import { usePreferenceStore } from '@/state/preferences';
import { type ThemeColors, radius, spacing } from '@/design-system/tokens';

export interface AssistantAskCardProps {
  text: string;
  onChangeText: (text: string) => void;
  onAskQuestion: (question: string) => void;
  loading?: boolean;
}

export function AssistantAskCard({
  text,
  onChangeText,
  onAskQuestion,
  loading = false
}: AssistantAskCardProps) {
  const { colors } = useTheme();
  const styles = React.useMemo(() => createStyles(colors), [colors]);
  const direction = usePreferenceStore((state) => state.direction);
  const isRtl = direction === 'rtl';

  const disabled = !text.trim() || loading;
  const handleSubmit = () => {
    const trimmed = text.trim();
    if (disabled) return;
    onAskQuestion(trimmed);
  };

  return (
    <View testID="assistant-ask-card" style={styles.card}>
      <View style={styles.innerBox}>
        {isRtl ? (
          <>
            {/* Submit button on the left in RTL */}
            <Pressable
              testID="assistant-ask-submit-button"
              onPress={handleSubmit}
              disabled={disabled}
              accessibilityState={{ disabled }}
              style={({ pressed }) => [
                styles.sparkleButton,
                disabled && styles.sparkleButtonDisabled,
                pressed && styles.sparkleButtonPressed
              ]}
              accessibilityLabel={translate('assistant.action.ask')}
              accessibilityRole="button"
            >
              <SparkleIcon size={20} color={disabled ? colors.content.secondary : colors.content.inverse} />
            </Pressable>

            {/* Input field on the right in RTL */}
            <TextInput
              testID="assistant-ask-input"
              value={text}
              onChangeText={onChangeText}
              maxLength={1000}
              placeholder={translate('assistant.ask.placeholder')}
              placeholderTextColor={colors.content.secondary}
              style={[styles.input, styles.inputRtl]}
              returnKeyType="send"
              onSubmitEditing={handleSubmit}
              editable={!loading}
              multiline
            />
          </>
        ) : (
          <>
            {/* Input field on the left in LTR */}
            <TextInput
              testID="assistant-ask-input"
              value={text}
              onChangeText={onChangeText}
              maxLength={1000}
              placeholder={translate('assistant.ask.placeholder')}
              placeholderTextColor={colors.content.secondary}
              style={[styles.input, styles.inputLtr]}
              returnKeyType="send"
              onSubmitEditing={handleSubmit}
              editable={!loading}
              multiline
            />

            {/* Submit button on the right in LTR */}
            <Pressable
              testID="assistant-ask-submit-button"
              onPress={handleSubmit}
              disabled={disabled}
              accessibilityState={{ disabled }}
              style={({ pressed }) => [
                styles.sparkleButton,
                disabled && styles.sparkleButtonDisabled,
                pressed && styles.sparkleButtonPressed
              ]}
              accessibilityLabel={translate('assistant.action.ask')}
              accessibilityRole="button"
            >
              <SparkleIcon size={20} color={disabled ? colors.content.secondary : colors.content.inverse} />
            </Pressable>
          </>
        )}
      </View>
    </View>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  card: {
    backgroundColor: colors.surfaces.card,
    borderColor: colors.borders.default,
    borderRadius: radius.card,
    borderWidth: 1,
    marginHorizontal: spacing.md,
    padding: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 2
  },
  innerBox: {
    alignItems: 'center',
    backgroundColor: colors.surfaces.brandSubtle,
    borderColor: colors.borders.subtle,
    borderRadius: radius.sm,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.sm,
    minHeight: 70,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs
  },
  input: {
    color: colors.content.primary,
    flex: 1,
    fontSize: 15,
    maxHeight: 90,
    minHeight: 48,
    paddingVertical: 0,
    textAlignVertical: 'top'
  },
  inputRtl: {
    textAlign: 'right',
    writingDirection: 'rtl'
  },
  inputLtr: {
    textAlign: 'left',
    writingDirection: 'ltr'
  },
  sparkleButton: {
    alignItems: 'center',
    backgroundColor: colors.interactions.primary,
    borderRadius: radius.pill,
    height: 44,
    justifyContent: 'center',
    width: 44
  },
  sparkleButtonDisabled: {
    backgroundColor: colors.borders.disabled
  },
  sparkleButtonPressed: {
    opacity: 0.75
  }
});
