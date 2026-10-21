import React from 'react';
import { AppState, Platform, type AppStateStatus } from 'react-native';
import { act, fireEvent, screen } from '@testing-library/react-native';
import { router } from 'expo-router';
import { HomeScreen } from './HomeScreen';
import { TrackingHomeCard } from '@/features/tracking/TrackingHomeCard';
import { InitialHomeLoadingBoundary } from '@/features/shell/InitialHomeLoadingBoundary';
import { createLiveAutomaticTrackingService } from '@/services/live/automatic-tracking-service';
import { renderWithProviders } from '@/test-utils/render';
import { changeLocale } from '@/localization/i18n';
import { usePreferenceStore } from '@/state/preferences';
import { useAppShellStore } from '@/state/app-shell';
import { buildPreferences } from '@/domain/foundation';

const mockGetStatus = jest.fn();
const mockReadNotificationPermission = jest.fn();
const mockReadSmsPermission = jest.fn();
const mockReadNotificationAccess = jest.fn();
const mockReadSources = jest.fn();
jest.mock('@/services/automatic-tracking-service', () => ({
  automaticTrackingService: { getStatus: () => mockGetStatus() }
}));
jest.mock('@/config/mobile-automation', () => ({ isMobileAutomationEnabled: () => true }));
jest.mock('@/services/platform/phone-notification-service', () => ({
  phoneNotificationService: { getPermission: () => mockReadNotificationPermission() }
}));
jest.mock('@/services/platform/tracking-permission-service', () => ({
  createTrackingPermissionService: () => ({ getState: () => mockReadSmsPermission() })
}));
jest.mock('@/services/platform/bank-notification-service', () => ({
  bankNotificationService: { getAccessState: () => mockReadNotificationAccess() }
}));
jest.mock('@/services/tracking-source-preferences', () => ({
  trackingSourcePreferences: { load: () => mockReadSources() }
}));
jest.mock('@/features/core-finance/core-finance-queries', () => ({
  useHomeBalanceSummary: () => ({ data: {
    totalBalanceMinor: 125000, currencyCode: 'SAR', isEstimated: false,
    components: [], excludedAccountIds: [], periodIncomeMinor: 0, periodExpenseMinor: 0,
    activeAccountCount: 1, recentTransactions: [], reviewCount: 0, pendingSyncCount: 0, dataState: 'ready'
  }, isLoading: false, isError: false }),
  useAccounts: () => ({ data: [] }),
  useCategories: () => ({ data: [] }),
  useAccountBalances: () => ({ data: [] })
}));
jest.mock('./useHomeTodayActivity', () => ({
  useHomeTodayActivity: () => ({ data: [], isError: false, isFetching: false })
}));
jest.mock('@/features/settings/settings-queries', () => ({
  useSettingsProfile: () => ({ data: { name: 'Dana' } })
}));
jest.mock('expo-router', () => ({
  router: { push: jest.fn() },
  usePathname: () => '/home',
  useFocusEffect: (callback: () => (() => void) | undefined) => {
    const React = jest.requireActual<typeof import('react')>('react');
    React.useEffect(callback, [callback]);
  }
}));

const status = {
  available: true, mode: 'automatic_clear', lastDetectedAt: null,
  lastSuccessfulTransactionId: null, detectedThisMonth: 0, reviewCount: 0,
  activeKeywordCount: 1, activeSenderCount: 1, lastUpdatedAt: '2026-10-21T08:00:00Z'
};
const never = () => new Promise<Response>(() => undefined);
const previousPlatform = Platform.OS;

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  mockReadNotificationPermission.mockResolvedValue('denied');
  mockReadSmsPermission.mockResolvedValue({ status: 'granted' });
  mockReadNotificationAccess.mockResolvedValue('granted');
  mockReadSources.mockResolvedValue({ smsEnabled: true, notificationEnabled: true });
  changeLocale('en');
  Object.defineProperty(Platform, 'OS', { configurable: true, value: 'android' });
  usePreferenceStore.setState({ ...buildPreferences({ locale: 'en' }), reducedMotion: true, hydrated: true });
  useAppShellStore.setState({ hydrated: true, profileSetupStatus: 'complete', session: {
    status: 'authenticated', userId: 'readiness-owner', method: 'google', issuedAt: 1,
    expiresAt: Date.now() + 60000, restoration: 'restored'
  } });
});

it.each(['display-permission', 'sms-permission', 'notification-access', 'source-preferences'] as const)(
  'reveals ready Home when the initial %s read never returns',
  async (stage) => {
    // October 21: an optional native/storage read must not keep Home behind its startup cover.
    const pending = new Promise(() => undefined);
    const reads = {
      'display-permission': mockReadNotificationPermission,
      'sms-permission': mockReadSmsPermission,
      'notification-access': mockReadNotificationAccess,
      'source-preferences': mockReadSources
    };
    reads[stage].mockReturnValue(pending);
    const request = jest.fn<ReturnType<typeof fetch>, Parameters<typeof fetch>>()
      .mockResolvedValue(new Response(JSON.stringify(status), { status: 200 }));
    const service = createLiveAutomaticTrackingService({ token: async () => 'owner-token', request });
    mockGetStatus.mockImplementation(() => service.getStatus());
    const view = renderHome();
    try {
      await act(async () => { await jest.advanceTimersByTimeAsync(14_999); });
      expect(screen.getByTestId('startup-loading')).toBeTruthy();
      await act(async () => { await jest.advanceTimersByTimeAsync(2); });
      expect(screen.queryByTestId('startup-loading')).toBeNull();
      expect(screen.getByTestId('home-account-card')).toBeTruthy();
      if (stage === 'display-permission')
        expect(screen.queryByTestId('notification-home-card')).toBeNull();
      else
        expect(screen.getByRole('button', { name: 'Enable notifications' })).toBeTruthy();
    } finally {
      view.unmount();
    }
  }
);

afterEach(() => {
  jest.useRealTimers();
  Object.defineProperty(Platform, 'OS', { configurable: true, value: previousPlatform });
});

function renderHome() {
  const view = renderWithProviders(
    <InitialHomeLoadingBoundary isHome>
      <HomeScreen notice={<TrackingHomeCard />} />
    </InitialHomeLoadingBoundary>
  );
  fireEvent(screen.getByTestId('initial-home-content', { includeHiddenElements: true }), 'layout', {
    nativeEvent: { layout: { x: 0, y: 0, width: 360, height: 720 } }
  });
  return view;
}

it.each(['failure', 'deadline'] as const)(
  'releases the real Home notice gate on tracking %s with display notifications denied',
  async (mode) => {
    const request = jest.fn<ReturnType<typeof fetch>, Parameters<typeof fetch>>()
      .mockImplementation(mode === 'deadline' ? never : async () => { throw new Error('offline'); });
    const service = createLiveAutomaticTrackingService({ token: async () => 'owner-token', request });
    mockGetStatus.mockImplementation(() => service.getStatus());
    const view = renderHome();
    try {
      await act(async () => { await jest.advanceTimersByTimeAsync(0); });
      if (mode === 'deadline') {
        expect(screen.getByTestId('startup-loading')).toBeTruthy();
        await act(async () => { await jest.advanceTimersByTimeAsync(15_001); });
      }
      expect(screen.queryByTestId('startup-loading')).toBeNull();
      expect(screen.getByTestId('home-account-card')).toBeTruthy();
      fireEvent.press(screen.getByRole('button', { name: 'Enable notifications' }));
      expect(router.push).toHaveBeenCalledWith('/settings/application');
    } finally {
      view.unmount();
    }
  }
);

it('keeps the Home visible while foreground tracking refresh uses cached data and later times out', async () => {
  const listeners = new Set<(state: AppStateStatus) => void>();
  const original = jest.mocked(AppState.addEventListener).getMockImplementation();
  const spy = jest.spyOn(AppState, 'addEventListener').mockImplementation((_event, listener) => {
    listeners.add(listener);
    return { remove: () => { listeners.delete(listener); } };
  });
  const request = jest.fn<ReturnType<typeof fetch>, Parameters<typeof fetch>>()
    .mockResolvedValueOnce(new Response(JSON.stringify(status), { status: 200 }))
    .mockImplementation(never);
  const service = createLiveAutomaticTrackingService({ token: async () => 'owner-token', request });
  mockGetStatus.mockImplementation(() => service.getStatus());
  const view = renderHome();
  try {
    await act(async () => { await jest.advanceTimersByTimeAsync(0); });
    expect(screen.queryByTestId('startup-loading')).toBeNull();
    await act(async () => {
      listeners.forEach((listener) => listener('active'));
      await jest.advanceTimersByTimeAsync(0);
    });
    expect(request).toHaveBeenCalledTimes(2);
    expect(screen.queryByTestId('startup-loading')).toBeNull();
    await act(async () => { await jest.advanceTimersByTimeAsync(15_001); });
    expect(screen.queryByTestId('startup-loading')).toBeNull();
    expect(screen.getByTestId('notification-home-card')).toBeTruthy();
  } finally {
    view.unmount();
    spy.mockRestore();
    if (original) jest.mocked(AppState.addEventListener).mockImplementation(original);
  }
});
