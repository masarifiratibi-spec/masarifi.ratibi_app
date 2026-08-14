import React from 'react';
import { act, renderHook } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { createMockVoiceAnalyzerService } from '@/services/mocks/voice-analyzer-service';
import { coreFinanceService } from '@/services/mocks/core-finance-service';
import {
  fixtureProposalGroup,
  fixtureTranscript
} from '@/services/mocks/voice-fixtures';
import { useVoiceCaptureStore } from '@/state/voice-capture';
import type { NotificationSourceEvent } from '@/services/contracts/assistant-notifications-service';
import type { VoiceProposalGroup, VoiceScenario } from '@/domain/voice-capture';
import { useVoiceCapture } from './useVoiceCapture';

const mockCreateFromSource = jest.fn();

jest.mock('@/services/mocks/assistant-notifications-service', () => ({
  assistantNotificationsService: {
    createFromSource: (event: unknown) => mockCreateFromSource(event)
  }
}));

afterEach(() => {
  jest.restoreAllMocks();
  mockCreateFromSource.mockReset();
  useVoiceCaptureStore.getState().reset();
});

it('moves deterministic capture output into transcript then review without saving', async () => {
  const service = createMockVoiceAnalyzerService();
  const store = useVoiceCaptureStore.getState();
  store.reset();
  const transcript = await service.transcribe('private://audio', 'clear_en');
  store.setTranscript(transcript);
  store.transition('transcript_review');
  const group = await service.analyze({
    transcript, scenario: 'clear_en', sessionId: store.id,
    recordedAt: Date.now(), timezoneOffsetMinutes: 0
  });
  store.setGroup(group);
  store.transition('proposal_review');
  expect(useVoiceCaptureStore.getState()).toMatchObject({
    state: 'proposal_review', transcript: expect.objectContaining({ text: expect.any(String) })
  });
});

it('emits central voice outcome notifications once without raw transcript content', async () => {
  const notifications: NotificationSourceEvent[] = [];
  mockCreateFromSource.mockImplementation(async (event: NotificationSourceEvent) => {
    notifications.push(event);
    return { id: `notification-${event.eventKey}`, ...event };
  });
  const finance = jest
    .spyOn(coreFinanceService, 'createTransactionsAtomically')
    .mockResolvedValue({ value: [], affectedScopes: ['transactions.list'] } as never);
  const { result, unmount } = renderVoiceHook();

  let confirmedText = '';
  act(() => {
    confirmedText = seedVoiceSession('clear_en');
  });
  await act(async () => result.current.save());
  await act(async () => result.current.save());

  act(() => {
    seedVoiceSession('low_confidence');
  });
  await act(async () => result.current.save());

  act(() => {
    seedVoiceSession('clear_en', duplicateGroup);
  });
  await act(async () => result.current.save());

  act(() => {
    seedVoiceSession('obligation');
  });
  await act(async () => result.current.save());

  act(() => {
    seedVoiceSession('obligation', confirmedObligationGroup);
  });
  await act(async () => result.current.save());

  act(() => {
    seedVoiceSession('clear_en');
  });
  finance.mockRejectedValueOnce(new Error('offline'));
  await act(async () => result.current.save());

  expect(notifications.map((event) => event.eventKey)).toEqual([
    'voice:group-voice-test-clear_en:saved',
    'voice:group-voice-test-low_confidence:review-required',
    'voice:group-voice-test-clear_en:duplicate',
    'voice:group-voice-test-obligation:saved',
    'voice:group-voice-test-obligation:obligation-link',
    'voice:group-voice-test-clear_en:failed'
  ]);
  expect(JSON.stringify(notifications)).not.toContain(confirmedText);
  expect(
    notifications.filter(
      (event) => event.eventKey === 'voice:group-voice-test-clear_en:saved'
    )
  ).toHaveLength(1);
  unmount();
});

it('keeps owner save truth when notification emission fails and retries review notifications', async () => {
  const notifications: NotificationSourceEvent[] = [];
  mockCreateFromSource
    .mockRejectedValueOnce(new Error('notification offline'))
    .mockImplementation(async (event: NotificationSourceEvent) => {
      notifications.push(event);
      return { id: `notification-${event.eventKey}`, ...event };
    });
  const finance = jest
    .spyOn(coreFinanceService, 'createTransactionsAtomically')
    .mockResolvedValue({ value: [], affectedScopes: [] } as never);
  const { result, unmount } = renderVoiceHook();

  act(() => {
    seedVoiceSession('clear_en');
  });
  await act(async () => result.current.save());
  expect(useVoiceCaptureStore.getState().state).toBe('saved');
  expect(finance).toHaveBeenCalledTimes(1);
  expect(notifications.map((event) => event.eventKey)).toEqual([
    'voice:group-voice-test-clear_en:saved'
  ]);

  notifications.length = 0;
  mockCreateFromSource.mockRejectedValueOnce(new Error('notification offline'));

  act(() => {
    seedVoiceSession('low_confidence');
  });
  await act(async () => result.current.save());
  await act(async () => result.current.save());

  expect(notifications.map((event) => event.eventKey)).toEqual([
    'voice:group-voice-test-low_confidence:review-required'
  ]);
  unmount();
});

function renderVoiceHook() {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false }
    }
  });
  return renderHook(() => useVoiceCapture(), {
    wrapper: ({ children }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    )
  });
}

function seedVoiceSession(
  scenario: VoiceScenario,
  transform: (group: VoiceProposalGroup) => VoiceProposalGroup = (group) => group
) {
  const store = useVoiceCaptureStore.getState();
  const recordedAt = Date.UTC(2026, 7, 8, 12);
  const transcript = fixtureTranscript(scenario, recordedAt);
  store.reset();
  store.setTranscript(transcript);
  store.setGroup(
    transform(fixtureProposalGroup({
      scenario,
      sessionId: 'voice-test',
      recordedAt,
      timezoneOffsetMinutes: 0
    }))
  );
  store.patch({
    startedAt: recordedAt,
    timezoneOffsetMinutes: 0,
    state: 'proposal_review'
  });
  return transcript.text;
}

function duplicateGroup(group: VoiceProposalGroup): VoiceProposalGroup {
  return {
    ...group,
    proposals: group.proposals.map((proposal, index) =>
      index === 0
        ? {
            ...proposal,
            duplicateOfTransactionId: 'transaction-existing'
          }
        : proposal
    )
  };
}

function confirmedObligationGroup(group: VoiceProposalGroup): VoiceProposalGroup {
  return {
    ...group,
    proposals: group.proposals.map((proposal, index) =>
      index === 0 && proposal.recurringSuggestion
        ? {
            ...proposal,
            obligationId: proposal.recurringSuggestion.candidateObligationIds[0],
            recurringSuggestion: {
              ...proposal.recurringSuggestion,
              confirmed: true
            }
          }
        : proposal
    )
  };
}
