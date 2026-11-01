import React, { useRef, useState } from 'react';
import {
  View,
  TextInput,
  Pressable,
  StyleSheet,
  Text,
  Platform
} from 'react-native';
import { layoutDirectionStyle } from '@/design-system/direction';
import { translate } from '@/localization/i18n';
import { usePreferenceStore } from '@/state/preferences';
import { radius, spacing } from '@/design-system/tokens';
import { colorTokens } from '@/design-system/tokens';
import { useAssistantDraft } from '../useAssistantDraft';
import { AssistantDraftStatus } from '../AssistantDraftStatus';

export interface AssistantComposerProps {
  /** True acknowledges a successful send; false preserves the question for recovery. */
  onSendMessage: (message: string) => Promise<boolean>;
  loading?: boolean;
  conversationId?: string;
}

export function AssistantComposer({
  onSendMessage,
  conversationId,
  loading = false
}: AssistantComposerProps) {
  const draft = useAssistantDraft(conversationId ? `conversation:${conversationId}` : 'landing');
  const text = draft.text;
  const [submitting, setSubmitting] = useState(false);
  const sending = useRef(false);
  const draftRevision = useRef(0);
  const direction = usePreferenceStore((state) => state.direction);
  const isRtl = direction === 'rtl';
  const disabled = !text.trim() || loading || submitting || draft.loading;

  const handleSend = async () => {
    const trimmed = text.trim();
    if (!trimmed || loading || draft.loading || sending.current) return;
    const sentRevision = draft.revision;
    const sentEdit = draftRevision.current;
    sending.current = true;
    setSubmitting(true);
    try {
      const accepted = await onSendMessage(trimmed);
      if (accepted && draftRevision.current === sentEdit)
        await draft.discard(sentRevision).catch(() => undefined);
    } finally {
      sending.current = false;
      setSubmitting(false);
    }
  };

  return (
    <>
    <AssistantDraftStatus draft={draft} />
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
          onChangeText={value => { draftRevision.current += 1; draft.change(value); }}
          maxLength={1000}
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
          editable={!loading && !draft.loading}
        />
      </View>

      {/* Trailing Circular Send Button */}
      <Pressable
        testID="assistant-composer-send-button"
        onPress={handleSend}
        disabled={disabled}
        style={({ pressed }) => [
          styles.sendButton,
          disabled && styles.sendButtonDisabled,
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
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    backgroundColor: colorTokens.raw["FFFFFF"],
    borderTopColor: colorTokens.raw["EEF3F0"],
    borderTopWidth: 1,
    ...layoutDirectionStyle('ltr'),
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
    maxHeight: 100,
    minHeight: 48,
    paddingVertical: 0,
    textAlignVertical: 'top'
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
