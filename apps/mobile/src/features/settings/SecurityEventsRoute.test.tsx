import React from 'react';
import { Redirect } from 'expo-router';

test('redirects the retired security-events route to Security Settings', () => {
  const Route = jest.requireActual<{ default: () => React.ReactElement }>(
    '@app/security/events'
  ).default;
  expect(Route()).toEqual(<Redirect href="/security/settings" />);
});
