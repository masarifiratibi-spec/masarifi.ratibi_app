import React from 'react';
import { fireEvent, screen } from '@testing-library/react-native';
import { router } from 'expo-router';

import { renderWithProviders } from '@/test-utils/render';
import { changeLocale, translateDynamic as t } from '@/localization/i18n';

jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));
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
const { SubscriptionScreen } = require('./SubscriptionScreen') as Record<string, React.ComponentType>;

beforeEach(() => {
  jest.clearAllMocks();
  changeLocale('en');
  mockQueries.useSubscriptionCatalog.mockReturnValue({ data: catalog(), isLoading: false, isError: false });
  mockQueries.useSubscriptionState.mockReturnValue({ data: state(), isLoading: false, isError: false });
  mockQueries.useStartSubscriptionOperation.mockReturnValue({ mutate: jest.fn(), isPending: false });
});

test('shows current plan, all offers from one catalog, exact terms, limits, and representative disclosure', () => {
  renderWithProviders(<SubscriptionScreen />);

  expect(screen.getByText('Current plan: Free')).toBeTruthy();
  expect(screen.getByText('Free')).toBeTruthy();
  expect(screen.getByText('Basic')).toBeTruthy();
  expect(screen.getByText('Premium')).toBeTruthy();
  expect(screen.getByText('19.00 SAR / month')).toBeTruthy();
  expect(screen.getByText('190.00 SAR / year')).toBeTruthy();
  expect(screen.getAllByText('Smart financial assistant').length).toBeGreaterThan(0);
  expect(screen.getByText('30 assistant questions')).toBeTruthy();
  expect(screen.getAllByText('7-day representative trial available').length).toBeGreaterThan(0);
  expect(screen.getByText('The Basic plan renews monthly in this representative flow.')).toBeTruthy();
  expect(screen.getAllByText('You can schedule cancellation before the next representative renewal.')).toHaveLength(2);
  expect(screen.getByText(t('subscriptions.representative.notice'))).toBeTruthy();
});

test('routes checkout, restore, and manage actions without changing entitlement locally', () => {
  const start = jest.fn();
  mockQueries.useStartSubscriptionOperation.mockReturnValue({ mutate: start, isPending: false });
  renderWithProviders(<SubscriptionScreen />);

  fireEvent.press(screen.getByText('Choose Basic'));
  fireEvent.press(screen.getByText(t('subscriptions.action.restore')));
  fireEvent.press(screen.getByText(t('subscriptions.action.manage')));

  expect(router.push).toHaveBeenCalledWith('/subscriptions/checkout?offerId=basic-monthly');
  expect(start).toHaveBeenCalledWith(expect.objectContaining({
    input: { kind: 'restore', offerId: 'basic-monthly', catalogVersion: '2026-01' },
    expectedVersion: 1
  }));
  expect(router.push).toHaveBeenCalledWith('/subscriptions/manage');
});

test('renders catalog terms and actions in Arabic without exposing message keys', () => {
  changeLocale('ar');
  renderWithProviders(<SubscriptionScreen />);

  expect(screen.getByText('الخطة الحالية: مجانية')).toBeTruthy();
  expect(screen.getByText('19.00 SAR / شهر')).toBeTruthy();
  expect(screen.getByText('اختر أساسية')).toBeTruthy();
  expect(screen.queryByText(/subscriptions\./)).toBeNull();
});

test('shows loading, error, limit, expiry, and read-only states', () => {
  mockQueries.useSubscriptionCatalog.mockReturnValueOnce({ data: null, isLoading: true, isError: false });
  const loading = renderWithProviders(<SubscriptionScreen />);
  expect(screen.getByText(t('subscriptions.state.loading'))).toBeTruthy();
  loading.unmount();

  mockQueries.useSubscriptionCatalog.mockReturnValue({ data: null, isLoading: false, isError: true });
  const error = renderWithProviders(<SubscriptionScreen />);
  expect(screen.getByText(t('subscriptions.state.error'))).toBeTruthy();
  error.unmount();

  mockQueries.useSubscriptionCatalog.mockReturnValue({ data: catalog(), isLoading: false, isError: false });
  mockQueries.useSubscriptionState.mockReturnValue({ data: { ...state(), status: 'expired', paidContentAccess: 'read_only' }, isLoading: false, isError: false });
  renderWithProviders(<SubscriptionScreen />);
  expect(screen.getByText(t('subscriptions.state.expired'))).toBeTruthy();
  expect(screen.getByText(t('subscriptions.access.readOnly'))).toBeTruthy();
  expect(screen.getByText(t('subscriptions.limit.reached'))).toBeTruthy();
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
      offer('free', 'Free', 'free', 'none', 0, { assistantQuestions: 5 }, false),
      offer('basic-monthly', 'Basic', 'basic', 'monthly', 1900, { assistantQuestions: 30 }, true),
      offer('premium-annual', 'Premium', 'premium', 'annual', 19000, { assistantQuestions: 200 }, true)
    ]
  };
}

function offer(offerId: string, name: string, plan: string, billingPeriod: string, priceMinor: number, limits: Record<string, number>, eligible: boolean) {
  return {
    offerId,
    name,
    plan,
    billingPeriod,
    priceMinor,
    currency: 'SAR',
    features: ['subscriptions.feature.assistant'],
    limits,
    trial: { eligible, durationDays: eligible ? 7 : 0, trialPriceMinor: 0, postTrialPriceMinor: priceMinor },
    renewalTermsKey: `subscriptions.terms.renewal.${plan}`,
    cancellationTermsKey: `subscriptions.terms.cancellation.${plan}`,
    catalogVersion: '2026-01',
    effectiveAt: 1
  };
}
