import React from 'react';
import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';

import { automaticTrackingKeys } from '@/state/automatic-tracking-view-state';
import { renderWithQueryData } from '@/test-utils/render';
import { translate } from '@/localization/i18n';
import { TrackingStatusScreen } from './TrackingStatusScreen';
import { createAppShellStorage } from '@/storage/app-shell-storage';
import { defaultKeywordRules } from '@/services/mocks/default-keywords';

describe('TrackingStatusScreen', () => {
  beforeEach(async () => {
    const storage = createAppShellStorage();
    await storage.saveKeywords(defaultKeywordRules);
  });

  it('renders tracking status, how it works, and keyword chips with dynamic count', async () => {
    renderWithQueryData(<TrackingStatusScreen />, [
      [
        automaticTrackingKeys.status,
        {
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
        }
      ]
    ]);
    await act(async () => {});

    // 1. Header & Status
    expect(
      screen.getByText(translate('tracking.header.title'))
    ).toBeOnTheScreen();
    expect(
      screen.getByText(translate('tracking.status.enabled'))
    ).toBeOnTheScreen();

    // 2. How it works explanations
    expect(
      screen.getByText(translate('tracking.howItWorks.detection'))
    ).toBeOnTheScreen();
    expect(
      screen.getByText(translate('tracking.howItWorks.privacy'))
    ).toBeOnTheScreen();

    // 3. Keywords section with real keywords
    await waitFor(() => {
      expect(
        screen.getByText(new RegExp(translate('tracking.keywords.sectionTitle')))
      ).toBeOnTheScreen();
    });

    // Grocery / مصروف should be in the default keywords
    expect(screen.getByText('Grocery')).toBeOnTheScreen();
    expect(screen.getByText('مصروف')).toBeOnTheScreen();
  });

  it('displays actionable permission warning when permission is not granted', async () => {
    renderWithQueryData(<TrackingStatusScreen />, [
      [
        automaticTrackingKeys.status,
        {
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
        }
      ]
    ]);
    await act(async () => {});

    expect(
      screen.getByTestId('tracking-permission-warning-banner')
    ).toBeOnTheScreen();
    expect(
      screen.getByText(translate('tracking.permission.warning'))
    ).toBeOnTheScreen();
  });

  it('allows adding and removing custom keywords', async () => {
    renderWithQueryData(<TrackingStatusScreen />, [
      [
        automaticTrackingKeys.status,
        {
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
        }
      ]
    ]);
    await act(async () => {});

    // Open add keyword draft input
    await waitFor(() => {
      expect(screen.getByTestId('tracking-add-keyword-toggle')).toBeOnTheScreen();
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
  });

  it('allows restoring default keywords', async () => {
    renderWithQueryData(<TrackingStatusScreen />, [
      [
        automaticTrackingKeys.status,
        {
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
        }
      ]
    ]);
    await act(async () => {});

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
});
