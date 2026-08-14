import React, { type PropsWithChildren } from 'react';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider, notifyManager } from '@tanstack/react-query';

import { supportService } from '@/services/mocks/support-service';
import {
  supportKeys,
  useArticleSearch,
  useDiscardSupportDraft,
  useReplyToTicket,
  useSaveSupportDraft,
  useSubmitSupportDraft,
  useSupportDraftQuery,
  useSupportTicket,
  useSupportTickets,
  useRateTicket
} from './support-queries';

beforeAll(() => {
  notifyManager.setNotifyFunction((callback) => act(callback));
});

afterAll(() => {
  notifyManager.setNotifyFunction((callback) => callback());
});

afterEach(() => jest.restoreAllMocks());

test('loads article search, ticket pages/detail, and drafts from support service keys', async () => {
  const { wrapper } = queryHarness();
  jest.spyOn(supportService, 'searchArticles').mockResolvedValue([{ id: 'article-1' }] as never);
  jest.spyOn(supportService, 'listTickets').mockResolvedValue({ items: [{ id: 'ticket-1' }], nextCursor: null, total: 1 } as never);
  jest.spyOn(supportService, 'getTicket').mockResolvedValue({ id: 'ticket-1' } as never);
  jest.spyOn(supportService, 'loadDraft').mockResolvedValue({ id: 'draft-1' } as never);

  const articles = renderHook(() => useArticleSearch({ query: 'help', category: 'faq' }), { wrapper });
  const tickets = renderHook(() => useSupportTickets('cursor-1'), { wrapper });
  const ticket = renderHook(() => useSupportTicket('ticket-1'), { wrapper });
  const draft = renderHook(() => useSupportDraftQuery('draft-1'), { wrapper });

  await waitFor(() => expect(articles.result.current.data?.[0]?.id).toBe('article-1'));
  await waitFor(() => expect(tickets.result.current.data?.items[0]?.id).toBe('ticket-1'));
  await waitFor(() => expect(ticket.result.current.data?.id).toBe('ticket-1'));
  await waitFor(() => expect(draft.result.current.data?.id).toBe('draft-1'));
  expect(supportService.listTickets).toHaveBeenCalledWith('cursor-1');
});

test('mutations invalidate only submitted/saved support scopes after success', async () => {
  const { client, wrapper } = queryHarness();
  client.setQueryData(supportKeys.draft('draft-1'), { id: 'draft-1' });
  client.setQueryData(supportKeys.tickets(), { items: [] });
  client.setQueryData(supportKeys.ticket('ticket-1'), { id: 'ticket-1' });
  jest.spyOn(supportService, 'saveDraft').mockResolvedValue({ id: 'draft-1' } as never);
  jest.spyOn(supportService, 'discardDraft').mockResolvedValue(undefined);
  jest.spyOn(supportService, 'submitDraft').mockResolvedValue({ value: { ticketId: 'ticket-1' }, affectedScopes: ['support.tickets', 'support.ticket.ticket-1', 'support.draft.draft-1'] } as never);
  jest.spyOn(supportService, 'reply').mockResolvedValue({ value: { ticketId: 'ticket-1' }, affectedScopes: ['support.ticket.ticket-1', 'support.tickets'] } as never);
  jest.spyOn(supportService, 'rate').mockResolvedValue({ value: { ticketId: 'ticket-1' }, affectedScopes: ['support.ticket.ticket-1'] } as never);

  const save = renderHook(() => useSaveSupportDraft(), { wrapper });
  const discard = renderHook(() => useDiscardSupportDraft(), { wrapper });
  const submit = renderHook(() => useSubmitSupportDraft(), { wrapper });
  const reply = renderHook(() => useReplyToTicket(), { wrapper });
  const rate = renderHook(() => useRateTicket(), { wrapper });

  await act(async () => {
    await save.result.current.mutateAsync({ id: 'draft-1' } as never);
    await discard.result.current.mutateAsync('draft-1');
    await submit.result.current.mutateAsync({ draftId: 'draft-1', operationId: 'submit-1' });
    await reply.result.current.mutateAsync({ ticketId: 'ticket-1', input: { description: 'Reply' }, expectedVersion: 1, operationId: 'reply-1' });
    await rate.result.current.mutateAsync({ ticketId: 'ticket-1', rating: 5, expectedVersion: 2, operationId: 'rate-1' });
  });

  expect(client.getQueryState(supportKeys.draft('draft-1'))?.isInvalidated).toBe(true);
  expect(client.getQueryState(supportKeys.tickets())?.isInvalidated).toBe(true);
  expect(client.getQueryState(supportKeys.ticket('ticket-1'))?.isInvalidated).toBe(true);
});

test('failed submission preserves cached draft and ticket pages', async () => {
  const { client, wrapper } = queryHarness();
  const draft = { id: 'draft-1' };
  const tickets = { items: [] };
  client.setQueryData(supportKeys.draft('draft-1'), draft);
  client.setQueryData(supportKeys.tickets(), tickets);
  jest.spyOn(supportService, 'submitDraft').mockRejectedValue(new Error('offline'));

  await expect(renderHook(() => useSubmitSupportDraft(), { wrapper }).result.current.mutateAsync({ draftId: 'draft-1', operationId: 'failed' })).rejects.toThrow('offline');

  expect(client.getQueryData(supportKeys.draft('draft-1'))).toBe(draft);
  expect(client.getQueryData(supportKeys.tickets())).toBe(tickets);
});

function queryHarness() {
  const client = new QueryClient({ defaultOptions: { queries: { gcTime: Infinity, retry: false }, mutations: { gcTime: Infinity, retry: false } } });
  const wrapper = ({ children }: PropsWithChildren) => React.createElement(QueryClientProvider, { client }, children);
  return { client, wrapper };
}
