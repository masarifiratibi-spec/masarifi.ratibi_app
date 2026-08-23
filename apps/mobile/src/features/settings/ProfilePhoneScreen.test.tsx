import React from 'react';
import { fireEvent, screen } from '@testing-library/react-native';

import { renderWithProviders } from '@/test-utils/render';
import { changeLocale, translateDynamic as t } from '@/localization/i18n';
import { ProfilePhoneScreen } from './ProfilePhoneScreen';

jest.mock('expo-router', () => ({ router: { push: jest.fn(), back: jest.fn() } }));
jest.mock('./settings-queries', () => ({
  useSettingsProfile: jest.fn(),
  useSaveSettingsProfile: jest.fn()
}));

// eslint-disable-next-line @typescript-eslint/no-var-requires
const mockQueries = require('./settings-queries') as {
  useSettingsProfile: jest.Mock;
  useSaveSettingsProfile: jest.Mock;
};

beforeEach(() => {
  jest.clearAllMocks();
  changeLocale('en');
  mockQueries.useSettingsProfile.mockReturnValue({
    data: {
      name: 'Dana',
      avatar: 'default',
      phone: '+966500000000',
      googleAccount: null,
      email: 'dana@example.com',
      country: 'SA',
      currency: 'SAR',
      timeZone: 'Asia/Riyadh',
      completion: [],
      version: 1
    },
    isLoading: false,
    isError: false
  });
  mockQueries.useSaveSettingsProfile.mockReturnValue({
    mutate: jest.fn(),
    isPending: false
  });
});

test('ProfilePhoneScreen displays current phone and saves updated phone number', () => {
  const save = jest.fn();
  mockQueries.useSaveSettingsProfile.mockReturnValue({
    mutate: save,
    isPending: false
  });

  renderWithProviders(<ProfilePhoneScreen />);

  expect(screen.getAllByText(t('settings.profile.phone.title')).length).toBeGreaterThan(0);
  expect(screen.getByText('+966500000000')).toBeTruthy();

  fireEvent.changeText(
    screen.getByLabelText(t('appShell.auth.phone.number')),
    '555123456'
  );
  fireEvent.press(screen.getByText(t('settings.profile.phone.save')));

  expect(save).toHaveBeenCalledWith(
    expect.objectContaining({
      input: expect.objectContaining({ phone: '+966555123456' }),
      expectedVersion: 1
    }),
    expect.any(Object)
  );
});
