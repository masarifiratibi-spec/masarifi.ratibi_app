import React from 'react';

jest.mock('@/config/demo-mode', () => ({ isFixtureModeEnabled: () => false }));
jest.mock('./SecurityEventScreen', () => ({ SecurityEventScreen: () => null }));

test('keeps live events gated until the owner-filtered endpoint is deployed', () => {
  const Route = jest.requireActual<{ default: () => React.ReactElement }>(
    '@app/security/events'
  ).default;
  const { BackendUnavailableState } = jest.requireActual('@/features/shell/BackendUnavailableState');
  expect(Route().type).toBe(BackendUnavailableState);
});
