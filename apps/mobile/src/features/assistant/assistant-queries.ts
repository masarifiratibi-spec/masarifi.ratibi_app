import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient
} from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';

import { assistantService } from '@/services/assistant-service';
import type { AssistantQuestionIntent } from '@/services/contracts/assistant-notifications-service';

export type AssistantConversationQuery = {
  cursor?: string;
  pageSize?: number;
  status?: 'active' | 'archived' | 'deleted';
};

export const assistantKeys = {
  consent: () => ['assistant', 'consent'] as const,
  availability: () => ['assistant', 'availability'] as const,
  insights: () => ['assistant', 'insights'] as const,
  conversations: (input: AssistantConversationQuery = {}) =>
    ['assistant', 'conversations', input] as const,
  conversation: (id: string, cursor?: string) =>
    cursor
      ? (['assistant', 'conversation', id, cursor] as const)
      : (['assistant', 'conversation', id] as const),
  response: (id: string) => ['assistant', 'response', id] as const,
  actionPreview: (id: string) => ['assistant', 'actionPreview', id] as const,
  context: () => ['assistant', 'context', 'current'] as const,
  questionOperation: () => ['assistant', 'questionOperation'] as const
};

export function useAssistantConsent() {
  return useQuery({
    queryKey: assistantKeys.consent(),
    queryFn: () => assistantService.getConsent()
  });
}

export function useAssistantAvailability() {
  return useQuery({
    queryKey: assistantKeys.availability(),
    queryFn: () => assistantService.getAvailability()
  });
}

function useAssistantForeground() {
  const [foreground, setForeground] = useState(
    () => !['background', 'inactive'].includes(AppState.currentState)
  );
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) =>
      setForeground(state === 'active')
    );
    return () => subscription.remove();
  }, []);
  return foreground;
}

export function useAssistantQuestionOperation() {
  const client = useQueryClient();
  const foreground = useAssistantForeground();
  return useQuery({
    queryKey: assistantKeys.questionOperation(),
    enabled: foreground,
    staleTime: 0,
    retry: false,
    queryFn: async () => {
      const operation =
        (await assistantService.readQuestionOperation?.()) ?? null;
      if (operation?.phase !== 'accepted' || !operation.conversationId)
        return operation;
      const conversationId = operation.conversationId;
      // Reconcile accepted work through reads; unknown acceptance still requires explicit recovery.
      await client.fetchQuery({
        queryKey: assistantKeys.conversation(conversationId),
        queryFn: () => assistantService.getConversation(conversationId),
        staleTime: 0,
        retry: false
      });
      return (await assistantService.readQuestionOperation?.()) ?? null;
    },
    refetchInterval: (query) =>
      query.state.error ||
      query.state.data?.phase !== 'accepted' ||
      Date.now() - (query.state.data.createdAt ?? 0) >= 5 * 60000
        ? false
        : Math.min(
            8000,
            2000 * 2 ** Math.min(query.state.dataUpdateCount - 1, 2)
          )
  });
}

export function useResumeAssistantQuestion() {
  return useAssistantMutation(async () => {
    if (!assistantService.resumeQuestion)
      throw new Error('assistant_unavailable');
    return assistantService.resumeQuestion();
  });
}

export function useRetryAssistantQuestion() {
  return useAssistantMutation(async () => {
    if (!assistantService.retryQuestionOperation)
      throw new Error('assistant_unavailable');
    return assistantService.retryQuestionOperation();
  });
}

export function useAssistantConversations(
  input: AssistantConversationQuery = {}
) {
  const { cursor: _cursor, ...query } = input;
  return useInfiniteQuery({
    queryKey: assistantKeys.conversations(query),
    initialPageParam: input.cursor,
    queryFn: ({ pageParam }) =>
      assistantService.listConversations({ ...query, cursor: pageParam }),
    getNextPageParam: (page) => page.nextCursor ?? undefined
  });
}

export function useAssistantConversation(id: string, cursor?: string) {
  const foreground = useAssistantForeground();
  const polling = useRef({ id, startedAt: Date.now() });
  if (polling.current.id !== id)
    polling.current = { id, startedAt: Date.now() };
  return useQuery({
    queryKey: assistantKeys.conversation(id, cursor),
    queryFn: () => assistantService.getConversation(id, cursor),
    enabled: Boolean(id) && foreground,
    retry: false,
    refetchInterval: (query) =>
      query.state.error ||
      !query.state.data?.pendingMessageIds?.length ||
      Date.now() - polling.current.startedAt >= 5 * 60000
        ? false
        : Math.min(
            8000,
            2000 * 2 ** Math.min(query.state.dataUpdateCount - 1, 2)
          )
  });
}

export function useAssistantResponse(id: string) {
  return useQuery({
    queryKey: assistantKeys.response(id),
    queryFn: () => assistantService.getResponse(id),
    enabled: Boolean(id),
    staleTime: Infinity
  });
}

export function useAssistantActionPreview(id: string) {
  return useQuery({
    queryKey: assistantKeys.actionPreview(id),
    queryFn: () => assistantService.getActionPreview(id),
    enabled: Boolean(id)
  });
}

export function useSetAssistantConsent() {
  return useAssistantMutation(
    ({
      enabled,
      expectedVersion,
      operationId
    }: {
      enabled: boolean;
      expectedVersion: number;
      operationId: string;
    }) => assistantService.setConsent(enabled, expectedVersion, operationId)
  );
}

export function useAskAssistant() {
  return useAssistantMutation(
    ({
      conversationId,
      question,
      operationId,
      intent
    }: {
      conversationId: string;
      question: string;
      operationId: string;
      intent?: AssistantQuestionIntent;
    }) =>
      intent
        ? assistantService.ask(conversationId, question, operationId, intent)
        : assistantService.ask(conversationId, question, operationId)
  );
}

export function useAssistantInsights() {
  return useQuery({
    queryKey: assistantKeys.insights(),
    queryFn: () => assistantService.listInsights()
  });
}

export function useCreateAssistantConversation() {
  return useAssistantMutation(
    ({
      question,
      operationId,
      intent
    }: {
      question: string;
      operationId: string;
      intent?: AssistantQuestionIntent;
    }) => assistantService.createConversation({ question, intent }, operationId)
  );
}

export function useRenameAssistantConversation() {
  return useAssistantMutation(
    ({
      id,
      title,
      expectedVersion,
      operationId
    }: {
      id: string;
      title: string;
      expectedVersion: number;
      operationId: string;
    }) =>
      assistantService.renameConversation(
        id,
        title,
        expectedVersion,
        operationId
      )
  );
}

export function useDeleteAssistantConversation() {
  return useAssistantMutation(
    ({
      id,
      expectedVersion,
      operationId
    }: {
      id: string;
      expectedVersion: number;
      operationId: string;
    }) => assistantService.deleteConversation(id, expectedVersion, operationId)
  );
}

export function useAssistantFeedback() {
  return useAssistantMutation(
    ({
      responseId,
      feedback,
      operationId
    }: {
      responseId: string;
      feedback: 'helpful' | 'not_helpful' | 'reported';
      operationId: string;
    }) =>
      assistantService.setResponseFeedback(responseId, feedback, operationId)
  );
}

export function useUpdateAssistantActionPreview() {
  return useAssistantMutation(
    async ({
      previewId,
      input,
      expectedVersion
    }: {
      previewId: string;
      input: unknown;
      expectedVersion: number;
    }) => ({
      value: await assistantService.updateActionPreview(
        previewId,
        input as never,
        expectedVersion
      ),
      affectedScopes: [`assistant.actionPreview.${previewId}`]
    })
  );
}

export function useConfirmAssistantAction() {
  return useAssistantMutation(
    ({
      previewId,
      expectedVersion,
      operationId
    }: {
      previewId: string;
      expectedVersion: number;
      operationId: string;
    }) =>
      assistantService.confirmAction(previewId, expectedVersion, operationId)
  );
}

export function useCancelAssistantAction() {
  return useAssistantMutation(
    ({
      previewId,
      expectedVersion,
      operationId
    }: {
      previewId: string;
      expectedVersion: number;
      operationId: string;
    }) => assistantService.cancelAction(previewId, expectedVersion, operationId)
  );
}

function useAssistantMutation<TVariables, TValue>(
  mutationFn: (
    variables: TVariables
  ) => Promise<{ value: TValue; affectedScopes: readonly string[] }>
) {
  const client = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: (result) =>
      invalidateAssistantScopes(client, result.affectedScopes),
    onError: (error) => {
      const scopes = (error as { affectedScopes?: readonly string[] })
        .affectedScopes;
      if (scopes?.length) return invalidateAssistantScopes(client, scopes);
    },
    onSettled: () =>
      client.invalidateQueries({ queryKey: assistantKeys.questionOperation() })
  });
}

export function assistantScopeToKey(scope: string): readonly unknown[] | null {
  if (scope === 'assistant.insights') return assistantKeys.insights();
  if (scope === 'assistant.consent') return assistantKeys.consent();
  if (scope === 'assistant.availability') return assistantKeys.availability();
  if (scope === 'assistant.conversations')
    return ['assistant', 'conversations'];
  if (scope === 'assistant.context') return assistantKeys.context();
  if (
    scope.startsWith('assistant.actionPreview.') &&
    scope.length > 'assistant.actionPreview.'.length
  )
    return assistantKeys.actionPreview(
      scope.slice('assistant.actionPreview.'.length)
    );
  if (
    scope.startsWith('assistant.conversation.') &&
    scope.length > 'assistant.conversation.'.length
  )
    return assistantKeys.conversation(
      scope.slice('assistant.conversation.'.length)
    );
  return null;
}

export async function invalidateAssistantScopes(
  client: QueryClient,
  scopes: readonly string[]
) {
  if (scopes.includes('financial.live')) {
    await Promise.all(
      [
        ['core-finance'],
        ['planning'],
        ['reports', 'live'],
        ['reports', 'preview'],
        ['reports', 'breakdown'],
        ['reports', 'net-worth'],
        ['tracking']
      ].map((queryKey) => client.invalidateQueries({ queryKey }))
    );
  }
  await Promise.all(
    scopes.map((scope) => {
      const key = assistantScopeToKey(scope);
      return key
        ? client.invalidateQueries({ queryKey: key })
        : Promise.resolve();
    })
  );
}
