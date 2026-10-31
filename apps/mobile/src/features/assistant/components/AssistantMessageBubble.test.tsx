import React from 'react';
import { fireEvent, screen } from '@testing-library/react-native';
import { renderWithProviders } from '@/test-utils/render';
import { changeLocale, translateDynamic } from '@/localization/i18n';
import { usePreferenceStore } from '@/state/preferences';
import type { AssistantResponse } from '@/domain/assistant';
import { AssistantMessageBubble } from './AssistantMessageBubble';
import { spendingPresentationFixture } from '@/test-utils/assistant-spending-presentation-fixture';
import { ThemeContext } from '@/state/theme-context';
import { resolveTheme } from '@/design-system/theme';

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

it('shows the grounded amount first with dated comparison, explanation and a conditional saving goal', () => {
  const response = Object.assign(answer('Compatible plain text'), {
    spendingSummary: spendingPresentationFixture
  });
  renderWithProviders(<AssistantMessageBubble response={response} />);
  expect(screen.getByTestId('assistant-summary-amount-0')).toHaveTextContent(
    '2,400.00 SAR'
  );
  expect(screen.getByText(/300.00 SAR/)).toBeTruthy();
  expect(screen.getByText('وش نلاحظ؟')).toBeTruthy();
  expect(screen.getByText('خطوة للتوفير')).toBeTruthy();
  expect(screen.getByText('هدف توفير مشروط: 200.00 SAR')).toBeTruthy();
  expect(screen.queryByText('Compatible plain text')).toBeNull();
  fireEvent.press(screen.getByText('تفاصيل أكثر'));
  expect(screen.getByText('Compatible plain text')).toBeTruthy();
});

it('masks all structured financial information and restores it only after local reveal', () => {
  usePreferenceStore.setState({ hideBalances: true });
  renderWithProviders(
    <AssistantMessageBubble
      response={Object.assign(answer('private fallback'), {
        spendingSummary: spendingPresentationFixture
      })}
    />
  );
  expect(screen.queryByText(/2,400|300.00|المطاعم|200.00/)).toBeNull();
  fireEvent.press(
    screen.getByText(translateDynamic('assistant.action.revealFinancial'))
  );
  expect(screen.getByTestId('assistant-summary-amount-0')).toHaveTextContent(
    '2,400.00 SAR'
  );
  expect(usePreferenceStore.getState().hideBalances).toBe(true);
});

it('keeps exact huge values readable and uses the response language without forcing a comparison or saving goal', () => {
  const amount = '-900,719,925,474,099,312.345 KWD';
  const summary = {
    ...spendingPresentationFixture,
    locale: 'en' as const,
    cards: [
      {
        ...spendingPresentationFixture.cards[0]!,
        amount,
        comparison: null,
        explanation: null,
        saving: { text: 'Review Restaurants transactions.', target: null }
      }
    ]
  };
  renderWithProviders(
    <AssistantMessageBubble
      response={Object.assign(answer('fallback'), { spendingSummary: summary })}
    />
  );
  const value = screen.getByTestId('assistant-summary-amount-0');
  expect(value).toHaveTextContent(amount);
  expect(value.props.numberOfLines).toBeUndefined();
  expect(value.props.adjustsFontSizeToFit).toBeUndefined();
  expect(screen.getByText('A saving step')).toBeTruthy();
  expect(screen.queryByText(/Conditional saving target/)).toBeNull();
});

it.each(['light', 'dark'] as const)(
  'keeps the financial amount readable in %s theme',
  (mode) => {
    const theme = resolveTheme(mode);
    renderWithProviders(
      <ThemeContext.Provider value={{ theme }}>
        <AssistantMessageBubble
          response={Object.assign(answer('complete answer'), {
            spendingSummary: spendingPresentationFixture
          })}
        />
      </ThemeContext.Provider>
    );
    expect(screen.getByTestId('assistant-summary-amount-0')).toHaveStyle({
      color: theme.colors.content.primary
    });
  }
);

it('renders the 19 October model object markers as plain financial text', () => {
  renderWithProviders(
    <AssistantMessageBubble
      response={answer(
        'From \uFFFC2026-10-01, expenses were \uFFFC867.24 SAR.'
      )}
    />
  );
  expect(
    screen.getByText('From 2026-10-01, expenses were 867.24 SAR.')
  ).toBeTruthy();
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
