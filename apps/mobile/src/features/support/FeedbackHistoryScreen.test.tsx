import React from 'react';
import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { supportService } from '@/services/mocks/support-service';
import { renderWithProviders } from '@/test-utils/render';
import { changeLocale, translateDynamic as t } from '@/localization/i18n';
import { useAppShellStore } from '@/state/app-shell';
import type { SupportFeedback } from '@/domain/support';
import { FeedbackHistoryScreen } from './FeedbackHistoryScreen';

jest.mock('expo-router', () => ({
  router: { back: jest.fn() },
  usePathname: () => '/support/feedback'
}));

const previous = useAppShellStore.getState().session;
const identity = (userId: string) => ({
  status: 'authenticated' as const,
  userId,
  method: 'google' as const,
  issuedAt: 1,
  expiresAt: 9999999999999,
  restoration: 'restored' as const
});
const note = (
  status: SupportFeedback['status'] = 'new',
  subject = 'My original feedback'
): SupportFeedback => ({
  id: '11000000-0000-4000-8000-000000000091',
  type: 'other',
  subject,
  body: 'Original owner text',
  status,
  version: 1,
  createdAt: 1790784000000
});
const page = (item: SupportFeedback, nextCursor: string | null = null) => ({
  items: [item],
  nextCursor,
  total: 1
});

beforeEach(() => {
  changeLocale('en');
  useAppShellStore.setState({ session: identity('owner-a') });
});
afterEach(() => {
  jest.restoreAllMocks();
  useAppShellStore.setState({ session: previous });
});

test.each(['ar', 'en'] as const)(
  'shows owner feedback and its actual moderation state in %s, with no moderation controls',
  async (locale) => {
    changeLocale(locale);
    jest
      .spyOn(supportService, 'listFeedback')
      .mockResolvedValue(page(note('planned')));
    renderWithProviders(<FeedbackHistoryScreen />);
    expect(await screen.findByText('My original feedback')).toBeTruthy();
    expect(screen.getByText('Original owner text')).toBeTruthy();
    expect(screen.getByText(t('support.feedback.status.planned'))).toBeTruthy();
    expect(screen.queryByRole('button', {
      name: /edit|delete|review|resolve|close|assign|تعديل|حذف|مراجعة|إغلاق|إسناد/i
    })).toBeNull();
  }
);

test('refreshes the same owner note after Admin closes it', async () => {
  const read = jest
    .spyOn(supportService, 'listFeedback')
    .mockResolvedValueOnce(page(note()))
    .mockResolvedValueOnce(page({ ...note('closed'), version: 5 }));
  renderWithProviders(<FeedbackHistoryScreen />);
  await screen.findByText(t('support.feedback.status.new'));
  fireEvent.press(
    screen.getByRole('button', { name: t('support.feedback.refresh') })
  );
  expect(
    await screen.findByText(t('support.feedback.status.closed'))
  ).toBeTruthy();
  expect(screen.getByText('Original owner text')).toBeTruthy();
  expect(read).toHaveBeenCalledTimes(2);
});

test('hides a cached note after an authoritative owner read denial', async () => {
  jest
    .spyOn(supportService, 'listFeedback')
    .mockResolvedValueOnce(page(note()))
    .mockRejectedValueOnce({ code: 'forbidden' });
  renderWithProviders(<FeedbackHistoryScreen />);
  await screen.findByText('Original owner text');
  fireEvent.press(
    screen.getByRole('button', { name: t('support.feedback.refresh') })
  );
  await screen.findByText(t('support.feedback.error'));
  expect(screen.queryByText('Original owner text')).toBeNull();
});

test('does not reveal an old owner response that arrives after switching accounts', async () => {
  let resolveOld!: (value: ReturnType<typeof page>) => void;
  jest
    .spyOn(supportService, 'listFeedback')
    .mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveOld = resolve;
        })
    )
    .mockResolvedValueOnce(page(note('new', 'Owner B note')));
  renderWithProviders(<FeedbackHistoryScreen />);
  await waitFor(() =>
    expect(supportService.listFeedback).toHaveBeenCalledTimes(1)
  );
  act(() => useAppShellStore.setState({ session: identity('owner-b') }));
  await screen.findByText('Owner B note');
  await act(async () => {
    resolveOld(page(note('closed', 'Owner A private note')));
  });
  expect(screen.queryByText('Owner A private note')).toBeNull();
  expect(screen.getByText('Owner B note')).toBeTruthy();
});

test('loads the next feedback page without duplicating an overlapping note', async () => {
  const read = jest
    .spyOn(supportService, 'listFeedback')
    .mockResolvedValueOnce(page(note(), 'page-2'))
    .mockResolvedValueOnce({
      items: [
        { ...note('reviewing'), version: 2 },
        {
          ...note('new', 'Second note'),
          id: '11000000-0000-4000-8000-000000000092'
        }
      ],
      nextCursor: null,
      total: 2
    });
  renderWithProviders(<FeedbackHistoryScreen />);
  await screen.findByText('My original feedback');
  fireEvent.press(
    screen.getByRole('button', { name: t('support.feedback.loadMore') })
  );
  await screen.findByText('Second note');
  expect(screen.getAllByText('My original feedback')).toHaveLength(1);
  expect(screen.getByText(t('support.feedback.status.reviewing'))).toBeTruthy();
  expect(read.mock.calls[1][0]).toBe('page-2');
});

test('does not regress a newer moderation state when a later page overlaps with an older version', async () => {
  jest
    .spyOn(supportService, 'listFeedback')
    .mockResolvedValueOnce(page({ ...note('closed'), version: 5 }, 'page-2'))
    .mockResolvedValueOnce(page({ ...note('planned'), version: 3 }));
  renderWithProviders(<FeedbackHistoryScreen />);
  await screen.findByText(t('support.feedback.status.closed'));
  fireEvent.press(
    screen.getByRole('button', { name: t('support.feedback.loadMore') })
  );
  await waitFor(() =>
    expect(
      screen.queryByRole('button', { name: t('support.feedback.loadMore') })
    ).toBeNull()
  );
  expect(screen.getByText(t('support.feedback.status.closed'))).toBeTruthy();
  expect(screen.queryByText(t('support.feedback.status.planned'))).toBeNull();
});

test('does not request feedback when no owner is authenticated', () => {
  useAppShellStore.setState({ session: null });
  const read = jest.spyOn(supportService, 'listFeedback');
  renderWithProviders(<FeedbackHistoryScreen />);
  expect(screen.getByText(t('support.feedback.error'))).toBeTruthy();
  expect(read).not.toHaveBeenCalled();
});
