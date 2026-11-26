import { clearTrackingIsolation } from '@/test-utils/tracking-admission';
import React from 'react';
import {
  within,
  act,
  fireEvent,
  screen,
  waitFor
} from '@testing-library/react-native';
import {
  AppState,
  type AppStateStatus,
  PixelRatio,
  Platform
} from 'react-native';
import { router } from 'expo-router';

import { automaticTrackingKeys } from '@/state/automatic-tracking-view-state';
import { renderWithProviders, renderWithQueryData } from '@/test-utils/render';
import { resolveTheme } from '@/design-system/theme';
import { changeLocale, translate } from '@/localization/i18n';
import {
  TrackingStatusScreen,
  TrackingSyncPanel
} from './TrackingStatusScreen';
import { createAppShellStorage } from '@/storage/app-shell-storage';
import { defaultKeywordRules } from '@/services/mocks/default-keywords';
import { automaticTrackingService } from '@/services/automatic-tracking-service';
import * as trackingPermissionModule from '@/services/platform/tracking-permission-service';
import { permissionState } from '@/services/mocks/tracking-permission-service';
import type { TrackingStatusSnapshot } from '@/domain/automatic-tracking';
import { usePreferenceStore } from '@/state/preferences';
import { bankNotificationService } from '@/services/platform/bank-notification-service';
import { trackingSourcePreferences } from '@/services/tracking-source-preferences';
import { TrackingHomeCard } from './TrackingHomeCard';
import { phoneNotificationService } from '@/services/platform/phone-notification-service';
import { useAppShellStore } from '@/state/app-shell';
import * as coordinator from '@/services/automatic-tracking-coordinator';
import {
  beginTrackingAdmission,
  isolateTrackingForOwner
} from '@/state/tracking-admission';

const openSmsSettings = jest.fn(async () => undefined);
const responsiveStatus: TrackingStatusSnapshot = {
  platform: 'android',
  mode: 'automatic_clear',
  permissionStatus: 'granted',
  smsPermissionStatus: 'granted',
  notificationAccessStatus: 'granted',
  smsTrackingEnabled: false,
  notificationTrackingEnabled: false,
  serviceState: 'healthy',
  lastDetectedAt: null,
  lastSuccessfulTransactionId: null,
  detectedThisMonth: 0,
  reviewCount: 0,
  activeKeywordCount: 113,
  activeSenderCount: 0,
  lastUpdatedAt: 1
};

it('shows the tracking frame during its first status read without inventing source states', () => {
  const read = jest
    .spyOn(automaticTrackingService, 'getStatus')
    .mockImplementation(() => new Promise<never>(() => {}));
  const view = renderWithProviders(<TrackingStatusScreen />);
  try {
    expect(view.getByTestId('tracking-status-screen')).toBeOnTheScreen();
    expect(
      view.getByText(translate('tracking.header.title'))
    ).toBeOnTheScreen();
    expect(view.queryAllByRole('switch')).toHaveLength(0);
  } finally {
    view.unmount();
    read.mockRestore();
  }
});

function renderStatus(
  status: TrackingStatusSnapshot,
  requestedPermissionStatus = status.permissionStatus ?? 'not_requested',
  options: {
    loadStatus?: () => Promise<TrackingStatusSnapshot>;
    smsPermission?: ReturnType<typeof permissionState>['status'];
    homeSetup?: boolean;
  } = {}
) {
  jest
    .spyOn(trackingSourcePreferences, 'ensureDisabled')
    .mockImplementation((source) =>
      trackingSourcePreferences.set(source, false)
    );
  jest
    .spyOn(automaticTrackingService, 'getStatus')
    .mockImplementation(options.loadStatus ?? (async () => status));
  jest
    .spyOn(bankNotificationService, 'getAccessState')
    .mockResolvedValue(status.notificationAccessStatus ?? 'denied');
  jest.spyOn(trackingSourcePreferences, 'load').mockResolvedValue({
    smsEnabled:
      status.smsTrackingEnabled ??
      (status.mode !== 'paused' && status.permissionStatus === 'granted'),
    notificationEnabled: status.notificationTrackingEnabled ?? false
  });
  jest
    .spyOn(trackingPermissionModule, 'createTrackingPermissionService')
    .mockReturnValue({
      getState: async () =>
        permissionState(
          options.smsPermission ??
            status.smsPermissionStatus ??
            status.permissionStatus ??
            'not_requested'
        ),
      requestAfterEducation: jest.fn(async () =>
        permissionState(requestedPermissionStatus)
      ),
      openSettings: openSmsSettings
    });
  return renderWithQueryData(
    <>
      <TrackingStatusScreen />
      {options.homeSetup ? <TrackingHomeCard /> : null}
    </>,
    [[automaticTrackingKeys.status, status]]
  );
}

async function readyControl(testID: string) {
  await waitFor(() => expect(screen.getByTestId(testID)).toBeEnabled());
  return screen.getByTestId(testID);
}

describe('TrackingStatusScreen', () => {
  it('shows the normal tracking layout and browsable steps before account admission without starting reads or capture', async () => {
    const previousPlatform = Platform.OS;
    Platform.OS = 'android';
    const read = jest.spyOn(automaticTrackingService, 'getStatus');
    const keywords = jest.spyOn(automaticTrackingService, 'listKeywordRules');
    act(() => beginTrackingAdmission());
    const view = renderWithQueryData(<TrackingStatusScreen />, []);
    try {
      expect(screen.getByTestId('tracking-status-screen')).toBeOnTheScreen();
      expect(
        screen.getByText(translate('tracking.source.smsTracking'))
      ).toBeOnTheScreen();
      expect(
        screen.getByText(translate('tracking.source.notificationTracking'))
      ).toBeOnTheScreen();
      expect(screen.getByTestId('tracking-sms-switch')).toBeDisabled();
      expect(screen.getByTestId('tracking-notification-switch')).toBeDisabled();
      expect(
        screen.queryByText(translate('tracking.unverified.title'))
      ).toBeNull();
      fireEvent.press(screen.getByTestId('tracking-setup-toggle'));
      fireEvent.press(screen.getByTestId('tracking-guide-sms'));
      expect(screen.getByTestId('tracking-guide-open-settings')).toBeDisabled();
      expect(read).not.toHaveBeenCalled();
      expect(keywords).not.toHaveBeenCalled();
    } finally {
      view.unmount();
      Platform.OS = previousPlatform;
      act(() => clearTrackingIsolation());
    }
  });

  it('shows the complete tracking layout and setup guide while the first status request is pending', async () => {
    const previousPlatform = Platform.OS;
    Platform.OS = 'android';
    jest
      .spyOn(automaticTrackingService, 'getStatus')
      .mockReturnValue(new Promise(() => {}));
    const view = renderWithQueryData(<TrackingStatusScreen />, []);
    try {
      expect(screen.getByTestId('tracking-status-screen')).toBeOnTheScreen();
      expect(screen.getByTestId('tracking-sms-switch')).toBeDisabled();
      expect(screen.getByTestId('tracking-notification-switch')).toBeDisabled();
      expect(screen.getByTestId('tracking-setup-guide')).toBeOnTheScreen();
      expect(screen.getByTestId('tracking-alert-settings')).toBeOnTheScreen();
      expect(screen.getByTestId('tracking-keywords-card')).toBeOnTheScreen();
    } finally {
      view.unmount();
      Platform.OS = previousPlatform;
    }
  });

  it.each(['dark', 'light'] as const)(
    'uses matching page, card and text colors in %s mode',
    async (mode) => {
      const prior = usePreferenceStore.getState().theme;
      usePreferenceStore.setState({ theme: mode, hydrated: true });
      const view = renderStatus(responsiveStatus);
      try {
        const { colors } = resolveTheme(mode);
        expect(await screen.findByTestId('tracking-status-screen')).toHaveStyle(
          { backgroundColor: colors.surfaces.page }
        );
        expect(await screen.findByTestId('tracking-keywords-card')).toHaveStyle(
          { backgroundColor: colors.surfaces.card }
        );
        for (const key of [
          'tracking.source.smsTracking',
          'tracking.source.notificationTracking'
        ] as const) {
          expect(screen.getByText(translate(key))).toHaveStyle({
            color: colors.content.primary
          });
        }
      } finally {
        view.unmount();
        usePreferenceStore.setState({ theme: prior });
      }
    }
  );

  it('does not use a cached SMS grant to activate a newly denied native permission', async () => {
    const push = jest.spyOn(router, 'push').mockImplementation(jest.fn());
    const save = jest
      .spyOn(trackingSourcePreferences, 'set')
      .mockResolvedValue({ smsEnabled: true, notificationEnabled: false });
    jest
      .spyOn(automaticTrackingService, 'setMode')
      .mockResolvedValue({ ...responsiveStatus, mode: 'automatic_clear' });
    const view = renderStatus(
      { ...responsiveStatus, mode: 'paused' },
      'denied',
      {
        smsPermission: 'denied',
        loadStatus: () => new Promise(() => undefined)
      }
    );
    try {
      fireEvent.press(await readyControl('tracking-sms-switch'));
      await waitFor(() => expect(openSmsSettings).toHaveBeenCalledTimes(1));
      expect(push).not.toHaveBeenCalled();
      expect(save).not.toHaveBeenCalledWith('sms', true);
    } finally {
      view.unmount();
    }
  });

  it('keeps a pending intent across reopening and lets the newer OFF win', async () => {
    let finishMode: (() => void) | undefined;
    let persisted = { smsEnabled: false, notificationEnabled: false };
    const writes: string[] = [];
    jest
      .spyOn(automaticTrackingService, 'setMode')
      .mockImplementation(async (mode) => {
        if (mode === 'automatic_clear')
          await new Promise<void>((resolve) => {
            finishMode = resolve;
          });
        writes.push(mode);
        return { ...responsiveStatus, mode };
      });
    jest
      .spyOn(trackingSourcePreferences, 'set')
      .mockImplementation(async (source, enabled) => {
        persisted = {
          ...persisted,
          [source === 'sms' ? 'smsEnabled' : 'notificationEnabled']: enabled
        };
        return persisted;
      });
    const first = renderStatus({ ...responsiveStatus, mode: 'paused' });
    let firstMounted = true;
    let reopened: ReturnType<typeof renderStatus> | undefined;
    try {
      fireEvent.press(await readyControl('tracking-sms-switch'));
      await waitFor(() => expect(finishMode).toBeDefined());
      first.unmount();
      firstMounted = false;
      reopened = renderStatus({ ...responsiveStatus, mode: 'paused' });
      jest
        .mocked(trackingSourcePreferences.load)
        .mockImplementation(async () => persisted);
      expect(
        screen.getByTestId('tracking-sms-switch')
      ).toHaveAccessibilityState({ checked: true });
      fireEvent.press(screen.getByTestId('tracking-sms-switch'));
      expect(
        screen.getByTestId('tracking-sms-switch')
      ).toHaveAccessibilityState({ checked: false });
      await act(async () => finishMode?.());
      await waitFor(() =>
        expect(writes).toEqual(['automatic_clear', 'paused'])
      );
      expect(persisted.smsEnabled).toBe(false);
    } finally {
      await act(async () => finishMode?.());
      if (firstMounted) first.unmount();
      reopened?.unmount();
    }
  });

  it('does not grant a source when native activation fails', async () => {
    let persisted = { smsEnabled: false, notificationEnabled: false };
    jest
      .spyOn(trackingSourcePreferences, 'set')
      .mockImplementation(async (source, enabled) => {
        persisted = {
          ...persisted,
          [source === 'sms' ? 'smsEnabled' : 'notificationEnabled']: enabled
        };
        return persisted;
      });
    const native = jest
      .spyOn(bankNotificationService, 'setCaptureEnabled')
      .mockImplementation(async (enabled) => {
        if (enabled) throw new Error('native activation unavailable');
      });
    const view = renderStatus(responsiveStatus);
    jest
      .mocked(trackingSourcePreferences.load)
      .mockImplementation(async () => persisted);
    try {
      fireEvent.press(await readyControl('tracking-notification-switch'));
      expect(
        await screen.findByText(translate('tracking.state.error'))
      ).toBeOnTheScreen();
      expect(persisted.notificationEnabled).toBe(false);
      expect(native).toHaveBeenCalledWith(false);
      expect(
        screen.getByTestId('tracking-notification-switch')
      ).toHaveAccessibilityState({ checked: false });
    } finally {
      view.unmount();
    }
  });

  it('does not finish a delayed activation after its admitted context changes', async () => {
    let finishMode!: () => void;
    let persisted = { smsEnabled: false, notificationEnabled: false };
    jest
      .spyOn(automaticTrackingService, 'setMode')
      .mockImplementation(async (mode) => {
        await new Promise<void>((resolve) => {
          finishMode = resolve;
        });
        return { ...responsiveStatus, mode };
      });
    jest
      .spyOn(trackingSourcePreferences, 'set')
      .mockImplementation(async (source, enabled) => {
        persisted = {
          ...persisted,
          [source === 'sms' ? 'smsEnabled' : 'notificationEnabled']: enabled
        };
        return persisted;
      });
    const view = renderStatus({ ...responsiveStatus, mode: 'paused' });
    try {
      fireEvent.press(await readyControl('tracking-sms-switch'));
      await waitFor(() => expect(finishMode).toBeDefined());
      act(() => beginTrackingAdmission());
      await act(async () => finishMode());
      expect(persisted.smsEnabled).toBe(false);
      expect(screen.queryByTestId('tracking-sms-switch')).toBeNull();
    } finally {
      if (finishMode) await act(async () => finishMode());
      view.unmount();
      act(() => clearTrackingIsolation());
    }
  });

  it('shows an immediate source intent and lets OFF supersede a delayed activation', async () => {
    let finishMode: (() => void) | undefined;
    let persisted = { smsEnabled: false, notificationEnabled: false };
    jest
      .spyOn(automaticTrackingService, 'setMode')
      .mockImplementation(async (mode) => {
        if (mode === 'automatic_clear')
          await new Promise<void>((resolve) => {
            finishMode = resolve;
          });
        return { ...responsiveStatus, mode };
      });
    jest
      .spyOn(trackingSourcePreferences, 'set')
      .mockImplementation(async (source, enabled) => {
        persisted = {
          ...persisted,
          [source === 'sms' ? 'smsEnabled' : 'notificationEnabled']: enabled
        };
        return persisted;
      });
    const view = renderStatus({ ...responsiveStatus, mode: 'paused' });
    jest
      .mocked(trackingSourcePreferences.load)
      .mockImplementation(async () => persisted);
    try {
      fireEvent.press(await readyControl('tracking-sms-switch'));
      expect(
        screen.getByTestId('tracking-sms-switch')
      ).toHaveAccessibilityState({ checked: true });
      expect(screen.getByTestId('tracking-sms-switch')).toBeEnabled();
      await waitFor(() => expect(finishMode).toBeDefined());
      fireEvent.press(screen.getByTestId('tracking-sms-switch'));
      expect(
        screen.getByTestId('tracking-sms-switch')
      ).toHaveAccessibilityState({ checked: false });
      await act(async () => finishMode?.());
      await waitFor(() => expect(persisted.smsEnabled).toBe(false));
      expect(
        screen.getByTestId('tracking-sms-switch')
      ).toHaveAccessibilityState({ checked: false });
    } finally {
      await act(async () => finishMode?.());
      view.unmount();
    }
  });

  it('keeps the other source and keyword controls responsive during a consent write', async () => {
    let finishSms: (() => void) | undefined;
    let persisted = { smsEnabled: false, notificationEnabled: false };
    jest
      .spyOn(trackingSourcePreferences, 'set')
      .mockImplementation(async (source, enabled) => {
        if (source === 'sms' && enabled)
          await new Promise<void>((resolve) => {
            finishSms = resolve;
          });
        persisted = {
          ...persisted,
          [source === 'sms' ? 'smsEnabled' : 'notificationEnabled']: enabled
        };
        return persisted;
      });
    jest
      .spyOn(bankNotificationService, 'setCaptureEnabled')
      .mockResolvedValue();
    const view = renderStatus(responsiveStatus);
    jest
      .mocked(trackingSourcePreferences.load)
      .mockImplementation(async () => persisted);
    try {
      fireEvent.press(await readyControl('tracking-sms-switch'));
      expect(
        screen.getByTestId('tracking-sms-switch')
      ).toHaveAccessibilityState({ checked: true });
      expect(screen.getByTestId('tracking-notification-switch')).toBeEnabled();
      expect(
        await screen.findByTestId('tracking-add-keyword-toggle')
      ).toBeEnabled();
      fireEvent.press(screen.getByTestId('tracking-notification-switch'));
      expect(
        screen.getByTestId('tracking-notification-switch')
      ).toHaveAccessibilityState({ checked: true });
      await act(async () => finishSms?.());
      await waitFor(() =>
        expect(persisted).toEqual({
          smsEnabled: true,
          notificationEnabled: true
        })
      );
    } finally {
      await act(async () => finishSms?.());
      view.unmount();
    }
  });

  it('keeps saved controls usable while a background status read is pending', async () => {
    renderStatus(
      {
        platform: 'android',
        mode: 'automatic_clear',
        permissionStatus: 'granted',
        smsPermissionStatus: 'granted',
        notificationAccessStatus: 'granted',
        smsTrackingEnabled: false,
        notificationTrackingEnabled: false,
        serviceState: 'healthy',
        lastDetectedAt: null,
        lastSuccessfulTransactionId: null,
        detectedThisMonth: 0,
        reviewCount: 0,
        activeKeywordCount: 113,
        activeSenderCount: 0,
        lastUpdatedAt: 1
      },
      'granted',
      { loadStatus: () => new Promise(() => undefined) }
    );
    await act(async () => {});
    expect(screen.getByTestId('tracking-sms-switch')).toBeEnabled();
    expect(screen.getByTestId('tracking-notification-switch')).toBeEnabled();
    expect(
      await screen.findByTestId('tracking-add-keyword-toggle')
    ).toBeEnabled();
  });

  it.each(['scanning', 'processing'] as const)(
    'keeps routine %s work out of the customer interface',
    (status) => {
      renderWithQueryData(
        <TrackingSyncPanel
          state={{
            status,
            sessionId: null,
            reviewId: null,
            duplicateId: null,
            errorCode: null
          }}
          onRetry={() => undefined}
        />,
        []
      );
      expect(
        screen.queryByText(translate('tracking.sync.scanning'))
      ).toBeNull();
      expect(
        screen.queryByText(translate('tracking.sync.processing'))
      ).toBeNull();
    }
  );

  it('shows a locally disabled source as off while its server revocation remains pending', async () => {
    let enabled = true;
    jest
      .spyOn(trackingSourcePreferences, 'set')
      .mockImplementation(async () => {
        enabled = false;
        throw new Error('offline_revocation');
      });
    jest
      .spyOn(trackingSourcePreferences, 'hasPendingConsent')
      .mockImplementation(async () => !enabled);
    renderStatus({
      platform: 'android',
      mode: 'automatic_clear',
      permissionStatus: 'granted',
      smsPermissionStatus: 'granted',
      notificationAccessStatus: 'granted',
      smsTrackingEnabled: true,
      notificationTrackingEnabled: false,
      serviceState: 'healthy',
      lastDetectedAt: null,
      lastSuccessfulTransactionId: null,
      detectedThisMonth: 0,
      reviewCount: 0,
      activeKeywordCount: 0,
      activeSenderCount: 0,
      lastUpdatedAt: 1
    });
    jest
      .mocked(trackingSourcePreferences.load)
      .mockImplementation(async () => ({
        smsEnabled: enabled,
        notificationEnabled: false
      }));
    fireEvent.press(await readyControl('tracking-sms-switch'));
    await waitFor(() =>
      expect(
        screen.getByTestId('tracking-sms-switch')
      ).toHaveAccessibilityState({ checked: false })
    );
    expect(
      await screen.findByText(translate('tracking.sources.pendingConsent'))
    ).toBeOnTheScreen();
  });
  it('shows a pending source command without activating it on screen open and offers an explicit retry', async () => {
    let pending = true;
    jest
      .spyOn(trackingSourcePreferences, 'hasPendingConsent')
      .mockImplementation(async () => pending);
    const retry = jest
      .spyOn(trackingSourcePreferences, 'retryPendingConsent')
      .mockResolvedValue(false);
    const resync = jest
      .spyOn(coordinator, 'resyncAutomaticTracking')
      .mockImplementation(async () => {
        pending = false;
        return {
          status: 'idle',
          sessionId: null,
          reviewId: null,
          duplicateId: null,
          errorCode: null
        };
      });
    renderStatus({
      platform: 'android',
      mode: 'automatic_clear',
      permissionStatus: 'granted',
      smsTrackingEnabled: false,
      notificationTrackingEnabled: false,
      serviceState: 'healthy',
      lastDetectedAt: null,
      lastSuccessfulTransactionId: null,
      detectedThisMonth: 0,
      reviewCount: 0,
      activeKeywordCount: 0,
      activeSenderCount: 0,
      lastUpdatedAt: 1
    });
    expect(
      await screen.findByText(translate('tracking.sources.pendingConsent'))
    ).toBeOnTheScreen();
    expect(retry).not.toHaveBeenCalled();
    expect(resync).not.toHaveBeenCalled();
    fireEvent.press(screen.getByTestId('tracking-consent-retry'));
    await waitFor(() => expect(resync).toHaveBeenCalledTimes(1));
    await waitFor(() =>
      expect(
        screen.queryByText(translate('tracking.sources.pendingConsent'))
      ).toBeNull()
    );
  });
  it('shows preserved Tracking as unavailable without mounting capture controls or reads', () => {
    changeLocale('ar');
    isolateTrackingForOwner('user_currentA');
    const read = jest.spyOn(automaticTrackingService, 'getStatus');
    try {
      renderWithQueryData(<TrackingStatusScreen />, []);
      expect(
        screen.getByText('التتبع معلّق لحماية بيانات محفوظة')
      ).toBeOnTheScreen();
      expect(screen.queryByTestId('tracking-add-keyword-toggle')).toBeNull();
      expect(read).not.toHaveBeenCalled();
    } finally {
      act(() => clearTrackingIsolation());
    }
  });
  it('waits for the keyword list before allowing edits', async () => {
    let finishLoad!: (
      rules: Awaited<
        ReturnType<typeof automaticTrackingService.listKeywordRules>
      >
    ) => void;
    jest.spyOn(automaticTrackingService, 'listKeywordRules').mockReturnValue(
      new Promise((resolve) => {
        finishLoad = resolve;
      })
    );
    renderStatus({
      platform: 'android',
      mode: 'automatic_clear',
      permissionStatus: 'granted',
      serviceState: 'healthy',
      lastDetectedAt: null,
      lastSuccessfulTransactionId: null,
      detectedThisMonth: 0,
      reviewCount: 0,
      activeKeywordCount: 22,
      activeSenderCount: 0,
      lastUpdatedAt: Date.now()
    });
    expect(screen.queryByTestId('tracking-add-keyword-toggle')).toBeNull();
    await act(async () => {
      finishLoad(
        defaultKeywordRules.map((rule) => ({
          ...rule,
          recentUseCount: 0,
          lastUsedAt: null
        }))
      );
    });
    expect(
      await screen.findByTestId('tracking-add-keyword-toggle')
    ).toBeEnabled();
  });

  it('leaves a saved capture visible through financial screens without a success banner', () => {
    renderWithQueryData(
      <TrackingSyncPanel
        state={{
          status: 'imported',
          sessionId: 'saved',
          reviewId: null,
          duplicateId: null,
          errorCode: null
        }}
        onRetry={() => undefined}
      />,
      []
    );
    expect(screen.queryByText(translate('tracking.status.enabled'))).toBeNull();
  });
  it('refreshes effective native configuration after saving a keyword override', async () => {
    const refreshed = jest
      .spyOn(coordinator, 'updateAutomaticTrackingKeywords')
      .mockResolvedValue(undefined);
    jest.spyOn(automaticTrackingService, 'listKeywordRules').mockResolvedValue(
      defaultKeywordRules.map((rule) => ({
        ...rule,
        recentUseCount: 0,
        lastUsedAt: null
      }))
    );
    jest
      .spyOn(automaticTrackingService, 'saveKeywordRules')
      .mockImplementation(async (rules) => ({
        value: rules.map((rule) => ({
          ...rule,
          recentUseCount: 0,
          lastUsedAt: null
        })),
        affectedScopes: ['tracking.keywords']
      }));
    renderStatus({
      platform: 'android',
      mode: 'review_all',
      permissionStatus: 'granted',
      serviceState: 'healthy',
      lastDetectedAt: null,
      lastSuccessfulTransactionId: null,
      detectedThisMonth: 0,
      reviewCount: 0,
      activeKeywordCount: 22,
      activeSenderCount: 0,
      lastUpdatedAt: Date.now()
    });
    const toggle = await screen.findByTestId(
      'tracking-keyword-toggle-expense-en-default'
    );
    await act(async () => {
      fireEvent.press(toggle);
    });
    expect(refreshed).toHaveBeenCalledTimes(1);
    expect(
      screen.getByTestId('tracking-keyword-toggle-expense-en-default')
    ).toHaveAccessibilityState({ checked: false });
  });
  beforeEach(async () => {
    act(() => clearTrackingIsolation());
    openSmsSettings.mockClear();
    const storage = createAppShellStorage();
    await storage.saveKeywords(defaultKeywordRules);
  });

  afterEach(() => jest.restoreAllMocks());

  it('renders the approved collapsed setup guide between source controls and keywords', async () => {
    renderStatus({
      platform: 'android',
      mode: 'automatic_clear',
      permissionStatus: 'granted',
      serviceState: 'healthy',
      lastDetectedAt: null,
      lastSuccessfulTransactionId: null,
      detectedThisMonth: 12,
      reviewCount: 3,
      activeKeywordCount: 22,
      activeSenderCount: 5,
      lastUpdatedAt: Date.now()
    });

    // 1. Header & Status
    expect(
      await screen.findByText(translate('tracking.header.title'))
    ).toBeOnTheScreen();
    expect(
      screen.getByText(translate('tracking.source.smsTrackingDescription'))
    ).toBeOnTheScreen();
    expect(screen.getByTestId('tracking-sms-switch')).toHaveProp(
      'accessibilityState',
      expect.objectContaining({ checked: true })
    );

    // 2. Setup guide and compact explanation
    expect(
      screen.getByRole('button', {
        name: translate('tracking.setup.alertSettings')
      })
    ).toBeOnTheScreen();
    expect(screen.queryByTestId('tracking-setup-privacy')).toBeNull();
    expect(
      screen.getByTestId('tracking-setup-toggle')
    ).toHaveAccessibilityState({ expanded: false });
    expect(
      screen.queryByRole('button', { name: translate('privacy.details') })
    ).toBeNull();

    // 3. Keywords section with real keywords
    await waitFor(() => {
      expect(
        screen.getByText(
          new RegExp(translate('tracking.keywords.sectionTitle'))
        )
      ).toBeOnTheScreen();
    });

    // Grocery / مصروف should be in the default keywords
    expect(screen.getByText('Grocery')).toBeOnTheScreen();
    expect(screen.getByText('مصروف')).toBeOnTheScreen();
  });

  it('shows independent SMS and transaction notification tracking switches', async () => {
    changeLocale('en');
    renderStatus({
      platform: 'android',
      mode: 'automatic_clear',
      permissionStatus: 'granted',
      smsPermissionStatus: 'granted',
      notificationAccessStatus: 'granted',
      smsTrackingEnabled: true,
      notificationTrackingEnabled: false,
      serviceState: 'healthy',
      lastDetectedAt: null,
      lastSuccessfulTransactionId: null,
      detectedThisMonth: 0,
      reviewCount: 0,
      activeKeywordCount: 22,
      activeSenderCount: 0,
      lastUpdatedAt: Date.now()
    } as TrackingStatusSnapshot);

    expect(await screen.findByText('SMS tracking')).toBeOnTheScreen();
    expect(
      screen.getByText(translate('tracking.source.smsTrackingDescription'))
    ).toBeOnTheScreen();
    expect(
      screen.getByText('Transaction notification tracking')
    ).toBeOnTheScreen();
    expect(screen.getByTestId('tracking-sms-switch')).toBeOnTheScreen();
    expect(
      screen.getByTestId('tracking-notification-switch')
    ).toBeOnTheScreen();
    expect(await readyControl('tracking-sms-switch')).toBeEnabled();
    expect(await readyControl('tracking-notification-switch')).toBeEnabled();
  });

  it.each(['denied', 'revoked', 'permanently_denied'] as const)(
    'opens Android settings directly for SMS access from %s state',
    async (permission) => {
      const push = jest.spyOn(router, 'push').mockImplementation(jest.fn());
      const setSource = jest.spyOn(trackingSourcePreferences, 'set');
      const setMode = jest.spyOn(automaticTrackingService, 'setMode');
      renderStatus(
        {
          platform: 'android',
          mode: 'paused',
          permissionStatus: permission,
          smsPermissionStatus: permission,
          smsTrackingEnabled: false,
          notificationTrackingEnabled: false,
          serviceState: 'healthy',
          lastDetectedAt: null,
          lastSuccessfulTransactionId: null,
          detectedThisMonth: 0,
          reviewCount: 0,
          activeKeywordCount: 0,
          activeSenderCount: 0,
          lastUpdatedAt: 1
        },
        'granted'
      );
      fireEvent.press(await readyControl('tracking-sms-switch'));
      await waitFor(() => expect(openSmsSettings).toHaveBeenCalledTimes(1));
      expect(push).not.toHaveBeenCalled();
      expect(setSource).not.toHaveBeenCalled();
      expect(setMode).not.toHaveBeenCalled();
    }
  );

  it.each(['granted', 'denied'] as const)(
    'rechecks SMS permission on returning from Android settings: %s',
    async (returnedPermission) => {
      const listeners = new Set<(state: AppStateStatus) => void>();
      jest
        .spyOn(AppState, 'addEventListener')
        .mockImplementation((_event, listener) => {
          listeners.add(listener);
          return { remove: () => listeners.delete(listener) } as never;
        });
      const saveSource = jest
        .spyOn(trackingSourcePreferences, 'set')
        .mockResolvedValue({ smsEnabled: true, notificationEnabled: false });
      const setMode = jest
        .spyOn(automaticTrackingService, 'setMode')
        .mockResolvedValue({ ...responsiveStatus, mode: 'automatic_clear' });
      const native = {
        smsPermission: 'denied' as ReturnType<typeof permissionState>['status']
      };
      renderStatus(
        {
          ...responsiveStatus,
          mode: 'paused',
          permissionStatus: 'denied',
          smsPermissionStatus: 'denied'
        },
        'denied',
        native
      );
      const service = jest
        .mocked(trackingPermissionModule.createTrackingPermissionService)
        .mock.results.at(-1)?.value;
      const readNativePermission = jest.spyOn(service, 'getState');
      fireEvent.press(await readyControl('tracking-sms-switch'));
      await waitFor(() => expect(openSmsSettings).toHaveBeenCalledTimes(1));
      expect(saveSource).not.toHaveBeenCalled();
      native.smsPermission = returnedPermission;
      await act(async () =>
        listeners.forEach((listener) => listener('active'))
      );
      await waitFor(() =>
        expect(readNativePermission.mock.calls.length).toBeGreaterThanOrEqual(2)
      );
      if (returnedPermission === 'granted') {
        await waitFor(() =>
          expect(saveSource).toHaveBeenCalledWith('sms', true)
        );
        expect(setMode).toHaveBeenCalledWith('automatic_clear');
      } else {
        expect(saveSource).not.toHaveBeenCalledWith('sms', true);
        expect(
          screen.getByTestId('tracking-sms-switch')
        ).toHaveAccessibilityState({ checked: false });
      }
    }
  );

  it.each([
    ['sms', 'denied', 'granted', true],
    ['sms', 'denied', 'denied', false],
    ['sms', 'granted', 'granted', true],
    ['notification', 'denied', 'granted', true],
    ['notification', 'denied', 'denied', false],
    ['notification', 'granted', 'granted', true]
  ] as const)(
    'guide activation of %s with permission %s → %s sets its switch to %s',
    async (source, initialAccess, returnedAccess, wantEnabled) => {
      const priorOS = Platform.OS;
      Platform.OS = 'android';
      const listeners = new Set<(state: AppStateStatus) => void>();
      jest
        .spyOn(AppState, 'addEventListener')
        .mockImplementation((_event, listener) => {
          listeners.add(listener);
          return { remove: () => listeners.delete(listener) } as never;
        });
      const stored = { smsEnabled: false, notificationEnabled: false };
      let mode: TrackingStatusSnapshot['mode'] = 'paused';
      let notificationAccess: 'granted' | 'denied' =
        source === 'notification' ? initialAccess : 'denied';
      const options: {
        smsPermission: 'granted' | 'denied';
        loadStatus: () => Promise<TrackingStatusSnapshot>;
      } = {
        smsPermission: source === 'sms' ? initialAccess : 'denied',
        loadStatus: async (): Promise<TrackingStatusSnapshot> => ({
          ...responsiveStatus,
          mode,
          permissionStatus:
            options.smsPermission === 'granted' ||
            notificationAccess === 'granted'
              ? 'granted'
              : 'denied',
          smsPermissionStatus: options.smsPermission,
          notificationAccessStatus: notificationAccess,
          smsTrackingEnabled: stored.smsEnabled,
          notificationTrackingEnabled: stored.notificationEnabled
        })
      };
      const resync = jest
        .spyOn(coordinator, 'resyncAutomaticTracking')
        .mockResolvedValue({
          status: 'idle',
          sessionId: null,
          reviewId: null,
          duplicateId: null,
          errorCode: null
        });
      const save = jest
        .spyOn(trackingSourcePreferences, 'set')
        .mockImplementation(async (selectedSource, enabled) => {
          if (selectedSource === 'sms') stored.smsEnabled = enabled;
          else stored.notificationEnabled = enabled;
          return { ...stored };
        });
      jest
        .spyOn(automaticTrackingService, 'setMode')
        .mockImplementation(async (nextMode) => {
          mode = nextMode;
          return options.loadStatus();
        });
      const listenerSettings = jest
        .spyOn(bankNotificationService, 'openSettings')
        .mockResolvedValue();
      jest
        .spyOn(bankNotificationService, 'setCaptureEnabled')
        .mockResolvedValue();
      const view = renderStatus(await options.loadStatus(), 'denied', options);
      jest
        .mocked(trackingSourcePreferences.load)
        .mockImplementation(async () => ({ ...stored }));
      jest
        .mocked(bankNotificationService.getAccessState)
        .mockImplementation(async () => notificationAccess);
      try {
        fireEvent.press(await screen.findByTestId('tracking-setup-toggle'));
        fireEvent.press(screen.getByTestId(`tracking-guide-${source}`));
        expect(save).not.toHaveBeenCalled();
        fireEvent.press(screen.getByTestId('tracking-guide-open-settings'));
        if (initialAccess === 'denied') {
          await waitFor(() =>
            expect(
              source === 'sms' ? openSmsSettings : listenerSettings
            ).toHaveBeenCalledTimes(1)
          );
          expect(save).not.toHaveBeenCalled();
          if (source === 'sms') options.smsPermission = returnedAccess;
          else notificationAccess = returnedAccess;
          resync.mockClear();
          await act(async () =>
            listeners.forEach((listener) => listener('active'))
          );
          await waitFor(() => expect(resync).toHaveBeenCalled());
        }
        if (wantEnabled)
          await waitFor(() => expect(save).toHaveBeenCalledWith(source, true));
        else expect(save).not.toHaveBeenCalledWith(source, true);
        if (wantEnabled) {
          expect(
            await within(screen.getByTestId('app-sheet-modal')).findByRole(
              'button',
              {
                name: translate('tracking.setup.enabled')
              }
            )
          ).toBeDisabled();
        } else {
          expect(
            within(screen.getByTestId('app-sheet-modal')).queryByRole(
              'button',
              {
                name: translate('tracking.setup.enabled')
              }
            )
          ).toBeNull();
        }
        fireEvent(screen.getByTestId('app-sheet-modal'), 'requestClose');
        await waitFor(() =>
          expect(
            screen.getByTestId(
              `tracking-${source === 'sms' ? 'sms' : 'notification'}-switch`
            )
          ).toHaveAccessibilityState({ checked: wantEnabled })
        );
        expect(
          screen.getByTestId(
            `tracking-${source === 'sms' ? 'notification' : 'sms'}-switch`
          )
        ).toHaveAccessibilityState({ checked: false });
      } finally {
        view.unmount();
        Platform.OS = priorOS;
      }
    }
  );

  it.each(['sms', 'notification'] as const)(
    'guide activation hides the matching home setup card and resets its label when switched off: %s',
    async (source) => {
      const priorOS = Platform.OS;
      const priorSession = useAppShellStore.getState().session;
      const priorProfile = useAppShellStore.getState().profileSetupStatus;
      Platform.OS = 'android';
      useAppShellStore.setState({
        session: {
          status: 'authenticated',
          userId: `guide-home-${source}`,
          method: 'google',
          issuedAt: 1,
          expiresAt: 9999999999,
          restoration: 'restored'
        },
        profileSetupStatus: 'complete'
      });
      jest
        .spyOn(phoneNotificationService, 'getPermission')
        .mockResolvedValue('granted');
      const stored = { smsEnabled: false, notificationEnabled: false };
      let mode: TrackingStatusSnapshot['mode'] = 'paused';
      const read = async (): Promise<TrackingStatusSnapshot> => ({
        ...responsiveStatus,
        mode,
        smsTrackingEnabled: stored.smsEnabled,
        notificationTrackingEnabled: stored.notificationEnabled
      });
      jest.spyOn(coordinator, 'resyncAutomaticTracking').mockResolvedValue({
        status: 'idle',
        sessionId: null,
        reviewId: null,
        duplicateId: null,
        errorCode: null
      });
      jest
        .spyOn(trackingSourcePreferences, 'set')
        .mockImplementation(async (selected, enabled) => {
          if (selected === 'sms') stored.smsEnabled = enabled;
          else stored.notificationEnabled = enabled;
          return { ...stored };
        });
      jest
        .spyOn(automaticTrackingService, 'setMode')
        .mockImplementation(async (next) => {
          mode = next;
          return read();
        });
      jest
        .spyOn(bankNotificationService, 'setCaptureEnabled')
        .mockResolvedValue();
      const view = renderStatus(await read(), 'granted', {
        loadStatus: read,
        homeSetup: true
      });
      jest
        .mocked(trackingSourcePreferences.load)
        .mockImplementation(async () => ({ ...stored }));
      const card =
        source === 'sms'
          ? 'sms-tracking-home-card'
          : 'notification-tracking-home-card';
      const otherCard =
        source === 'sms'
          ? 'notification-tracking-home-card'
          : 'sms-tracking-home-card';
      try {
        expect(await screen.findByTestId(card)).toBeOnTheScreen();
        expect(screen.getByTestId(otherCard)).toBeOnTheScreen();
        fireEvent.press(screen.getByTestId('tracking-setup-toggle'));
        fireEvent.press(screen.getByTestId(`tracking-guide-${source}`));
        fireEvent.press(screen.getByTestId('tracking-guide-open-settings'));
        expect(
          await within(screen.getByTestId('app-sheet-modal')).findByRole(
            'button',
            {
              name: translate('tracking.setup.enabled')
            }
          )
        ).toBeDisabled();
        fireEvent(screen.getByTestId('app-sheet-modal'), 'requestClose');
        await waitFor(() => expect(screen.queryByTestId(card)).toBeNull());
        expect(screen.getByTestId(otherCard)).toBeOnTheScreen();
        fireEvent.press(await readyControl(`tracking-${source}-switch`));
        expect(await screen.findByTestId(card)).toBeOnTheScreen();
        fireEvent.press(screen.getByTestId(`tracking-guide-${source}`));
        expect(
          within(screen.getByTestId('app-sheet-modal')).queryByRole('button', {
            name: translate('tracking.setup.enabled')
          })
        ).toBeNull();
        expect(
          screen.getByTestId('tracking-guide-open-settings')
        ).toBeEnabled();
      } finally {
        view.unmount();
        Platform.OS = priorOS;
        useAppShellStore.setState({
          session: priorSession,
          profileSetupStatus: priorProfile
        });
      }
    }
  );

  it.each(['sms', 'notification'] as const)(
    'keeps a failed %s guide activation off and shows its error inside the sheet',
    async (source) => {
      const priorOS = Platform.OS;
      Platform.OS = 'android';
      const save = jest.spyOn(trackingSourcePreferences, 'set');
      if (source === 'sms')
        openSmsSettings.mockRejectedValueOnce(
          new Error('Settings unavailable')
        );
      else
        jest
          .spyOn(bankNotificationService, 'openSettings')
          .mockRejectedValue(new Error('Settings unavailable'));
      const view = renderStatus({
        ...responsiveStatus,
        mode: 'paused',
        permissionStatus: 'denied',
        smsPermissionStatus: 'denied',
        notificationAccessStatus: 'denied'
      });
      try {
        fireEvent.press(await screen.findByTestId('tracking-setup-toggle'));
        fireEvent.press(screen.getByTestId(`tracking-guide-${source}`));
        fireEvent.press(screen.getByTestId('tracking-guide-open-settings'));
        expect(
          await screen.findByText(translate('tracking.setup.enableFailed'))
        ).toBeOnTheScreen();
        expect(save).not.toHaveBeenCalled();
      } finally {
        view.unmount();
        Platform.OS = priorOS;
        openSmsSettings.mockReset().mockResolvedValue(undefined);
      }
    }
  );

  it('turns off SMS tracking without pausing enabled notification tracking', async () => {
    const saveSource = jest
      .spyOn(trackingSourcePreferences, 'set')
      .mockResolvedValue({ smsEnabled: false, notificationEnabled: true });
    const setMode = jest
      .spyOn(automaticTrackingService, 'setMode')
      .mockResolvedValue({} as never);
    renderStatus({
      platform: 'android',
      mode: 'automatic_clear',
      permissionStatus: 'granted',
      smsPermissionStatus: 'granted',
      notificationAccessStatus: 'granted',
      smsTrackingEnabled: true,
      notificationTrackingEnabled: true,
      serviceState: 'healthy',
      lastDetectedAt: null,
      lastSuccessfulTransactionId: null,
      detectedThisMonth: 0,
      reviewCount: 0,
      activeKeywordCount: 0,
      activeSenderCount: 0,
      lastUpdatedAt: 1
    });

    fireEvent.press(await readyControl('tracking-sms-switch'));

    await waitFor(() => expect(saveSource).toHaveBeenCalledWith('sms', false));
    expect(setMode).not.toHaveBeenCalledWith('paused');
  });

  it('releases the source switches after saving while message sync is still running', async () => {
    let finishSync!: (state: coordinator.AutomaticTrackingSyncState) => void;
    const resync = jest
      .spyOn(coordinator, 'resyncAutomaticTracking')
      .mockReturnValue(
        new Promise((resolve) => {
          finishSync = resolve;
        })
      );
    jest.spyOn(trackingSourcePreferences, 'set').mockResolvedValue({
      smsEnabled: false,
      notificationEnabled: true
    });
    renderStatus({
      platform: 'android',
      mode: 'automatic_clear',
      permissionStatus: 'granted',
      smsPermissionStatus: 'granted',
      notificationAccessStatus: 'granted',
      smsTrackingEnabled: true,
      notificationTrackingEnabled: true,
      serviceState: 'healthy',
      lastDetectedAt: null,
      lastSuccessfulTransactionId: null,
      detectedThisMonth: 0,
      reviewCount: 0,
      activeKeywordCount: 0,
      activeSenderCount: 0,
      lastUpdatedAt: 1
    });
    try {
      fireEvent.press(await readyControl('tracking-sms-switch'));
      await waitFor(() => expect(resync).toHaveBeenCalled());
      expect(
        screen.getByTestId('tracking-sms-switch')
      ).toHaveAccessibilityState({ checked: false });
      expect(await readyControl('tracking-sms-switch')).toBeEnabled();
      expect(await readyControl('tracking-notification-switch')).toBeEnabled();
    } finally {
      await act(async () =>
        finishSync({
          status: 'idle',
          sessionId: null,
          reviewId: null,
          duplicateId: null,
          errorCode: null
        })
      );
    }
  });

  it('enables notification tracking directly when Android access is already granted', async () => {
    const saveSource = jest
      .spyOn(trackingSourcePreferences, 'set')
      .mockResolvedValue({ smsEnabled: false, notificationEnabled: true });
    const setMode = jest
      .spyOn(automaticTrackingService, 'setMode')
      .mockResolvedValue({} as never);
    const openSettings = jest.spyOn(bankNotificationService, 'openSettings');
    const setCaptureEnabled = jest
      .spyOn(bankNotificationService, 'setCaptureEnabled')
      .mockResolvedValue();
    renderStatus({
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
      detectedThisMonth: 0,
      reviewCount: 0,
      activeKeywordCount: 0,
      activeSenderCount: 0,
      lastUpdatedAt: 1
    });

    fireEvent.press(await readyControl('tracking-notification-switch'));

    await waitFor(() =>
      expect(saveSource).toHaveBeenCalledWith('notification', true)
    );
    expect(setMode).toHaveBeenCalledWith('automatic_clear');
    expect(setCaptureEnabled).toHaveBeenCalledWith(true);
    expect(openSettings).not.toHaveBeenCalled();
  });

  it.each(['sms', 'notification'] as const)(
    'unpauses server preferences before requesting explicit %s consent',
    async (source) => {
      let serverEnabled = false;
      const savedSources = { smsEnabled: false, notificationEnabled: false };
      jest
        .spyOn(automaticTrackingService, 'setMode')
        .mockImplementation(async () => {
          serverEnabled = true;
          return {} as never;
        });
      jest
        .spyOn(trackingSourcePreferences, 'set')
        .mockImplementation(async (selected, enabled) => {
          if (enabled && !serverEnabled)
            throw new Error('TRACKING_PREFERENCES_DISABLED');
          savedSources[
            selected === 'sms' ? 'smsEnabled' : 'notificationEnabled'
          ] = enabled;
          return { ...savedSources };
        });
      jest
        .spyOn(bankNotificationService, 'setCaptureEnabled')
        .mockResolvedValue();
      renderStatus({
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
        detectedThisMonth: 0,
        reviewCount: 0,
        activeKeywordCount: 0,
        activeSenderCount: 0,
        lastUpdatedAt: 1
      });
      fireEvent.press(await readyControl(`tracking-${source}-switch`));
      await waitFor(() =>
        expect(savedSources).toEqual({
          smsEnabled: source === 'sms',
          notificationEnabled: source === 'notification'
        })
      );
      expect(serverEnabled).toBe(true);
    }
  );

  it('turns off notification capture without pausing enabled SMS tracking', async () => {
    const saveSource = jest
      .spyOn(trackingSourcePreferences, 'set')
      .mockResolvedValue({ smsEnabled: true, notificationEnabled: false });
    const setCaptureEnabled = jest
      .spyOn(bankNotificationService, 'setCaptureEnabled')
      .mockResolvedValue();
    const setMode = jest.spyOn(automaticTrackingService, 'setMode');
    renderStatus({
      platform: 'android',
      mode: 'automatic_clear',
      permissionStatus: 'granted',
      smsPermissionStatus: 'granted',
      notificationAccessStatus: 'granted',
      smsTrackingEnabled: true,
      notificationTrackingEnabled: true,
      serviceState: 'healthy',
      lastDetectedAt: null,
      lastSuccessfulTransactionId: null,
      detectedThisMonth: 0,
      reviewCount: 0,
      activeKeywordCount: 0,
      activeSenderCount: 0,
      lastUpdatedAt: 1
    });

    fireEvent.press(await readyControl('tracking-notification-switch'));

    await waitFor(() =>
      expect(saveSource).toHaveBeenCalledWith('notification', false)
    );
    expect(setCaptureEnabled).toHaveBeenCalledWith(false);
    expect(setMode).not.toHaveBeenCalledWith('paused');
  });

  it('finishes notification activation after Android settings grants access', async () => {
    const appStateListeners = new Set<(state: AppStateStatus) => void>();
    jest
      .spyOn(AppState, 'addEventListener')
      .mockImplementation((_event, listener) => {
        appStateListeners.add(listener);
        return { remove: () => appStateListeners.delete(listener) } as never;
      });
    const saveSource = jest
      .spyOn(trackingSourcePreferences, 'set')
      .mockResolvedValue({ smsEnabled: false, notificationEnabled: true });
    const setCaptureEnabled = jest
      .spyOn(bankNotificationService, 'setCaptureEnabled')
      .mockResolvedValue();
    const setMode = jest
      .spyOn(automaticTrackingService, 'setMode')
      .mockResolvedValue({} as never);
    const openSettings = jest
      .spyOn(bankNotificationService, 'openSettings')
      .mockResolvedValue();
    renderStatus({
      platform: 'android',
      mode: 'paused',
      permissionStatus: 'denied',
      smsPermissionStatus: 'denied',
      notificationAccessStatus: 'denied',
      smsTrackingEnabled: false,
      notificationTrackingEnabled: false,
      serviceState: 'healthy',
      lastDetectedAt: null,
      lastSuccessfulTransactionId: null,
      detectedThisMonth: 0,
      reviewCount: 0,
      activeKeywordCount: 0,
      activeSenderCount: 0,
      lastUpdatedAt: 1
    });

    fireEvent.press(await readyControl('tracking-notification-switch'));
    await waitFor(() => expect(openSettings).toHaveBeenCalledTimes(1));
    jest
      .mocked(bankNotificationService.getAccessState)
      .mockResolvedValue('granted');
    act(() => appStateListeners.forEach((listener) => listener('active')));

    await waitFor(() => {
      expect(setCaptureEnabled).toHaveBeenCalledWith(true);
      expect(saveSource).toHaveBeenCalledWith('notification', true);
      expect(setMode).toHaveBeenCalledWith('automatic_clear');
    });
  });

  it('keeps keyword management roomy without changing its layout', async () => {
    renderStatus({
      platform: 'android',
      mode: 'automatic_clear',
      permissionStatus: 'granted',
      serviceState: 'healthy',
      lastDetectedAt: null,
      lastSuccessfulTransactionId: null,
      detectedThisMonth: 0,
      reviewCount: 0,
      activeKeywordCount: 22,
      activeSenderCount: 0,
      lastUpdatedAt: Date.now()
    });

    expect(await screen.findByTestId('tracking-keywords-card')).toHaveStyle({
      marginHorizontal: -4,
      padding: 18
    });
    expect(
      await screen.findByTestId('tracking-keyword-chip-expense-en-default')
    ).toHaveStyle({ minHeight: 40 });
  });

  it('anchors Arabic tracking rows to a physical LTR canvas and mirrors them explicitly', async () => {
    changeLocale('ar');
    usePreferenceStore.setState({ direction: 'rtl', locale: 'ar' });
    const rendered = renderStatus({
      platform: 'android',
      mode: 'automatic_clear',
      permissionStatus: 'granted',
      serviceState: 'healthy',
      lastDetectedAt: null,
      lastSuccessfulTransactionId: null,
      detectedThisMonth: 0,
      reviewCount: 0,
      activeKeywordCount: 22,
      activeSenderCount: 0,
      lastUpdatedAt: Date.now()
    });

    await screen.findByTestId('tracking-status-screen');
    expect(screen.getByTestId('tracking-sms-switch-row')).toHaveStyle({
      flexDirection: 'row-reverse'
    });
    expect(screen.getByTestId('tracking-sms-switch-text')).toHaveStyle({
      alignItems: 'flex-end'
    });
    expect(screen.getByTestId('tracking-setup-toggle')).toHaveStyle({
      flexDirection: 'row-reverse'
    });

    rendered.unmount();
    usePreferenceStore.setState({ direction: 'ltr', locale: 'en' });
    changeLocale('en');
  });

  it('omits the permission warning while preserving explicit SMS activation', async () => {
    renderStatus({
      platform: 'android',
      mode: 'automatic_clear',
      permissionStatus: 'denied',
      serviceState: 'healthy',
      lastDetectedAt: null,
      lastSuccessfulTransactionId: null,
      detectedThisMonth: 0,
      reviewCount: 0,
      activeKeywordCount: 22,
      activeSenderCount: 0,
      lastUpdatedAt: Date.now()
    });

    expect(
      screen.queryByTestId('tracking-permission-warning-banner')
    ).toBeNull();
    expect(
      screen.queryByText(translate('tracking.permission.warning'))
    ).toBeNull();

    const setMode = jest.spyOn(automaticTrackingService, 'setMode');
    const push = jest.spyOn(router, 'push').mockImplementation(jest.fn());
    fireEvent.press(await readyControl('tracking-sms-switch'));

    await waitFor(() => expect(openSmsSettings).toHaveBeenCalledTimes(1));
    expect(push).not.toHaveBeenCalled();
    expect(setMode).not.toHaveBeenCalled();
  });

  it.each(['ar', 'en'] as const)(
    'labels unavailable tracking honestly and disables its controls in %s',
    async (locale) => {
      changeLocale(locale);
      renderStatus({
        platform: 'conservative',
        mode: 'automatic_clear',
        permissionStatus: 'unavailable',
        serviceState: 'unavailable',
        lastDetectedAt: null,
        lastSuccessfulTransactionId: null,
        detectedThisMonth: 0,
        reviewCount: 0,
        activeKeywordCount: 0,
        activeSenderCount: 0,
        lastUpdatedAt: Date.now()
      });

      expect(
        await screen.findByText(translate('tracking.status.unavailable'))
      ).toBeOnTheScreen();
      expect(screen.getByTestId('tracking-mode-switch')).toBeDisabled();
      expect(
        await screen.findByTestId('tracking-add-keyword-toggle')
      ).toBeDisabled();
      expect(
        screen.queryByTestId('tracking-permission-warning-banner')
      ).toBeNull();
    }
  );

  it.each([
    ['queued', 'tracking.service.offline'],
    ['account_required', 'coreFinance.accounts.noEligible'],
    ['error', 'tracking.sync.error']
  ] as const)('renders coordinator state %s', (status, titleKey) => {
    renderWithQueryData(
      <TrackingSyncPanel
        state={{
          status,
          sessionId: null,
          reviewId: null,
          duplicateId: null,
          errorCode: status === 'error' ? 'offline' : null
        }}
        onRetry={jest.fn()}
      />,
      []
    );

    expect(screen.getByText(translate(titleKey))).toBeOnTheScreen();
  });

  it.each([
    ['review', 'reviewId', 'review-1', '/tracking/review/review-1'],
    [
      'duplicate',
      'duplicateId',
      'duplicate-1',
      '/tracking/duplicates/duplicate-1'
    ]
  ] as const)('opens the real %s result ID', (status, idKey, id, route) => {
    const push = jest.spyOn(router, 'push').mockImplementation(jest.fn());
    renderWithQueryData(
      <TrackingSyncPanel
        state={{
          status,
          sessionId: 'session-1',
          reviewId: null,
          duplicateId: null,
          errorCode: null,
          [idKey]: id
        }}
        onRetry={jest.fn()}
      />,
      []
    );

    fireEvent.press(
      screen.getByLabelText(
        translate(
          status === 'review'
            ? 'tracking.action.review'
            : 'tracking.action.open'
        )
      )
    );
    expect(push).toHaveBeenCalledWith(route);
  });

  it.each(['ar', 'en'] as const)(
    'labels demo tracking as non-production in %s',
    async (locale) => {
      const previous = process.env.EXPO_PUBLIC_DEMO_MODE;
      process.env.EXPO_PUBLIC_DEMO_MODE = '1';
      changeLocale(locale);
      try {
        renderStatus({
          platform: 'android',
          mode: 'automatic_clear',
          permissionStatus: 'granted',
          serviceState: 'healthy',
          lastDetectedAt: null,
          lastSuccessfulTransactionId: null,
          detectedThisMonth: 1,
          reviewCount: 0,
          activeKeywordCount: 1,
          activeSenderCount: 1,
          lastUpdatedAt: Date.now()
        });

        expect(
          await screen.findByLabelText(translate('tracking.status.demo'))
        ).toHaveTextContent(translate('tracking.status.demo'));
      } finally {
        if (previous === undefined) delete process.env.EXPO_PUBLIC_DEMO_MODE;
        else process.env.EXPO_PUBLIC_DEMO_MODE = previous;
      }
    }
  );

  it('allows adding and removing custom keywords', async () => {
    const saveRules = jest.spyOn(automaticTrackingService, 'saveKeywordRules');
    renderStatus({
      platform: 'android',
      mode: 'automatic_clear',
      permissionStatus: 'granted',
      serviceState: 'healthy',
      lastDetectedAt: null,
      lastSuccessfulTransactionId: null,
      detectedThisMonth: 0,
      reviewCount: 0,
      activeKeywordCount: 22,
      activeSenderCount: 0,
      lastUpdatedAt: Date.now()
    });

    // Open add keyword draft input
    await waitFor(() => {
      expect(
        screen.getByTestId('tracking-add-keyword-toggle')
      ).toBeOnTheScreen();
    });
    await act(async () => {
      fireEvent.press(screen.getByTestId('tracking-add-keyword-toggle'));
    });

    // Type new keyword
    const input = screen.getByTestId('tracking-new-keyword-input');
    await act(async () => {
      fireEvent.changeText(input, 'StarbucksCoffee');
    });
    await act(async () => {
      fireEvent.press(screen.getByTestId('tracking-submit-add-keyword'));
    });

    // Should appear in list
    await waitFor(() => {
      expect(screen.getByText('StarbucksCoffee')).toBeOnTheScreen();
    });
    fireEvent.press(
      await readyControl('tracking-keyword-remove-financial-ar-starbuckscoffee')
    );
    await waitFor(() => expect(saveRules).toHaveBeenCalledTimes(2));
    expect(
      saveRules.mock.calls[1][0].some(
        (rule) => rule.value === 'StarbucksCoffee'
      )
    ).toBe(false);
    await waitFor(() =>
      expect(screen.queryByText('StarbucksCoffee')).toBeNull()
    );
    await waitFor(() =>
      expect(
        screen.getByTestId('tracking-keyword-toggle-expense-en-default')
      ).toBeEnabled()
    );
    fireEvent.press(
      screen.getByTestId('tracking-keyword-toggle-expense-en-default')
    );
    await waitFor(() =>
      expect(
        screen.getByTestId('tracking-keyword-toggle-expense-en-default')
      ).toHaveAccessibilityState({ checked: false })
    );
  });

  it('allows editing a keyword', async () => {
    renderStatus({
      platform: 'android',
      mode: 'automatic_clear',
      permissionStatus: 'granted',
      serviceState: 'healthy',
      lastDetectedAt: null,
      lastSuccessfulTransactionId: null,
      detectedThisMonth: 0,
      reviewCount: 0,
      activeKeywordCount: 22,
      activeSenderCount: 0,
      lastUpdatedAt: Date.now()
    });

    await screen.findByText('Grocery');
    await act(async () => {
      fireEvent.press(screen.getByTestId('tracking-add-keyword-toggle'));
    });
    await act(async () => {
      fireEvent.changeText(
        screen.getByTestId('tracking-new-keyword-input'),
        'Cafe'
      );
    });
    await act(async () => {
      fireEvent.press(screen.getByTestId('tracking-submit-add-keyword'));
    });
    await screen.findByText('Cafe');
    fireEvent.press(
      screen.getByTestId('tracking-keyword-edit-financial-ar-cafe')
    );
    fireEvent.changeText(
      screen.getByTestId('tracking-keyword-edit-input-financial-ar-cafe'),
      'Groceries'
    );
    fireEvent.press(
      screen.getByTestId('tracking-keyword-save-financial-ar-cafe')
    );

    expect(await screen.findByText('Groceries')).toBeOnTheScreen();
  });

  it('allows restoring default keywords', async () => {
    renderStatus({
      platform: 'android',
      mode: 'automatic_clear',
      permissionStatus: 'granted',
      serviceState: 'healthy',
      lastDetectedAt: null,
      lastSuccessfulTransactionId: null,
      detectedThisMonth: 0,
      reviewCount: 0,
      activeKeywordCount: 22,
      activeSenderCount: 0,
      lastUpdatedAt: Date.now()
    });

    await waitFor(() => {
      expect(
        screen.getByTestId('tracking-restore-keywords-button')
      ).toBeOnTheScreen();
    });
    await act(async () => {
      fireEvent.press(screen.getByTestId('tracking-restore-keywords-button'));
    });

    expect(screen.getByText('Salary')).toBeOnTheScreen();
    expect(screen.getByText('راتب')).toBeOnTheScreen();
  });

  it.each(['ar', 'en'] as const)(
    'stacks the keyword header at 200%% text in %s',
    async (locale) => {
      jest.spyOn(PixelRatio, 'getFontScale').mockReturnValue(2);
      changeLocale(locale);
      renderStatus({
        platform: 'android',
        mode: 'automatic_clear',
        permissionStatus: 'granted',
        serviceState: 'healthy',
        lastDetectedAt: null,
        lastSuccessfulTransactionId: null,
        detectedThisMonth: 12,
        reviewCount: 3,
        activeKeywordCount: 22,
        activeSenderCount: 5,
        lastUpdatedAt: Date.now()
      });

      expect(await screen.findByTestId('tracking-keyword-header')).toHaveStyle({
        alignItems: 'stretch',
        flexDirection: 'column'
      });
    }
  );
});
