import React from 'react';
import { act, render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';
import { FoundationProviders } from '@/state/FoundationProviders';
import { useAppShellStore } from '@/state/app-shell';
import { usePreferenceStore } from '@/state/preferences';
import { changeLocale } from '@/localization/i18n';

afterEach(() => { act(() => useAppShellStore.getState().reset()); });

it.each([['ar', 'جارٍ تسجيل الخروج…'], ['en', 'Signing out…']] as const)('covers route changes with only the logout progress message in %s', (locale, message) => {
  changeLocale(locale);
  usePreferenceStore.setState({locale});
  useAppShellStore.setState({logoutInProgressOwnerId: 'user_logout'});
  render(<FoundationProviders><Text>Underlying route</Text></FoundationProviders>);
  expect(screen.getByTestId('logout-progress-overlay')).toBeTruthy();
  expect(screen.getByText(message)).toBeTruthy();
  act(() => useAppShellStore.getState().fenceLogoutOwner('user_logout'));
  expect(screen.getByText(message)).toBeTruthy();
  act(() => useAppShellStore.setState({logoutInProgressOwnerId:null,logoutRecoveryOwnerId:null}));
  expect(screen.queryByText(message)).toBeNull();
  expect(screen.getByText('Underlying route')).toBeTruthy();
});
