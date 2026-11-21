import { useTheme } from '@/state/theme-context';
import React, { useState } from 'react';
import { View, StyleSheet, AppState } from 'react-native';
import { router } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { AssistantLanding } from './AssistantLanding';
import { AssistantConversationView } from './AssistantConversationView';
import { AssistantActionPreviewScreen } from './AssistantActionPreviewScreen';
import { StyledText } from '@/components/StyledText';
import { FormField } from '@/design-system/components/forms/FormField';
import { ActionButton } from '@/design-system/components/ActionButton';
import { SurfaceCard } from '@/design-system/components/SurfaceCard';
import {
  GroupedList,
  NavigationRow
} from '@/design-system/components/navigation/GroupedList';
import { translateDynamic } from '@/localization/i18n';
import { buildAssistantSupportContext } from '@/features/support/support-context';
import type { AssistantResponse, AssistantUserTurn } from '@/domain/assistant';
import type { AssistantQuestionIntent } from '@/services/contracts/assistant-notifications-service';
import { AssistantQuestionRecovery } from './AssistantFunctionalStatus';
import { useAppShellStore } from '@/state/app-shell';
import {
  hasReadableSnapshot,
  isAuthoritativeReadDenial
} from '@/services/read-snapshot';
import { FinancialRefreshStatus } from '@/features/core-finance/FinancialRefreshStatus';
import { StateView } from '@/design-system/components/feedback/StateView';
import * as queries from './assistant-queries';

type HomeProps = { initialConversationId?: string; initialQuestion?: string };
export function AssistantHomeScreen(props: HomeProps) {
  const ownerId = useAppShellStore((state) => state.session?.userId ?? null);
  return <AssistantHomeContent key={ownerId ?? 'signed-out'} {...props} />;
}

function AssistantHomeContent({
  initialConversationId,
  initialQuestion
}: HomeProps) {
  const { colors } = useTheme();
  const insights = queries.useAssistantInsights();
  const createConversation = queries.useCreateAssistantConversation();
  const availability = queries.useAssistantAvailability?.();
  const operation = queries.useAssistantQuestionOperation?.();
  const resume = queries.useResumeAssistantQuestion?.();
  const retry = queries.useRetryAssistantQuestion?.();
  const unresolved = Boolean(
    operation?.data && !['completed', 'failed'].includes(operation.data.phase)
  );
  const [firstTurn, setFirstTurn] = useState<AssistantUserTurn | null>(null);
  const firstDispatching = React.useRef(false);

  const [activeConversationId, setActiveConversationId] = useState<
    string | null
  >(initialConversationId ?? null);

  const createError = createConversation.error as
    { code?: string } | null | undefined;
  const creationFailed =
    createConversation.isError && createError?.code !== 'still_processing';

  const handleAskFirstQuestion = async (
    question: string,
    intent?: AssistantQuestionIntent
  ): Promise<boolean> => {
    if (unresolved) {
      if (operation?.data?.conversationId)
        router.navigate(`/assistant/${operation.data.conversationId}`);
      else if (operation?.data?.question)
        setFirstTurn({
          id: operation.data.operationId,
          content: operation.data.question,
          status: 'unknown',
          createdAt: operation.data.createdAt ?? Date.now()
        });
      return false;
    }
    if (
      firstDispatching.current ||
      createConversation.isPending
    )
      return false;
    const operationId = `assistant-create-${Date.now()}`;
    firstDispatching.current = true;
    setFirstTurn({
      id: operationId,
      content: question,
      status: 'queued',
      createdAt: Date.now()
    });
    return new Promise<boolean>((resolve) => {
      createConversation.mutate(
        { question, intent, operationId },
        {
          onSuccess: (result: { value: { id: string } }) => {
            setActiveConversationId(result.value.id);
            resolve(true);
          },
          onError: (error) => {
            setFirstTurn((current) =>
              current
                ? {
                    ...current,
                    status:
                      (error as { code?: string })?.code === 'still_processing'
                        ? 'processing'
                        : 'unknown'
                  }
                : null
            );
            resolve(false);
          },
          onSettled: () => {
            firstDispatching.current = false;
          }
        }
      );
    });
  };

  if (activeConversationId) {
    return (
      <AssistantConversationScreen
        conversationId={activeConversationId}
        initialUserTurn={firstTurn ?? undefined}
        onBack={() => {
          setActiveConversationId(null);
          setFirstTurn(null);
        }}
      />
    );
  }

  if (firstTurn)
    return (
      <AssistantConversationView
        conversationId={operation?.data?.conversationId ?? 'pending-creation'}
        responses={[]}
        userTurns={[
          {
            ...firstTurn,
            status:
              operation?.data?.phase === 'failed' ? 'failed' : firstTurn.status
          }
        ]}
        onSendMessage={handleAskFirstQuestion}
        onBack={() => setFirstTurn(null)}
        availability={availability?.data ?? null}
        isSending={createConversation.isPending || unresolved}
        error={
          creationFailed ? translateDynamic('assistant.state.error') : undefined
        }
        functionalStatus={
          unresolved || creationFailed ? (
            <AssistantQuestionRecovery
              operation={operation?.data}
              loading={resume?.isPending || retry?.isPending}
              error={creationFailed || resume?.isError || retry?.isError}
              onCheck={() =>
                resume?.mutate(undefined, {
                  onSettled: () => operation?.refetch()
                })
              }
              onRetry={() =>
                retry?.mutate(undefined, {
                  onSuccess: (result) => {
                    setActiveConversationId(result.value.conversationId);
                  }
                })
              }
            />
          ) : undefined
        }
      />
    );

  let errorMessage: string | null = null;
  if (createError?.code === 'limit_reached') {
    errorMessage = translateDynamic('assistant.state.limit');
  } else if (createError?.code === 'offline') {
    errorMessage = translateDynamic('assistant.state.offline');
  } else if (
    createError ||
    insights.isError
  ) {
    errorMessage = translateDynamic('assistant.state.error');
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.surfaces.page }]}>
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
        initialQuestion={initialQuestion}
        onAskQuestion={handleAskFirstQuestion}
        insight={insights.data?.[0]}
        onSelectConversation={(id) => {
          router.push(`/assistant/${id}`);
        }}
        loading={
          createConversation.isPending
        }
        error={errorMessage}
      />
    </View>
  );
}

type ConversationProps = {
  conversationId?: string;
  initialUserTurn?: AssistantUserTurn;
  onBack?: () => void;
};
export function AssistantConversationScreen(props: ConversationProps) {
  const ownerId = useAppShellStore((state) => state.session?.userId ?? null);
  return (
    <AssistantConversationContent
      key={JSON.stringify([ownerId, props.conversationId])}
      {...props}
    />
  );
}

function AssistantConversationContent({
  conversationId = 'conversation-1',
  initialUserTurn,
  onBack
}: ConversationProps) {
  const { colors } = useTheme();
  const queryClient = useQueryClient();
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
  const [optimisticTurn, setOptimisticTurn] =
    React.useState<AssistantUserTurn | null>(null);
  const pendingAcknowledgement = React.useRef<{
    operationId: string;
    resolve: (accepted: boolean) => void;
  } | null>(null);
  const latestSubmission = React.useRef<{
    operationId: string;
    ownerId: string | null;
    conversationId: string;
  } | null>(null);
  const publicationScope = React.useRef({ cursor, accessDenied: false });
  const ask = queries.useAskAssistant((response, input) => {
    const submission = latestSubmission.current;
    if (
      !submission ||
      submission.operationId !== input.operationId ||
      submission.conversationId !== input.conversationId ||
      response.conversationId !== submission.conversationId ||
      (useAppShellStore.getState().session?.userId ?? null) !==
        submission.ownerId ||
      publicationScope.current.accessDenied
    )
      return;
    const deniedRead = [undefined, publicationScope.current.cursor].some(
      (readCursor) =>
        isAuthoritativeReadDenial(
          queryClient.getQueryState(
            queries.assistantKeys.conversation(
              submission.conversationId,
              readCursor,
              submission.ownerId
            )
          )?.error
        )
    );
    if (!deniedRead)
      setResponses((current) => mergeAssistantRows(current, [response]));
  });
  const resetAsk = ask.reset;
  const questionSendFailed =
    ask.isError &&
    (ask.error as { code?: string })?.code !== 'still_processing';
  const rename = queries.useRenameAssistantConversation();
  const remove = queries.useDeleteAssistantConversation();
  const feedback = queries.useAssistantFeedback();

  const latestData = hasReadableSnapshot(latest) ? latest.data : undefined;
  const data = hasReadableSnapshot(page) ? page.data : undefined;
  const accessDenied =
    isAuthoritativeReadDenial(latest.error) ||
    isAuthoritativeReadDenial(page.error);
  publicationScope.current = { cursor, accessDenied };
  const conversation = latestData?.conversation ?? data?.conversation;
  const nextCursor = data?.responses.nextCursor ?? null;
  const pageItems: AssistantResponse[] = [
    ...(latestData?.responses.items ?? []),
    ...(cursor ? (data?.responses.items ?? []) : [])
  ];
  const pageTurns: AssistantUserTurn[] = [
    ...(latestData?.userTurns ?? []),
    ...(cursor ? (data?.userTurns ?? []) : [])
  ];
  const pageKey = JSON.stringify([pageItems, pageTurns]);
  const pageItemsRef = React.useRef({ responses: pageItems, turns: pageTurns });
  pageItemsRef.current = { responses: pageItems, turns: pageTurns };

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
    setResponses((current) => mergeAssistantRows(current, incoming.responses));
    setUserTurns((current) => mergeAssistantRows(current, incoming.turns));
    setRenameTitle((current) => current || data?.conversation.title || '');
  }, [cursor, pageKey, data?.conversation.title]);

  React.useEffect(() => {
    if (accessDenied) {
      setResponses([]);
      setUserTurns([]);
    }
  }, [accessDenied]);

  const refreshHistory = latest.refetch;
  const refreshOperation = operation?.refetch;
  const refreshAvailability = availability?.refetch;
  React.useEffect(() => {
    const listener = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        refreshHistory?.();
        refreshOperation?.();
        refreshAvailability?.();
      }
    });
    return () => listener.remove();
  }, [refreshHistory, refreshOperation, refreshAvailability]);

  const unresolvedQuestion = Boolean(
    operation?.data && !['completed', 'failed'].includes(operation.data.phase)
  );
  const answeredMessageIds = new Set(
    responses.flatMap((response) =>
      response.requestMessageId ? [response.requestMessageId] : []
    )
  );
  const optimisticOperation =
    optimisticTurn && operation?.data?.operationId === optimisticTurn.id
      ? operation.data
      : null;
  const optimisticMessageId =
    optimisticOperation?.messageId ?? optimisticTurn?.id;
  const optimisticPersisted =
    userTurns.some((turn) => turn.id === optimisticMessageId) ||
    responses.some(
      (response) => response.requestMessageId === optimisticMessageId
    );
  const recoveryFailed =
    operation?.data?.phase !== 'completed' &&
    (resume?.isError || retry?.isError);
  const restoredTurn: AssistantUserTurn | null =
    operation?.data?.conversationId === conversationId &&
    operation.data.question &&
    !userTurns.some(
      (turn) =>
        turn.id === (operation.data?.messageId ?? operation.data?.operationId)
    ) &&
    !responses.some(
      (response) => response.requestMessageId === operation.data?.messageId
    )
      ? {
          id: operation.data.messageId ?? operation.data.operationId,
          content: operation.data.question,
          createdAt: operation.data.createdAt ?? 0,
          status:
            operation.data.phase === 'accepted'
              ? 'queued'
              : operation.data.phase === 'completed'
                ? 'completed'
                : operation.data.phase === 'failed'
                  ? 'failed'
                  : 'unknown'
        }
      : null;
  const waitingForInitialHistory = Boolean(
    initialUserTurn && !latest.data && !latest.isError
  );
  const initialTurns =
    initialUserTurn && !userTurns.length && !responses.length
      ? [initialUserTurn]
      : userTurns;

  React.useEffect(() => {
    const pending = pendingAcknowledgement.current;
    if (
      pending &&
      operation?.data?.conversationId === conversationId &&
      operation.data.operationId === pending.operationId &&
      ['completed', 'failed'].includes(operation.data.phase)
    ) {
      pendingAcknowledgement.current = null;
      pending.resolve(operation.data.phase === 'completed');
      if (operation.data.phase === 'completed') {
        setOptimisticTurn(null);
        resetAsk?.();
      }
    }
  }, [
    operation?.data?.operationId,
    operation?.data?.phase,
    operation?.data?.conversationId,
    optimisticTurn?.id,
    conversationId,
    resetAsk
  ]);

  React.useEffect(
    () => () => {
      latestSubmission.current = null;
      pendingAcknowledgement.current?.resolve(false);
      pendingAcknowledgement.current = null;
    },
    [conversationId]
  );

  const handleSendMessage = async (questionText: string): Promise<boolean> => {
    if (
      !questionText.trim() ||
      waitingForInitialHistory ||
      pendingAcknowledgement.current ||
      ask.isPending ||
      (operation?.data &&
        !['completed', 'failed'].includes(operation.data.phase))
    )
      return false;
    resume?.reset?.();
    retry?.reset?.();
    const operationId = `ask-${Date.now()}`;
    const submittedOwner = useAppShellStore.getState().session?.userId ?? null;
    const submittedConversation = conversation?.id ?? conversationId;
    latestSubmission.current = {
      operationId,
      ownerId: submittedOwner,
      conversationId: submittedConversation
    };
    setOptimisticTurn({
      id: operationId,
      content: questionText,
      status: 'queued',
      createdAt: Date.now()
    });
    return new Promise<boolean>((resolve) => {
      pendingAcknowledgement.current = { operationId, resolve };
      ask.mutate(
        {
          conversationId: submittedConversation,
          question: questionText,
          operationId
        },
        {
          onSuccess: () => {
            if (pendingAcknowledgement.current?.operationId !== operationId)
              return;
            pendingAcknowledgement.current = null;
            setOptimisticTurn(null);
            resolve(true);
          },
          onError: (error) => {
            if (pendingAcknowledgement.current?.operationId !== operationId)
              return;
            const failure = error as {
              code?: string;
              definitiveRejection?: boolean;
              questionOperationId?: string;
            };
            const durableId = failure?.questionOperationId;
            setOptimisticTurn((current) =>
              current
                ? {
                    ...current,
                    id: durableId ?? current.id,
                    status:
                      failure?.code === 'still_processing'
                        ? 'processing'
                        : 'unknown'
                  }
                : null
            );
            if (durableId && !failure.definitiveRejection) {
              pendingAcknowledgement.current.operationId = durableId;
            } else {
              pendingAcknowledgement.current = null;
              resolve(false);
            }
          }
        }
      );
    });
  };

  const handleReviewAction = (previewId: string) => {
    router.push(`/assistant/${conversationId}/actions/${previewId}`);
  };

  const handleViewReport = () => {
    router.push('/reports');
  };

  if (accessDenied)
    return (
      <StateView
        state="error"
        title={translateDynamic('assistant.state.error')}
      />
    );

  return (
    <View style={[styles.container, { backgroundColor: colors.surfaces.page }]}>
      {/* 1. Rich Modern Conversation View (Reference 2) */}
      {page.isError ? <FinancialRefreshStatus query={page} /> : null}
      <AssistantConversationView
        conversation={conversation}
        conversationId={conversationId}
        responses={responses}
        userTurns={
          optimisticTurn && !optimisticPersisted
            ? [
                ...userTurns,
                {
                  ...optimisticTurn,
                  id: optimisticMessageId ?? optimisticTurn.id,
                  status:
                    optimisticOperation?.phase === 'failed'
                      ? 'failed'
                      : optimisticTurn.status
                }
              ]
            : restoredTurn
              ? [...userTurns, restoredTurn]
              : initialTurns
        }
        onBack={() => {
          if (onBack) onBack();
          else if (router.canGoBack()) router.back();
          else router.replace('/assistant');
        }}
        availability={availability?.data ?? null}
        functionalStatus={
          unresolvedQuestion || operation?.isError || recoveryFailed ? (
            <AssistantQuestionRecovery
              operation={operation?.data}
              loading={resume?.isPending || retry?.isPending}
              error={operation?.isError || recoveryFailed || questionSendFailed}
              onCheck={() => {
                resume?.mutate(undefined, {
                  onSuccess: () => {
                    ask.reset?.();
                    setOptimisticTurn(null);
                  },
                  onSettled: () => {
                    operation?.refetch();
                    latest.refetch?.();
                  }
                });
              }}
              onRetry={() =>
                retry?.mutate(undefined, {
                  onSuccess: () => {
                    ask.reset?.();
                    setOptimisticTurn(null);
                    latest.refetch?.();
                  }
                })
              }
            />
          ) : undefined
        }
        onSendMessage={handleSendMessage}
        onReviewAction={handleReviewAction}
        renderAction={(previewId, fallback) => (
          <AssistantActionPreviewScreen
            conversationId={conversationId ?? ''}
            previewId={previewId}
            inline
            fallback={fallback}
            onReviewAction={handleReviewAction}
          />
        )}
        onViewReport={handleViewReport}
        isSending={
          waitingForInitialHistory ||
          ask.isPending ||
          Boolean(
            latest.data?.pendingMessageIds?.some(
              (id) => !answeredMessageIds.has(id)
            )
          ) ||
          (unresolvedQuestion &&
            !answeredMessageIds.has(operation?.data?.messageId ?? ''))
        }
        error={
          questionSendFailed ||
          (!hasReadableSnapshot(page) && page.isError) ||
          feedback.isError ||
          data?.failureCode
            ? translateDynamic('assistant.state.error')
            : null
        }
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
            <GroupedList label={translateDynamic('assistant.feedback.report')}>
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

export function mergeAssistantRows<T extends { id: string; createdAt: number }>(
  current: readonly T[],
  incoming: readonly T[]
): T[] {
  return [
    ...new Map([...current, ...incoming].map((row) => [row.id, row])).values()
  ].sort((a, b) => a.createdAt - b.createdAt || a.id.localeCompare(b.id));
}

const styles = StyleSheet.create({
  container: {
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
