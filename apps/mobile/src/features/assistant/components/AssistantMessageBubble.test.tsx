import React from 'react';
import { fireEvent, screen } from '@testing-library/react-native';
import { renderWithProviders } from '@/test-utils/render';
import { changeLocale, translateDynamic } from '@/localization/i18n';
import { usePreferenceStore } from '@/state/preferences';
import type { AssistantResponse } from '@/domain/assistant';
import { AssistantMessageBubble } from './AssistantMessageBubble';

function answer(content: string): AssistantResponse {
  return {
    id: 'formatted-answer',
    conversationId: 'formatting-chat',
    question: 'مصروفاتي؟',
    responseType: 'direct',
    blocks: [{ label: 'fact', key: content, values: {} }],
    period: 'current_state',
    dataAsOf: 1,
    snapshot: {
      sources: [],
      values: [],
      completeness: {
        confirmed: 1,
        reviewRequired: 0,
        conflicts: 0,
        reasons: []
      },
      reportReference: null
    },
    limitations: [],
    proposedActionIds: [],
    feedback: null,
    createdAt: 1
  };
}

beforeEach(() => {
  changeLocale('ar');
  usePreferenceStore.setState({ hideBalances: false });
});

it('renders model bold emphasis while preserving signed amounts, currencies and punctuation', () => {
  renderWithProviders(
    <AssistantMessageBubble
      response={answer(
        'آخر معاملة **3.00 SAR**؛ صافي التدفق **-1,234.56 SAR** (١٢٪).'
      )}
    />
  );
  expect(
    screen.getByText('آخر معاملة 3.00 SAR؛ صافي التدفق -1,234.56 SAR (١٢٪).')
  ).toBeTruthy();
  expect(screen.getByText('3.00 SAR')).toHaveStyle({ fontWeight: '700' });
  expect(screen.getByText('-1,234.56 SAR')).toHaveStyle({ fontWeight: '700' });
  expect(screen.queryByText(/\*\*/)).toBeNull();
});

it('retains unmatched markup, arithmetic and link-like content as inert exact text', () => {
  const text =
    '2 * 3 = 6؛ **غير مكتمل؛ [رصيد](https://example.com) <b>5 SAR</b>';
  renderWithProviders(<AssistantMessageBubble response={answer(text)} />);
  expect(screen.getByText(text)).toBeTruthy();
  expect(screen.queryAllByRole('link')).toHaveLength(0);
});

it('masks formatted financial prose until local reveal', () => {
  usePreferenceStore.setState({ hideBalances: true });
  renderWithProviders(
    <AssistantMessageBubble response={answer('مدخراتك **900.00 SAR**')} />
  );
  expect(screen.queryByText(/900\.00/)).toBeNull();
  fireEvent.press(
    screen.getByText(translateDynamic('assistant.action.revealFinancial'))
  );
  expect(screen.getByText('مدخراتك 900.00 SAR')).toBeTruthy();
  expect(usePreferenceStore.getState().hideBalances).toBe(true);
});
