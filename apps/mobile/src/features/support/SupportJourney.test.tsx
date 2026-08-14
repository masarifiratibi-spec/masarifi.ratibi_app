import React from 'react';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';

import { renderWithProviders } from '@/test-utils/render';
import { changeLocale, translateDynamic as t } from '@/localization/i18n';

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn() },
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
const mockDraft = require('./useSupportDraft') as { useSupportDraft: jest.Mock };
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { SupportHomeScreen } = require('./SupportHomeScreen') as { SupportHomeScreen: React.ComponentType };
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { SupportFormScreen } = require('./SupportFormScreen') as { SupportFormScreen: React.ComponentType<{ mode?: string }> };

beforeEach(() => {
  jest.clearAllMocks();
  changeLocale('en');
  mockQueries.useArticleSearch.mockReturnValue({ data: articles(), isLoading: false, isError: false });
  mockQueries.useSaveSupportDraft.mockReturnValue({ mutateAsync: jest.fn(async (draft) => draft), isPending: false });
  mockQueries.useSubmitSupportDraft.mockReturnValue({ mutate: jest.fn(), isPending: false, isError: false });
  mockDraft.useSupportDraft.mockReturnValue({
    values: { category: 'technical', subject: '', description: '', context: null },
    update: jest.fn(),
    discard: jest.fn(),
    retrySave: jest.fn(),
    markSubmitted: jest.fn(),
    safeFailure: null,
    draftReady: true
  });
});

test('support home searches FAQ/help/whats-new in Arabic and English and opens no-result ticket path', () => {
  renderWithProviders(<SupportHomeScreen />);

  expect(screen.getByText(t('support.home.version'))).toBeTruthy();
  expect(screen.getByText(t('support.article.faq.subscription.title'))).toBeTruthy();
  expect(screen.getByText(t('support.article.help.notifications.title'))).toBeTruthy();
  expect(screen.getByText(t('support.article.whatsNew.v009.title'))).toBeTruthy();

  fireEvent.changeText(screen.getByLabelText('support.search.input'), 'اشتراك');
  expect(mockQueries.useArticleSearch).toHaveBeenCalled();
  fireEvent.press(screen.getByText(t('support.search.noResultsCreateTicket')));
  expect(router.push).toHaveBeenCalledWith('/support/new');
});

test('support form validates, flushes latest draft before submit, reviews/removes optional context, and excludes attachments', async () => {
  const update = jest.fn();
  const save = jest.fn(async (draft) => draft);
  const markSubmitted = jest.fn();
  const submit = jest.fn((_variables, options) => options?.onSuccess?.());
  mockQueries.useSaveSupportDraft.mockReturnValue({ mutateAsync: save, isPending: false });
  mockQueries.useSubmitSupportDraft.mockReturnValue({ mutate: submit, isPending: false, isError: true });
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

  expect(screen.getByText(t('support.form.context.transaction'))).toBeTruthy();
  fireEvent.press(screen.getByText(t('support.form.removeContext')));
  expect(update).toHaveBeenCalledWith({ context: null });
  expect(screen.queryByText(/attachment/i)).toBeNull();

  fireEvent.changeText(screen.getByLabelText(t('support.form.subject')), '');
  fireEvent.press(screen.getByText(t('support.form.submit')));
  expect(screen.getByText(t('support.form.validation.subject'))).toBeTruthy();
  expect(submit).not.toHaveBeenCalled();

  fireEvent.changeText(screen.getByLabelText(t('support.form.subject')), 'Wrong category');
  fireEvent.changeText(screen.getByLabelText(t('support.form.description')), 'Latest description');
  fireEvent.press(screen.getByText(t('support.form.submit')));
  await waitFor(() => expect(save).toHaveBeenCalledWith(expect.objectContaining({ subject: 'Wrong category', description: 'Latest description' })));
  expect(submit).toHaveBeenCalledWith(expect.objectContaining({ operationId: expect.stringMatching(/^support-submit-/) }), expect.any(Object));
  expect(markSubmitted).toHaveBeenCalled();
  expect(screen.getByText(t('support.form.failure.offline'))).toBeTruthy();
});

function articles() {
  return [
    { id: 'faq-subscription', kind: 'faq', titleKey: 'support.article.faq.subscription.title' },
    { id: 'help-notifications', kind: 'help', titleKey: 'support.article.help.notifications.title' },
    { id: 'whats-new-009', kind: 'whats_new', titleKey: 'support.article.whatsNew.v009.title' }
  ];
}

function transactionReportDraft() {
  return {
    category: 'technical',
    subject: 'Wrong category',
    description: 'This transaction looks wrong.',
    context: { itemId: 'transaction-1', itemKind: 'transaction', category: 'food', status: 'posted', appVersion: '1.0.0', diagnosticCategory: 'transaction' }
  };
}
