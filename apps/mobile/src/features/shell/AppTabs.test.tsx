import React from 'react';
import { act, fireEvent, screen } from '@testing-library/react-native';

import { changeLocale, translate } from '@/localization/i18n';
import { usePreferenceStore } from '@/state/preferences';
import { renderWithProviders } from '@/test-utils/render';
import { AppTabs } from './AppTabs';

afterEach(() => {
  changeLocale('en');
  usePreferenceStore.setState({ locale: 'en', direction: 'ltr' });
});

it('keeps semantic tab order while inherited direction mirrors the layout', () => {
  changeLocale('en');
  usePreferenceStore.setState({ locale: 'en', direction: 'ltr' });
  renderWithProviders(
    <AppTabs currentRoute="/(tabs)/home" onSelect={jest.fn()} />
  );
  expect(screen.getByTestId('foundation-direction-root')).toHaveStyle({
    direction: 'ltr'
  });
  expect(
    screen.getAllByRole('tab').map((tab) => tab.props.accessibilityLabel)
  ).toEqual(['Home', 'Assistant', 'Transactions']);
  expect(screen.queryByRole('tab', { name: 'Reports' })).toBeNull();
  expect(screen.queryByRole('tab', { name: 'More' })).toBeNull();

  act(() => {
    usePreferenceStore.setState({ locale: 'ar', direction: 'rtl' });
  });
  expect(screen.getByTestId('foundation-direction-root')).toHaveStyle({
    direction: 'rtl'
  });
  expect(screen.getByTestId('app-tabs')).toHaveStyle({
    flexDirection: 'row'
  });
  expect(screen.getByTestId('app-tabs')).not.toHaveStyle({ direction: 'ltr' });
  expect(
    screen.getAllByRole('tab').map((tab) => tab.props.accessibilityLabel)
  ).toEqual(['الرئيسية', 'المساعد', 'المعاملات']);
});

it('renders the assistant mark and opens the prominent center destination', () => {
  changeLocale('en');
  usePreferenceStore.setState({ locale: 'en', direction: 'ltr' });
  const onSelect = jest.fn();
  renderWithProviders(
    <AppTabs currentRoute="/(tabs)/home" onSelect={onSelect} />
  );

  fireEvent.press(
    screen.getByRole('tab', {
      name: translate('appShell.shell.assistant', 'en')
    })
  );
  expect(onSelect).toHaveBeenCalledWith('/assistant');
  expect(
    screen.getByTestId('app-tabs-assistant-icon', {
      includeHiddenElements: true
    })
  ).toBeTruthy();
});

it('allows long tab labels to wrap instead of truncating', () => {
  changeLocale('en');
  usePreferenceStore.setState({ locale: 'en', direction: 'ltr' });
  renderWithProviders(
    <AppTabs currentRoute="/(tabs)/home" onSelect={jest.fn()} />
  );

  const label = screen.getByText(translate('appShell.tabs.transactions', 'en'));
  expect(label.props.numberOfLines).toBe(2);
  expect(label.props.maxFontSizeMultiplier).toBe(1.5);
  expect(label).toHaveStyle({ width: '100%' });
});
