/* eslint-disable @typescript-eslint/no-var-requires */
import React from 'react';
import { FlatList, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import type { AssistantResponse } from '@/domain/assistant';
import { buildAssistantSupportContext } from '@/features/support/support-context';
import { ActionButton } from '@/design-system/components/ActionButton';
import { StyledText } from '@/components/StyledText';
import { translateDynamic } from '@/localization/i18n';

type AssistantQueries = typeof import('./assistant-queries');

export function AssistantHomeScreen() {
  const queries = require('./assistant-queries') as AssistantQueries;
  const consent = queries.useAssistantConsent();
  const conversations = queries.useAssistantConversations({ pageSize: 20 });
  const setConsent = queries.useSetAssistantConsent();
  const createConversation = queries.useCreateAssistantConversation();
  const consentStatus = consent.data?.status;
  const createError = createConversation.error as { code?: string } | null | undefined;
  const legacyConversations = conversations.data as unknown as { items?: { id: string; title: string }[]; total?: number } | undefined;
  const conversationItems = conversations.data?.pages?.flatMap((page) => page.items) ?? legacyConversations?.items ?? [];
  const conversationTotal = conversations.data?.pages?.[0]?.total ?? legacyConversations?.total ?? 0;

  return (
    <FlatList
      data={conversationItems}
      keyExtractor={(item: { id: string }) => item.id}
      ListHeaderComponent={<View>
        <StyledText variant="title">assistant.consent.title</StyledText>
        <StyledText>assistant.privacy.transactions</StyledText>
        {consentStatus === 'disabled' ? <StyledText>assistant.state.disabled</StyledText> : null}
        {createError?.code === 'limit_reached' ? <StyledText>assistant.state.limit</StyledText> : null}
        {createError?.code === 'offline' ? <StyledText>assistant.state.offline</StyledText> : null}
        {conversationTotal === 0 ? <StyledText>assistant.state.empty</StyledText> : null}
        {consent.isError ? <StyledText accessibilityRole="alert">assistant.state.error</StyledText> : null}
        {consentStatus !== 'enabled' ? <ActionButton label="assistant.action.enable" onPress={() => setConsent.mutate({ enabled: true, expectedVersion: consent.data?.version ?? 1, operationId: `assistant-consent-${Date.now()}` })} /> : null}
        <ActionButton label="assistant.suggestions.spending" onPress={() => createConversation.mutate(
          { question: translateDynamic('assistant.suggestions.spending'), operationId: `assistant-create-${Date.now()}` },
          { onSuccess: (result: { value: { id: string } }) => router.push(`/assistant/${result.value.id}`) }
        )} />
      </View>}
      renderItem={({ item }: { item: { id: string; title: string } }) => <ActionButton label={item.title} variant="secondary" onPress={() => router.push(`/assistant/${item.id}`)} />}
      onEndReached={() => conversations.hasNextPage && !conversations.isFetchingNextPage && conversations.fetchNextPage?.()}
    />
  );
}

export function AssistantConversationScreen({ conversationId = 'conversation-1' }: { conversationId?: string }) {
  const queries = require('./assistant-queries') as AssistantQueries;
  const [cursor, setCursor] = React.useState<string | undefined>(undefined);
  const page = queries.useAssistantConversation(conversationId, cursor);
  const [question, setQuestion] = React.useState('');
  const [renameTitle, setRenameTitle] = React.useState('');
  const [confirmingDelete, setConfirmingDelete] = React.useState(false);
  const [responses, setResponses] = React.useState<AssistantResponse[]>([]);
  const ask = queries.useAskAssistant();
  const rename = queries.useRenameAssistantConversation();
  const remove = queries.useDeleteAssistantConversation();
  const feedback = queries.useAssistantFeedback();
  const data = page.data;
  const conversation = data?.conversation;
  const nextCursor = data?.responses.nextCursor ?? null;
  const pageItems: AssistantResponse[] = data?.responses.items ?? [];
  const pageKey = pageItems.map((item) => item.id).join('|');
  const pageItemsRef = React.useRef(pageItems);
  pageItemsRef.current = pageItems;

  React.useEffect(() => {
    setCursor(undefined);
    setResponses([]);
    setRenameTitle('');
    setConfirmingDelete(false);
  }, [conversationId]);

  React.useEffect(() => {
    const incoming = pageItemsRef.current;
    if (!incoming.length) return;
    setResponses((current) => cursor ? [...current, ...incoming.filter((item) => current.every((seen) => seen.id !== item.id))] : incoming);
    setRenameTitle((current) => current || data?.conversation.title || '');
  }, [cursor, pageKey, data?.conversation.title]);

  return (
    <View style={{ flex: 1 }}>
      <FlatList
        data={responses}
        keyExtractor={(item: AssistantResponse) => item.id}
        renderItem={({ item }: { item: AssistantResponse }) => <AssistantResponseRow response={item} conversationId={conversationId} />}
        onEndReached={() => nextCursor && setCursor(nextCursor)}
      />
      <TextInput accessibilityLabel={translateDynamic('assistant.input.question')} value={question} onChangeText={setQuestion} />
      <ActionButton label="assistant.action.ask" loading={ask.isPending} onPress={() => ask.mutate({ conversationId: conversation?.id ?? conversationId, question, operationId: `ask-${Date.now()}` })} />
      <TextInput accessibilityLabel={translateDynamic('assistant.input.rename')} value={renameTitle} onChangeText={setRenameTitle} />
      <ActionButton label="assistant.action.rename" loading={rename.isPending} onPress={() => conversation && renameTitle.trim() && rename.mutate({ id: conversation.id, title: renameTitle.trim(), expectedVersion: conversation.version, operationId: `rename-${Date.now()}` })} />
      <ActionButton label="assistant.action.delete" variant="destructive" onPress={() => setConfirmingDelete(true)} />
      {confirmingDelete ? (
        <>
          <ActionButton label="assistant.action.cancelDelete" variant="secondary" onPress={() => setConfirmingDelete(false)} />
          <ActionButton label="assistant.action.confirmDelete" variant="destructive" loading={remove.isPending} onPress={() => conversation && remove.mutate({ id: conversation.id, expectedVersion: conversation.version, operationId: `delete-${Date.now()}` })} />
        </>
      ) : null}
      {responses[0] ? (
        <>
          <ActionButton label="assistant.feedback.helpful" variant="secondary" onPress={() => feedback.mutate({ responseId: responses[0].id, feedback: 'helpful', operationId: `feedback-${Date.now()}` })} />
          <ActionButton label="assistant.feedback.report" variant="secondary" onPress={() => feedback.mutate({ responseId: responses[0].id, feedback: 'reported', operationId: `report-${Date.now()}` })} />
          <ActionButton label="support.report.assistant" variant="secondary" onPress={() => router.push({ pathname: '/support/new', params: { mode: 'assistant_report', context: JSON.stringify(buildAssistantSupportContext(responses[0], { appVersion: '1.0.0' })) } })} />
        </>
      ) : null}
    </View>
  );
}

function AssistantResponseRow({ response, conversationId }: { response: AssistantResponse; conversationId: string }) {
  return (
    <View>
      {(response.blocks ?? []).map((block, index) => (
        <View key={block.key ?? `${response.id}-block-${index}`}>
          <StyledText variant="subtitle">{`assistant.label.${block.label}`}</StyledText>
          <StyledText>{translateDynamic(block.key, block.values)}</StyledText>
        </View>
      ))}
      {response.snapshot.reportReference ? (
        <ActionButton label="assistant.evidence.report" variant="secondary" onPress={() => router.push('/reports')} />
      ) : null}
      {(response.limitations ?? []).map((item) => (
        <StyledText key={item}>{item === 'review_required_excluded' ? 'assistant.limitation.reviewExcluded' : item}</StyledText>
      ))}
      {response.proposedActionIds.map((previewId) => (
        <ActionButton key={previewId} label="assistant.proposal.review" onPress={() => router.push(`/assistant/${conversationId}/actions/${previewId}`)} />
      ))}
    </View>
  );
}
