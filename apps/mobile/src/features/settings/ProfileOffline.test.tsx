import React from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';
import { QueryClient } from '@tanstack/react-query';
import { FoundationProviders } from '@/state/FoundationProviders';
import {
  changeLocale,
  currentLocale,
  translateDynamic as t
} from '@/localization/i18n';
import { useAppShellStore } from '@/state/app-shell';
import { usePreferenceStore } from '@/state/preferences';
import type { UserProfile } from '@/domain/settings';
import { ProfileScreen } from './ProfileScreen';
import * as queries from './settings-queries';

jest.mock('./settings-queries', () => ({
  useSettingsProfile: jest.fn(),
  useSaveSettingsProfile: jest.fn()
}));
const profile: UserProfile = {
  name: 'Saved owner',
  avatar: 'default',
  email: null,
  phone: null,
  googleAccount: null,
  gender: null,
  country: 'SA',
  currency: 'SAR',
  timeZone: 'Asia/Riyadh',
  completion: [],
  version: 1
};
const snapshot = (data: UserProfile = profile, error: unknown = null) => ({
  data,
  error,
  isLoading: false,
  isError: Boolean(error),
  dataUpdatedAt: 100,
  isFetching: false
});
function renderProfile() {
  const locale = currentLocale();
  usePreferenceStore.setState({
    locale,
    direction: locale === 'ar' ? 'rtl' : 'ltr',
    hydrated: true
  });
  const client = new QueryClient({
    defaultOptions: { queries: { gcTime: Infinity, retry: false } }
  });
  return render(<ProfileScreen />, {
    wrapper: ({ children }) => (
      <FoundationProviders client={client}>{children}</FoundationProviders>
    )
  });
}
const savedSession = useAppShellStore.getState().session;
const mutate = jest.fn();
beforeEach(() => {
  jest.clearAllMocks();
  changeLocale('en');
  jest.mocked(queries.useSettingsProfile).mockReturnValue(snapshot() as never);
  jest
    .mocked(queries.useSaveSettingsProfile)
    .mockReturnValue({ mutate, isPending: false } as never);
});
afterEach(() => useAppShellStore.setState({ session: savedSession }));

it.each(['ar', 'en'] as const)(
  'shows an authorized cached profile after a failed refresh in %s',
  (locale) => {
    changeLocale(locale);
    jest
      .mocked(queries.useSettingsProfile)
      .mockReturnValue(snapshot(profile, Error('offline')) as never);
    const view = renderProfile();
    expect(view.getByLabelText(t('settings.profile.name')).props.value).toBe(
      'Saved owner'
    );
    expect(
      view.getByText(t('coreFinance.state.refreshFailedSnapshot'))
    ).toBeTruthy();
  }
);

it('keeps edited fields while refreshing untouched fields and the authoritative version', () => {
  const view = renderProfile();
  fireEvent.changeText(
    view.getByLabelText(t('settings.profile.name')),
    'Unsent edit'
  );
  jest.mocked(queries.useSettingsProfile).mockReturnValue(
    snapshot({
      ...profile,
      name: 'Server name',
      email: 'new@example.com',
      version: 2
    }) as never
  );
  view.rerender(<ProfileScreen />);
  expect(view.getByLabelText(t('settings.profile.name')).props.value).toBe(
    'Unsent edit'
  );
  expect(view.getByLabelText(t('settings.profile.email')).props.value).toBe(
    'new@example.com'
  );
  fireEvent.press(view.getByText(t('settings.profile.save')));
  expect(mutate).toHaveBeenCalledWith(
    expect.objectContaining({
      input: expect.objectContaining({
        name: 'Unsent edit',
        email: 'new@example.com'
      }),
      expectedVersion: 2
    })
  );
});

it('preserves an unset gender instead of silently choosing one when saving', () => {
  const view = renderProfile();
  fireEvent.press(view.getByText(t('settings.profile.save')));
  expect(mutate).toHaveBeenCalledWith(
    expect.objectContaining({
      input: expect.objectContaining({ gender: null })
    })
  );
});

it('never carries unsent profile edits into another owner on a reused screen', () => {
  const session = {
    userId: 'owner-a',
    method: 'google' as const,
    status: 'authenticated' as const,
    restoration: 'restored' as const,
    issuedAt: 1,
    expiresAt: 9999999999999
  };
  useAppShellStore.setState({ session });
  const view = renderProfile();
  fireEvent.changeText(
    view.getByLabelText(t('settings.profile.name')),
    'A private draft'
  );
  jest
    .mocked(queries.useSettingsProfile)
    .mockReturnValue(snapshot({ ...profile, name: 'Owner B' }) as never);
  act(() =>
    useAppShellStore.setState({
      session: { ...session, userId: 'owner-b' }
    })
  );
  view.rerender(<ProfileScreen />);
  expect(view.getByLabelText(t('settings.profile.name')).props.value).toBe(
    'Owner B'
  );
  expect(mutate).not.toHaveBeenCalled();
});

it('withdraws the saved profile after an authoritative access denial', () => {
  jest
    .mocked(queries.useSettingsProfile)
    .mockReturnValue(snapshot(profile, { code: 'forbidden' }) as never);
  const view = renderProfile();
  expect(view.queryByLabelText(t('settings.profile.name'))).toBeNull();
  expect(mutate).not.toHaveBeenCalled();
});
