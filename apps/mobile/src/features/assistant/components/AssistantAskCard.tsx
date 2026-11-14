import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  TextInput,
  View
} from 'react-native';
import { useTheme } from '@/state/theme-context';
import { DesignIcon } from '@/design-system/icons';
import { fontFamilyForLocale } from '@/design-system/typography';
import { translate } from '@/localization/i18n';
import { usePreferenceStore } from '@/state/preferences';
import { type ThemeColors } from '@/design-system/tokens';

export interface AssistantAskCardProps {
  text: string;
  onChangeText: (text: string) => void;
  onAskQuestion: (question: string) => void;
  loading?: boolean;
  canSend?: boolean;
}

export function AssistantAskCard({
  text,
  onChangeText,
  onAskQuestion,
  loading = false,
  canSend = true
}: AssistantAskCardProps) {
  const { colors } = useTheme();
  const styles = React.useMemo(() => createStyles(colors), [colors]);
  const direction = usePreferenceStore((state) => state.direction);
  const locale = usePreferenceStore((state) => state.locale);
  const disabled = !text.trim() || loading || !canSend;
  const submit = () => {
    if (!disabled) onAskQuestion(text.trim());
  };
  return (
    <View
      testID="assistant-ask-card"
      style={[
        styles.card,
        { flexDirection: direction === 'rtl' ? 'row-reverse' : 'row' }
      ]}
    >
      <TextInput
        testID="assistant-ask-input"
        value={text}
        onChangeText={onChangeText}
        maxLength={1000}
        multiline
        editable={!loading}
        returnKeyType="send"
        onSubmitEditing={submit}
        accessibilityLabel={translate('assistant.ask.title')}
        placeholder={translate('assistant.ask.placeholder')}
        placeholderTextColor={colors.content.secondary}
        style={[
          styles.input,
          {
            fontFamily: fontFamilyForLocale(locale, 400),
            writingDirection: direction,
            textAlign: direction === 'rtl' ? 'right' : 'left'
          }
        ]}
      />
      <Pressable
        testID="assistant-ask-submit-button"
        onPress={submit}
        disabled={disabled}
        accessibilityLabel={translate('assistant.action.ask')}
        accessibilityRole="button"
        accessibilityState={{ disabled, busy: loading }}
        style={({ pressed }) => [
          styles.send,
          disabled && styles.disabled,
          pressed && styles.pressed
        ]}
      >
        {loading ? (
          <ActivityIndicator color={colors.content.inverse} />
        ) : (
          <DesignIcon
            name="arrowUp"
            decorative
            size="md"
            color={colors.content.inverse}
          />
        )}
      </Pressable>
    </View>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    card: {
      alignItems: 'center',
      backgroundColor: colors.surfaces.card,
      borderColor: colors.borders.default,
      borderRadius: 32,
      borderWidth: 1,
      direction: 'ltr',
      gap: 8,
      minHeight: 64,
      padding: 7
    },
    input: {
      color: colors.content.primary,
      flex: 1,
      fontSize: 16,
      lineHeight: 24,
      maxHeight: 120,
      minHeight: 48,
      paddingHorizontal: 12,
      paddingVertical: 10,
      textAlignVertical: 'center'
    },
    send: {
      alignItems: 'center',
      backgroundColor: colors.interactions.primary,
      borderRadius: 24,
      flexShrink: 0,
      height: 48,
      justifyContent: 'center',
      width: 48
    },
    disabled: { opacity: 0.5 },
    pressed: { opacity: 0.75 }
  });
