import React from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';

import TrackingDemoRoute from '@app/(onboarding)/tracking-demo';
import TrackingKeywordsRoute from '@app/(onboarding)/tracking-keywords';
import TrackingPreferencesRoute from '@app/(onboarding)/tracking-preferences';
import { renderWithProviders } from '@/test-utils/render';
import { decideTrackingOutcome } from './tracking-policy';
import { createOnboardingProgress } from './onboarding-progress';
import { useAppShellStore } from '@/state/app-shell';

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), replace: jest.fn() },
  Stack: () => null
}));

const asyncSet = jest.mocked(AsyncStorage.setItem);

beforeEach(() => {
  jest.clearAllMocks();
  useAppShellStore.getState().reset();
});

describe('tracking configuration journey', () => {
  it('persists validated keyword changes without parser tuning controls', async () => {
    useAppShellStore.setState({
      onboarding: {
        ...createOnboardingProgress('android', 1),
        completedSteps: ['tracking_intro', 'permission_education', 'permission_request'],
        currentStep: 'keywords'
      }
    });
    renderWithProviders(<TrackingKeywordsRoute />);

    await screen.findByText('مصروف');
    fireEvent.changeText(screen.getByLabelText('كلمة جديدة'), 'Cafe');
    fireEvent.press(screen.getByLabelText('إضافة كلمة'));
    fireEvent.press(screen.getByLabelText('متابعة'));

    await waitFor(() =>
      expect(asyncSet).toHaveBeenCalledWith(
        'masarifi.appShell.keywords',
        expect.stringContaining('Cafe')
      )
    );
    expect(screen.queryByText(/confidence|parser/i)).toBeNull();
    expect(router.replace).toHaveBeenCalledWith('/(onboarding)/tracking-preferences');
  });

  it('persists the chosen tracking mode and resumes the demo', async () => {
    useAppShellStore.setState({
      onboarding: {
        ...createOnboardingProgress('android', 1),
        completedSteps: [
          'tracking_intro',
          'permission_education',
          'permission_request',
          'keywords'
        ],
        currentStep: 'preference'
      }
    });
    renderWithProviders(<TrackingPreferencesRoute />);

    fireEvent.press(screen.getByLabelText('مراجعة كل العناصر'));
    fireEvent.press(screen.getByLabelText('متابعة'));

    await waitFor(() =>
      expect(asyncSet).toHaveBeenCalledWith(
        'masarifi.appShell.trackingPreference',
        expect.stringContaining('review_all')
      )
    );
    expect(router.replace).toHaveBeenCalledWith('/(onboarding)/tracking-demo');
  });

  it('shows safe correction controls and never adds unsafe fixtures', () => {
    renderWithProviders(<TrackingDemoRoute />);

    expect(screen.getByLabelText('تراجع')).toBeOnTheScreen();
    expect(screen.getByLabelText('تعديل')).toBeOnTheScreen();
    expect(screen.getByLabelText('الإبلاغ عن مشكلة')).toBeOnTheScreen();
    expect(decideTrackingOutcome('automatic_clear', 'otp')).not.toBe('add');
  });
});
