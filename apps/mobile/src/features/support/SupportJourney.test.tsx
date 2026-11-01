import React from 'react';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';

import { renderWithProviders } from '@/test-utils/render';
import { changeLocale, translateDynamic as t } from '@/localization/i18n';

jest.mock('expo-crypto', () => ({
  randomUUID: () => '11111111-1111-4111-8111-111111111111'
}));

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn(), replace: jest.fn() },
  useLocalSearchParams: () => ({})
}));

jest.mock('./support-queries', () => ({
  useArticleSearch: jest.fn(),
  useSupportDraftQuery: jest.fn(),
  useSaveSupportDraft: jest.fn(),
  useSubmitSupportDraft: jest.fn(),
  useDiscardSupportDraft: jest.fn()
}));

jest.mock('./useSupportDraft', () => ({ useSupportDraft: jest.fn() }));

// eslint-disable-next-line @typescript-eslint/no-var-requires
const mockQueries = require('./support-queries') as Record<string, jest.Mock>;
// eslint-disable-next-line @typescript-eslint/no-var-requires
const mockDraft = require('./useSupportDraft') as {
  useSupportDraft: jest.Mock;
};
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { SupportHomeScreen } = require('./SupportHomeScreen') as {
  SupportHomeScreen: React.ComponentType;
};
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { SupportFormScreen } = require('./SupportFormScreen') as {
  SupportFormScreen: React.ComponentType<{ mode?: string }>;
};

beforeEach(() => {
  jest.clearAllMocks();
  changeLocale('en');
  mockQueries.useArticleSearch.mockReturnValue({
    data: articles(),
    isLoading: false,
    isError: false
  });
  mockQueries.useSaveSupportDraft.mockReturnValue({
    mutateAsync: jest.fn(async (draft) => draft),
    isPending: false
  });
  mockQueries.useSubmitSupportDraft.mockReturnValue({
    mutateAsync: jest.fn(async () => ({ value: { ticketId: null } })),
    isPending: false,
    isError: false
  });
  mockDraft.useSupportDraft.mockReturnValue({
    values: {
      category: 'technical',
      subject: '',
      description: '',
      context: null
    },
    update: jest.fn(),
    discard: jest.fn(),
    retrySave: jest.fn(),
    markSubmitted: jest.fn(),
    safeFailure: null,
    draftReady: true
  });
});

test('support home directly renders contact support form in Arabic and English', () => {
  renderWithProviders(<SupportHomeScreen />);

  expect(screen.getByText(t('support.form.title'))).toBeTruthy();
  expect(screen.getByText(t('support.form.category'))).toBeTruthy();
  expect(screen.getByText(t('support.form.submit'))).toBeTruthy();
});

test('opens feedback history after a confirmed feedback submission without creating a ticket conversation', async () => {
  const original = mockDraft.useSupportDraft.getMockImplementation()!();
  mockDraft.useSupportDraft.mockReturnValue({ ...original, values: { ...original.values, category: 'feedback', subject: 'My feedback', description: 'Original feedback text' } });
  const submit = jest.fn(async () => ({ value: { ticketId: null, kind: 'feedback' } }));
  mockQueries.useSubmitSupportDraft.mockReturnValue({ mutateAsync: submit, isPending: false });
  renderWithProviders(<SupportHomeScreen />);
  fireEvent.press(screen.getByRole('button', { name: t('support.form.submit') }));
  await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/support/feedback'));
  expect(submit).toHaveBeenCalledTimes(1);
  expect(router.back).not.toHaveBeenCalled();
});

test('support form validates, flushes latest draft before submit, reviews/removes optional context, and excludes attachments', async () => {
  const update = jest.fn();
  const save = jest.fn(async (draft) => draft);
  const markSubmitted = jest.fn();
  const submit = jest.fn(async () => ({ value: { ticketId: null } }));
  mockQueries.useSaveSupportDraft.mockReturnValue({
    mutateAsync: save,
    isPending: false
  });
  mockQueries.useSubmitSupportDraft.mockReturnValue({
    mutateAsync: submit,
    isPending: false,
    isError: true
  });
  mockDraft.useSupportDraft.mockReturnValue({
    values: transactionReportDraft(),
    update,
    discard: jest.fn(),
    retrySave: jest.fn(),
    markSubmitted,
    safeFailure: 'offline',
    draftReady: true
  });

  renderWithProviders(<SupportFormScreen mode="transaction_report" />);

  expect(
    screen.getByLabelText(
      `${t('support.category.technical')} ${t('designSystem.state.selected')}`
    )
  ).toBeTruthy();
  expect(screen.getByText(t('support.form.context.transaction'))).toBeTruthy();
  fireEvent.press(screen.getByText(t('support.form.removeContext')));
  expect(update).toHaveBeenCalledWith({ context: null });
  expect(screen.queryByText(/attachment/i)).toBeNull();

  fireEvent.changeText(screen.getByLabelText(t('support.form.subject')), '');
  fireEvent.press(screen.getByText(t('support.form.submit')));
  expect(screen.getByText(t('support.form.validation.subject'))).toBeTruthy();
  expect(submit).not.toHaveBeenCalled();

  fireEvent.changeText(
    screen.getByLabelText(t('support.form.subject')),
    'Wrong category'
  );
  fireEvent.changeText(
    screen.getByLabelText(t('support.form.description')),
    'Latest description'
  );
  fireEvent.press(screen.getByText(t('support.form.submit')));
  await waitFor(() =>
    expect(save).toHaveBeenCalledWith(
      expect.objectContaining({
        subject: 'Wrong category',
        description: 'Latest description'
      })
    )
  );
  await waitFor(() =>
    expect(submit).toHaveBeenCalledWith(
      expect.objectContaining({
        operationId: expect.stringMatching(/^[0-9a-f-]{36}$/)
      })
    )
  );
  await waitFor(() => expect(markSubmitted).toHaveBeenCalled());
  expect(screen.getByText(t('support.form.failure.offline'))).toBeTruthy();
});

test('a rejected submission keeps its text and distinguishes sending from draft saving', async () => {
  const submit = jest.fn().mockRejectedValue(Object.assign(new Error('unavailable'), { code: 'unavailable' }));
  mockQueries.useSubmitSupportDraft.mockReturnValue({ mutateAsync: submit, isPending: false });
  renderWithProviders(<SupportFormScreen />);
  fireEvent.changeText(screen.getByLabelText(t('support.form.subject')), 'Feedback stays');
  fireEvent.changeText(screen.getByLabelText(t('support.form.description')), 'Keep this text for the same submission.');
  fireEvent.press(screen.getByText(t('support.form.submit')));

  await waitFor(() => expect(screen.getByText(t('support.form.submitFailure'))).toBeTruthy());
  expect(screen.queryByText(t('support.form.failure.representative_failure'))).toBeNull();
  expect(screen.getByDisplayValue('Feedback stays')).toBeTruthy();
  expect(screen.getByDisplayValue('Keep this text for the same submission.')).toBeTruthy();
  expect(submit).toHaveBeenCalledTimes(1);
});

function articles() {
  return [
    {
      id: 'faq-subscription',
      kind: 'faq',
      titleKey: 'support.article.faq.subscription.title'
    },
    {
      id: 'help-notifications',
      kind: 'help',
      titleKey: 'support.article.help.notifications.title'
    },
    {
      id: 'whats-new-009',
      kind: 'whats_new',
      titleKey: 'support.article.whatsNew.v009.title'
    }
  ];
}

function transactionReportDraft() {
  return {
    category: 'technical',
    subject: 'Wrong category',
    description: 'This transaction looks wrong.',
    context: {
      itemId: 'transaction-1',
      itemKind: 'transaction',
      category: 'food',
      status: 'posted',
      appVersion: '1.0.0',
      diagnosticCategory: 'transaction'
    }
  };
}
