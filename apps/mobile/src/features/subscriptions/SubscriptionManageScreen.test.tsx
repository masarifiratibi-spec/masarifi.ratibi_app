import React from 'react';
import { fireEvent, screen } from '@testing-library/react-native';
import { router } from 'expo-router';

import { renderWithProviders } from '@/test-utils/render';
import { changeLocale, translateDynamic as t } from '@/localization/i18n';

jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));
jest.mock('./subscription-queries', () => ({
  useSubscriptionState: jest.fn(),
  useSubscriptionCatalog: jest.fn(),
  useStartSubscriptionOperation: jest.fn(),
  useSubscriptionOperation: jest.fn(),
  useCompleteSubscriptionOperation: jest.fn(),
  useExpireSubscriptionPeriod: jest.fn()
}));

// eslint-disable-next-line @typescript-eslint/no-var-requires
const mockQueries = require('./subscription-queries') as {
  useSubscriptionState: jest.Mock;
  useSubscriptionCatalog: jest.Mock;
  useStartSubscriptionOperation: jest.Mock;
  useSubscriptionOperation: jest.Mock;
  useCompleteSubscriptionOperation: jest.Mock;
  useExpireSubscriptionPeriod: jest.Mock;
};
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { SubscriptionManageScreen } = require('./SubscriptionManageScreen') as Record<string, React.ComponentType<{ operationId?: string }>>;

beforeEach(() => {
  jest.clearAllMocks();
  changeLocale('en');
  mockQueries.useSubscriptionState.mockReturnValue({ data: state(), isLoading: false, isError: false });
  mockQueries.useSubscriptionCatalog.mockReturnValue({ data: catalog(), isLoading: false, isError: false });
  mockQueries.useStartSubscriptionOperation.mockReturnValue({ mutate: jest.fn(), isPending: false });
  mockQueries.useSubscriptionOperation.mockReturnValue({ data: null, isLoading: false, isError: false });
  mockQueries.useCompleteSubscriptionOperation.mockReturnValue({ mutate: jest.fn(), isPending: false });
  mockQueries.useExpireSubscriptionPeriod.mockReturnValue({ mutate: jest.fn(), isPending: false });
});

test('shows active plan lifecycle, renewal, retained access, and representative disclosure', () => {
  renderWithProviders(<SubscriptionManageScreen />);

  expect(screen.getByText(t('subscriptions.manage.current', { plan: 'premium' }))).toBeTruthy();
  expect(screen.getByText(t('subscriptions.manage.status.active'))).toBeTruthy();
  expect(screen.getByText(t('subscriptions.manage.renewsAt', { date: '2026-02-15' }))).toBeTruthy();
  expect(screen.getByText(t('subscriptions.access.editable'))).toBeTruthy();
  expect(screen.getByText(t('subscriptions.representative.notice'))).toBeTruthy();
});

test('starts restore, cancel, renewal, and routes plan change with stable operation inputs', () => {
  const start = jest.fn();
  const expire = jest.fn();
  mockQueries.useStartSubscriptionOperation.mockReturnValue({ mutate: start, isPending: false });
  mockQueries.useExpireSubscriptionPeriod.mockReturnValue({ mutate: expire, isPending: false });

  renderWithProviders(<SubscriptionManageScreen />);

  fireEvent.press(screen.getByText(t('subscriptions.manage.restore')));
  fireEvent.press(screen.getByText(t('subscriptions.manage.cancelAtPeriodEnd')));
  fireEvent.press(screen.getByText(t('subscriptions.manage.renew')));
  fireEvent.press(screen.getByText(t('subscriptions.manage.expire')));
  fireEvent.press(screen.getByText(t('subscriptions.manage.change', { plan: 'basic' })));

  expect(start).toHaveBeenCalledWith(expect.objectContaining({ input: { kind: 'restore', offerId: 'premium-annual', catalogVersion: '2026-01' } }), expect.any(Object));
  expect(start).toHaveBeenCalledWith(expect.objectContaining({ input: { kind: 'cancel', offerId: 'premium-annual', catalogVersion: '2026-01' } }), expect.any(Object));
  expect(start).toHaveBeenCalledWith(expect.objectContaining({ input: { kind: 'renew_mock', offerId: 'premium-annual', catalogVersion: '2026-01' } }), expect.any(Object));
  expect(expire).toHaveBeenCalledWith(expect.objectContaining({ operationId: expect.stringMatching(/^subscription-expire-/) }));
  expect(router.push).toHaveBeenCalledWith('/subscriptions/checkout?offerId=basic-monthly');
});

test('loads a reviewed operation and completes through the representative success path', () => {
  const complete = jest.fn();
  mockQueries.useSubscriptionOperation.mockReturnValue({
    data: { operationId: 'cancel-op', kind: 'cancel', status: 'review' },
    isLoading: false,
    isError: false
  });
  mockQueries.useCompleteSubscriptionOperation.mockReturnValue({ mutate: complete, isPending: false });

  renderWithProviders(<SubscriptionManageScreen operationId="cancel-op" />);

  expect(screen.getByText(t('subscriptions.operation.review'))).toBeTruthy();
  fireEvent.press(screen.getByText(t('subscriptions.operation.continue')));

  expect(complete).toHaveBeenCalledWith({ operationId: 'cancel-op', outcome: 'success' }, expect.any(Object));
});

test('manage-started cancel becomes active and can complete cancel-at-period-end successfully', () => {
  const complete = jest.fn((_input, options) => options?.onSuccess?.({ value: { operationId: 'started-cancel', kind: 'cancel', status: 'succeeded' } }));
  mockQueries.useStartSubscriptionOperation.mockReturnValue({
    mutate: jest.fn((_input, options) => options?.onSuccess?.({ value: { operationId: 'started-cancel', kind: 'cancel', status: 'review' } }))
  });
  mockQueries.useCompleteSubscriptionOperation.mockReturnValue({ mutate: complete, isPending: false });

  renderWithProviders(<SubscriptionManageScreen />);

  fireEvent.press(screen.getByText(t('subscriptions.manage.cancelAtPeriodEnd')));
  expect(screen.getByText(t('subscriptions.operation.review'))).toBeTruthy();

  fireEvent.press(screen.getByText(t('subscriptions.operation.continue')));
  expect(complete).toHaveBeenCalledWith({ operationId: 'started-cancel', outcome: 'success' }, expect.any(Object));
  expect(screen.getByText(t('subscriptions.operation.succeeded'))).toBeTruthy();
  expect(screen.queryByText(t('subscriptions.operation.continue'))).toBeNull();
});

test('shows expiry read-only retention without deleting paid content', () => {
  mockQueries.useSubscriptionState.mockReturnValue({ data: { ...state(), status: 'expired', paidContentAccess: 'read_only' }, isLoading: false, isError: false });

  renderWithProviders(<SubscriptionManageScreen />);

  expect(screen.getByText(t('subscriptions.manage.status.expired'))).toBeTruthy();
  expect(screen.getByText(t('subscriptions.access.readOnly'))).toBeTruthy();
  expect(screen.queryByText(/delete|removed/i)).toBeNull();
});

function state() {
  return {
    plan: 'premium',
    status: 'active',
    offerId: 'premium-annual',
    catalogVersion: '2026-01',
    startedAt: 1,
    trialEndsAt: null,
    renewsAt: Date.UTC(2026, 1, 15),
    accessEndsAt: null,
    limits: { assistantQuestions: 200 },
    version: 3,
    paidContentAccess: 'editable',
    updatedAt: 1
  };
}

function catalog() {
  return {
    version: '2026-01',
    offers: [
      { offerId: 'basic-monthly', plan: 'basic', billingPeriod: 'monthly', priceMinor: 1900, currency: 'SAR', features: [], limits: {}, trial: { eligible: false, durationDays: 0, trialPriceMinor: 0, postTrialPriceMinor: 1900 }, renewalTermsKey: 'renew.basic', cancellationTermsKey: 'cancel.basic', catalogVersion: '2026-01', effectiveAt: 1 },
      { offerId: 'premium-annual', plan: 'premium', billingPeriod: 'annual', priceMinor: 19000, currency: 'SAR', features: [], limits: {}, trial: { eligible: false, durationDays: 0, trialPriceMinor: 0, postTrialPriceMinor: 19000 }, renewalTermsKey: 'renew.premium', cancellationTermsKey: 'cancel.premium', catalogVersion: '2026-01', effectiveAt: 1 }
    ]
  };
}
