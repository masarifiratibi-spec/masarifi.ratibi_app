import React from 'react';
import { Platform } from 'react-native';
import { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
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
jest.mock('@react-native-community/datetimepicker', () => ({
  __esModule: true,
  default: () => null,
  DateTimePickerAndroid: { open: jest.fn() }
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
afterEach(() => {
  useAppShellStore.setState({ session: savedSession });
  jest.restoreAllMocks();
});

it('selects and saves a local birthday with the current profile version and unsent edits', () => {
  jest.replaceProperty(Platform, 'OS', 'android');
  jest
    .mocked(queries.useSettingsProfile)
    .mockReturnValue(
      snapshot({ ...profile, birthday: '2000-02-29', version: 3 }) as never
    );
  const view = renderProfile();
  fireEvent.changeText(
    view.getByLabelText(t('settings.profile.name')),
    'Edited name'
  );
  fireEvent.press(view.getByText(t('settings.profile.birthday')));
  expect(DateTimePickerAndroid.open).toHaveBeenCalledTimes(1);
  const picker = jest.mocked(DateTimePickerAndroid.open).mock.calls[0][0];
  expect(picker.value.getFullYear()).toBe(2000);
  expect(picker.value.getMonth()).toBe(1);
  expect(picker.value.getDate()).toBe(29);
  expect(picker.maximumDate).toBeInstanceOf(Date);
  act(() =>
    picker.onChange?.(
      { type: 'set', nativeEvent: { timestamp: 0, utcOffset: 180 } },
      new Date(1996, 5, 15)
    )
  );
  expect(view.getByText('1996-06-15')).toBeTruthy();
  expect(mutate).toHaveBeenCalledWith(
    expect.objectContaining({
      input: expect.objectContaining({
        birthday: '1996-06-15',
        name: 'Edited name'
      }),
      expectedVersion: 3
    })
  );
});

it('does not save a dismissed birthday or a date in the future', () => {
  jest.replaceProperty(Platform, 'OS', 'android');
  const view = renderProfile();
  fireEvent.press(view.getByText(t('settings.profile.birthday')));
  const picker = jest.mocked(DateTimePickerAndroid.open).mock.calls[0][0];
  act(() =>
    picker.onChange?.({
      type: 'dismissed',
      nativeEvent: { timestamp: 0, utcOffset: 0 }
    })
  );
  act(() =>
    picker.onChange?.(
      { type: 'set', nativeEvent: { timestamp: 0, utcOffset: 0 } },
      new Date(2999, 0, 1)
    )
  );
  expect(mutate).not.toHaveBeenCalled();
  expect(view.getByText(t('settings.profile.birthday.notSet'))).toBeTruthy();
});

it('ignores an open birthday picker after switching owners', () => {
  jest.replaceProperty(Platform, 'OS', 'android');
  useAppShellStore.setState({
    session: {
      userId: 'owner-a',
      method: 'google',
      status: 'authenticated',
      restoration: 'restored',
      issuedAt: 1,
      expiresAt: 9999999999999
    }
  });
  const view = renderProfile();
  fireEvent.press(view.getByText(t('settings.profile.birthday')));
  const picker = jest.mocked(DateTimePickerAndroid.open).mock.calls[0][0];
  act(() => useAppShellStore.setState({ session: null }));
  act(() =>
    picker.onChange?.(
      { type: 'set', nativeEvent: { timestamp: 0, utcOffset: 0 } },
      new Date(1996, 5, 15)
    )
  );
  expect(mutate).not.toHaveBeenCalled();
});

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
