import React from 'react';

jest.mock('@/config/demo-mode', () => ({ isFixtureModeEnabled: () => false }));
jest.mock('./SecurityEventScreen', () => ({ SecurityEventScreen: () => null }));

test('opens live events after the owner-filtered endpoint deployment', () => {
  const Route = jest.requireActual<{ default: () => React.ReactElement }>(
    '@app/security/events'
  ).default;
  const { SecurityEventScreen } = jest.requireMock('./SecurityEventScreen');
  expect(Route().type).toBe(SecurityEventScreen);
});
