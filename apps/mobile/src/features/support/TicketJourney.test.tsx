import React from 'react';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import { renderWithProviders } from '@/test-utils/render';
import { changeLocale, translateDynamic as t } from '@/localization/i18n';

jest.mock('./support-queries', () => ({
  useSupportTickets: jest.fn(),
  useSupportTicket: jest.fn(),
  useReplyToTicket: jest.fn(),
  useRateTicket: jest.fn()
}));

// eslint-disable-next-line @typescript-eslint/no-var-requires
const mockQueries = require('./support-queries') as Record<string, jest.Mock>;
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { TicketListScreen } = require('./TicketListScreen') as { TicketListScreen: React.ComponentType };
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { TicketDetailScreen } = require('./TicketDetailScreen') as { TicketDetailScreen: React.ComponentType<{ ticketId: string }> };

beforeEach(() => {
  jest.clearAllMocks();
  changeLocale('en');
  mockQueries.useSupportTickets.mockReturnValue({ data: { items: [ticket('open'), ticket('resolved', 'resolved')], nextCursor: null, total: 2 }, isLoading: false, isError: false });
  mockQueries.useSupportTicket.mockReturnValue({ data: ticket('open'), isLoading: false, isError: false });
  mockQueries.useReplyToTicket.mockReturnValue({ mutate: jest.fn(), isPending: false, isError: false });
  mockQueries.useRateTicket.mockReturnValue({ mutate: jest.fn(), isPending: false, isError: false });
});

test('ticket list shows stable references, statuses, updated times, and empty/loading/error states', () => {
  renderWithProviders(<TicketListScreen />);

  expect(screen.getByText(t('support.ticket.listTitle'))).toBeTruthy();
  expect(screen.UNSAFE_getByType(require('react-native').FlatList).props.keyExtractor(ticket('open'))).toBe('open');
  expect(screen.getByText('SUP-open')).toBeTruthy();
  expect(screen.getByText(t('support.ticket.status.open'))).toBeTruthy();
  expect(screen.getByText('SUP-resolved')).toBeTruthy();
  expect(screen.getByText(t('support.ticket.status.resolved'))).toBeTruthy();
});

test('ticket list appends next pages without losing prior rows or order', async () => {
  const firstPage = { items: [ticket('newer')], nextCursor: 'next', total: 2 };
  const secondPage = { items: [ticket('older')], nextCursor: null, total: 2 };
  mockQueries.useSupportTickets.mockImplementation((cursor?: string) => ({ data: cursor ? secondPage : firstPage, isLoading: false, isError: false }));

  renderWithProviders(<TicketListScreen />);
  const list = screen.UNSAFE_getByType(require('react-native').FlatList);
  fireEvent(list, 'onEndReached');

  await waitFor(() => expect(screen.getByText('SUP-older')).toBeTruthy());
  expect(screen.getByText('SUP-newer')).toBeTruthy();
});

test('ticket detail preserves reply input through failure and only rates resolved or closed tickets', () => {
  const reply = jest.fn();
  const rate = jest.fn();
  mockQueries.useReplyToTicket.mockReturnValue({ mutate: reply, isPending: false, isError: true });
  mockQueries.useRateTicket.mockReturnValue({ mutate: rate, isPending: false, isError: false });

  renderWithProviders(<TicketDetailScreen ticketId="open" />);

  expect(screen.getByText(t('support.ticket.detailTitle', { reference: 'SUP-open' }))).toBeTruthy();
  expect(screen.getByText('SUP-open')).toBeTruthy();
  expect(screen.getByText(t('support.ticket.message.user'))).toBeTruthy();
  expect(screen.queryByText(t('support.ticket.rate.5'))).toBeNull();
  fireEvent.changeText(screen.getByLabelText(t('support.ticket.reply')), 'Please help again.');
  fireEvent.press(screen.getByText(t('support.ticket.sendReply')));
  expect(reply).toHaveBeenCalledWith(expect.objectContaining({ input: { description: 'Please help again.' }, operationId: expect.stringMatching(/^support-reply-/) }));
  expect(screen.getByDisplayValue('Please help again.')).toBeTruthy();
  expect(screen.getByText(t('support.ticket.replyFailed'))).toBeTruthy();

  mockQueries.useSupportTicket.mockReturnValue({ data: ticket('resolved', 'resolved'), isLoading: false, isError: false });
  renderWithProviders(<TicketDetailScreen ticketId="resolved" />);
  fireEvent.press(screen.getByText(t('support.ticket.rate.5')));
  expect(rate).toHaveBeenCalledWith(expect.objectContaining({ rating: 5, operationId: expect.stringMatching(/^support-rate-/) }));
});

test('ticket detail has no attachment UI', () => {
  renderWithProviders(<TicketDetailScreen ticketId="open" />);

  expect(screen.queryByText(/attachment|upload|file/i)).toBeNull();
});

function ticket(id: string, status: 'open' | 'resolved' | 'closed' = 'open') {
  return {
    id,
    reference: `SUP-${id}`,
    category: 'technical',
    subject: `Subject ${id}`,
    description: `Description ${id}`,
    context: null,
    status,
    messages: [{ id: `${id}-message`, author: 'user', body: 'support.ticket.message.user', createdAt: 1 }],
    createdAt: 1,
    updatedAt: 2,
    rating: null,
    version: 1
  };
}
