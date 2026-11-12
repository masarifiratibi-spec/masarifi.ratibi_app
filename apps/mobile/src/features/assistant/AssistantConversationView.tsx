import React, { useRef, useEffect, useMemo } from 'react';
import {
  View,
  FlatList,
  StyleSheet,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  BackHandler,
  AppState
} from 'react-native';
import { getCalendars } from 'expo-localization';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';
import { AssistantHeaderBanner } from './components/AssistantHeaderBanner';
import { UserMessageBubble } from './components/UserMessageBubble';
import { AssistantMessageBubble } from './components/AssistantMessageBubble';
import { AssistantTypingIndicator } from './components/AssistantTypingIndicator';
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
import { usePreferenceStore } from '@/state/preferences';
import { useTheme } from '@/state/theme-context';
import type { AssistantAvailability } from './AssistantFunctionalStatus';

export interface AssistantConversationViewProps {
  conversation?: AssistantConversation | null;
  conversationId: string;
  responses: readonly AssistantResponse[];
  onSendMessage: AssistantComposerProps['onSendMessage'];
  onReviewAction?: (previewId: string) => void;
  renderAction?: (
    previewId: string,
    fallback: React.ReactNode
  ) => React.ReactNode;
  onViewReport?: () => void;
  userTurns?: readonly AssistantUserTurn[];
  onBack?: () => void;
  functionalStatus?: React.ReactNode;
  availability?: AssistantAvailability | null;
  isSending?: boolean;
  error?: string | null;
  onEndReached?: () => void;
  testID?: string;
}

const EMPTY_USER_TURNS: readonly AssistantUserTurn[] = [];

export function AssistantConversationView({
  conversation: _conversation,
  conversationId,
  responses,
  onSendMessage,
  onReviewAction,
  renderAction,
  onViewReport,
  userTurns = EMPTY_USER_TURNS,
  onBack,
  functionalStatus,
  availability,
  isSending = false,
  error,
  onEndReached,
  testID = 'assistant-conversation-view'
}: AssistantConversationViewProps) {
  const { colors } = useTheme();
  const insets = React.useContext(SafeAreaInsetsContext);
  const [uses24HourClock, setUses24HourClock] = React.useState(
    () => getCalendars()[0]?.uses24hourClock
  );
  const hour12 = uses24HourClock == null ? undefined : !uses24HourClock;
  const locale = usePreferenceStore((state) => state.locale);
  const clock = useMemo(
    () =>
      new Intl.DateTimeFormat(locale, {
        hour: '2-digit',
        minute: '2-digit',
        hour12
      }),
    [locale, hour12]
  );
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        setUses24HourClock(getCalendars()[0]?.uses24hourClock);
      }
    });
    return () => subscription.remove();
  }, []);
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
  const orderedTurns = useMemo(() => {
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
    return [...turns.values()].sort(
      (a, b) => a.createdAt - b.createdAt || a.id.localeCompare(b.id)
    );
  }, [userTurns, responses]);
  const latestTurnId = orderedTurns.at(-1)?.id;
  const waitingForAnswer =
    isSending ||
    orderedTurns.some(
      (turn) => !turn.response && ['queued', 'processing'].includes(turn.status)
    );
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
  }, [lastResponseId, latestTurnId, orderedTurns.length]);

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
          status={item.response ? 'completed' : item.status}
          timestamp={
            item.createdAt > 0 ? clock.format(item.createdAt) : undefined
          }
        />
      )}

      {/* 2. AI Response Bubble */}
      {item.response ? (
        <AssistantMessageBubble
          response={item.response}
          conversationId={conversationId}
          onReviewAction={onReviewAction}
          renderAction={renderAction}
          onViewReport={onViewReport}
          timestamp={clock.format(item.response.createdAt)}
        />
      ) : null}
    </View>
  );

  return (
    <KeyboardAvoidingView
      testID={testID}
      style={[styles.root, { backgroundColor: colors.surfaces.page }]}
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
          waitingForAnswer || error || functionalStatus ? (
            <View
              testID="assistant-thinking-indicator"
              style={styles.thinkingContainer}
            >
              {waitingForAnswer && !error ? <AssistantTypingIndicator /> : null}
              {functionalStatus}
              {error && !functionalStatus ? (
                <StyledText
                  style={[styles.thinkingText, { color: colors.content.link }]}
                >
                  {error}
                </StyledText>
              ) : null}
            </View>
          ) : null
        }
      />

      {/* 3. Follow-up suggestions */}
      {!waitingForAnswer &&
        responses.length > 0 &&
        !responses.at(-1)?.proposedActionIds?.length && (
          <AssistantFollowUpSuggestions
            onSelectSuggestion={onSendMessage}
            disabled={isSending}
          />
        )}

      {/* 4. Bottom Sticky Composer */}
      <AssistantComposer
        conversationId={conversationId}
        onSendMessage={onSendMessage}
        loading={waitingForAnswer}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: {
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
    alignItems: 'stretch',
    gap: spacing.xs,
    marginVertical: spacing.md
  },
  thinkingText: {
    fontSize: 13,
    fontWeight: '600'
  }
});
