import React from 'react';
import { FlatList } from 'react-native';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor
} from '@testing-library/react-native';
import { QueryClient } from '@tanstack/react-query';
import { FoundationProviders } from '@/state/FoundationProviders';
import { useAppShellStore } from '@/state/app-shell';
import { usePreferenceStore } from '@/state/preferences';

import { renderWithProviders } from '@/test-utils/render';
import { changeLocale, translateDynamic as t } from '@/localization/i18n';
import type { SupportTicket } from '@/domain/support';
import * as queries from './support-queries';
import { TicketListScreen } from './TicketListScreen';
import { TicketDetailScreen } from './TicketDetailScreen';

jest.mock('./support-queries', () => ({
  useSupportTickets: jest.fn(),
  useSupportTicket: jest.fn(),
  useReplyToTicket: jest.fn(),
  useRateTicket: jest.fn()
}));

const mockQueries = queries as unknown as Record<string, jest.Mock>;

beforeEach(() => {
  jest.clearAllMocks();
  changeLocale('en');
  mockQueries.useSupportTickets.mockReturnValue({
    data: {
      items: [ticket('open'), ticket('resolved', 'resolved')],
      nextCursor: null,
      total: 2
    },
    isLoading: false,
    isError: false
  });
  mockQueries.useSupportTicket.mockReturnValue({
    data: ticket('open'),
    isLoading: false,
    isError: false
  });
  mockQueries.useReplyToTicket.mockReturnValue({
    mutate: jest.fn(),
    isPending: false,
    isError: false
  });
  mockQueries.useRateTicket.mockReturnValue({
    mutate: jest.fn(),
    isPending: false,
    isError: false
  });
});

test.each(['en', 'ar'] as const)(
  'saved support history remains visible after refresh failure in %s',
  (locale) => {
    changeLocale(locale);
    mockQueries.useSupportTickets.mockReturnValue({
      data: { items: [ticket('saved')], nextCursor: null, total: 1 },
      dataUpdatedAt: 100,
      isLoading: false,
      isError: true,
      isFetching: false,
      error: Error('offline')
    });
    renderWithProviders(<TicketListScreen />);
    expect(screen.getByText('SUP-saved')).toBeTruthy();
    expect(screen.queryByText(t('support.ticket.error'))).toBeNull();
    expect(
      screen.getByText(t('coreFinance.state.refreshFailedSnapshot'))
    ).toBeTruthy();
  }
);

test('a failed detail refresh does not pretend that an unsent reply failed', () => {
  mockQueries.useSupportTicket.mockReturnValue({
    data: ticket('saved'),
    dataUpdatedAt: 100,
    isLoading: false,
    isError: true,
    isFetching: false,
    error: Error('offline'),
    refetch: jest.fn()
  });
  renderWithProviders(<TicketDetailScreen ticketId="saved" />);
  expect(screen.getByText('SUP-saved')).toBeTruthy();
  expect(screen.queryByText(t('support.ticket.replyFailed'))).toBeNull();
  expect(
    screen.getByText(t('coreFinance.state.refreshFailedSnapshot'))
  ).toBeTruthy();
});

test('a confirmed detail permission denial hides the old cached record', () => {
  mockQueries.useSupportTicket.mockReturnValue({
    data: ticket('private'),
    isLoading: false,
    isError: true,
    error: { code: 'forbidden' }
  });
  renderWithProviders(<TicketDetailScreen ticketId="private" />);
  expect(screen.queryByText('SUP-private')).toBeNull();
  expect(screen.getByText(t('support.ticket.error'))).toBeTruthy();
});

test('accumulated support pages cannot cross owners after account switching', async () => {
  const previous = useAppShellStore.getState().session;
  const identity = (userId: string) => ({
    status: 'authenticated' as const,
    userId,
    method: 'google' as const,
    issuedAt: 1,
    expiresAt: 9999999999999,
    restoration: 'restored' as const
  });
  useAppShellStore.setState({ session: identity('a') });
  usePreferenceStore.setState({
    hydrated: true,
    locale: 'en',
    direction: 'ltr'
  });
  mockQueries.useSupportTickets.mockReturnValue({
    data: { items: [ticket('a-page1')], nextCursor: 'a-page2', total: 2 },
    dataUpdatedAt: 100,
    isLoading: false,
    isError: false
  });
  const client = new QueryClient({
    defaultOptions: { queries: { gcTime: Infinity } }
  });
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <FoundationProviders client={client}>{children}</FoundationProviders>
  );
  const view = render(<TicketListScreen />, { wrapper });
  try {
    expect(screen.getByText('SUP-a-page1')).toBeTruthy();
    fireEvent(view.UNSAFE_getByType(FlatList), 'endReached');
    mockQueries.useSupportTickets.mockReturnValue({
      data: { items: [ticket('a-page2')], nextCursor: null, total: 2 },
      dataUpdatedAt: 200,
      isLoading: false,
      isError: false
    });
    view.rerender(<TicketListScreen />);
    await waitFor(() => expect(screen.getByText('SUP-a-page2')).toBeTruthy());
    act(() => useAppShellStore.setState({ session: identity('b') }));
    mockQueries.useSupportTickets.mockReturnValue({
      data: { items: [ticket('b-page1')], nextCursor: null, total: 1 },
      dataUpdatedAt: 300,
      isLoading: false,
      isError: false
    });
    view.rerender(<TicketListScreen />);
    await waitFor(() => expect(screen.getByText('SUP-b-page1')).toBeTruthy());
    expect(screen.queryByText('SUP-a-page1')).toBeNull();
    expect(screen.queryByText('SUP-a-page2')).toBeNull();
  } finally {
    view.unmount();
    client.clear();
    useAppShellStore.setState({ session: previous });
  }
});

test('an unsent support reply cannot follow a reused screen into another owner or ticket', () => {
  const previous = useAppShellStore.getState().session;
  const identity = (userId: string) => ({
    status: 'authenticated' as const,
    userId,
    method: 'google' as const,
    issuedAt: 1,
    expiresAt: 9999999999999,
    restoration: 'restored' as const
  });
  useAppShellStore.setState({ session: identity('a') });
  usePreferenceStore.setState({
    hydrated: true,
    locale: 'en',
    direction: 'ltr'
  });
  mockQueries.useSupportTicket.mockReturnValue({
    data: ticket('a'),
    isLoading: false,
    isError: false
  });
  const mutate = jest.fn();
  mockQueries.useReplyToTicket.mockReturnValue({
    mutate,
    isPending: false,
    isError: false
  });
  const client = new QueryClient({
    defaultOptions: { queries: { gcTime: Infinity } }
  });
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <FoundationProviders client={client}>{children}</FoundationProviders>
  );
  const view = render(<TicketDetailScreen ticketId="a" />, { wrapper });
  try {
    fireEvent.changeText(
      screen.getByLabelText(t('support.ticket.reply')),
      'Private unsent reply A'
    );
    expect(screen.getByDisplayValue('Private unsent reply A')).toBeTruthy();
    act(() => useAppShellStore.setState({ session: identity('b') }));
    mockQueries.useSupportTicket.mockReturnValue({
      data: ticket('b'),
      isLoading: false,
      isError: false
    });
    view.rerender(<TicketDetailScreen ticketId="b" />);
    expect(screen.queryByDisplayValue('Private unsent reply A')).toBeNull();
    expect(mutate).not.toHaveBeenCalled();
  } finally {
    view.unmount();
    client.clear();
    useAppShellStore.setState({ session: previous });
  }
});

test('ticket list shows stable references, statuses, updated times, and empty/loading/error states', () => {
  renderWithProviders(<TicketListScreen />);

  expect(screen.getByText(t('support.ticket.listTitle'))).toBeTruthy();
  expect(
    screen.UNSAFE_getByType(FlatList).props.keyExtractor(ticket('open'))
  ).toBe('open');
  expect(screen.getByText('SUP-open')).toBeTruthy();
  expect(screen.getByText(t('support.ticket.status.open'))).toBeTruthy();
  expect(screen.getByText('SUP-resolved')).toBeTruthy();
  expect(screen.getByText(t('support.ticket.status.resolved'))).toBeTruthy();
});

test.each(
  (
    [
      ['submitted', 'Submitted', 'تم الإرسال'],
      ['open', 'Open', 'مفتوحة'],
      ['waiting_user', 'Waiting for your reply', 'بانتظار ردك'],
      ['waiting_support', 'Waiting for support', 'بانتظار رد الدعم'],
      ['resolved', 'Resolved', 'تم حلها'],
      ['closed', 'Closed', 'مغلقة']
    ] as const
  ).flatMap(([status, english, arabic]) => [
    { status, locale: 'en' as const, label: english },
    { status, locale: 'ar' as const, label: arabic }
  ])
)(
  'localizes contractual $status status in the ticket list and detail in $locale',
  ({ status, locale, label }) => {
    const retained = ticket('status-check', status);
    mockQueries.useSupportTickets.mockReturnValue({
      data: { items: [retained], nextCursor: null, total: 1 },
      isLoading: false,
      isError: false
    });
    mockQueries.useSupportTicket.mockReturnValue({
      data: retained,
      isLoading: false,
      isError: false
    });
    changeLocale(locale);
    const list = renderWithProviders(<TicketListScreen />);
    expect(list.getByText(label)).toBeTruthy();
    list.unmount();
    const detail = renderWithProviders(
      <TicketDetailScreen ticketId="status-check" />
    );
    expect(detail.getByText(label)).toBeTruthy();
    detail.unmount();
  }
);

test('ticket list appends next pages without losing prior rows or order', async () => {
  const firstPage = { items: [ticket('newer')], nextCursor: 'next', total: 2 };
  const secondPage = { items: [ticket('older')], nextCursor: null, total: 2 };
  mockQueries.useSupportTickets.mockImplementation((cursor?: string) => ({
    data: cursor ? secondPage : firstPage,
    isLoading: false,
    isError: false
  }));

  renderWithProviders(<TicketListScreen />);
  const list = screen.UNSAFE_getByType(FlatList);
  fireEvent(list, 'onEndReached');

  await waitFor(() => expect(screen.getByText('SUP-older')).toBeTruthy());
  expect(screen.getByText('SUP-newer')).toBeTruthy();
});

test('ticket detail preserves reply input through failure and only rates resolved or closed tickets', () => {
  const reply = jest.fn();
  const rate = jest.fn();
  const refetch = jest.fn();
  mockQueries.useSupportTicket.mockReturnValue({
    data: ticket('open'),
    isLoading: false,
    isError: false,
    refetch
  });
  mockQueries.useReplyToTicket.mockReturnValue({
    mutate: reply,
    isPending: false,
    isError: true
  });
  mockQueries.useRateTicket.mockReturnValue({
    mutate: rate,
    isPending: false,
    isError: false
  });

  renderWithProviders(<TicketDetailScreen ticketId="open" />);

  expect(
    screen.getByText(t('support.ticket.detailTitle', { reference: 'SUP-open' }))
  ).toBeTruthy();
  expect(screen.getByText('SUP-open')).toBeTruthy();
  expect(screen.getByText(t('support.ticket.message.user'))).toBeTruthy();
  expect(screen.queryByText(t('support.ticket.rate.5'))).toBeNull();
  fireEvent.changeText(
    screen.getByLabelText(t('support.ticket.reply')),
    'Please help again.'
  );
  fireEvent.press(screen.getByText(t('support.ticket.sendReply')));
  expect(reply).toHaveBeenCalledWith(
    expect.objectContaining({
      input: { description: 'Please help again.' },
      operationId: expect.stringMatching(/^support-reply-/)
    })
  );
  expect(screen.getByDisplayValue('Please help again.')).toBeTruthy();
  expect(screen.getByText(t('support.ticket.replyFailed'))).toBeTruthy();
  fireEvent.press(screen.getByText(t('support.ticket.refresh')));
  expect(refetch).toHaveBeenCalledTimes(1);
  expect(screen.getByDisplayValue('Please help again.')).toBeTruthy();

  mockQueries.useSupportTicket.mockReturnValue({
    data: ticket('resolved', 'resolved'),
    isLoading: false,
    isError: false
  });
  renderWithProviders(<TicketDetailScreen ticketId="resolved" />);
  fireEvent.press(screen.getByText(t('support.ticket.rate.5')));
  expect(rate).toHaveBeenCalledWith(
    expect.objectContaining({
      rating: 5,
      operationId: expect.stringMatching(/^support-rate-/)
    })
  );
});

test('ticket detail has no attachment UI', () => {
  renderWithProviders(<TicketDetailScreen ticketId="open" />);

  expect(screen.queryByText(/attachment|upload|file/i)).toBeNull();
});

test('closed ticket shows its conversation without offering an unsupported reply', () => {
  mockQueries.useSupportTicket.mockReturnValue({
    data: ticket('closed', 'closed'),
    isLoading: false,
    isError: false
  });
  renderWithProviders(<TicketDetailScreen ticketId="closed" />);
  expect(screen.getByText('SUP-closed')).toBeTruthy();
  expect(screen.queryByText(t('support.ticket.sendReply'))).toBeNull();
});

function ticket(id: string, status: SupportTicket['status'] = 'open') {
  return {
    id,
    reference: `SUP-${id}`,
    category: 'technical',
    subject: `Subject ${id}`,
    description: `Description ${id}`,
    context: null,
    status,
    messages: [
      {
        id: `${id}-message`,
        author: 'user',
        body: 'support.ticket.message.user',
        createdAt: 1
      }
    ],
    createdAt: 1,
    updatedAt: 2,
    rating: null,
    version: 1
  };
}
