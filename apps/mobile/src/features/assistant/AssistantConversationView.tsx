import React, { useRef, useEffect } from 'react';
import {
  View,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  BackHandler
} from 'react-native';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';
import { AssistantHeaderBanner } from './components/AssistantHeaderBanner';
import { UserMessageBubble } from './components/UserMessageBubble';
import { AssistantMessageBubble } from './components/AssistantMessageBubble';
import { AssistantFollowUpSuggestions } from './components/AssistantFollowUpSuggestions';
import {
  AssistantComposer,
  type AssistantComposerProps
} from './components/AssistantComposer';
import { StyledText } from '@/components/StyledText';
import { spacing } from '@/design-system/tokens';
import type {
  AssistantConversation,
  AssistantResponse,
  AssistantUserTurn
} from '@/domain/assistant';
import { currentLocale, translate } from '@/localization/i18n';
import { colorTokens } from '@/design-system/tokens';
import type { AssistantAvailability } from './AssistantFunctionalStatus';

export interface AssistantConversationViewProps {
  conversation?: AssistantConversation | null;
  conversationId: string;
  responses: readonly AssistantResponse[];
  onSendMessage: AssistantComposerProps['onSendMessage'];
  onReviewAction?: (previewId: string) => void;
  onViewReport?: () => void;
  onFeedback?: (
    responseId: string,
    feedback: 'helpful' | 'not_helpful' | 'reported'
  ) => void;
  userTurns?: readonly AssistantUserTurn[];
  onBack?: () => void;
  functionalStatus?: React.ReactNode;
  availability?: AssistantAvailability | null;
  isSending?: boolean;
  error?: string | null;
  onEndReached?: () => void;
  testID?: string;
}

export function AssistantConversationView({
  conversation: _conversation,
  conversationId,
  responses,
  onSendMessage,
  onReviewAction,
  onViewReport,
  onFeedback,
  userTurns = [],
  onBack,
  functionalStatus,
  availability,
  isSending = false,
  error,
  onEndReached,
  testID = 'assistant-conversation-view'
}: AssistantConversationViewProps) {
  const insets = React.useContext(SafeAreaInsetsContext);
  const [keyboardVisible, setKeyboardVisible] = React.useState(() =>
    Keyboard.isVisible()
  );
  useEffect(() => {
    const show = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      () => setKeyboardVisible(true)
    );
    const hide = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => setKeyboardVisible(false)
    );
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);
  const flatListRef = useRef<FlatList>(null);
  const lastResponseId = responses[responses.length - 1]?.id;
  const turns = new Map<
    string,
    AssistantUserTurn & { response?: AssistantResponse }
  >();
  userTurns.forEach((turn) => turns.set(turn.id, turn));
  responses.forEach((response) => {
    const id = response.requestMessageId ?? response.id;
    turns.set(id, {
      ...(turns.get(id) ?? {
        id,
        content: response.question,
        createdAt: response.requestCreatedAt ?? response.createdAt,
        status: 'completed'
      }),
      response
    });
  });
  const orderedTurns = [...turns.values()].sort(
    (a, b) => a.createdAt - b.createdAt || a.id.localeCompare(b.id)
  );
  const latestTurnId = orderedTurns.at(-1)?.id;
  const handleBack = () => {
    if (Keyboard.isVisible()) Keyboard.dismiss();
    else onBack?.();
  };
  useEffect(() => {
    if (!onBack) return;
    const listener = BackHandler.addEventListener('hardwareBackPress', () => {
      handleBack();
      return true;
    });
    return () => listener.remove();
  });

  useEffect(() => {
    if (orderedTurns.length > 0) {
      const timer = setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [lastResponseId, latestTurnId]);

  // Merge responses into a flat sequence of user questions and AI answers
  const renderItem = ({
    item
  }: {
    item: AssistantUserTurn & { response?: AssistantResponse };
  }) => (
    <View style={styles.turnGroup}>
      {/* 1. User Question */}
      {item.content && (
        <UserMessageBubble
          message={item.content}
          status={item.status}
          timestamp={
            item.createdAt > 0
              ? new Date(item.createdAt).toLocaleTimeString(currentLocale(), {
                  hour: '2-digit',
                  minute: '2-digit'
                })
              : undefined
          }
        />
      )}

      {/* 2. AI Response Bubble */}
      {item.response ? (
        <AssistantMessageBubble
          response={item.response}
          conversationId={conversationId}
          onReviewAction={onReviewAction}
          onViewReport={onViewReport}
          onFeedback={(feedback) => onFeedback?.(item.response!.id, feedback)}
          timestamp={new Date(item.response.createdAt).toLocaleTimeString(
            currentLocale(),
            {
              hour: '2-digit',
              minute: '2-digit'
            }
          )}
        />
      ) : null}
    </View>
  );

  return (
    <KeyboardAvoidingView
      testID={testID}
      style={styles.root}
      behavior="padding"
      enabled={keyboardVisible}
      // FoundationProviders already places this screen below the top safe area.
      keyboardVerticalOffset={insets?.top ?? 0}
    >
      {/* 1. Top Sub-Header Identity Banner */}
      <AssistantHeaderBanner availability={availability} />

      {/* 2. Chat Conversation List */}
      <FlatList
        ref={flatListRef}
        testID="assistant-message-list"
        data={orderedTurns}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        onEndReached={onEndReached}
        keyboardShouldPersistTaps="handled"
        maintainVisibleContentPosition={{ minIndexForVisible: 0 }}
        ListFooterComponent={
          isSending || error || functionalStatus ? (
            <View
              testID="assistant-thinking-indicator"
              style={styles.thinkingContainer}
            >
              {functionalStatus ?? (
                <>
                  {isSending && !error ? (
                    <ActivityIndicator
                      size="small"
                      color={colorTokens.raw['0D684A']}
                    />
                  ) : null}
                  <StyledText style={styles.thinkingText}>
                    {error ?? translate('assistant.thinking')}
                  </StyledText>
                </>
              )}
            </View>
          ) : null
        }
      />

      {/* 3. Follow-up suggestions */}
      {!isSending && responses.length > 0 && (
        <AssistantFollowUpSuggestions
          onSelectSuggestion={onSendMessage}
          disabled={isSending}
        />
      )}

      {/* 4. Bottom Sticky Composer */}
      <AssistantComposer onSendMessage={onSendMessage} loading={isSending} />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: {
    backgroundColor: colorTokens.raw['EEF6F4'],
    flex: 1
  },
  listContent: {
    gap: spacing.sm,
    paddingBottom: spacing.md,
    paddingTop: spacing.sm
  },
  turnGroup: {
    gap: spacing.xs,
    width: '100%'
  },
  thinkingContainer: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.xs,
    justifyContent: 'center',
    marginVertical: spacing.md
  },
  thinkingText: {
    color: colorTokens.raw['0D684A'],
    fontSize: 13,
    fontWeight: '600'
  }
});
