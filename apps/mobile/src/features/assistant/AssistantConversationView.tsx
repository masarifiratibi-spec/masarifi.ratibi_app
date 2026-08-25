import React, { useRef, useEffect } from 'react';
import {
  View,
  FlatList,
  StyleSheet,
  ActivityIndicator
} from 'react-native';
import { AssistantHeaderBanner } from './components/AssistantHeaderBanner';
import { UserMessageBubble } from './components/UserMessageBubble';
import { AssistantMessageBubble } from './components/AssistantMessageBubble';
import { AssistantFollowUpSuggestions } from './components/AssistantFollowUpSuggestions';
import { AssistantComposer } from './components/AssistantComposer';
import { StyledText } from '@/components/StyledText';
import { spacing } from '@/design-system/tokens';
import type { AssistantConversation, AssistantResponse } from '@/domain/assistant';
import { translate } from '@/localization/i18n';
import { colorTokens } from '@/design-system/tokens';

export interface AssistantConversationViewProps {
  conversation?: AssistantConversation | null;
  conversationId: string;
  responses: readonly AssistantResponse[];
  onSendMessage: (message: string) => void;
  onReviewAction?: (previewId: string) => void;
  onViewReport?: () => void;
  onFeedback?: (responseId: string, feedback: 'helpful' | 'reported') => void;
  isSending?: boolean;
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
  isSending = false,
  onEndReached,
  testID = 'assistant-conversation-view'
}: AssistantConversationViewProps) {
  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    if (responses.length > 0) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [responses.length, isSending]);

  // Merge responses into a flat sequence of user questions and AI answers
  const renderItem = ({ item }: { item: AssistantResponse }) => (
    <View style={styles.turnGroup}>
      {/* 1. User Question */}
      {item.question && (
        <UserMessageBubble
          message={item.question}
          timestamp={new Date(item.createdAt).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit'
          })}
        />
      )}

      {/* 2. AI Response Bubble */}
      <AssistantMessageBubble
        response={item}
        conversationId={conversationId}
        onReviewAction={onReviewAction}
        onViewReport={onViewReport}
        onFeedback={(feedback) => onFeedback?.(item.id, feedback)}
        timestamp={new Date(item.createdAt).toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit'
        })}
      />
    </View>
  );

  return (
    <View testID={testID} style={styles.root}>
      {/* 1. Top Sub-Header Identity Banner */}
      <AssistantHeaderBanner />

      {/* 2. Chat Conversation List */}
      <FlatList
        ref={flatListRef}
        testID="assistant-message-list"
        data={[...responses]}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        onEndReached={onEndReached}
        ListFooterComponent={
          isSending ? (
            <View
              testID="assistant-thinking-indicator"
              style={styles.thinkingContainer}
            >
              <ActivityIndicator size="small" color={colorTokens.raw["0D684A"]} />
              <StyledText style={styles.thinkingText}>
                {translate('assistant.thinking')}
              </StyledText>
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
      <AssistantComposer
        onSendMessage={onSendMessage}
        loading={isSending}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    backgroundColor: colorTokens.raw["EEF6F4"],
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
    color: colorTokens.raw["0D684A"],
    fontSize: 13,
    fontWeight: '600'
  }
});
