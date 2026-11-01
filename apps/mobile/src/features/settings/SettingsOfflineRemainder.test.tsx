import React from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';
import { QueryClient } from '@tanstack/react-query';
import { FoundationProviders } from '@/state/FoundationProviders';
import { useAppShellStore } from '@/state/app-shell';
import {
  changeLocale,
  currentLocale,
  translateDynamic as t
} from '@/localization/i18n';
import { usePreferenceStore } from '@/state/preferences';
import { ProfilePhoneScreen } from './ProfilePhoneScreen';
import { SessionListScreen } from './SessionListScreen';
import * as queries from './settings-queries';

jest.mock('./settings-queries', () => ({
  useSettingsProfile: jest.fn(),
  useSaveSettingsProfile: jest.fn(),
  useSettingsSessions: jest.fn(),
  useRevokeSession: jest.fn()
}));
const profile = {
  name: 'Saved owner',
  avatar: 'default',
  phone: '+971501234567',
  email: null,
  googleAccount: null,
  gender: null,
  country: 'AE',
  currency: 'AED',
  timeZone: 'Asia/Dubai',
  completion: [],
  version: 1
};
const snapshot = (data: unknown, error: unknown = Error('offline')) => ({
  data,
  error,
  isError: Boolean(error),
  isLoading: false,
  isFetching: false,
  dataUpdatedAt: 100
});
const mutate = jest.fn();
const previousSession = useAppShellStore.getState().session;
function renderWithProviders(ui: React.ReactElement) {
  const locale = currentLocale();
  usePreferenceStore.setState({
    locale,
    direction: locale === 'ar' ? 'rtl' : 'ltr',
    hydrated: true
  });
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } }
  });
  return render(ui, {
    wrapper: ({ children }) => (
      <FoundationProviders client={client}>{children}</FoundationProviders>
    )
  });
}
afterEach(() => useAppShellStore.setState({ session: previousSession }));
beforeEach(() => {
  jest.clearAllMocks();
  changeLocale('en');
  jest
    .mocked(queries.useSettingsProfile)
    .mockReturnValue(snapshot(profile) as never);
  jest
    .mocked(queries.useSaveSettingsProfile)
    .mockReturnValue({ mutate, isPending: false } as never);
  jest
    .mocked(queries.useRevokeSession)
    .mockReturnValue({ mutate, isPending: false } as never);
});

it('keeps unsent phone edits while refreshing the authoritative profile version', () => {
  jest
    .mocked(queries.useSettingsProfile)
    .mockReturnValue(snapshot(profile, null) as never);
  const view = renderWithProviders(<ProfilePhoneScreen />);
  fireEvent.changeText(
    view.getByLabelText(t('appShell.auth.phone.number')),
    '509876543'
  );
  jest
    .mocked(queries.useSettingsProfile)
    .mockReturnValue(
      snapshot({ ...profile, phone: '+16501234567', version: 2 }, null) as never
    );
  view.rerender(<ProfilePhoneScreen />);
  expect(view.getByLabelText(t('appShell.auth.phone.number')).props.value).toBe(
    '509876543'
  );
  expect(
    view.getByLabelText(t('appShell.auth.phone.countryCode')).props.value
  ).toBe('+971');
  fireEvent.press(
    view.getByRole('button', { name: t('settings.profile.phone.save') })
  );
  expect(mutate).toHaveBeenCalledWith(
    expect.objectContaining({
      input: expect.objectContaining({ phone: '+971509876543' }),
      expectedVersion: 2
    }),
    expect.anything()
  );
  view.unmount();
});

it('clears unsent phone text when an existing screen is reused for another owner', () => {
  const session = {
    userId: 'a',
    status: 'authenticated' as const,
    method: 'google' as const,
    restoration: 'restored' as const,
    issuedAt: 1,
    expiresAt: 9999999999999
  };
  useAppShellStore.setState({ session });
  const view = renderWithProviders(<ProfilePhoneScreen />);
  fireEvent.changeText(
    view.getByLabelText(t('appShell.auth.phone.number')),
    '509876543'
  );
  jest
    .mocked(queries.useSettingsProfile)
    .mockReturnValue(snapshot({ ...profile, phone: '+971501111111' }) as never);
  act(() =>
    useAppShellStore.setState({ session: { ...session, userId: 'b' } })
  );
  expect(view.getByLabelText(t('appShell.auth.phone.number')).props.value).toBe(
    '501111111'
  );
  expect(mutate).not.toHaveBeenCalled();
  view.unmount();
});

it.each(['ar', 'en'] as const)(
  'shows the saved phone offline without attempting a remote save in %s',
  (locale) => {
    changeLocale(locale);
    const view = renderWithProviders(<ProfilePhoneScreen />);
    expect(view.getByText(profile.phone)).toBeTruthy();
    expect(
      view.getByText(t('coreFinance.state.refreshFailedSnapshot'))
    ).toBeTruthy();
    const save = view.getByRole('button', {
      name: t('settings.profile.phone.save')
    });
    expect(save).toBeDisabled();
    fireEvent.press(save);
    expect(mutate).not.toHaveBeenCalled();
    view.unmount();
  }
);

it('keeps a saved session inventory readable without allowing offline revocation', () => {
  jest
    .mocked(queries.useSettingsSessions)
    .mockReturnValue(
      snapshot([
        {
          id: 'saved-device',
          deviceLabel: 'Saved device',
          status: 'active',
          isCurrentDevice: false
        }
      ]) as never
    );
  const view = renderWithProviders(<SessionListScreen />);
  expect(view.getByText('Saved device')).toBeTruthy();
  expect(
    view.getByText(t('coreFinance.state.refreshFailedSnapshot'))
  ).toBeTruthy();
  const revoke = view.getByRole('button', {
    name: t('settings.sessions.revoke', { device: 'Saved device' })
  });
  expect(revoke).toBeDisabled();
  fireEvent.press(revoke);
  expect(mutate).not.toHaveBeenCalled();
  view.unmount();
});

it('withholds saved session inventory after an authoritative denial', () => {
  jest
    .mocked(queries.useSettingsSessions)
    .mockReturnValue(
      snapshot(
        [
          {
            id: 'saved-device',
            deviceLabel: 'Saved device',
            status: 'active',
            isCurrentDevice: false
          }
        ],
        { code: 'permission_required' }
      ) as never
    );
  const view = renderWithProviders(<SessionListScreen />);
  expect(view.queryByText('Saved device')).toBeNull();
  expect(mutate).not.toHaveBeenCalled();
  view.unmount();
});
