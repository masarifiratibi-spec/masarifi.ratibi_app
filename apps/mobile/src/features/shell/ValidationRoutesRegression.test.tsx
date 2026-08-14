import React from 'react';
import { Platform } from 'react-native';

import DesignSystemRoute from '@app/design-system';
import TrustRoute from '@app/foundation/trust';
import PositionRoute from '@app/foundation/position';
import CaptureRoute from '@app/foundation/capture';
import AccessibilityRoute from '@app/foundation/accessibility';
import ScenariosRoute from '@app/foundation/scenarios';
import { renderWithProviders } from '@/test-utils/render';
import { changeLocale } from '@/localization/i18n';

describe('validation routes regression', () => {
  it('keeps foundation validation routes and design-system gallery directly reachable', () => {
    const originalPlatform = Platform.OS;
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'web' });
    for (const Route of [DesignSystemRoute, TrustRoute, PositionRoute, CaptureRoute, AccessibilityRoute]) {
      expect(renderWithProviders(<Route />).toJSON()).not.toBeNull();
    }
    Object.defineProperty(Platform, 'OS', { configurable: true, value: originalPlatform });
  });

  it('keeps frontend quality scenarios development-only', () => {
    changeLocale('en');
    const devGlobal = global as typeof globalThis & { __DEV__: boolean };
    const originalDev = devGlobal.__DEV__;
    Object.defineProperty(global, '__DEV__', { configurable: true, value: false });
    expect(renderWithProviders(<ScenariosRoute />).getByText('Scenario selector is only available in development builds.')).toBeTruthy();

    Object.defineProperty(global, '__DEV__', { configurable: true, value: true });
    expect(renderWithProviders(<ScenariosRoute />).getByText('Frontend quality scenarios')).toBeTruthy();
    Object.defineProperty(global, '__DEV__', { configurable: true, value: originalDev });
  });
});
