import React from 'react';
import { fireEvent } from '@testing-library/react-native';

import { renderWithProviders } from '@/test-utils/render';
import { NotificationBadge } from './NotificationBadge';
import { StateView } from './StateView';
import { StatusBanner } from './StatusBanner';

describe('State feedback', () => {
  it.each(['loading', 'success', 'error', 'empty', 'offline', 'sync', 'permission', 'review'] as const)(
    'renders %s state with optional recovery action',
    (state) => {
      const onAction = jest.fn();
      const screen = renderWithProviders(
        <StateView state={state} title={`${state} title`} actionLabel="Recover" onAction={onAction} />
      );
      expect(screen.getByText(`${state} title`)).toBeTruthy();
      fireEvent.press(screen.getByLabelText('Recover'));
      expect(onAction).toHaveBeenCalledTimes(1);
    }
  );

  it('renders status banners and notification badges', () => {
    const screen = renderWithProviders(
      <>
        <StatusBanner status="offline" message="Offline" />
        <NotificationBadge count={3} label="Notifications" />
        <NotificationBadge count={4} label="Decorative" decorative />
      </>
    );
    expect(screen.getByText('Offline')).toBeTruthy();
    expect(screen.getByLabelText('Notifications 3')).toBeTruthy();
    expect(screen.queryByLabelText('Decorative 4')).toBeNull();
  });
});
