import React from 'react';
import { render, screen } from '@testing-library/react-native';

import TabsLayout from '@app/(tabs)/_layout';

let mockRouteName = 'home';

jest.mock('expo-router', () => ({
  router: { navigate: jest.fn() },
  Tabs: Object.assign(
    ({ tabBar }: { tabBar: (props: { state: { index: number; routeNames: string[] } }) => React.ReactNode }) => {
      const routeNames = ['home', 'transactions', 'add', 'reports', 'more'];
      return <>{tabBar({ state: { index: routeNames.indexOf(mockRouteName), routeNames } })}</>;
    },
    { Screen: () => null }
  )
}));

jest.mock('./ProtectedRouteGate', () => ({
  ProtectedRouteGate: ({ children }: { children: React.ReactNode }) => children
}));

it('shows the primary tab bar only on primary destinations', () => {
  mockRouteName = 'home';
  const rendered = render(<TabsLayout />);
  expect(screen.getByTestId('app-tabs')).toBeTruthy();

  mockRouteName = 'reports';
  rendered.rerender(<TabsLayout />);
  expect(screen.queryByTestId('app-tabs')).toBeNull();

  mockRouteName = 'more';
  rendered.rerender(<TabsLayout />);
  expect(screen.queryByTestId('app-tabs')).toBeNull();
});
