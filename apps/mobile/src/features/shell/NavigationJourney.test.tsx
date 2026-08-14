import React from 'react';
import { act, fireEvent, screen } from '@testing-library/react-native';
import { router } from 'expo-router';
import { notifyManager } from '@tanstack/react-query';

import HomeRoute from '@app/(tabs)/home';
import TransactionsRoute from '@app/(tabs)/transactions';
import AddRoute from '@app/(tabs)/add';
import ReportsRoute from '@app/(tabs)/reports';
import MoreRoute from '@app/(tabs)/more';
import AccountsRoute from '@app/accounts';
import AssistantRoute from '@app/assistant';
import AuthRequiredRoute from '@app/modals/auth-required';
import { translate, translateDynamic } from '@/localization/i18n';
import { renderWithProviders } from '@/test-utils/render';

let mockSearchParams: { returnTo?: string } = {};

jest.mock('expo-router', () => ({
  router: {
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
    navigate: jest.fn()
  },
  useLocalSearchParams: () => mockSearchParams,
  Tabs: Object.assign(() => null, { Screen: () => null }),
  Stack: () => null
}));

jest.mock('@/services/mocks/core-finance-service', () => ({
  coreFinanceService: {
    getHomeSummary: jest.fn(async () => ({ dataState: 'empty' })),
    loadDraft: jest.fn(async () => null),
    listAccounts: jest.fn(async () => []),
    listCategories: jest.fn(async () => []),
    listTransactions: jest.fn(async () => ({ items: [], total: 0 }))
  }
}));

jest.mock('@/services/mocks/assistant-notifications-service', () => ({
  assistantNotificationsService: {
    list: jest.fn(async (input: { unreadOnly?: boolean } = {}) => ({
      items: [],
      nextCursor: null,
      total: input.unreadOnly ? 7 : 0
    }))
  }
}));

jest.mock('@/features/assistant/assistant-queries', () => ({
  useAssistantConsent: jest.fn(),
  useAssistantAvailability: jest.fn(),
  useSetAssistantConsent: jest.fn(),
  useCreateAssistantConversation: jest.fn(),
  useAssistantConversations: jest.fn(),
  useAssistantConversation: jest.fn(),
  useAskAssistant: jest.fn(),
  useRenameAssistantConversation: jest.fn(),
  useDeleteAssistantConversation: jest.fn(),
  useAssistantFeedback: jest.fn()
}));

const mockAssistantQueries = jest.requireMock('@/features/assistant/assistant-queries') as Record<string, jest.Mock>;

beforeAll(() => {
  notifyManager.setNotifyFunction((callback) => { act(callback); });
});

afterAll(() => {
  notifyManager.setNotifyFunction((callback) => { callback(); });
});

describe('navigation journey', () => {
  beforeEach(() => {
    mockSearchParams = {};
    jest.clearAllMocks();
    mockAssistantQueries.useAssistantConsent.mockReturnValue({ data: { status: 'enabled', version: 1 }, error: null, isError: false });
    mockAssistantQueries.useAssistantAvailability.mockReturnValue({ data: { status: 'available', remainingQuestions: 2 }, error: null, isError: false });
    mockAssistantQueries.useSetAssistantConsent.mockReturnValue({ mutate: jest.fn() });
    mockAssistantQueries.useCreateAssistantConversation.mockReturnValue({ mutate: jest.fn(), error: null });
    mockAssistantQueries.useAssistantConversations.mockReturnValue({ data: { items: [], nextCursor: null, total: 0 }, isLoading: false, isError: false });
    mockAssistantQueries.useAssistantConversation.mockReturnValue({ data: { conversation: { id: 'conversation-1', title: 'Assistant', version: 1 }, responses: { items: [], nextCursor: null, total: 0 } } });
    mockAssistantQueries.useAskAssistant.mockReturnValue({ mutate: jest.fn() });
    mockAssistantQueries.useRenameAssistantConversation.mockReturnValue({ mutate: jest.fn() });
    mockAssistantQueries.useDeleteAssistantConversation.mockReturnValue({ mutate: jest.fn() });
    mockAssistantQueries.useAssistantFeedback.mockReturnValue({ mutate: jest.fn() });
  });

  it('renders every primary and representative secondary destination', async () => {
    const home = renderWithProviders(<HomeRoute />);
    expect(
      await screen.findByLabelText(translate('appShell.shell.accounts'))
    ).toBeOnTheScreen();
    expect(
      screen.getByLabelText(translate('appShell.shell.assistant'))
    ).toBeOnTheScreen();
    home.unmount();

    const transactions = renderWithProviders(<TransactionsRoute />);
    expect(
      await screen.findByText(translate('appShell.tabs.transactions'))
    ).toBeOnTheScreen();
    transactions.unmount();

    const add = renderWithProviders(<AddRoute />);
    expect(
      await screen.findByText(translate('appShell.tabs.add'))
    ).toBeOnTheScreen();
    add.unmount();

    const reports = renderWithProviders(<ReportsRoute />);
    expect(
      screen.getByText(translate('appShell.tabs.reports'))
    ).toBeOnTheScreen();
    reports.unmount();

    const more = renderWithProviders(<MoreRoute />);
    expect(
      screen.getByLabelText(translate('appShell.shell.security'))
    ).toBeOnTheScreen();
    for (const [label, route] of [
      [translate('appShell.shell.profile'), '/profile'],
      [translate('appShell.shell.security'), '/security/settings'],
      [translate('appShell.shell.privacy'), '/profile/privacy'],
      [translate('appShell.shell.subscriptions'), '/subscriptions'],
      [translate('appShell.shell.support'), '/support']
    ] as const) {
      const link = screen.getByLabelText(label);
      expect(link).toBeOnTheScreen();
      fireEvent.press(link);
      expect(router.push).toHaveBeenCalledWith(route);
    }
    more.unmount();

    const accounts = renderWithProviders(<AccountsRoute />);
    expect(
      await screen.findByLabelText(translate('coreFinance.accounts.add'))
    ).toBeOnTheScreen();
    accounts.unmount();

    const assistant = renderWithProviders(<AssistantRoute />);
    expect(
      screen.getByText(translateDynamic('assistant.consent.title'))
    ).toBeOnTheScreen();
    assistant.unmount();

    const authRequired = renderWithProviders(<AuthRequiredRoute />);
    expect(
      screen.getByText(translate('appShell.navigation.authRequired'))
    ).toBeOnTheScreen();
    authRequired.unmount();
  });

  it('offers a safe return action when transactions opened from reports', async () => {
    mockSearchParams = { returnTo: '/(tabs)/reports' };
    renderWithProviders(<TransactionsRoute />);

    expect(
      await screen.findByText(translate('coreFinance.ledger.empty'))
    ).toBeOnTheScreen();
    fireEvent.press(
      await screen.findByLabelText(translate('appShell.navigation.back'))
    );
    expect(router.navigate).toHaveBeenCalledWith('/(tabs)/reports');
  });

  it('opens notifications from More and shows the unread badge', async () => {
    renderWithProviders(<MoreRoute />);

    const notificationsLink = await screen.findByLabelText(
      `${translate('appShell.shell.notifications')} 7`
    );
    expect(notificationsLink).toBeOnTheScreen();
    fireEvent.press(notificationsLink);

    expect(router.push).toHaveBeenCalledWith('/notifications');
  });

  it('opens assistant from More and announces disabled and limit states', async () => {
    mockAssistantQueries.useAssistantConsent.mockReturnValue({ data: { status: 'disabled', version: 2 }, error: null, isError: false });
    const disabled = renderWithProviders(<MoreRoute />);
    const assistantDisabled = await screen.findByLabelText(
      `${translate('appShell.shell.assistant')} ${translate('appShell.shell.assistantDisabled')}`
    );
    fireEvent.press(assistantDisabled);
    expect(router.push).toHaveBeenCalledWith('/assistant');
    disabled.unmount();

    mockAssistantQueries.useAssistantConsent.mockReturnValue({ data: { status: 'enabled', version: 2 }, error: null, isError: false });
    mockAssistantQueries.useAssistantAvailability.mockReturnValue({ data: { status: 'limit_reached', remainingQuestions: 0 }, error: null, isError: false });
    renderWithProviders(<MoreRoute />);
    expect(
      await screen.findByLabelText(`${translate('appShell.shell.assistant')} ${translate('appShell.shell.assistantLimitReached')}`)
    ).toBeOnTheScreen();
  });
});
