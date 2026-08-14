import React from 'react';
import { fireEvent, screen } from '@testing-library/react-native';
import { router } from 'expo-router';

import { renderWithProviders } from '@/test-utils/render';
import { changeLocale, translateDynamic as t } from '@/localization/i18n';

jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));
jest.mock('./settings-queries', () => ({
  useSettingsProfile: jest.fn(),
  useSaveSettingsProfile: jest.fn(),
  usePrivacyRequest: jest.fn(),
  useDeleteLocalData: jest.fn()
}));

// eslint-disable-next-line @typescript-eslint/no-var-requires
const mockQueries = require('./settings-queries') as {
  useSettingsProfile: jest.Mock;
  useSaveSettingsProfile: jest.Mock;
  usePrivacyRequest: jest.Mock;
  useDeleteLocalData: jest.Mock;
};
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { ApplicationSettingsScreen } = require('./ApplicationSettingsScreen') as { ApplicationSettingsScreen: React.ComponentType };
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { PrivacySettingsScreen } = require('./PrivacySettingsScreen') as { PrivacySettingsScreen: React.ComponentType };
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { ProfileScreen } = require('./ProfileScreen') as { ProfileScreen: React.ComponentType };

beforeEach(() => {
  jest.clearAllMocks();
  changeLocale('en');
  mockQueries.useSettingsProfile.mockReturnValue({ data: profile(), isLoading: false, isError: false });
  mockQueries.useSaveSettingsProfile.mockReturnValue({ mutate: jest.fn(), isPending: false });
  mockQueries.usePrivacyRequest.mockReturnValue({ mutate: jest.fn(), isPending: false });
  mockQueries.useDeleteLocalData.mockReturnValue({ mutate: jest.fn(), isPending: false });
});

test('profile preserves edits, validates owner fields, and redirects identity-owned values', () => {
  const save = jest.fn();
  mockQueries.useSaveSettingsProfile.mockReturnValue({ mutate: save, isPending: false });

  renderWithProviders(<ProfileScreen />);

  expect(screen.getByText(t('settings.profile.avatar.default'))).toBeTruthy();
  expect(screen.getByText('+966500000000')).toBeTruthy();
  expect(screen.getByText(t('settings.profile.google.notLinked'))).toBeTruthy();
  expect(screen.getByText('SA')).toBeTruthy();
  expect(screen.getByText(t('settings.profile.completion.identity'))).toBeTruthy();
  expect(screen.getByText(t('settings.profile.googleOwner'))).toBeTruthy();

  fireEvent.changeText(screen.getByLabelText(t('settings.profile.name')), 'Dana Edited');
  fireEvent.changeText(screen.getByLabelText(t('settings.profile.email')), 'bad-email');
  fireEvent.press(screen.getByText(t('settings.profile.save')));
  expect(screen.getByText(t('settings.profile.validation.email'))).toBeTruthy();
  expect(save).not.toHaveBeenCalled();

  fireEvent.changeText(screen.getByLabelText(t('settings.profile.email')), 'dana@example.com');
  fireEvent.press(screen.getByText(t('settings.profile.save')));
  expect(save).toHaveBeenCalledWith(expect.objectContaining({ input: expect.objectContaining({ name: 'Dana Edited', timeZone: 'Asia/Riyadh', currency: 'SAR' }), expectedVersion: 1 }));

  fireEvent.press(screen.getByText(t('settings.profile.phoneOwner')));
  expect(router.push).toHaveBeenCalledWith('/security/settings');
  fireEvent.press(screen.getByText(t('settings.profile.googleOwner')));
  expect(router.push).toHaveBeenCalledWith('/security/settings');
});

test('application settings route device-local owners without duplicating hide balances', () => {
  renderWithProviders(<ApplicationSettingsScreen />);

  ['settings.application.language', 'settings.application.theme', 'settings.application.weekStart', 'settings.application.defaultAccount', 'settings.application.transactionDefaults', 'settings.application.dashboard', 'settings.application.trackingOwner', 'settings.application.reportEmailOwner', 'settings.application.hideBalances', 'settings.application.notificationsOwner', 'settings.application.reportsOwner'].forEach((key) => expect(screen.getAllByText(t(key)).length).toBeGreaterThan(0));
  expect(screen.getAllByText(t('settings.application.voiceOwner')).length).toBeGreaterThan(0);

  fireEvent.press(screen.getByText(t('settings.application.notificationsOwner')));
  expect(router.push).toHaveBeenCalledWith('/notifications/preferences');
});

test('privacy settings requests export/deletion and local deletion without false completion claims', () => {
  const request = jest.fn();
  const localDelete = jest.fn();
  mockQueries.usePrivacyRequest.mockReturnValue({ mutate: request, isPending: false });
  mockQueries.useDeleteLocalData.mockReturnValue({ mutate: localDelete, isPending: false });

  renderWithProviders(<PrivacySettingsScreen />);

  expect(screen.getByText(t('settings.privacy.legalExplanation'))).toBeTruthy();
  expect(screen.getByText(t('settings.privacy.tracking.enabled'))).toBeTruthy();
  expect(screen.getByText(t('settings.privacy.assistantPersonalization.enabled'))).toBeTruthy();
  expect(screen.getByLabelText(t('settings.privacy.analytics'))).toBeTruthy();
  fireEvent.press(screen.getByText(t('settings.privacy.tracking')));
  expect(screen.getByText(t('settings.privacy.tracking.disabled'))).toBeTruthy();

  fireEvent.press(screen.getByText(t('settings.privacy.exportReview')));
  expect(request).not.toHaveBeenCalled();
  fireEvent.press(screen.getByText(t('settings.privacy.confirmRequest')));
  fireEvent.press(screen.getByText(t('settings.privacy.accountDeletionReview')));
  fireEvent.press(screen.getByText(t('settings.privacy.confirmRequest')));
  fireEvent.press(screen.getByText(t('settings.privacy.localDelete')));
  expect(localDelete).not.toHaveBeenCalled();
  fireEvent.press(screen.getByText(t('settings.privacy.confirmLocalDelete')));

  expect(request).toHaveBeenCalledWith(expect.objectContaining({ kind: 'data_export' }));
  expect(request).toHaveBeenCalledWith(expect.objectContaining({ kind: 'account_deletion' }));
  expect(localDelete).toHaveBeenCalledWith(expect.objectContaining({ operationId: expect.stringMatching(/^settings-local-delete-/) }));
  expect(screen.queryByText(/settings\.privacy\.completed/i)).toBeNull();
});

function profile() {
  return {
    name: 'Dana',
    avatar: 'default',
    phone: '+966500000000',
    googleAccount: null,
    email: 'dana@example.com',
    country: 'SA',
    currency: 'SAR',
    timeZone: 'Asia/Riyadh',
    completion: ['identity', 'currency'],
    version: 1
  };
}
