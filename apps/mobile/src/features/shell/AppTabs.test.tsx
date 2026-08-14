import React from 'react';
import { act, render, screen } from '@testing-library/react-native';

import { usePreferenceStore } from '@/state/preferences';
import { AppTabs } from './AppTabs';

it('uses current locale labels and RTL tab order', () => {
  usePreferenceStore.setState({ locale: 'en', direction: 'ltr' });
  const { rerender } = render(
    <AppTabs currentRoute="/(tabs)/home" onSelect={jest.fn()} />
  );
  expect(screen.getAllByRole('tab')[0]).toHaveTextContent('Home');

  act(() => {
    usePreferenceStore.setState({ locale: 'ar', direction: 'rtl' });
  });
  rerender(<AppTabs currentRoute="/(tabs)/home" onSelect={jest.fn()} />);
  expect(screen.getAllByRole('tab')[0]).toHaveTextContent('المزيد');
  expect(screen.getAllByRole('tab')[4]).toHaveTextContent('الرئيسية');
});
