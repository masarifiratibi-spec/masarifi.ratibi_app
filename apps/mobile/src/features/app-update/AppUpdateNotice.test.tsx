import React from 'react';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor
} from '@testing-library/react-native';
import { AppState, Linking, Platform, type AppStateStatus } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { usePreferenceStore } from '@/state/preferences';
import * as api from './app-update';
import * as applicationVersion from '@/services/platform/application-version';
import { useVoiceCaptureStore } from '@/state/voice-capture';
import { useVoiceUpdateInteraction } from '@/state/voice-update-interaction';
import {
  AppUpdateNotice,
  AppUpdateScreen,
  AppUpdateSettingsEntry
} from './AppUpdateNotice';

let mockPath = '/home';
let mockLocked = false;
jest.mock('expo-router', () => ({
  usePathname: () => mockPath,
  router: {
    back: jest.fn(),
    push: jest.fn(),
    canGoBack: () => true,
    replace: jest.fn()
  }
}));
jest.mock('@/config/demo-mode', () => ({
  ...jest.requireActual('@/config/demo-mode'),
  isFixtureModeEnabled: () => false
}));
jest.mock('@/config/client-runtime', () => ({
  ...jest.requireActual('@/config/client-runtime'),
  isAppLockEnabled: () => true,
  isBenchmarkReadOnly: () => false
}));
jest.mock('@/state/app-shell', () => {
  const actual = jest.requireActual('@/state/app-shell');
  return {
    ...actual,
    useAppShellStore: Object.assign(
      (select: (value: unknown) => unknown) =>
        select({
          hydrated: true,
          session: { status: 'authenticated' },
          privacyLock: {
            enabled: true,
            appLockStatus: mockLocked ? 'locked' : 'unlocked'
          }
        }),
      {
        getState: actual.useAppShellStore.getState,
        setState: actual.useAppShellStore.setState,
        subscribe: actual.useAppShellStore.subscribe
      }
    )
  };
});

const published: api.UpdatePolicy = {
  schemaVersion: 1,
  enabled: true,
  release: { version: '1.0.1', versionCode: 140 },
  storeUrl: api.ANDROID_STORE_URL
};
beforeEach(async () => {
  Object.defineProperty(AppState, 'currentState', {
    value: 'active',
    configurable: true
  });
  Object.defineProperty(Platform, 'OS', {
    value: 'android',
    configurable: true
  });
  usePreferenceStore.setState({ locale: 'en', direction: 'ltr' });
  mockPath = '/home';
  mockLocked = false;
  useVoiceCaptureStore.getState().reset();
  useVoiceUpdateInteraction.setState({ pending: 0 });
  await AsyncStorage.clear();
  jest.spyOn(api, 'requestUpdatePolicy').mockResolvedValue(published);
  jest
    .spyOn(applicationVersion, 'installedApplication')
    .mockReturnValue({ version: '1.0.0', versionCode: 130 });
});
afterEach(() => jest.restoreAllMocks());

async function mount(element: React.ReactElement) {
  const view = render(element);
  await act(async () => {
    await Promise.resolve();
  });
  return view;
}

test('offers a non-blocking update and remembers Later for this release', async () => {
  const view = await mount(<AppUpdateNotice />);
  await waitFor(() => expect(screen.getByText('Update now')).toBeTruthy());
  fireEvent.press(screen.getByText('Later'));
  await waitFor(() => expect(screen.queryByText('Update now')).toBeNull());
  view.unmount();
  await mount(<AppUpdateNotice />);
  expect(screen.queryByText('Update now')).toBeNull();
});
test('does not snooze a later release and never prompts an up-to-date client', async () => {
  await AsyncStorage.setItem(
    'masarifi.appUpdate.snooze.v1',
    JSON.stringify({ versionCode: 139, until: Date.now() + 86400000 })
  );
  const view = await mount(<AppUpdateNotice />);
  await waitFor(() => expect(screen.getByText('Update now')).toBeTruthy());
  view.unmount();
  jest
    .mocked(api.installedApplication)
    .mockReturnValue({ version: '1.0.1', versionCode: 140 });
  await mount(<AppUpdateNotice />);
  expect(screen.queryByText('Update now')).toBeNull();
});
test('keeps update checking out of locked sessions and edit flows', async () => {
  mockLocked = true;
  const view = render(<AppUpdateNotice />);
  expect(api.requestUpdatePolicy).not.toHaveBeenCalled();
  mockLocked = false;
  mockPath = '/transactions/new';
  view.rerender(<AppUpdateNotice />);
  expect(api.requestUpdatePolicy).not.toHaveBeenCalled();
});
test('manual update destination supports offline retry and store-opening failure', async () => {
  jest
    .mocked(api.requestUpdatePolicy)
    .mockRejectedValueOnce(new Error('offline'));
  jest
    .spyOn(Linking, 'openURL')
    .mockRejectedValue(new Error('store unavailable'));
  await mount(<AppUpdateScreen />);
  await waitFor(() => expect(screen.getByText('Try again')).toBeTruthy());
  fireEvent.press(screen.getByText('Try again'));
  await waitFor(() => expect(screen.getByText('Update now')).toBeTruthy());
  fireEvent.press(screen.getByText('Update now'));
  await waitFor(() =>
    expect(
      screen.getByText('Could not open Google Play. Try again.')
    ).toBeTruthy()
  );
  expect(Linking.openURL).toHaveBeenLastCalledWith(api.ANDROID_STORE_URL);
});

test('provides an Android settings destination and hides it on iOS', () => {
  const view = render(<AppUpdateSettingsEntry />);
  fireEvent.press(screen.getByText('Check for updates'));
  expect(router.push).toHaveBeenCalledWith('/app-update');
  Object.defineProperty(Platform, 'OS', { value: 'ios', configurable: true });
  view.rerender(<AppUpdateSettingsEntry />);
  expect(screen.queryByText('Check for updates')).toBeNull();
});

test('does not display a policy that arrives after leaving the safe home screen', async () => {
  let resolve!: (policy: api.UpdatePolicy) => void;
  jest.mocked(api.requestUpdatePolicy).mockReturnValueOnce(
    new Promise((next) => {
      resolve = next;
    })
  );
  const view = render(<AppUpdateNotice />);
  mockPath = '/transactions/new';
  view.rerender(<AppUpdateNotice />);
  await act(async () => resolve(published));
  expect(screen.queryByText('Update now')).toBeNull();
});

test('expires Later after 24 hours even while the JavaScript process stays alive', async () => {
  let now = Date.now();
  jest.spyOn(Date, 'now').mockImplementation(() => now);
  let resume: (state: AppStateStatus) => void = () => undefined;
  jest
    .spyOn(AppState, 'addEventListener')
    .mockImplementation((_event, listener) => {
      resume = listener;
      return { remove: jest.fn() };
    });
  await mount(<AppUpdateNotice />);
  await act(async () => fireEvent.press(screen.getByText('Later')));
  expect(screen.queryByText('Update now')).toBeNull();
  now += 24 * 60 * 60_000 + 1;
  await act(async () => resume('active'));
  expect(screen.getByText('Update now')).toBeTruthy();
});

test('aborts a pending update check when inline Home recording begins', async () => {
  let resolve!: (policy: api.UpdatePolicy) => void;
  jest.mocked(api.requestUpdatePolicy).mockReturnValueOnce(
    new Promise((next) => {
      resolve = next;
    })
  );
  render(<AppUpdateNotice />);
  await act(async () =>
    useVoiceCaptureStore.getState().transition('recording')
  );
  await act(async () => resolve(published));
  expect(screen.queryByText('Update now')).toBeNull();
  expect(
    jest.mocked(api.requestUpdatePolicy).mock.calls[0]?.[2]?.signal?.aborted
  ).toBe(true);
});

test('waits until voice disclosure and microphone preparation finish', async () => {
  useVoiceUpdateInteraction.setState({ pending: 1 });
  await mount(<AppUpdateNotice />);
  expect(api.requestUpdatePolicy).not.toHaveBeenCalled();
  await act(async () => useVoiceUpdateInteraction.setState({ pending: 0 }));
  expect(screen.getByText('Update now')).toBeTruthy();
});
