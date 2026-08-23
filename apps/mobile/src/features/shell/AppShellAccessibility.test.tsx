import React from 'react';
import { screen } from '@testing-library/react-native';

import HomeRoute from '@app/(tabs)/home';
import MoreRoute from '@app/(tabs)/more';
import { PermissionEducation } from '@/features/onboarding/PermissionEducation';
import { PinForm } from '@/features/security/PinForm';
import { changeLocale, translate } from '@/localization/i18n';
import { renderWithProviders } from '@/test-utils/render';

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), replace: jest.fn(), back: jest.fn(), navigate: jest.fn() },
  useLocalSearchParams: () => ({})
}));

describe('app shell accessibility', () => {
  it('exposes names, roles, actions, and Android-sized controls across shell surfaces', async () => {
    changeLocale('ar');
    const home = renderWithProviders(<HomeRoute />);
    expect(
      await screen.findByText(translate('coreFinance.home.total'))
    ).toBeTruthy();
    expect(screen.getByTestId('home-quick-action-accounts')).toBeOnTheScreen();
    home.unmount();

    const more = renderWithProviders(<MoreRoute />);
    expect(screen.getByLabelText('الملف الشخصي')).toHaveStyle({ minHeight: 48 });
    more.unmount();

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
