import React from 'react';
import { Platform, Text } from 'react-native';
import { act, screen } from '@testing-library/react-native';
import { ProtectedRouteGate } from './ProtectedRouteGate';
import {
  authenticatedSession,
  lockedPrivacy
} from '@/test-utils/app-shell-fixtures';
import { renderWithProviders } from '@/test-utils/render';
import { useAppShellStore } from '@/state/app-shell';
import { usePreferenceStore } from '@/state/preferences';
import { changeLocale, translate } from '@/localization/i18n';
import {
  StartupLoadingBoundary,
  useStartupReady
} from '@/design-system/components/feedback/StartupLoadingBoundary';

// The installed Expo Redirect renders null while its navigation request commits.
// Hold that SDK boundary to inspect what the app paints during the transition.
const mockReplace = jest.fn();
let mockPathname = '/security/unlock';
jest.mock('expo-router', () => ({
  usePathname: () => mockPathname,
  router: {
    replace: (...args: unknown[]) => mockReplace(...args),
    push: jest.fn()
  },
  Redirect: ({ href }: { href: string }) => {
    const ReactActual = jest.requireActual<typeof React>('react');
    ReactActual.useEffect(() => {
      mockReplace(href);
    }, [href]);
    return null;
  }
}));

beforeEach(() => {
  mockPathname = '/security/unlock';
  mockReplace.mockClear();
});
afterEach(() => jest.restoreAllMocks());

test.each(['ios', 'android'] as const)(
  '%s unlock transition keeps iOS feedback visible while preserving Android',
  async (platform) => {
    jest.replaceProperty(Platform, 'OS', platform);
    changeLocale('ar');
    useAppShellStore.setState({
      hydrated: true,
      session: authenticatedSession,
      privacyLock: lockedPrivacy,
      profileSetupStatus: 'complete',
      pendingDestination: null
    });
    usePreferenceStore.setState({
      hydrated: true,
      firstLaunchOnboardingCompleted: true
    });
    renderWithProviders(
      <ProtectedRouteGate>
        <Text>Device authentication screen</Text>
      </ProtectedRouteGate>
    );
    expect(screen.getByText('Device authentication screen')).toBeOnTheScreen();
    await act(async () => {
      await useAppShellStore.getState().unlock();
    });
    expect(screen.queryByText('Device authentication screen')).toBeNull();
    expect(mockReplace).toHaveBeenCalledWith('/(tabs)/home');
    const progress = screen.queryByRole('progressbar', {
      name: translate('appShell.startup.preparing')
    });
    if (platform === 'ios') expect(progress).toBeOnTheScreen();
    else expect(progress).toBeNull();
  }
);

test.each(['warm', 'cold'] as const)(
  'iOS %s unlock shows one loading view and releases it when the destination mounts',
  async (startup) => {
    jest.replaceProperty(Platform, 'OS', 'ios');
    changeLocale('ar');
    useAppShellStore.setState({
      hydrated: true,
      session: authenticatedSession,
      privacyLock: lockedPrivacy,
      profileSetupStatus: 'complete',
      pendingDestination: null
    });
    usePreferenceStore.setState({
      hydrated: true,
      firstLaunchOnboardingCompleted: true
    });
    function Destination() {
      useStartupReady(startup === 'warm' || mockPathname === '/home');
      return <Text>Destination content</Text>;
    }
    let mountDestination!: () => void;
    function Navigation() {
      const [atDestination, setAtDestination] = React.useState(false);
      mockPathname = atDestination ? '/home' : '/security/unlock';
      mountDestination = () => setAtDestination(true);
      return (
        <StartupLoadingBoundary
          locale="ar"
          themePreference="light"
          reducedMotion
        >
          <ProtectedRouteGate>
            <Destination />
          </ProtectedRouteGate>
        </StartupLoadingBoundary>
      );
    }
    renderWithProviders(<Navigation />);
    await act(async () => {
      await useAppShellStore.getState().unlock();
    });
    expect(
      screen.getAllByRole('progressbar', {
        name: translate('appShell.startup.preparing')
      })
    ).toHaveLength(1);
    await act(async () => mountDestination());
    expect(screen.getByText('Destination content')).toBeOnTheScreen();
    expect(screen.queryByRole('progressbar')).toBeNull();
  }
);
