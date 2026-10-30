import React from 'react';
import { act, fireEvent, waitFor } from '@testing-library/react-native';
import { renderWithProviders } from '@/test-utils/render';
import { changeLocale, translate } from '@/localization/i18n';
import { automaticTrackingService } from '@/services/automatic-tracking-service';
import { TrackingStatusScreen } from './TrackingStatusScreen';
import { TrackingHistoryList } from './TrackingHistoryList';
import { ReviewDetail } from './ReviewDetail';
import { DuplicateComparison } from './DuplicateComparison';
import { SenderRuleList } from './SenderRuleList';
import * as queries from './useAutomaticTracking';

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(async () => null),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn()
}));
jest.mock('./useAutomaticTracking', () => ({
  ...jest.requireActual('./useAutomaticTracking'),
  useTrackingStatus: jest.fn(),
  useTrackingHistory: jest.fn(),
  useReviewItem: jest.fn(),
  useDuplicateCandidate: jest.fn(),
  useSenderRules: jest.fn()
}));
const snapshot = (data: unknown) => ({
  data,
  error: Error('offline'),
  isError: true,
  isLoading: false,
  isFetching: false,
  dataUpdatedAt: 100,
  refetch: jest.fn()
});
beforeEach(() => {
  changeLocale('en');
  jest
    .spyOn(automaticTrackingService, 'listKeywordRules')
    .mockResolvedValue([]);
});
afterEach(() => jest.restoreAllMocks());

it('keeps history visible and reports a failed clear without an unhandled action or false success', async () => {
  jest
    .mocked(queries.useTrackingHistory)
    .mockReturnValue({
      ...snapshot({ items: [], nextCursor: null, total: 0 }),
      isError: false,
      error: null
    } as never);
  jest
    .spyOn(automaticTrackingService, 'clearHistory')
    .mockRejectedValue(Error('connection lost'));
  const view = renderWithProviders(<TrackingHistoryList />);
  await act(async () =>
    fireEvent.press(
      view.getByRole('button', {
        name: translate('tracking.action.clearHistory')
      })
    )
  );
  await waitFor(() =>
    expect(view.getByText(translate('tracking.state.error'))).toBeTruthy()
  );
  expect(view.getByText(translate('tracking.history.empty'))).toBeTruthy();
  view.unmount();
});

it.each(['ar', 'en'] as const)(
  'keeps saved tracking history readable with an honest refresh state in %s',
  (locale) => {
    changeLocale(locale);
    jest.mocked(queries.useTrackingHistory).mockReturnValue(
      snapshot({
        items: [
          {
            id: 'saved-event',
            action: 'detected',
            reasonCodes: [],
            occurredAt: 1
          }
        ],
        nextCursor: null,
        total: 1
      }) as never
    );
    const view = renderWithProviders(<TrackingHistoryList />);
    expect(view.getByText(translate('tracking.history.detected'))).toBeTruthy();
    expect(
      view.getByText(translate('coreFinance.state.refreshFailedSnapshot'))
    ).toBeTruthy();
    view.unmount();
  }
);

it('shows a saved status snapshot without allowing it to authorize source configuration', () => {
  jest.mocked(queries.useTrackingStatus).mockReturnValue(
    snapshot({
      platform: 'android',
      mode: 'paused',
      permissionStatus: 'granted',
      smsPermissionStatus: 'granted',
      notificationAccessStatus: 'granted',
      smsTrackingEnabled: false,
      notificationTrackingEnabled: false,
      serviceState: 'healthy',
      lastDetectedAt: null,
      lastSuccessfulTransactionId: null,
      detectedThisMonth: 3,
      reviewCount: 1,
      activeKeywordCount: 0,
      activeSenderCount: 0,
      lastUpdatedAt: 100
    }) as never
  );
  const setMode = jest.spyOn(automaticTrackingService, 'setMode');
  const view = renderWithProviders(<TrackingStatusScreen />);
  expect(view.getByTestId('tracking-status-screen')).toBeTruthy();
  const controls = view.getAllByRole('switch');
  controls.forEach((control) => expect(control).toBeDisabled());
  controls.forEach((control) => fireEvent.press(control));
  expect(setMode).not.toHaveBeenCalled();
  view.unmount();
});

it('reads a saved review but requires a refreshed authoritative result before confirming', () => {
  jest.mocked(queries.useReviewItem).mockReturnValue(
    snapshot({
      id: 'review-saved',
      status: 'pending',
      proposedValues: {
        amountMinor: 1200,
        currencyCode: 'SAR',
        merchant: 'Saved merchant'
      },
      missingFields: [],
      reasonCodes: [],
      createdAt: 1,
      updatedAt: 1
    }) as never
  );
  const resolve = jest.spyOn(automaticTrackingService, 'resolveReview');
  const view = renderWithProviders(<ReviewDetail id="review-saved" />);
  expect(view.getByText('Saved merchant')).toBeTruthy();
  const confirm = view.getByRole('button', {
    name: translate('tracking.action.confirm')
  });
  expect(confirm).toBeDisabled();
  fireEvent.press(confirm);
  expect(resolve).not.toHaveBeenCalled();
  view.unmount();
});

it('reads a saved duplicate comparison without applying a financial resolution offline', () => {
  jest.mocked(queries.useDuplicateCandidate).mockReturnValue(
    snapshot({
      id: 'duplicate-saved',
      existingTransactionId: 'saved-transaction',
      reasonCodes: [],
      status: 'pending'
    }) as never
  );
  const resolve = jest.spyOn(automaticTrackingService, 'resolveDuplicate');
  const view = renderWithProviders(
    <DuplicateComparison id="duplicate-saved" />
  );
  const keep = view.getByRole('button', {
    name: translate('tracking.duplicate.keepNew')
  });
  expect(keep).toBeDisabled();
  fireEvent.press(keep);
  expect(resolve).not.toHaveBeenCalled();
  view.unmount();
});

it('shows saved sender rules without treating them as a fresh configuration result', () => {
  jest.mocked(queries.useSenderRules).mockReturnValue(
    snapshot([
      {
        id: 'sender-saved',
        displayLabel: 'Saved sender',
        normalizedSender: 'Bank',
        origin: 'custom',
        institutionKey: null,
        enabled: true,
        trusted: false
      }
    ]) as never
  );
  const save = jest.spyOn(automaticTrackingService, 'saveSenderRule');
  const view = renderWithProviders(<SenderRuleList />);
  fireEvent.press(view.getByText('Saved sender'));
  expect(
    view.getByText(translate('coreFinance.state.refreshFailedSnapshot'))
  ).toBeTruthy();
  expect(save).not.toHaveBeenCalled();
  view.unmount();
});
