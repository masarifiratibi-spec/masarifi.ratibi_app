import React from 'react';
import { fireEvent, screen } from '@testing-library/react-native';
import { PixelRatio } from 'react-native';
import { renderWithProviders } from '@/test-utils/render';
import { changeLocale, translate } from '@/localization/i18n';
import { AssistantConversationView } from './AssistantConversationView';
import type { AssistantResponse } from '@/domain/assistant';

describe('AssistantConversationView', () => {
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

  it('renders banner, user question bubble, AI response bubble, insight card, and composer', () => {
    const onSendMessage = jest.fn();

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
    fireEvent.press(screen.getByTestId('assistant-composer-send-button'));
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
