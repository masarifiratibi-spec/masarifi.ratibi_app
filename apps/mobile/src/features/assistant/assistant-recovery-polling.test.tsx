import React, { type PropsWithChildren } from 'react';
import {
  act,
  fireEvent,
  renderHook,
  screen
} from '@testing-library/react-native';
import { renderWithProviders } from '@/test-utils/render';
import { AssistantConversationScreen } from './AssistantHomeScreen';
import { AppState, type AppStateStatus } from 'react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createLiveAssistantApiService } from '@/services/live/assistant-api-service';
import { createMemoryAssistantJournal } from '@/storage/assistant-operation-journal';
import {
  assistantKeys,
  useAssistantConversation,
  useAssistantQuestionOperation
} from './assistant-queries';

let mockLiveService: ReturnType<typeof createLiveAssistantApiService>;
type ConversationData = Awaited<
  ReturnType<typeof mockLiveService.getConversation>
>;
jest.mock('@/services/assistant-service', () => ({
  get assistantService() {
    return mockLiveService;
  }
}));

const conversationId = '99100000-0000-4000-8000-000000000001';
const messageId = '99100000-0000-4000-8000-000000000002';
const at = '2026-09-03T00:00:00.000Z';

async function recoveryHarness(
  phase: 'accepted' | 'prepared' | 'empty' = 'accepted',
  conversationOnly = false
) {
  const journal = createMemoryAssistantJournal();
  const saved =
    phase === 'empty'
      ? null
      : await journal.reserve(
          'owner-a',
          'question',
          { conversationId, question: 'Spend?' },
          'delayed-question-operation'
        );
  if (phase === 'accepted')
    await journal.update('owner-a', 'question', saved!.operationId, {
      phase,
      messageId
    });
  let status = 'processing',
    offline = false,
    owner = 'owner-a',
    authStalled = false,
    question = 'Spend?',
    hasUser = phase !== 'empty';
  const calls: { method?: string; owner: string; question?: string }[] = [];
  const request: typeof fetch = async (url, init) => {
    if (init?.method === 'POST') {
      question = JSON.parse(String(init.body)).content;
      hasUser = true;
    }
    calls.push({
      method: init?.method,
      owner,
      ...(init?.method === 'POST' ? { question } : {})
    });
    if (offline) throw new TypeError('Network request failed');
    const user = {
      id: messageId,
      conversationId,
      replyToMessageId: null,
      role: 'user',
      content: question,
      status,
      failureCode: status === 'failed' ? 'AI_PROCESSING_FAILED' : null,
      snapshot: null,
      preview: null,
      createdAt: at
    };
    const answer = {
      id: '99100000-0000-4000-8000-000000000003',
      conversationId,
      replyToMessageId: messageId,
      role: 'assistant',
      content: 'Spend 13 SAR',
      status: 'completed',
      failureCode: null,
      snapshot: {
        id: '99100000-0000-4000-8000-000000000004',
        schemaVersion: 1,
        evidenceRefs: [],
        model: 'test-model',
        provider: 'test-provider',
        createdAt: at
      },
      preview: null,
      createdAt: at
    };
    const path = new URL(String(url)).pathname;
    const payload = path.endsWith('/availability')
      ? { status: 'available', limit: 30, used: 0, remaining: 30, resetsAt: at }
      : path.endsWith('/result')
        ? {
            id: messageId,
            conversationId,
            status,
            failureCode: null,
            request: user,
            response: status === 'completed' ? answer : null
          }
        : init?.method === 'POST'
          ? { id: messageId, status: 'queued' }
          : path.endsWith('/messages')
            ? {
                items: !hasUser
                  ? []
                  : status === 'completed'
                    ? [answer, user]
                    : [user],
                nextCursor: null
              }
            : {
                id: conversationId,
                title: 'Spend?',
                status: 'active',
                version: 1,
                lastMessageAt: at,
                createdAt: at,
                updatedAt: at
              };
    return new Response(JSON.stringify(payload), {
      status: 200,
      headers: { 'content-type': 'application/json' }
    });
  };
  mockLiveService = createLiveAssistantApiService({
    baseUrl: 'https://api.test',
    journal,
    request,
    requestTimeoutMs: 10,
    identity: async () => {
      if (authStalled) return new Promise<never>(() => undefined);
      const captured = owner;
      return {
        userId: captured,
        token: 'inert-test-token',
        assertCurrent: async () => {
          if (captured !== owner) throw new Error('owner_changed');
        }
      };
    }
  });
  const client = new QueryClient({
    defaultOptions: {
      queries: { gcTime: Infinity, retry: false, staleTime: Infinity }
    }
  });
  client.setQueryData(assistantKeys.conversation(conversationId), {
    pendingMessageIds: conversationOnly ? [messageId] : [],
    responses: { items: [] }
  });
  const appStates = new Set<(state: AppStateStatus) => void>();
  jest
    .spyOn(AppState, 'addEventListener')
    .mockImplementation((_event, callback) => {
      appStates.add(callback);
      return {
        remove() {
          appStates.delete(callback);
        }
      };
    });
  const wrapper = ({ children }: PropsWithChildren) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  const hook = renderHook(
    () => {
      useAssistantConversation(conversationOnly ? conversationId : '');
      return useAssistantQuestionOperation();
    },
    { wrapper }
  );
  const tick = async (milliseconds = 2100) => {
    await act(async () => {
      await jest.advanceTimersByTimeAsync(milliseconds);
    });
  };
  await tick(conversationOnly ? 2100 : 20);
  return {
    hook,
    client,
    calls,
    journal,
    tick,
    showPending: () => {
      hasUser = true;
      status = 'processing';
    },
    setAuthStalled: (value: boolean) => {
      authStalled = value;
    },
    setStatus: (value: string) => {
      status = value;
    },
    goOffline: () => {
      offline = true;
    },
    switchOwner: () => {
      owner = 'owner-b';
    },
    setBackground: () => {
      appStates.forEach((callback) => callback('background'));
    }
  };
}

beforeEach(() => jest.useFakeTimers());
afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

it('gives a fresh pending question its own polling window in a conversation left open over five minutes', async () => {
  const h = await recoveryHarness('empty', true);
  await h.tick(6 * 60000);
  h.showPending();
  await act(async () => {
    await h.client.invalidateQueries({
      queryKey: assistantKeys.conversation(conversationId)
    });
  });
  expect(
    h.client.getQueryData<ConversationData>(
      assistantKeys.conversation(conversationId)
    )?.pendingMessageIds
  ).toEqual([messageId]);
  h.setStatus('completed');
  await h.tick(2100);
  expect(
    h.client.getQueryData<ConversationData>(
      assistantKeys.conversation(conversationId)
    )?.responses.items[0]?.blocks[0].key
  ).toBe('Spend 13 SAR');
  expect(h.calls.every((call) => call.method === 'GET')).toBe(true);
  h.hook.unmount();
  h.client.clear();
});

it('starts a newly accepted operation at the short polling interval despite previous query updates', async () => {
  const h = await recoveryHarness('empty');
  for (let i = 0; i < 6; i += 1)
    h.client.setQueryData(assistantKeys.questionOperation(), null);
  const operation = await h.journal.reserve(
    'owner-a',
    'question',
    { conversationId, question: 'Spend?' },
    'fresh-question-operation'
  );
  await h.journal.update('owner-a', 'question', operation.operationId, {
    phase: 'accepted',
    messageId
  });
  h.showPending();
  await act(async () => {
    await h.client.invalidateQueries({
      queryKey: assistantKeys.questionOperation()
    });
  });
  await h.tick(20);
  expect(h.hook.result.current.data?.phase).toBe('accepted');
  h.setStatus('completed');
  await h.tick(2100);
  expect(h.hook.result.current.data?.phase).toBe('completed');
  expect(h.calls.every((call) => call.method === 'GET')).toBe(true);
  h.hook.unmount();
  h.client.clear();
});

it('releases a pre-reserve authentication timeout so reconnecting can send a new question once', async () => {
  const h = await recoveryHarness('empty');
  const chat = renderWithProviders(
    <AssistantConversationScreen conversationId={conversationId} />
  );
  await h.tick(30);
  h.setAuthStalled(true);
  fireEvent.changeText(
    screen.getByTestId('assistant-composer-input'),
    'First question'
  );
  fireEvent.press(screen.getByTestId('assistant-composer-send-button'));
  await h.tick(100);
  expect(await h.journal.read('owner-a', 'question')).toBeNull();
  expect(screen.getByTestId('assistant-composer-input')).toHaveProp(
    'value',
    'First question'
  );
  h.setAuthStalled(false);
  h.setStatus('completed');
  fireEvent.changeText(
    screen.getByTestId('assistant-composer-input'),
    'New question after reconnect'
  );
  fireEvent.press(screen.getByTestId('assistant-composer-send-button'));
  await h.tick(100);
  expect(
    h.calls
      .filter((call) => call.method === 'POST')
      .map((call) => call.question)
  ).toEqual(['New question after reconnect']);
  expect(screen.getByTestId('assistant-composer-input')).toHaveProp(
    'value',
    ''
  );
  chat.unmount();
  h.hook.unmount();
  h.client.clear();
});

it('acknowledges the actual reused durable operation after a cold-screen send times out and later completes', async () => {
  const h = await recoveryHarness();
  const chat = renderWithProviders(
    <AssistantConversationScreen conversationId={conversationId} />
  );
  fireEvent.changeText(
    screen.getByTestId('assistant-composer-input'),
    'Spend?'
  );
  fireEvent.press(screen.getByTestId('assistant-composer-send-button'));
  await h.tick(66000);
  expect((await h.journal.read('owner-a', 'question'))?.operationId).toBe(
    'delayed-question-operation'
  );
  h.setStatus('completed');
  await h.tick(9000);
  expect(screen.getByText('Spend 13 SAR')).toBeTruthy();
  expect(screen.getByTestId('assistant-composer-input')).toHaveProp(
    'value',
    ''
  );
  expect(h.calls.every((call) => call.method === 'GET')).toBe(true);
  chat.unmount();
  h.hook.unmount();
  h.client.clear();
});

it.each(['completed', 'failed'])(
  'recovers a late %s result from an accepted journal despite an initially empty pending cache, using GET only',
  async (status) => {
    const h = await recoveryHarness();
    expect(h.hook.result.current.data?.phase).toBe('accepted');
    h.setStatus(status);
    await h.tick();
    expect(h.hook.result.current.data?.phase).toBe(status);
    if (status === 'completed')
      expect(
        h.client.getQueryData<any>(assistantKeys.conversation(conversationId))
          .responses.items[0].blocks[0].key
      ).toBe('Spend 13 SAR');
    expect(h.calls.length).toBeGreaterThan(0);
    expect(h.calls.every((call) => call.method === 'GET')).toBe(true);
    const count = h.calls.length;
    await h.tick(20000);
    expect(h.calls).toHaveLength(count);
    h.hook.unmount();
    h.client.clear();
  }
);

it.each(['background', 'offline', 'expired'] as const)(
  'also stops independent pending-conversation polling after %s',
  async (reason) => {
    const h = await recoveryHarness('accepted', true);
    expect(h.calls.length).toBeGreaterThan(0);
    if (reason === 'background') act(() => h.setBackground());
    if (reason === 'offline') {
      h.goOffline();
      await h.tick(9000);
    }
    if (reason === 'expired') await h.tick(5 * 60000 + 9000);
    const count = h.calls.length;
    await h.tick(20000);
    expect(h.calls).toHaveLength(count);
    h.hook.unmount();
    h.client.clear();
  }
);

it.each([
  'background',
  'unmount',
  'offline',
  'expired',
  'owner_changed'
] as const)(
  'stops recovery reads after %s without replacing the accepted question',
  async (reason) => {
    const h = await recoveryHarness();
    expect(h.calls.length).toBeGreaterThan(0);
    expect(h.hook.result.current.data?.phase).toBe('accepted');
    if (reason === 'background') act(() => h.setBackground());
    if (reason === 'unmount') h.hook.unmount();
    if (reason === 'offline') {
      h.goOffline();
      await h.tick();
    }
    if (reason === 'expired') await h.tick(5 * 60000 + 2100);
    if (reason === 'owner_changed') {
      h.switchOwner();
      await h.tick();
    }
    const count = h.calls.length;
    await h.tick(20000);
    expect(h.calls).toHaveLength(count);
    expect(h.calls.every((call) => call.method === 'GET')).toBe(true);
    expect((await h.journal.read('owner-a', 'question'))?.phase).toBe(
      'accepted'
    );
    if (reason !== 'unmount') h.hook.unmount();
    h.client.clear();
  }
);

it('preserves unknown acceptance without an automatic send or status request', async () => {
  const h = await recoveryHarness('prepared');
  await h.tick(20000);
  expect(h.calls).toEqual([]);
  expect(h.hook.result.current.data?.phase).toBe('prepared');
  h.hook.unmount();
  h.client.clear();
});

it('checks an old accepted entry once on reopen while keeping its automatic polling expired', async () => {
  const h = await recoveryHarness();
  h.hook.unmount();
  h.client.clear();
  jest.setSystemTime(Date.now() + 6 * 60000);
  h.setStatus('completed');
  const client = new QueryClient({
    defaultOptions: { queries: { gcTime: Infinity, retry: false } }
  });
  const wrapper = ({ children }: PropsWithChildren) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  const reopened = renderHook(useAssistantQuestionOperation, { wrapper });
  await h.tick(30);
  expect(reopened.result.current.data?.phase).toBe('completed');
  const count = h.calls.length;
  await h.tick(20000);
  expect(h.calls).toHaveLength(count);
  reopened.unmount();
  client.clear();
});
