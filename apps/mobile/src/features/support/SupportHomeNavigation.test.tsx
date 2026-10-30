import React from 'react';
import { fireEvent, screen } from '@testing-library/react-native';
import { router } from 'expo-router';
import { changeLocale, translate } from '@/localization/i18n';
import { renderWithProviders } from '@/test-utils/render';
import { SupportHomeScreen } from './SupportHomeScreen';

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn(), replace: jest.fn() }
}));

test.each(['ar', 'en'] as const)(
  'opens existing ticket history from Support in %s',
  async (locale) => {
    changeLocale(locale);
    renderWithProviders(<SupportHomeScreen />);
    fireEvent.press(
      await screen.findByRole('button', {
        name: translate('support.home.ticketHistory')
      })
    );
    expect(router.push).toHaveBeenCalledWith('/support/tickets');
    expect(router.replace).not.toHaveBeenCalled();
  }
);

test.each(['ar', 'en'] as const)(
  'opens a separate feedback history from Support in %s',
  async (locale) => {
    changeLocale(locale);
    renderWithProviders(<SupportHomeScreen />);
    fireEvent.press(await screen.findByRole('button', {
      name: locale === 'ar' ? 'سجل الملاحظات' : 'Feedback history'
    }));
    expect(router.push).toHaveBeenCalledWith('/support/feedback');
  }
);
