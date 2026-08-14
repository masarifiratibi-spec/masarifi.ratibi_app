import React from 'react';
import { render } from '@testing-library/react-native';

import OnboardingLayout from '@app/(onboarding)/_layout';
import { useAppShellStore } from '@/state/app-shell';
import { androidOnboarding } from '@/test-utils/app-shell-fixtures';

const mockRedirect = jest.fn((_props: { href: string }) => null);

jest.mock('expo-router', () => ({
  Redirect: (props: { href: string }) => mockRedirect(props),
  usePathname: () => '/tracking-intro',
  Stack: () => null
}));

describe('onboarding resume', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useAppShellStore.getState().reset();
  });

  it('opens earliest incomplete route and does not repeat completed education', () => {
    useAppShellStore.setState({
      hydrated: true,
      session: {
        status: 'authenticated',
        userId: 'mock-user',
        method: 'phone',
        issuedAt: 1,
        expiresAt: 4_000_000_000_000,
        restoration: 'restored'
      },
      onboarding: {
        ...androidOnboarding,
        completedSteps: ['tracking_intro', 'permission_education'],
        permissionEducationSeen: true,
        currentStep: 'permission_request'
      }
    });

    render(<OnboardingLayout />);

    expect(mockRedirect.mock.calls[0]?.[0]).toMatchObject({
      href: '/(onboarding)/android-sms-permission'
    });
  });

  it('keeps the earliest incomplete destination after remount', () => {
    useAppShellStore.setState({
      hydrated: true,
      session: {
        status: 'authenticated',
        userId: 'mock-user',
        method: 'phone',
        issuedAt: 1,
        expiresAt: 4_000_000_000_000,
        restoration: 'restored'
      },
      onboarding: {
        ...androidOnboarding,
        completedSteps: ['tracking_intro', 'permission_education'],
        permissionEducationSeen: true,
        currentStep: 'permission_request'
      }
    });

    const firstRender = render(<OnboardingLayout />);
    firstRender.unmount();
    render(<OnboardingLayout />);

    expect(mockRedirect).toHaveBeenCalledTimes(2);
    expect(mockRedirect.mock.calls[1]?.[0]).toMatchObject({
      href: '/(onboarding)/android-sms-permission'
    });
  });
});
