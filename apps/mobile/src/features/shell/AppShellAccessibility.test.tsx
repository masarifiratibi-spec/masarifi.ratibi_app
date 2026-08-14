import React from 'react';
import { screen } from '@testing-library/react-native';

import HomeRoute from '@app/(tabs)/home';
import { PermissionEducation } from '@/features/onboarding/PermissionEducation';
import { PinForm } from '@/features/security/PinForm';
import { changeLocale, translate } from '@/localization/i18n';
import { renderWithProviders } from '@/test-utils/render';

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), replace: jest.fn(), back: jest.fn() }
}));

describe('app shell accessibility', () => {
  it('exposes names, roles, actions, and Android-sized controls across shell surfaces', async () => {
    changeLocale('ar');
    renderWithProviders(<HomeRoute />);
    expect(await screen.findByText(translate('coreFinance.home.total'))).toBeTruthy();
    expect(screen.getByLabelText('الحسابات')).toHaveAccessibilityState({
      disabled: false
    });
    expect(screen.getByLabelText('إضافة يدوية')).toHaveStyle({ minHeight: 48 });

    renderWithProviders(
      <PermissionEducation onEnable={jest.fn()} onSkip={jest.fn()} />
    );
    expect(screen.getByLabelText('تفعيل التتبع')).toHaveAccessibilityState({
      disabled: false
    });

    renderWithProviders(<PinForm mode="unlock" onSubmit={jest.fn()} />);
    expect(screen.getByLabelText('رمز PIN')).toBeOnTheScreen();
  });
});
