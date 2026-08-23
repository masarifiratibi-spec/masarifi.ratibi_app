import React, { useState } from 'react';
import {
  View,
  TextInput,
  Pressable,
  StyleSheet,
  Text,
  KeyboardAvoidingView,
  Platform
} from 'react-native';
import { translate } from '@/localization/i18n';
import { usePreferenceStore } from '@/state/preferences';
import { radius, spacing } from '@/design-system/tokens';
import { colorTokens } from '@/design-system/tokens';

export interface AssistantComposerProps {
  onSendMessage: (message: string) => void;
  loading?: boolean;
}

export function AssistantComposer({
  onSendMessage,
  loading = false
}: AssistantComposerProps) {
  const [text, setText] = useState('');
  const direction = usePreferenceStore((state) => state.direction);
  const isRtl = direction === 'rtl';

  const handleSend = () => {
    const trimmed = text.trim();
    if (!trimmed || loading) return;
    onSendMessage(trimmed);
    setText('');
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 80 : 0}
      style={styles.keyboardContainer}
    >
      <View
        testID="assistant-composer"
        style={[
          styles.container,
          { flexDirection: isRtl ? 'row-reverse' : 'row' }
        ]}
      >
        {/* Leading Sparkle Button */}
        <Pressable
          style={styles.actionBtn}
          accessibilityLabel={translate('assistant.hero.title')}
          accessibilityRole="button"
        >
          <Text style={styles.actionIcon}>✨</Text>
        </Pressable>

        {/* Input Field */}
        <View style={styles.inputWrapper}>
          <TextInput
            testID="assistant-composer-input"
            value={text}
            onChangeText={setText}
            placeholder={translate('assistant.chat.placeholder')}
            placeholderTextColor={colorTokens.raw["7C8B85"]}
            multiline
            style={[
              styles.input,
              {
                textAlign: isRtl ? 'right' : 'left',
                writingDirection: direction
              }
            ]}
            editable={!loading}
          />
        </View>

        {/* Trailing Circular Send Button */}
        <Pressable
          testID="assistant-composer-send-button"
          onPress={handleSend}
          disabled={!text.trim() || loading}
          style={({ pressed }) => [
            styles.sendButton,
            !text.trim() && styles.sendButtonDisabled,
            pressed && styles.sendButtonPressed
          ]}
          accessibilityLabel={translate('assistant.action.ask')}
          accessibilityRole="button"
        >
          <Text style={[styles.sendIcon, isRtl && styles.sendIconRtl]}>
            ➤
          </Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  keyboardContainer: {
    backgroundColor: colorTokens.raw["FFFFFF"]
  },
  container: {
    alignItems: 'center',
    backgroundColor: colorTokens.raw["FFFFFF"],
    borderTopColor: colorTokens.raw["EEF3F0"],
    borderTopWidth: 1,
    gap: spacing.xs,
    paddingBottom: Platform.OS === 'ios' ? 24 : 12,
    paddingHorizontal: spacing.md,
    paddingTop: 10,
    shadowColor: colorTokens.raw["103F37"],
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 4
  },
  actionBtn: {
    alignItems: 'center',
    backgroundColor: colorTokens.raw["F3F8F5"],
    borderColor: colorTokens.raw["DCE7E2"],
    borderRadius: radius.pill,
    borderWidth: 1,
    height: 40,
    justifyContent: 'center',
    width: 40
  },
  actionIcon: {
    fontSize: 16
  },
  inputWrapper: {
    backgroundColor: colorTokens.raw["F8FAF9"],
    borderColor: colorTokens.raw["DCE7E2"],
    borderRadius: 20,
    borderWidth: 1,
    flex: 1,
    justifyContent: 'center',
    minHeight: 44,
    paddingHorizontal: 12,
    paddingVertical: 6
  },
  input: {
    color: colorTokens.raw["10231F"],
    fontSize: 14.5,
    maxHeight: 100
  },
  sendButton: {
    alignItems: 'center',
    backgroundColor: colorTokens.raw["103F37"],
    borderRadius: radius.pill,
    height: 40,
    justifyContent: 'center',
    width: 40
  },
  sendButtonDisabled: {
    backgroundColor: colorTokens.raw["D1E0DA"],
    opacity: 0.6
  },
  sendButtonPressed: {
    opacity: 0.8
  },
  sendIcon: {
    color: colorTokens.raw["FFFFFF"],
    fontSize: 14,
    fontWeight: '700'
  },
  sendIconRtl: {
    transform: [{ rotate: '180deg' }]
  }
});
