import React, { type PropsWithChildren } from 'react';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import { notifyManager, QueryClient, QueryClientProvider } from '@tanstack/react-query';

const queries = require('./assistant-queries') as Record<string, any>;
const { assistantService } = require('@/services/mocks/assistant-service') as Record<string, any>;

beforeAll(() => {
  notifyManager.setNotifyFunction((callback) => { act(callback); });
});

afterAll(() => {
  notifyManager.setNotifyFunction((callback) => { callback(); });
});

afterEach(() => {
  jest.restoreAllMocks();
});

test('keys consent, conversation pages, immutable responses, action previews, and current context separately', () => {
  expect(queries.assistantKeys.consent()).toEqual(['assistant', 'consent']);
  expect(queries.assistantKeys.availability()).toEqual(['assistant', 'availability']);
  expect(queries.assistantKeys.conversations({ pageSize: 10 })).toEqual(['assistant', 'conversations', { pageSize: 10 }]);
  expect(queries.assistantKeys.conversation('c1', 'page-2')).toEqual(['assistant', 'conversation', 'c1', 'page-2']);
  expect(queries.assistantKeys.response('r1')).toEqual(['assistant', 'response', 'r1']);
  expect(queries.assistantKeys.actionPreview('p1')).toEqual(['assistant', 'actionPreview', 'p1']);
  expect(queries.assistantKeys.context()).toEqual(['assistant', 'context', 'current']);
});

test('invalidates live assistant scopes without touching immutable responses or snapshots', async () => {
  const client = new QueryClient({ defaultOptions: { queries: { gcTime: Infinity } } });
  client.setQueryData(queries.assistantKeys.conversations({}), { items: [] });
  client.setQueryData(queries.assistantKeys.conversation('c1'), { conversation: { id: 'c1' } });
  client.setQueryData(queries.assistantKeys.conversation('c1', 'page-2'), { conversation: { id: 'c1' }, page: 2 });
  client.setQueryData(queries.assistantKeys.response('r1'), { id: 'r1', snapshot: { frozen: true } });
  client.setQueryData(queries.assistantKeys.actionPreview('p1'), { id: 'p1', version: 1 });
  client.setQueryData(queries.assistantKeys.context(), { dataAsOf: 1 });
  client.setQueryData(queries.assistantKeys.availability(), { status: 'available' });
  client.setQueryData(['reports', 'output', 'old'], { immutable: true });

  await queries.invalidateAssistantScopes(client, [
    'assistant.conversations',
    'assistant.conversation.c1',
    'assistant.context',
    'assistant.availability',
    'assistant.response.r1',
    'assistant.actionPreview.p1',
    'reports.live'
  ]);

  expect(client.getQueryState(queries.assistantKeys.conversations({}))?.isInvalidated).toBe(true);
  expect(client.getQueryState(queries.assistantKeys.conversation('c1'))?.isInvalidated).toBe(true);
  expect(client.getQueryState(queries.assistantKeys.conversation('c1', 'page-2'))?.isInvalidated).toBe(true);
  expect(client.getQueryState(queries.assistantKeys.context())?.isInvalidated).toBe(true);
  expect(client.getQueryState(queries.assistantKeys.availability())?.isInvalidated).toBe(true);
  expect(client.getQueryState(queries.assistantKeys.response('r1'))?.isInvalidated).toBe(false);
  expect(client.getQueryState(queries.assistantKeys.actionPreview('p1'))?.isInvalidated).toBe(true);
  expect(client.getQueryData(['reports', 'output', 'old'])).toEqual({ immutable: true });
});

test('wires consent, conversation pages, ask, rename, delete, and feedback to exact service calls', async () => {
  const { client, wrapper } = queryHarness();
  client.setQueryData(queries.assistantKeys.conversations({}), { items: [{ id: 'c1' }] });
  client.setQueryData(queries.assistantKeys.conversation('c1'), { conversation: { id: 'c1' } });
  client.setQueryData(queries.assistantKeys.context(), { dataAsOf: 1 });

  jest.spyOn(assistantService, 'getConsent').mockResolvedValue({ status: 'enabled', version: 2 });
  jest.spyOn(assistantService, 'getAvailability').mockResolvedValue({ status: 'available', remainingQuestions: 2 });
  jest.spyOn(assistantService, 'listConversations').mockResolvedValue({ items: [{ id: 'c1' }], nextCursor: null, total: 1 });
  jest.spyOn(assistantService, 'getConversation').mockResolvedValue({ conversation: { id: 'c1' }, responses: { items: [], nextCursor: null, total: 0 } });
  jest.spyOn(assistantService, 'getResponse').mockResolvedValue({ id: 'r1', snapshot: { frozen: true } });
  jest.spyOn(assistantService, 'getActionPreview').mockResolvedValue({ id: 'p1', version: 1 });
  const setConsent = jest.spyOn(assistantService, 'setConsent').mockResolvedValue(result({ status: 'disabled', version: 3 }, ['assistant.consent']));
  const ask = jest.spyOn(assistantService, 'ask').mockResolvedValue(result({ id: 'r1', conversationId: 'c1' }, ['assistant.conversation.c1', 'assistant.context']));
  const rename = jest.spyOn(assistantService, 'renameConversation').mockResolvedValue(result({ id: 'c1', title: 'New', version: 2 }, ['assistant.conversations', 'assistant.conversation.c1']));
  const remove = jest.spyOn(assistantService, 'deleteConversation').mockResolvedValue(result({ id: 'c1' }, ['assistant.conversations', 'assistant.conversation.c1']));
  const feedback = jest.spyOn(assistantService, 'setResponseFeedback').mockResolvedValue(result({ id: 'r1', feedback: 'helpful' }, ['assistant.conversation.c1']));
  const updatePreview = jest.spyOn(assistantService, 'updateActionPreview').mockResolvedValue({ id: 'p1', version: 2 });
  const confirmPreview = jest.spyOn(assistantService, 'confirmAction').mockResolvedValue(result({ id: 'p1', version: 3 }, ['assistant.actionPreview.p1', 'assistant.context']));
  const cancelPreview = jest.spyOn(assistantService, 'cancelAction').mockResolvedValue(result({ id: 'p1', version: 4 }, ['assistant.actionPreview.p1']));

  renderHook(() => queries.useAssistantConsent(), { wrapper });
  renderHook(() => queries.useAssistantAvailability(), { wrapper });
  renderHook(() => queries.useAssistantConversations({ pageSize: 10 }), { wrapper });
  renderHook(() => queries.useAssistantConversation('c1'), { wrapper });
  renderHook(() => queries.useAssistantResponse('r1'), { wrapper });
  renderHook(() => queries.useAssistantActionPreview('p1'), { wrapper });
  await waitFor(() => {
    expect(assistantService.getConsent).toHaveBeenCalled();
    expect(assistantService.getAvailability).toHaveBeenCalled();
    expect(assistantService.listConversations).toHaveBeenCalledWith({ pageSize: 10 });
    expect(assistantService.getConversation).toHaveBeenCalledWith('c1', undefined);
    expect(assistantService.getResponse).toHaveBeenCalledWith('r1');
    expect(assistantService.getActionPreview).toHaveBeenCalledWith('p1');
  });

  const consentHook = renderHook(() => queries.useSetAssistantConsent(), { wrapper });
  const askHook = renderHook(() => queries.useAskAssistant(), { wrapper });
  const renameHook = renderHook(() => queries.useRenameAssistantConversation(), { wrapper });
  const deleteHook = renderHook(() => queries.useDeleteAssistantConversation(), { wrapper });
  const feedbackHook = renderHook(() => queries.useAssistantFeedback(), { wrapper });
  const updatePreviewHook = renderHook(() => queries.useUpdateAssistantActionPreview(), { wrapper });
  const confirmPreviewHook = renderHook(() => queries.useConfirmAssistantAction(), { wrapper });
  const cancelPreviewHook = renderHook(() => queries.useCancelAssistantAction(), { wrapper });
  await act(async () => {
    await consentHook.result.current.mutateAsync({ enabled: false, expectedVersion: 2, operationId: 'consent-off' });
    await askHook.result.current.mutateAsync({ conversationId: 'c1', question: 'Q', operationId: 'ask-1' });
    await renameHook.result.current.mutateAsync({ id: 'c1', title: 'New', expectedVersion: 1, operationId: 'rename-1' });
    await deleteHook.result.current.mutateAsync({ id: 'c1', expectedVersion: 2, operationId: 'delete-1' });
    await feedbackHook.result.current.mutateAsync({ responseId: 'r1', feedback: 'helpful', operationId: 'feedback-1' });
    await updatePreviewHook.result.current.mutateAsync({ previewId: 'p1', input: { amountMinor: 1, currency: 'SAR' }, expectedVersion: 1 });
    await confirmPreviewHook.result.current.mutateAsync({ previewId: 'p1', expectedVersion: 2, operationId: 'preview-confirm-1' });
    await cancelPreviewHook.result.current.mutateAsync({ previewId: 'p1', expectedVersion: 3, operationId: 'preview-cancel-1' });
  });

  expect(setConsent).toHaveBeenCalledWith(false, 2, 'consent-off');
  expect(ask).toHaveBeenCalledWith('c1', 'Q', 'ask-1');
  expect(rename).toHaveBeenCalledWith('c1', 'New', 1, 'rename-1');
  expect(remove).toHaveBeenCalledWith('c1', 2, 'delete-1');
  expect(feedback).toHaveBeenCalledWith('r1', 'helpful', 'feedback-1');
  expect(updatePreview).toHaveBeenCalledWith('p1', { amountMinor: 1, currency: 'SAR' }, 1);
  expect(confirmPreview).toHaveBeenCalledWith('p1', 2, 'preview-confirm-1');
  expect(cancelPreview).toHaveBeenCalledWith('p1', 3, 'preview-cancel-1');
  await waitFor(() => expect(assistantService.getConversation.mock.calls.length).toBeGreaterThan(1));
  expect(client.getQueryState(queries.assistantKeys.context())?.isInvalidated).toBe(true);
});

function queryHarness() {
  const client = new QueryClient({
    defaultOptions: {
      queries: { gcTime: Infinity, retry: false },
      mutations: { gcTime: Infinity, retry: false }
    }
  });
  const wrapper = ({ children }: PropsWithChildren) => React.createElement(QueryClientProvider, { client }, children);
  return { client, wrapper };
}

function result(value: unknown, affectedScopes: readonly string[]) {
  return { value, affectedScopes };
}
