import React from 'react';
import { fireEvent, screen } from '@testing-library/react-native';
import { router } from 'expo-router';

import { changeLocale, translate, translateDynamic as t } from '@/localization/i18n';
import { renderWithProviders } from '@/test-utils/render';

jest.mock('expo-router', () => ({ router: { replace: jest.fn(), back: jest.fn() } }));
jest.mock('./subscription-queries', () => ({
  useSubscriptionCatalog: jest.fn(),
  useSubscriptionState: jest.fn(),
  useStartSubscriptionOperation: jest.fn()
}));

// eslint-disable-next-line @typescript-eslint/no-var-requires
const mockQueries = require('./subscription-queries') as {
  useSubscriptionCatalog: jest.Mock;
  useSubscriptionState: jest.Mock;
  useStartSubscriptionOperation: jest.Mock;
};
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { SubscriptionCheckoutScreen } = require('./SubscriptionCheckoutScreen') as Record<string, React.ComponentType<{ offerId?: string }>>;

beforeEach(() => {
  jest.clearAllMocks();
  changeLocale('en');
  mockQueries.useSubscriptionCatalog.mockReturnValue({ data: catalog(), isLoading: false, isError: false });
  mockQueries.useSubscriptionState.mockReturnValue({ data: state(), isLoading: false, isError: false });
  mockQueries.useStartSubscriptionOperation.mockReturnValue({ mutate: jest.fn(), isPending: false });
});

test('reviews one offer and starts a representative operation only after confirmation', () => {
  const start = jest.fn((_input, options) => options?.onSuccess?.({ value: { operationId: 'checkout-1' } }));
  mockQueries.useStartSubscriptionOperation.mockReturnValue({ mutate: start, isPending: false });

  renderWithProviders(<SubscriptionCheckoutScreen offerId="premium-annual" />);

  expect(screen.getByText('Premium')).toBeTruthy();
  expect(screen.getByText('190.00 SAR / year')).toBeTruthy();
  expect(screen.getByText('Offer version: 2026-01')).toBeTruthy();
  expect(screen.getByText(t('subscriptions.representative.notice'))).toBeTruthy();
  expect(screen.queryByText(/card number|visa|mastercard/i)).toBeNull();

  fireEvent.press(screen.getByText(t('subscriptions.checkout.confirm')));
  fireEvent.press(screen.getByText(translate('coreFinance.cancel')));
  expect(start).not.toHaveBeenCalled();

  fireEvent.press(screen.getByText(t('subscriptions.checkout.confirm')));
  fireEvent.press(screen.getByText(t('subscriptions.checkout.confirmNow')));

  expect(start).toHaveBeenCalledWith(
    {
      input: { kind: 'start_trial', offerId: 'premium-annual', catalogVersion: '2026-01' },
      expectedVersion: 1,
      operationId: expect.stringMatching(/^subscription-purchase-/)
    },
    expect.any(Object)
  );
  expect(router.replace).toHaveBeenCalledWith('/subscriptions/manage?operationId=checkout-1');
});

test('eligible trial checkout starts a trial lifecycle instead of immediate active purchase', () => {
  const start = jest.fn((_input, options) => options?.onSuccess?.({ value: { operationId: 'trial-op' } }));
  mockQueries.useStartSubscriptionOperation.mockReturnValue({ mutate: start, isPending: false });

  renderWithProviders(<SubscriptionCheckoutScreen offerId="basic-monthly" />);

  fireEvent.press(screen.getByText(t('subscriptions.checkout.confirm')));
  fireEvent.press(screen.getByText(t('subscriptions.checkout.confirmNow')));

  expect(start).toHaveBeenCalledWith(
    expect.objectContaining({
      input: { kind: 'start_trial', offerId: 'basic-monthly', catalogVersion: '2026-01' }
    }),
    expect.any(Object)
  );
});

test('blocks duplicate pending confirmation and retries after failure without changing state', () => {
  const start = jest.fn().mockImplementationOnce((_input, options) => options?.onError?.({ code: 'representative_failure' }));
  mockQueries.useStartSubscriptionOperation.mockReturnValue({ mutate: start, isPending: false });
  renderWithProviders(<SubscriptionCheckoutScreen offerId="basic-monthly" />);

  fireEvent.press(screen.getByText(t('subscriptions.checkout.confirm')));
  fireEvent.press(screen.getByText(t('subscriptions.checkout.confirmNow')));
  expect(screen.getByText(t('subscriptions.checkout.failed'))).toBeTruthy();

  fireEvent.press(screen.getByText(t('subscriptions.checkout.confirmNow')));
  expect(start).toHaveBeenCalledTimes(2);
});

test('shows changed catalog/state recovery and avoids operation start', () => {
  const start = jest.fn();
  mockQueries.useSubscriptionState.mockReturnValue({ data: { ...state(), version: 2, catalogVersion: 'old-catalog' }, isLoading: false, isError: false });
  mockQueries.useStartSubscriptionOperation.mockReturnValue({ mutate: start, isPending: false });

  renderWithProviders(<SubscriptionCheckoutScreen offerId="premium-annual" />);

  expect(screen.getByText(t('subscriptions.checkout.changed'))).toBeTruthy();
  expect(screen.queryByText(t('subscriptions.checkout.confirm'))).toBeNull();
  expect(start).not.toHaveBeenCalled();
});

function state() {
  return {
    plan: 'free',
    status: 'free',
    offerId: 'free',
    catalogVersion: '2026-01',
    startedAt: null,
    trialEndsAt: null,
    renewsAt: null,
    accessEndsAt: null,
    limits: { assistantQuestions: 5 },
    version: 1,
    paidContentAccess: 'editable',
    updatedAt: 1
  };
}

function catalog() {
  return {
    version: '2026-01',
    offers: [
      { offerId: 'basic-monthly', name: 'Basic', plan: 'basic', billingPeriod: 'monthly', priceMinor: 1900, currency: 'SAR', features: [], limits: {}, trial: { eligible: true, durationDays: 7, trialPriceMinor: 0, postTrialPriceMinor: 1900 }, renewalTermsKey: 'renew.basic', cancellationTermsKey: 'cancel.basic', catalogVersion: '2026-01', effectiveAt: 1 },
      { offerId: 'premium-annual', name: 'Premium', plan: 'premium', billingPeriod: 'annual', priceMinor: 19000, currency: 'SAR', features: [], limits: {}, trial: { eligible: true, durationDays: 7, trialPriceMinor: 0, postTrialPriceMinor: 19000 }, renewalTermsKey: 'renew.premium', cancellationTermsKey: 'cancel.premium', catalogVersion: '2026-01', effectiveAt: 1 }
    ]
  };
}
