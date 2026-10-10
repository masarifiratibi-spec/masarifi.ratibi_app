/* eslint-disable @typescript-eslint/no-var-requires */
import React, { useState } from 'react';
import { View, StyleSheet, AppState } from 'react-native';
import { router } from 'expo-router';
import { AssistantLanding } from './AssistantLanding';
import { AssistantConversationView } from './AssistantConversationView';
import { StyledText } from '@/components/StyledText';
import { FormField } from '@/design-system/components/forms/FormField';
import { ActionButton } from '@/design-system/components/ActionButton';
import { SurfaceCard } from '@/design-system/components/SurfaceCard';
import { GroupedList, NavigationRow } from '@/design-system/components/navigation/GroupedList';
import { translateDynamic } from '@/localization/i18n';
import { buildAssistantSupportContext } from '@/features/support/support-context';
import type { AssistantResponse, AssistantUserTurn } from '@/domain/assistant';
import { colorTokens } from '@/design-system/tokens';
import type { AssistantQuestionIntent } from '@/services/contracts/assistant-notifications-service';
import { AssistantQuestionRecovery } from './AssistantFunctionalStatus';

type AssistantQueries = typeof import('./assistant-queries');

export function AssistantHomeScreen({
  initialConversationId
}: {
  initialConversationId?: string;
}) {
  const queries = require('./assistant-queries') as AssistantQueries;
  const consent = queries.useAssistantConsent();
  const conversations = queries.useAssistantConversations({ pageSize: 20 });
  const insights = queries.useAssistantInsights();
  const setConsent = queries.useSetAssistantConsent();
  const createConversation = queries.useCreateAssistantConversation();
  const availability = queries.useAssistantAvailability?.();
  const operation = queries.useAssistantQuestionOperation?.();
  const resume = queries.useResumeAssistantQuestion?.();
  const retry = queries.useRetryAssistantQuestion?.();
  const unresolved = Boolean(operation?.data && !['completed', 'failed'].includes(operation.data.phase));
  const [firstTurn, setFirstTurn] = useState<AssistantUserTurn | null>(null);
  const firstDispatching = React.useRef(false);

  const [activeConversationId, setActiveConversationId] = useState<string | null>(
    initialConversationId ?? null
  );

  const createError = createConversation.error as { code?: string } | null | undefined;
  const legacyConversations = conversations.data as unknown as
    | { items?: { id: string; title: string }[]; total?: number }
    | undefined;
  const conversationItems =
    conversations.data?.pages?.flatMap((page) => page.items) ??
    legacyConversations?.items ??
    [];
  const conversationTotal =
    conversations.data?.pages?.[0]?.total ?? legacyConversations?.total ?? 0;

  const handleAskFirstQuestion = (question: string, intent?: AssistantQuestionIntent) => {
    if (unresolved) {
      if (operation?.data?.conversationId) router.navigate(`/assistant/${operation.data.conversationId}`);
      else if (operation?.data?.question) setFirstTurn({id: operation.data.operationId, content: operation.data.question, status: 'unknown', createdAt: operation.data.createdAt ?? Date.now()});
      return;
    }
    if (firstDispatching.current || createConversation.isPending || availability?.data?.capabilities?.directRead === 'disabled') return;
    const operationId = `assistant-create-${Date.now()}`;
    firstDispatching.current = true;
    setFirstTurn({id: operationId, content: question, status: 'queued', createdAt: Date.now()});
    createConversation.mutate(
      {
        question,
        intent,
        operationId
      },
      {
        onSuccess: (result: { value: { id: string } }) => {
          setFirstTurn(null);
          router.push(`/assistant/${result.value.id}`);
        },
        onError: () => setFirstTurn(current => current ? {...current, status: 'unknown'} : null),
        onSettled: () => {firstDispatching.current = false;}
      }
    );
  };

  const handleEnableConsent = () => {
    if (!consent.data || consent.isPending || consent.isError || setConsent.isPending) return;
    setConsent.mutate({
      enabled: true,
      expectedVersion: consent.data.version,
      operationId: `assistant-consent-${Date.now()}`
    });
  };

  if (activeConversationId) {
    return (
      <AssistantConversationScreen
        conversationId={activeConversationId}
        onBack={() => setActiveConversationId(null)}
      />
    );
  }

  if (firstTurn) return <AssistantConversationView
    conversationId={operation?.data?.conversationId ?? 'pending-creation'}
    responses={[]}
    userTurns={[{...firstTurn, status: operation?.data?.phase === 'failed' ? 'failed' : firstTurn.status}]}
    onSendMessage={handleAskFirstQuestion}
    onBack={() => setFirstTurn(null)}
    availability={availability?.data ?? null}
    isSending={createConversation.isPending || unresolved}
    error={createConversation.isError ? translateDynamic('assistant.state.error') : undefined}
    functionalStatus={unresolved || createConversation.isError ? <AssistantQuestionRecovery
      operation={operation?.data} loading={resume?.isPending || retry?.isPending}
      error={createConversation.isError || resume?.isError || retry?.isError}
      onCheck={() => resume?.mutate(undefined, {onSettled: () => operation?.refetch()})}
      onRetry={() => retry?.mutate(undefined, {onSuccess: result => {setFirstTurn(null); router.push(`/assistant/${result.value.conversationId}`);}})}
    /> : undefined}
  />;

  let errorMessage: string | null = null;
  if (createError?.code === 'limit_reached') {
    errorMessage = translateDynamic('assistant.state.limit');
  } else if (createError?.code === 'offline') {
    errorMessage = translateDynamic('assistant.state.offline');
  } else if (createError || consent.isError || setConsent.isError || conversations.isError || insights.isError) {
    errorMessage = translateDynamic('assistant.state.error');
  }

  return (
    <View style={styles.container}>
      {/* Header identification for screen reader */}
      <StyledText
        variant="title"
        accessible
        accessibilityLabel={translateDynamic('appShell.navigation.assistant')}
        style={styles.srOnly}
      >
        {translateDynamic('appShell.navigation.assistant')}
      </StyledText>

      {/* Main Landing Experience matching Reference 1 */}
      <AssistantLanding
        onAskQuestion={handleAskFirstQuestion}
        consent={consent.data}
        onEnableConsent={handleEnableConsent}
        consentLoading={consent.isPending || consent.isError || setConsent.isPending}
        insight={insights.data?.[0]}
        conversations={conversationItems}
        onSelectConversation={(id) => {
          router.push(`/assistant/${id}`);
        }}
        loading={createConversation.isPending || consent.isPending || setConsent.isPending || availability?.data?.capabilities?.directRead === 'disabled'}
        error={errorMessage}
      />

      <View style={styles.srOnly}>
        {conversationTotal === 0 && (
          <StyledText>{translateDynamic('assistant.state.empty')}</StyledText>
        )}
      </View>
    </View>
  );
}

export function AssistantConversationScreen({
  conversationId = 'conversation-1',
  onBack
}: {
  conversationId?: string;
  onBack?: () => void;
}) {
  const queries = require('./assistant-queries') as AssistantQueries;
  const [cursor, setCursor] = React.useState<string | undefined>(undefined);
  const latest = queries.useAssistantConversation(conversationId);
  const older = queries.useAssistantConversation(conversationId, cursor);
  const page = cursor ? older : latest;
  const availability = queries.useAssistantAvailability?.();
  const operation = queries.useAssistantQuestionOperation?.();
  const resume = queries.useResumeAssistantQuestion?.();
  const retry = queries.useRetryAssistantQuestion?.();
  const [question, setQuestion] = React.useState('');
  const [renameTitle, setRenameTitle] = React.useState('');
  const [confirmingDelete, setConfirmingDelete] = React.useState(false);
  const [responses, setResponses] = React.useState<AssistantResponse[]>([]);
  const [userTurns, setUserTurns] = React.useState<AssistantUserTurn[]>([]);
  const [optimisticTurn, setOptimisticTurn] = React.useState<AssistantUserTurn | null>(null);
  const ask = queries.useAskAssistant();
  const rename = queries.useRenameAssistantConversation();
  const remove = queries.useDeleteAssistantConversation();
  const feedback = queries.useAssistantFeedback();

  const data = page.data;
  const conversation = latest.data?.conversation ?? data?.conversation;
  const nextCursor = data?.responses.nextCursor ?? null;
  const pageItems: AssistantResponse[] = [...(latest.data?.responses.items ?? []), ...(cursor ? data?.responses.items ?? [] : [])];
  const pageTurns: AssistantUserTurn[] = [...(latest.data?.userTurns ?? []), ...(cursor ? data?.userTurns ?? [] : [])];
  const pageKey = JSON.stringify([pageItems, pageTurns]);
  const pageItemsRef = React.useRef({responses: pageItems, turns: pageTurns});
  pageItemsRef.current = {responses: pageItems, turns: pageTurns};

  React.useEffect(() => {
    setCursor(undefined);
    setResponses([]);
    setUserTurns([]);
    setOptimisticTurn(null);
    setRenameTitle('');
    setConfirmingDelete(false);
  }, [conversationId]);

  React.useEffect(() => {
    const incoming = pageItemsRef.current;
    setResponses(current => mergeAssistantRows(current, incoming.responses));
    setUserTurns(current => mergeAssistantRows(current, incoming.turns));
    setRenameTitle((current) => current || data?.conversation.title || '');
  }, [cursor, pageKey, data?.conversation.title]);

  React.useEffect(() => {
    const listener = AppState.addEventListener('change', state => {
      if (state === 'active') {latest.refetch?.(); operation?.refetch?.(); availability?.refetch?.();}
    });
    return () => listener.remove();
  }, [latest.refetch, operation?.refetch, availability?.refetch]);

  const unresolvedQuestion = Boolean(operation?.data && !['completed', 'failed'].includes(operation.data.phase));
  const optimisticOperation = optimisticTurn && operation?.data?.operationId === optimisticTurn.id ? operation.data : null;
  const optimisticMessageId = optimisticOperation?.messageId ?? optimisticTurn?.id;
  const optimisticPersisted = userTurns.some(turn => turn.id === optimisticMessageId) || responses.some(response => response.requestMessageId === optimisticMessageId);
  const recoveryFailed = operation?.data?.phase !== 'completed' && (resume?.isError || retry?.isError);
  const restoredTurn: AssistantUserTurn | null = operation?.data?.conversationId === conversationId && operation.data.question && !userTurns.some(turn => turn.id === (operation.data?.messageId ?? operation.data?.operationId)) && !responses.some(response => response.requestMessageId === operation.data?.messageId) ? {
    id: operation.data.messageId ?? operation.data.operationId,
    content: operation.data.question,
    createdAt: operation.data.createdAt ?? 0,
    status: operation.data.phase === 'accepted' ? 'queued' : operation.data.phase === 'completed' ? 'completed' : operation.data.phase === 'failed' ? 'failed' : 'unknown'
  } : null;

  const handleSendMessage = (questionText: string) => {
    if (!questionText.trim() || ask.isPending || availability?.data?.capabilities?.directRead === 'disabled' || (operation?.data && !['completed', 'failed'].includes(operation.data.phase))) return;
    resume?.reset?.();
    retry?.reset?.();
    const operationId = `ask-${Date.now()}`;
    setOptimisticTurn({id: operationId, content: questionText, status: 'queued', createdAt: Date.now()});
    ask.mutate({
      conversationId: conversation?.id ?? conversationId,
      question: questionText,
      operationId
    }, {onSuccess: () => {setOptimisticTurn(null);}, onError: () => {setOptimisticTurn(current => current ? {...current, status: 'unknown'} : null);}});
  };

  const handleReviewAction = (previewId: string) => {
    router.push(`/assistant/${conversationId}/actions/${previewId}`);
  };

  const handleViewReport = () => {
    router.push('/reports');
  };

  const handleFeedback = (responseId: string, type: 'helpful' | 'not_helpful' | 'reported') => {
    feedback.mutate({
      responseId,
      feedback: type,
      operationId: `feedback-${Date.now()}`
    });
  };

  return (
    <View style={styles.container}>
      {/* 1. Rich Modern Conversation View (Reference 2) */}
      <AssistantConversationView
        conversation={conversation}
        conversationId={conversationId}
        responses={responses}
        userTurns={optimisticTurn && !optimisticPersisted ? [...userTurns, {...optimisticTurn, id: optimisticMessageId ?? optimisticTurn.id, status: optimisticOperation?.phase === 'failed' ? 'failed' : optimisticTurn.status}] : restoredTurn ? [...userTurns, restoredTurn] : userTurns}
        onBack={() => {
          if (onBack) onBack();
          else if (router.canGoBack()) router.back();
          else router.replace('/assistant');
        }}
        availability={availability?.data ?? null}
        functionalStatus={unresolvedQuestion || operation?.isError || recoveryFailed ? <AssistantQuestionRecovery operation={operation?.data} loading={resume?.isPending || retry?.isPending} error={operation?.isError || recoveryFailed}
          onCheck={() => {resume?.mutate(undefined, {onSuccess: () => {ask.reset?.(); setOptimisticTurn(null);}, onSettled: () => {operation?.refetch(); latest.refetch?.();}});}}
          onRetry={() => retry?.mutate(undefined, {onSuccess: () => {ask.reset?.(); setOptimisticTurn(null); latest.refetch?.();}})} /> : undefined}
        onSendMessage={handleSendMessage}
        onReviewAction={handleReviewAction}
        onViewReport={handleViewReport}
        onFeedback={handleFeedback}
        isSending={ask.isPending || Boolean(latest.data?.pendingMessageIds?.length) || Boolean(operation?.data && !['completed', 'failed'].includes(operation.data.phase)) || availability?.data?.capabilities?.directRead === 'disabled'}
        error={ask.isError || page.isError || feedback.isError || data?.failureCode ? translateDynamic((ask.error as { code?: string })?.code === 'still_processing' ? 'assistant.thinking' : 'assistant.state.error') : null}
        onEndReached={() => nextCursor && setCursor(nextCursor)}
      />

      {/* 2. Management Controls & Forms Container */}
      <View style={styles.managementSection}>
        {conversation && (
          <StyledText variant="title" style={styles.srOnly}>
            {conversation.title}
          </StyledText>
        )}

        <View style={styles.srOnly}>
          <FormField
            label={translateDynamic('assistant.input.question')}
            value={question}
            onChangeText={setQuestion}
          />
          <ActionButton
            label="assistant.action.ask"
            loading={ask.isPending}
            onPress={() =>
              handleSendMessage(question.trim() || 'How can I save?')
            }
          />

          <SurfaceCard style={styles.manageCard}>
            <FormField
              label={translateDynamic('assistant.input.rename')}
              value={renameTitle}
              onChangeText={setRenameTitle}
            />
            <ActionButton
              label="assistant.action.rename"
              loading={Boolean(rename?.isPending)}
              onPress={() =>
                conversation &&
                renameTitle.trim() &&
                rename.mutate({
                  id: conversation.id,
                  title: renameTitle.trim(),
                  expectedVersion: conversation.version,
                  operationId: `rename-${Date.now()}`
                })
              }
            />
            <ActionButton
              label="assistant.action.delete"
              variant="destructive"
              onPress={() => setConfirmingDelete(true)}
            />
            {confirmingDelete ? (
              <>
                <ActionButton
                  label="assistant.action.cancelDelete"
                  variant="secondary"
                  onPress={() => setConfirmingDelete(false)}
                />
                <ActionButton
                  label="assistant.action.confirmDelete"
                  variant="destructive"
                  loading={Boolean(remove?.isPending)}
                  onPress={() =>
                    conversation &&
                    remove.mutate({
                      id: conversation.id,
                      expectedVersion: conversation.version,
                      operationId: `delete-${Date.now()}`
                    })
                  }
                />
              </>
            ) : null}
          </SurfaceCard>

          {responses[0] ? (
            <GroupedList label={translateDynamic('assistant.feedback.helpful')}>
              <NavigationRow
                label={translateDynamic('assistant.feedback.helpful')}
                onPress={() =>
                  feedback.mutate({
                    responseId: responses[0].id,
                    feedback: 'helpful',
                    operationId: `feedback-${Date.now()}`
                  })
                }
              />
              <NavigationRow
                label={translateDynamic('assistant.feedback.report')}
                onPress={() =>
                  feedback.mutate({
                    responseId: responses[0].id,
                    feedback: 'reported',
                    operationId: `report-${Date.now()}`
                  })
                }
              />
              <NavigationRow
                label={translateDynamic('support.report.assistant')}
                onPress={() =>
                  router.push({
                    pathname: '/support/new',
                    params: {
                      mode: 'assistant_report',
                      context: JSON.stringify(
                        buildAssistantSupportContext(responses[0], {
                          appVersion: '1.0.0'
                        })
                      )
                    }
                  })
                }
              />
            </GroupedList>
          ) : null}
        </View>
      </View>
    </View>
  );
}

export function mergeAssistantRows<T extends {id: string; createdAt: number}>(current: readonly T[], incoming: readonly T[]): T[] {
  return [...new Map([...current, ...incoming].map(row => [row.id, row])).values()].sort((a, b) => a.createdAt - b.createdAt || a.id.localeCompare(b.id));
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colorTokens.raw["EEF6F4"],
    flex: 1
  },
  managementSection: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 0,
    overflow: 'hidden',
    opacity: 0
  },
  manageCard: {
    gap: 8,
    padding: 8
  },
  srOnly: {
    height: 0,
    opacity: 0,
    overflow: 'hidden',
    width: 0
  }
});
