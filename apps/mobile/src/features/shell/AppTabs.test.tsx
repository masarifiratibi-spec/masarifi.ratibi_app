import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react-native';

import { translate } from '@/localization/i18n';
import { usePreferenceStore } from '@/state/preferences';
import { AppTabs } from './AppTabs';

it('renders only the three primary destinations in structural LTR and RTL order', () => {
  usePreferenceStore.setState({ locale: 'en', direction: 'ltr' });
  const { rerender } = render(
    <AppTabs currentRoute="/(tabs)/home" onSelect={jest.fn()} />
  );
  expect(
    screen.getAllByRole('tab').map((tab) => tab.props.accessibilityLabel)
  ).toEqual(['Home', 'Assistant', 'Transactions']);
  expect(screen.queryByRole('tab', { name: 'Reports' })).toBeNull();
  expect(screen.queryByRole('tab', { name: 'More' })).toBeNull();

  act(() => {
    usePreferenceStore.setState({ locale: 'ar', direction: 'rtl' });
  });
  rerender(<AppTabs currentRoute="/(tabs)/home" onSelect={jest.fn()} />);
  expect(screen.getByTestId('app-tabs')).toHaveStyle({
    flexDirection: 'row-reverse'
  });
  expect(
    screen.getAllByRole('tab').map((tab) => tab.props.accessibilityLabel)
  ).toEqual(['المعاملات', 'المساعد', 'الرئيسية']);
});

it('renders the assistant mark and opens the prominent center destination', () => {
  usePreferenceStore.setState({ locale: 'en', direction: 'ltr' });
  const onSelect = jest.fn();
  render(<AppTabs currentRoute="/(tabs)/home" onSelect={onSelect} />);

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
  usePreferenceStore.setState({ locale: 'en', direction: 'ltr' });
  render(<AppTabs currentRoute="/(tabs)/home" onSelect={jest.fn()} />);

  const label = screen.getByText(translate('appShell.tabs.transactions', 'en'));
  expect(label.props.numberOfLines).toBe(2);
  expect(label.props.maxFontSizeMultiplier).toBe(1.5);
  expect(label).toHaveStyle({ width: '100%' });
});
