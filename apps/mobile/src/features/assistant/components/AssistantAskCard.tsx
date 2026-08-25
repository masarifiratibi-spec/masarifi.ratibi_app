import React, { useState } from 'react';
import {
  View,
  TextInput,
  Pressable,
  StyleSheet
} from 'react-native';
import { SparkleIcon } from './AssistantIcons';
import { translate } from '@/localization/i18n';
import { usePreferenceStore } from '@/state/preferences';
import { colorTokens, radius, spacing } from '@/design-system/tokens';

export interface AssistantAskCardProps {
  onAskQuestion: (question: string) => void;
  loading?: boolean;
}

export function AssistantAskCard({
  onAskQuestion,
  loading = false
}: AssistantAskCardProps) {
  const [text, setText] = useState('');
  const direction = usePreferenceStore((state) => state.direction);
  const isRtl = direction === 'rtl';

  const handleSubmit = () => {
    const trimmed = text.trim();
    if (!trimmed || loading) return;
    onAskQuestion(trimmed);
    setText('');
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
              disabled={!text.trim() || loading}
              style={({ pressed }) => [
                styles.sparkleButton,
                !text.trim() && styles.sparkleButtonEmpty,
                pressed && styles.sparkleButtonPressed
              ]}
              accessibilityLabel={translate('assistant.action.ask')}
              accessibilityRole="button"
            >
              <SparkleIcon size={20} color={colorTokens.surface.white} />
            </Pressable>

            {/* Input field on the right in RTL */}
            <TextInput
              testID="assistant-ask-input"
              value={text}
              onChangeText={setText}
              placeholder={translate('assistant.ask.placeholder')}
              placeholderTextColor={colorTokens.ink['500']}
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
              onChangeText={setText}
              placeholder={translate('assistant.ask.placeholder')}
              placeholderTextColor={colorTokens.ink['500']}
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
              disabled={!text.trim() || loading}
              style={({ pressed }) => [
                styles.sparkleButton,
                !text.trim() && styles.sparkleButtonEmpty,
                pressed && styles.sparkleButtonPressed
              ]}
              accessibilityLabel={translate('assistant.action.ask')}
              accessibilityRole="button"
            >
              <SparkleIcon size={20} color={colorTokens.surface.white} />
            </Pressable>
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colorTokens.sand['50'],
    borderColor: colorTokens.sand['400'],
    borderRadius: radius.card,
    borderWidth: 1,
    marginHorizontal: spacing.md,
    padding: 10,
    shadowColor: colorTokens.teal['950'],
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 2
  },
  innerBox: {
    alignItems: 'center',
    backgroundColor: colorTokens.teal['50'],
    borderColor: colorTokens.teal['100'],
    borderRadius: radius.sm,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.sm,
    minHeight: 70,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs
  },
  input: {
    color: colorTokens.ink['900'],
    flex: 1,
    fontSize: 15,
    maxHeight: 90,
    minHeight: 48,
    paddingVertical: 8
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
    backgroundColor: colorTokens.teal['900'],
    borderRadius: radius.pill,
    height: 44,
    justifyContent: 'center',
    width: 44
  },
  sparkleButtonEmpty: {
    backgroundColor: colorTokens.teal['900'],
    opacity: 0.95
  },
  sparkleButtonPressed: {
    opacity: 0.75
  }
});
