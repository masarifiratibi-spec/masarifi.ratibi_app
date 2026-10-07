import React from 'react';
import { fireEvent, screen } from '@testing-library/react-native';
import { renderWithProviders } from '@/test-utils/render';
import { changeLocale, translateDynamic as t } from '@/localization/i18n';
import { usePreferenceStore } from '@/state/preferences';
import { AssistantLanding } from './AssistantLanding';
import { AssistantConversationView } from './AssistantConversationView';
import { AssistantMessageBubble } from './components/AssistantMessageBubble';
import type { AssistantResponse } from '@/domain/assistant';
import { BackHandler, Keyboard } from 'react-native';
import {
  assistantCapabilityState,
  AssistantQuestionRecovery
} from './AssistantFunctionalStatus';
import { mergeAssistantRows } from './AssistantHomeScreen';
import { FinancialInsightCard } from './components/FinancialInsightCard';

const response: AssistantResponse = {
  id: 'sample-answer',
  conversationId: 'sample-chat',
  question: 'Sample spending?',
  responseType: 'direct',
  blocks: [{ label: 'fact', key: 'Sample expenses 270.00 SAR', values: {} }],
  period: '2026-10-01/2026-10-31',
  dataAsOf: Date.parse('2026-10-07T06:00:00Z'),
  snapshot: {
    sources: [
      {
        kind: 'ledger',
        id: 'LEDGER-1',
        version: 9,
        asOf: '2026-10-07T06:00:00Z'
      }
    ],
    values: [
      {
        key: 'expense',
        exactMinor: '27000',
        currency: 'SAR',
        status: 'available'
      }
    ],
    completeness: {
      confirmed: 1,
      reviewRequired: 0,
      conflicts: 0,
      reasons: []
    },
    reportReference: null
  },
  limitations: ['next_installment_only'],
  proposedActionIds: [],
  feedback: null,
  createdAt: Date.parse('2026-10-07T06:01:00Z')
};

beforeEach(() => {
  changeLocale('en');
  usePreferenceStore.setState({ hideBalances: false });
});
afterEach(() => jest.restoreAllMocks());

it('preserves loaded older rows across a new latest-page result and deduplicates updates', () => {
  const older = [
    { id: 'old', createdAt: 1, content: 'old' },
    { id: 'new', createdAt: 2, content: 'pending' }
  ];
  const merged = mergeAssistantRows(older, [
    { id: 'new', createdAt: 2, content: 'complete' },
    { id: 'latest', createdAt: 3, content: 'latest' }
  ]);
  expect(merged.map((row) => [row.id, row.content])).toEqual([
    ['old', 'old'],
    ['new', 'complete'],
    ['latest', 'latest']
  ]);
});

it('uses Back first to dismiss the keyboard and then leave the conversation', () => {
  const back = jest.fn();
  const visible = jest.spyOn(Keyboard, 'isVisible').mockReturnValue(true);
  const dismiss = jest.spyOn(Keyboard, 'dismiss');
  let pressBack = () => false;
  jest
    .spyOn(BackHandler, 'addEventListener')
    .mockImplementation((_event, callback) => {
      pressBack = callback as () => boolean;
      return { remove: jest.fn() };
    });
  renderWithProviders(
    <AssistantConversationView
      conversationId="sample-chat"
      responses={[]}
      onSendMessage={jest.fn()}
      onBack={back}
    />
  );
  pressBack();
  expect(dismiss).toHaveBeenCalledTimes(1);
  expect(back).not.toHaveBeenCalled();
  visible.mockReturnValue(false);
  pressBack();
  expect(back).toHaveBeenCalledTimes(1);
});

it('shows unknown recovery with a distinct status check and explicit same-operation retry', () => {
  const check = jest.fn(),
    retry = jest.fn();
  renderWithProviders(
    <AssistantQuestionRecovery
      operation={{
        operationId: 'sample-operation',
        question: 'Sample question',
        conversationId: null,
        messageId: null,
        phase: 'prepared'
      }}
      onCheck={check}
      onRetry={retry}
    />
  );
  expect(screen.queryByText('Sample question')).toBeNull();
  expect(screen.queryByText(t('assistant.operation.title'))).toBeNull();
  fireEvent.press(screen.getByText(t('assistant.operation.check')));
  expect(check).toHaveBeenCalledTimes(1);
  expect(retry).not.toHaveBeenCalled();
  fireEvent.press(screen.getByText(t('assistant.operation.retrySame')));
  expect(retry).toHaveBeenCalledTimes(1);
});

it('separates available financial reads from disabled advice and unknown actions', () => {
  expect(
    assistantCapabilityState({
      status: 'disabled',
      remainingQuestions: 10,
      capabilities: {
        directRead: 'available',
        provider: 'disabled',
        actions: 'unknown'
      }
    })
  ).toEqual({
    directRead: 'available',
    provider: 'disabled',
    actions: 'unknown'
  });
});

it('masks insight trends as well as amounts and categories', () => {
  usePreferenceStore.setState({ hideBalances: true });
  renderWithProviders(
    <FinancialInsightCard
      totalMinor={27000}
      categoryName="Sample private category"
      categoryMinor={1000}
      trendPercentage={8}
    />
  );
  expect(screen.queryByText('%8')).toBeNull();
  expect(screen.queryByText('Sample private category')).toBeNull();
});

it('restores the original landing without a new history card', () => {
  const select = jest.fn();
  renderWithProviders(
    <AssistantLanding
      onAskQuestion={jest.fn()}
      onEnableConsent={jest.fn()}
      conversations={[{ id: 'sample-chat', title: 'Sample history' }]}
      onSelectConversation={select}
    />
  );
  expect(screen.queryByText('Sample history')).toBeNull();
  expect(screen.queryByText(t('assistant.history.title'))).toBeNull();
  expect(select).not.toHaveBeenCalled();
});

it('renders pending and failed questions without requiring an answer', () => {
  renderWithProviders(
    <AssistantConversationView
      conversationId="sample-chat"
      responses={[]}
      onSendMessage={jest.fn()}
      userTurns={[
        {
          id: 'sample-pending',
          content: 'Sample pending question',
          status: 'queued',
          createdAt: 1
        },
        {
          id: 'sample-failed',
          content: 'Sample failed question',
          status: 'failed',
          createdAt: 2
        }
      ]}
    />
  );
  expect(screen.getByText('Sample pending question')).toBeTruthy();
  expect(screen.getByText('Sample failed question')).toBeTruthy();
  expect(screen.getByText(t('assistant.messageStatus.failed'))).toBeTruthy();
});

it('retains evidence internally without adding new answer fields and explains limitations', () => {
  renderWithProviders(<AssistantMessageBubble response={response} />);
  expect(response.period).toBe('2026-10-01/2026-10-31');
  expect(response.snapshot.sources[0]).toMatchObject({
    id: 'LEDGER-1',
    version: 9
  });
  expect(screen.queryByText(t('assistant.evidence.title'))).toBeNull();
  expect(screen.queryByText('next_installment_only')).toBeNull();
  expect(
    screen.getByText(t('assistant.limitation.next_installment_only'))
  ).toBeTruthy();
});

it('masks financial prose and reveals locally without altering global masking', () => {
  usePreferenceStore.setState({ hideBalances: true });
  renderWithProviders(<AssistantMessageBubble response={response} />);
  expect(screen.queryByText('Sample expenses 270.00 SAR')).toBeNull();
  fireEvent.press(screen.getByText(t('assistant.action.revealFinancial')));
  expect(screen.getByText('Sample expenses 270.00 SAR')).toBeTruthy();
  expect(usePreferenceStore.getState().hideBalances).toBe(true);
});

it('sends ordinary negative feedback without filing a report', () => {
  const feedback = jest.fn();
  renderWithProviders(
    <AssistantMessageBubble response={response} onFeedback={feedback} />
  );
  fireEvent.press(screen.getByLabelText(t('assistant.feedback.notHelpful')));
  expect(feedback).toHaveBeenCalledWith('not_helpful');
  expect(feedback).not.toHaveBeenCalledWith('reported');
});

it('masks landing insight amounts when financial values are hidden', () => {
  usePreferenceStore.setState({ hideBalances: true });
  renderWithProviders(
    <AssistantLanding
      onAskQuestion={jest.fn()}
      onEnableConsent={jest.fn()}
      insight={{
        id: 'sample-insight',
        kind: 'budget_threshold',
        budgetName: 'Sample private budget 300 SAR',
        currency: 'SAR',
        spentMinor: 27000,
        budgetMinor: 30000,
        remainingMinor: 3000,
        utilizationBps: 9000,
        createdAt: 1,
        expiresAt: Date.now() + 10000
      }}
    />
  );
  expect(screen.queryByText('270.00 SAR')).toBeNull();
  expect(screen.queryByText('Sample private budget 300 SAR')).toBeNull();
});

it('explains that a failed recovery check has not established the outcome', () => {
  renderWithProviders(<AssistantQuestionRecovery error onCheck={jest.fn()} />);
  expect(screen.getByText(t('assistant.operation.checkFailed'))).toBeTruthy();
});
