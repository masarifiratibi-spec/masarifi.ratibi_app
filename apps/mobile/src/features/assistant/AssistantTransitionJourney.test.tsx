import {
  AssistantHomeScreen,
  AssistantConversationScreen
} from './AssistantHomeScreen';
import React from 'react';
import {
  act,
  fireEvent,
  screen,
  waitFor,
  within
} from '@testing-library/react-native';
import { renderWithProviders } from '@/test-utils/render';
import { changeLocale } from '@/localization/i18n';
import { usePreferenceStore } from '@/state/preferences';
import { router } from 'expo-router';
import { BackHandler, Keyboard } from 'react-native';

const mockAssistantQueries = jest.requireMock<Record<string, jest.Mock>>(
  './assistant-queries'
);

jest.mock('expo-router', () => ({
  router: {
    push: jest.fn(),
    navigate: jest.fn(),
    back: jest.fn(),
    canGoBack: jest.fn(),
    replace: jest.fn()
  },
  useLocalSearchParams: () => ({ conversationId: 'conv-101' })
}));
jest.mock('./assistant-queries', () => ({
  useAssistantConsent: jest.fn(),
  useAssistantInsights: jest.fn(),
  useSetAssistantConsent: jest.fn(),
  useCreateAssistantConversation: jest.fn(),
  useAssistantConversations: jest.fn(),
  useAssistantConversation: jest.fn(),
  useAskAssistant: jest.fn(),
  useRenameAssistantConversation: jest.fn(),
  useDeleteAssistantConversation: jest.fn(),
  useAssistantFeedback: jest.fn(),
  useAssistantAvailability: jest.fn(),
  useAssistantQuestionOperation: jest.fn(),
  useResumeAssistantQuestion: jest.fn(),
  useRetryAssistantQuestion: jest.fn()
}));

describe('Assistant Transition & Chat Journey', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAssistantQueries.useAssistantAvailability.mockReturnValue({
      data: undefined
    });
    mockAssistantQueries.useAssistantQuestionOperation.mockReturnValue({
      data: null
    });
    mockAssistantQueries.useResumeAssistantQuestion.mockReturnValue({
      isError: false
    });
    mockAssistantQueries.useRetryAssistantQuestion.mockReturnValue({
      isError: false
    });
    changeLocale('ar');
    mockAssistantQueries.useAssistantInsights.mockReturnValue({ data: [] });
    usePreferenceStore.setState({ hideBalances: false });

    mockAssistantQueries.useAssistantConsent.mockReturnValue({
      data: {
        status: 'enabled',
        disclosedDataCategories: ['transactions', 'planning', 'reports'],
        consentedAt: 1000,
        disabledAt: null,
        version: 1
      },
      isLoading: false,
      isError: false
    });
    mockAssistantQueries.useSetAssistantConsent.mockReturnValue({
      mutate: jest.fn()
    });
    mockAssistantQueries.useCreateAssistantConversation.mockReturnValue({
      mutate: jest.fn(),
      error: null
    });
    mockAssistantQueries.useAssistantConversations.mockReturnValue({
      data: { items: [], nextCursor: null, total: 0 },
      isLoading: false,
      isError: false
    });
    mockAssistantQueries.useAssistantConversation.mockReturnValue({
      data: {
        conversation: {
          id: 'conv-101',
          title: 'استفسار مالي',
          status: 'active',
          createdAt: 1,
          updatedAt: 2,
          lastResponseId: 'resp-101',
          version: 1
        },
        responses: {
          items: [
            {
              id: 'resp-101',
              conversationId: 'conv-101',
              question: 'كم صرفت هالشهر؟',
              responseType: 'direct',
              blocks: [
                { label: 'fact', key: 'assistant.answer.direct', values: {} }
              ],
              period: 'monthly:2026-05-01',
              dataAsOf: 1,
              snapshot: {
                sources: [{ kind: 'report', id: 'report-1', version: 1 }],
                values: [
                  {
                    key: 'assistant.context.report.expense',
                    minor: 425000,
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
                reportReference: 'report-1'
              },
              limitations: [],
              proposedActionIds: [],
              feedback: null,
              createdAt: 1
            }
          ],
          nextCursor: null,
          total: 1
        }
      },
      isLoading: false,
      isError: false
    });
    mockAssistantQueries.useAskAssistant.mockReturnValue({
      mutate: jest.fn(),
      isPending: false
    });
    mockAssistantQueries.useRenameAssistantConversation.mockReturnValue({
      mutate: jest.fn(),
      isPending: false
    });
    mockAssistantQueries.useDeleteAssistantConversation.mockReturnValue({
      mutate: jest.fn(),
      isPending: false
    });
    mockAssistantQueries.useAssistantFeedback.mockReturnValue({
      mutate: jest.fn(),
      isPending: false,
      isError: false
    });
  });

  it('transitions from landing to active chat when first question is asked', () => {
    let successCallback: ((res: { value: { id: string } }) => void) | undefined;
    const createConversationMock = jest.fn((_payload, options) => {
      successCallback = options?.onSuccess;
    });
    mockAssistantQueries.useCreateAssistantConversation.mockReturnValue({
      mutate: createConversationMock,
      error: null
    });

    renderWithProviders(<AssistantHomeScreen />);

    // Initially in Landing State (Reference 1)
    expect(screen.getByTestId('assistant-hero')).toBeTruthy();
    expect(screen.getByTestId('assistant-ask-card')).toBeTruthy();

    // User types question and submits
    fireEvent.changeText(
      screen.getByTestId('assistant-ask-input'),
      'كم صرفت هالشهر؟'
    );
    fireEvent.press(screen.getByTestId('assistant-ask-submit-button'));

    expect(createConversationMock).toHaveBeenCalledWith(
      expect.objectContaining({ question: 'كم صرفت هالشهر؟' }),
      expect.anything()
    );

    // Simulate mutation success and verify seamless in-place transition
    act(() => {
      successCallback?.({ value: { id: 'conv-101' } });
    });

    expect(router.push).not.toHaveBeenCalled();
    expect(screen.getByTestId('assistant-conversation-view')).toBeTruthy();
    expect(screen.queryByTestId('assistant-ask-card')).toBeNull();
  });

  it('DEF-019 keeps the quick question visible through loading and returns Back to the landing', async () => {
    let accepted: ((result: { value: { id: string } }) => void) | undefined;
    mockAssistantQueries.useCreateAssistantConversation.mockReturnValue({
      mutate: (_payload: unknown, options: { onSuccess: typeof accepted }) => {
        accepted = options.onSuccess;
      },
      error: null
    });
    const loadedConversation = mockAssistantQueries.useAssistantConversation();
    mockAssistantQueries.useAssistantConversation.mockReturnValue({
      data: undefined,
      isPending: true,
      isLoading: true
    });
    let refresh!: () => void;
    let back: (() => boolean | null | undefined) | undefined;
    const listener = jest
      .spyOn(BackHandler, 'addEventListener')
      .mockImplementation((_event, callback) => {
        back = callback;
        return { remove: jest.fn() };
      });
    const keyboard = jest.spyOn(Keyboard, 'isVisible').mockReturnValue(false);
    function RefreshableHome() {
      const [, setVersion] = React.useState(0);
      refresh = () => setVersion((version) => version + 1);
      return <AssistantHomeScreen />;
    }
    renderWithProviders(<RefreshableHome />);
    fireEvent.press(screen.getByTestId('suggestion-card-spending'));
    expect(
      within(screen.getByTestId('user-message-bubble')).getByText(
        'كم صرفت هالشهر؟'
      )
    ).toBeTruthy();
    await act(async () => {
      accepted?.({ value: { id: 'conv-101' } });
    });
    expect(router.push).not.toHaveBeenCalled();
    expect(screen.queryByTestId('assistant-landing')).toBeNull();
    expect(screen.getByText('كم صرفت هالشهر؟')).toBeTruthy();
    expect(screen.getByTestId('assistant-composer-input')).toHaveProp(
      'editable',
      false
    );
    mockAssistantQueries.useAssistantConversation.mockReturnValue(
      loadedConversation
    );
    await act(async () => {
      refresh();
    });
    await waitFor(() => {
      expect(screen.getAllByTestId('user-message-bubble')).toHaveLength(1);
    });
    expect(
      within(screen.getByTestId('user-message-bubble')).getByText(
        'كم صرفت هالشهر؟'
      )
    ).toBeTruthy();
    expect(screen.getByTestId('assistant-composer-input')).toHaveProp(
      'editable',
      true
    );
    act(() => {
      expect(back?.()).toBe(true);
    });
    expect(screen.getByTestId('assistant-hero')).toBeTruthy();
    expect(router.back).not.toHaveBeenCalled();
    listener.mockRestore();
    keyboard.mockRestore();
  });

  it('masks financial insight amounts when hideBalances is enabled', () => {
    usePreferenceStore.setState({ hideBalances: true });

    renderWithProviders(
      <AssistantHomeScreen initialConversationId="conv-101" />
    );

    expect(screen.getByTestId('financial-insight-card')).toBeTruthy();
    expect(screen.getAllByText(/•••• SAR/).length).toBeGreaterThanOrEqual(1);
  });

  it.each(['success', 'error'] as const)(
    'clears the composer only after a confirmed send %s',
    async (outcome) => {
      let callbacks:
        { onSuccess?: () => void; onError?: () => void } | undefined;
      mockAssistantQueries.useAskAssistant.mockReturnValue({
        mutate: (_input: unknown, options: typeof callbacks) => {
          callbacks = options;
        },
        isPending: false
      });
      renderWithProviders(
        <AssistantConversationScreen conversationId="conv-101" />
      );
      fireEvent.changeText(
        screen.getByTestId('assistant-composer-input'),
        'إيه آخر معاملة؟'
      );
      fireEvent.press(screen.getByTestId('assistant-composer-send-button'));
      expect(screen.getByTestId('assistant-composer-input')).toHaveProp(
        'value',
        'إيه آخر معاملة؟'
      );
      await act(async () => {
        if (outcome === 'success') callbacks?.onSuccess?.();
        else callbacks?.onError?.();
      });
      expect(screen.getByTestId('assistant-composer-input')).toHaveProp(
        'value',
        outcome === 'success' ? '' : 'إيه آخر معاملة؟'
      );
    }
  );

  it.each([false, true])(
    'acknowledges a timed-out original only after its journal completes, preserving an edited draft=%s',
    async (edited) => {
      let input: { operationId: string; question: string } | undefined;
      const submitted: string[] = [];
      let callbacks:
        | {
            onError?: (error: {
              code: string;
              questionOperationId?: string;
            }) => void;
          }
        | undefined;
      let operation: unknown = null;
      let refresh!: () => void;
      const reset = jest.fn();
      mockAssistantQueries.useAskAssistant.mockReturnValue({
        mutate: (value: typeof input, options: typeof callbacks) => {
          input = value;
          submitted.push(value!.question);
          callbacks = options;
        },
        isPending: false,
        isError: true,
        error: { code: 'still_processing' },
        reset
      });
      mockAssistantQueries.useAssistantQuestionOperation.mockImplementation(
        () => ({ data: operation })
      );
      function RefreshableChat() {
        const [, setVersion] = React.useState(0);
        refresh = () => setVersion((value) => value + 1);
        return <AssistantConversationScreen conversationId="conv-101" />;
      }
      renderWithProviders(<RefreshableChat />);
      fireEvent.changeText(
        screen.getByTestId('assistant-composer-input'),
        'إيه آخر معاملة؟'
      );
      fireEvent.press(screen.getByTestId('assistant-composer-send-button'));
      await act(async () => {
        callbacks?.onError?.({
          code: 'still_processing',
          questionOperationId: input?.operationId
        });
      });
      fireEvent.press(screen.getByTestId('follow-up-highest'));
      expect(submitted).toEqual(['إيه آخر معاملة؟']);
      if (edited)
        fireEvent.changeText(
          screen.getByTestId('assistant-composer-input'),
          'سؤال جديد'
        );
      await act(async () => {
        operation = {
          operationId: input?.operationId,
          phase: 'completed',
          conversationId: 'conv-101'
        };
        refresh();
      });
      expect(screen.getByTestId('assistant-composer-input')).toHaveProp(
        'value',
        edited ? 'سؤال جديد' : ''
      );
      expect(reset).toHaveBeenCalledTimes(1);
    }
  );

  it('allows consent while direct financial questions are disabled', () => {
    const enable = jest.fn();
    mockAssistantQueries.useAssistantConsent.mockReturnValue({
      data: { status: 'disabled', version: 2 }
    });
    mockAssistantQueries.useSetAssistantConsent.mockReturnValue({
      mutate: enable
    });
    mockAssistantQueries.useAssistantAvailability.mockReturnValue({
      data: {
        capabilities: {
          directRead: 'disabled',
          provider: 'disabled',
          actions: 'disabled'
        }
      }
    });
    renderWithProviders(<AssistantHomeScreen />);
    fireEvent.press(screen.getByTestId('assistant-consent-enable-button'));
    expect(enable).toHaveBeenCalledWith(
      expect.objectContaining({ enabled: true, expectedVersion: 2 })
    );
  });

  it('shows the first typed question in the original chat before creation is acknowledged', () => {
    const create = jest.fn();
    mockAssistantQueries.useCreateAssistantConversation.mockReturnValue({
      mutate: create
    });
    renderWithProviders(<AssistantHomeScreen />);
    fireEvent.changeText(
      screen.getByTestId('assistant-ask-input'),
      'Sample safe spending?'
    );
    fireEvent.press(screen.getByTestId('assistant-ask-submit-button'));
    expect(screen.getByTestId('assistant-conversation-view')).toBeTruthy();
    expect(screen.getByText('Sample safe spending?')).toBeTruthy();
    expect(create).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('assistant.capability.title')).toBeNull();
  });

  it('shows a new pending chat turn even while the journal query still holds the preceding completed question', () => {
    const data = mockAssistantQueries.useAssistantConversation().data;
    data.userTurns = [
      {
        id: 'previous-request',
        content: 'Previous question',
        createdAt: 1,
        status: 'completed'
      }
    ];
    data.responses.items[0].requestMessageId = 'previous-request';
    mockAssistantQueries.useAssistantQuestionOperation.mockReturnValue({
      data: {
        operationId: 'previous-operation',
        messageId: 'previous-request',
        phase: 'completed',
        conversationId: 'conv-101'
      }
    });
    const ask = jest.fn();
    mockAssistantQueries.useAskAssistant.mockReturnValue({
      mutate: ask,
      isPending: false
    });
    renderWithProviders(
      <AssistantHomeScreen initialConversationId="conv-101" />
    );
    fireEvent.changeText(
      screen.getByTestId('assistant-composer-input'),
      'New typed financial question'
    );
    fireEvent.press(screen.getByTestId('assistant-composer-send-button'));
    expect(ask).toHaveBeenCalledTimes(1);
    expect(screen.getByText('New typed financial question')).toBeTruthy();
  });

  it('resumes an unresolved original with deduplicating navigation and zero replacement questions', () => {
    const create = jest.fn();
    mockAssistantQueries.useCreateAssistantConversation.mockReturnValue({
      mutate: create
    });
    mockAssistantQueries.useAssistantQuestionOperation.mockReturnValue({
      data: {
        operationId: 'sample-original-key',
        phase: 'created',
        question: 'Sample original?',
        conversationId: 'sample-original-conversation'
      }
    });
    renderWithProviders(<AssistantHomeScreen />);
    fireEvent.press(screen.getByText('كم صرفت هالشهر؟'));
    fireEvent.press(screen.getByText('كم صرفت هالشهر؟'));
    expect(router.navigate).toHaveBeenCalledWith(
      '/assistant/sample-original-conversation'
    );
    expect(create).not.toHaveBeenCalled();
  });

  it('does not retain an earlier recovery failure after the original question completed', () => {
    mockAssistantQueries.useAssistantQuestionOperation.mockReturnValue({
      data: {
        operationId: 'recovered-operation',
        phase: 'completed',
        conversationId: 'conv-101'
      }
    });
    mockAssistantQueries.useResumeAssistantQuestion.mockReturnValue({
      isError: true
    });
    renderWithProviders(
      <AssistantHomeScreen initialConversationId="conv-101" />
    );
    expect(screen.queryByTestId('assistant-inline-recovery')).toBeNull();
  });

  it.each(['check', 'retry'] as const)(
    'clears the failed send only after successful original-operation %s',
    (action) => {
      const reset = jest.fn();
      mockAssistantQueries.useAskAssistant.mockReturnValue({
        mutate: jest.fn(),
        isPending: false,
        isError: true,
        error: { code: 'outcome_unknown' },
        reset
      });
      mockAssistantQueries.useAssistantQuestionOperation.mockReturnValue({
        data: {
          operationId: 'original-recovery-operation',
          phase: 'prepared',
          conversationId: 'conv-101',
          question: 'Sample income question?'
        }
      });
      let callbacks: { onSuccess?: () => void } | undefined;
      const mutate = jest.fn((_input, options) => {
        callbacks = options;
      });
      if (action === 'check')
        mockAssistantQueries.useResumeAssistantQuestion.mockReturnValue({
          mutate
        });
      else
        mockAssistantQueries.useRetryAssistantQuestion.mockReturnValue({
          mutate
        });
      renderWithProviders(
        <AssistantHomeScreen initialConversationId="conv-101" />
      );
      fireEvent.press(
        screen.getByText(
          action === 'check'
            ? 'التحقق من حالة السؤال'
            : 'إعادة محاولة العملية الأصلية'
        )
      );
      expect(mutate).toHaveBeenCalledTimes(1);
      expect(reset).not.toHaveBeenCalled();
      act(() => callbacks?.onSuccess?.());
      expect(reset).toHaveBeenCalledTimes(1);
    }
  );

  it.each([false, true])(
    'handles native Back from a conversation with router history=%s',
    (hasHistory) => {
      let back: (() => boolean | null | undefined) | undefined;
      const listener = jest
        .spyOn(BackHandler, 'addEventListener')
        .mockImplementation((_event, callback) => {
          back = callback;
          return { remove: jest.fn() };
        });
      const keyboard = jest.spyOn(Keyboard, 'isVisible').mockReturnValue(false);
      jest.mocked(router.canGoBack).mockReturnValue(hasHistory);
      renderWithProviders(
        <AssistantConversationScreen conversationId="conv-101" />
      );
      act(() => {
        expect(back?.()).toBe(true);
      });
      if (hasHistory) expect(router.back).toHaveBeenCalledTimes(1);
      else {
        expect(router.back).not.toHaveBeenCalled();
        expect(router.replace).toHaveBeenCalledWith('/assistant');
      }
      listener.mockRestore();
      keyboard.mockRestore();
    }
  );
});
