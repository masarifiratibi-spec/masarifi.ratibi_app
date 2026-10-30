import React from 'react';
import { act, fireEvent, screen } from '@testing-library/react-native';
import { AppState, PixelRatio, type AppStateStatus } from 'react-native';
import * as ExpoLocalization from 'expo-localization';
import { renderWithProviders } from '@/test-utils/render';
import { changeLocale, translate } from '@/localization/i18n';
import { AssistantConversationView } from './AssistantConversationView';
import type { AssistantResponse } from '@/domain/assistant';

describe('AssistantConversationView', () => {
  it('uses the existing status area for a submission failure and retains the typed question', async () => {
    const onSendMessage = jest.fn(async () => false);
    renderWithProviders(<AssistantConversationView conversationId="conversation-1" responses={[]} onSendMessage={onSendMessage} error="Safe failure" />);
    expect(screen.getByText('Safe failure')).toBeTruthy();
    fireEvent.changeText(screen.getByTestId('assistant-composer-input'), 'Retained question');
    await act(async () => { fireEvent.press(screen.getByTestId('assistant-composer-send-button')); });
    expect(screen.getByTestId('assistant-composer-input').props.value).toBe('Retained question');
  });
  beforeEach(() => {
    changeLocale('ar');
  });

  afterEach(() => jest.restoreAllMocks());

  const mockResponse: AssistantResponse = {
    id: 'response-1',
    conversationId: 'conversation-1',
    question: 'كم أنفقت هذا الشهر؟',
    responseType: 'direct',
    blocks: [
      { label: 'fact', key: 'assistant.answer.direct', values: {} }
    ],
    period: 'monthly:2026-05-01',
    dataAsOf: Date.now(),
    snapshot: {
      sources: [{ kind: 'report', id: 'report-1', version: 1 }],
      values: [
        { key: 'assistant.context.report.expense', minor: 425000, currency: 'SAR', status: 'available' }
      ],
      completeness: { confirmed: 1, reviewRequired: 0, conflicts: 0, reasons: [] },
      reportReference: 'report-1'
    },
    limitations: [],
    proposedActionIds: [],
    feedback: null,
    createdAt: Date.now()
  };

  it('refreshes both message clocks from the device hour preference after foregrounding', () => {
    changeLocale('en');
    const calendar = { calendar: ExpoLocalization.CalendarIdentifier.GREGORY, timeZone: 'UTC', firstWeekday: 1, uses24hourClock: true };
    const calendars = jest.spyOn(ExpoLocalization, 'getCalendars').mockReturnValue([calendar]);
    const lifecycle = jest.spyOn(AppState, 'addEventListener');
    const timestamp = new Date(2026, 7, 9, 15, 5).getTime();
    renderWithProviders(<AssistantConversationView conversationId="clock-check"
      responses={[{...mockResponse, conversationId: 'clock-check', createdAt: timestamp, requestCreatedAt: timestamp}]}
      onSendMessage={jest.fn()} />);
    expect(screen.getAllByText('15:05')).toHaveLength(2);
    calendars.mockReturnValue([{...calendar, uses24hourClock: false}]);
    act(() => {
      for (const [event, listener] of lifecycle.mock.calls) {
        if (event === 'change') (listener as (state: AppStateStatus) => void)('active');
      }
    });
    expect(screen.getAllByText('03:05 PM')).toHaveLength(2);
  });

  it('renders banner, user question bubble, AI response bubble, insight card, and composer', async () => {
    const onSendMessage = jest.fn(async () => true);

    renderWithProviders(
      <AssistantConversationView
        conversationId="conversation-1"
        responses={[mockResponse]}
        onSendMessage={onSendMessage}
      />
    );

    expect(screen.getByTestId('assistant-header-banner')).toBeTruthy();
    expect(screen.getAllByText('كم أنفقت هذا الشهر؟').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(translate('assistant.answer.direct'))).toBeTruthy();
    expect(screen.getByTestId('financial-insight-card')).toBeTruthy();
    expect(screen.getByTestId('assistant-composer')).toBeTruthy();

    // Type in composer and send
    fireEvent.changeText(
      screen.getByTestId('assistant-composer-input'),
      'ما هي خطة الادخار؟'
    );
    await act(async () => { fireEvent.press(screen.getByTestId('assistant-composer-send-button')); });
    expect(onSendMessage).toHaveBeenCalledWith('ما هي خطة الادخار؟');
  });

  it('handles follow up suggestion press', () => {
    const onSendMessage = jest.fn();

    renderWithProviders(
      <AssistantConversationView
        conversationId="conversation-1"
        responses={[mockResponse]}
        onSendMessage={onSendMessage}
      />
    );

    fireEvent.press(screen.getByTestId('follow-up-highest'));
    expect(onSendMessage).toHaveBeenCalledWith(
      translate('assistant.suggestions.highest')
    );
  });

  it('shows thinking indicator when isSending is true', () => {
    renderWithProviders(
      <AssistantConversationView
        conversationId="conversation-1"
        responses={[mockResponse]}
        onSendMessage={jest.fn()}
        isSending
      />
    );

    expect(screen.getByTestId('assistant-thinking-indicator')).toBeTruthy();
  });

  it.each(['ar', 'en'] as const)(
    'stacks the conversation banner at 200%% text in %s',
    (locale) => {
      jest.spyOn(PixelRatio, 'getFontScale').mockReturnValue(2);
      changeLocale(locale);
      renderWithProviders(
        <AssistantConversationView
          conversationId="conversation-1"
          responses={[]}
          onSendMessage={jest.fn()}
        />
      );

      expect(screen.getByTestId('assistant-header-banner')).toHaveStyle({
        alignItems: 'stretch',
        flexDirection: 'column'
      });
      expect(
        screen.getByText(translate('assistant.chat.banner.subtitle')).props
          .numberOfLines
      ).toBeUndefined();
    }
  );
});
