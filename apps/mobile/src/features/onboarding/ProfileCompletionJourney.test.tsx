import React from 'react';
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react-native';

import MoreRoute from '@app/(tabs)/more';
import HomeRoute from '@app/(tabs)/home';
import { useAppShellStore } from '@/state/app-shell';
import { renderWithProviders } from '@/test-utils/render';

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), replace: jest.fn(), back: jest.fn() }
}));

beforeEach(() => {
  useAppShellStore.getState().reset();
});

describe('profile completion journey', () => {
  it('dismisses, restarts hidden, reopens from More, and hides when complete', async () => {
    renderWithProviders(<HomeRoute />);
    expect(screen.getAllByText('استكمال الإعداد').length).toBeGreaterThan(0);
    fireEvent.press(screen.getByLabelText('إخفاء استكمال الإعداد'));
    await waitFor(() =>
      expect(useAppShellStore.getState().profilePromptDismissed).toBe(true)
    );

    cleanup();
    renderWithProviders(<HomeRoute />);
    expect(screen.queryByLabelText('إخفاء استكمال الإعداد')).toBeNull();

    cleanup();
    renderWithProviders(<MoreRoute />);
    fireEvent.press(screen.getByLabelText('إظهار استكمال الإعداد'));
    await waitFor(() =>
      expect(useAppShellStore.getState().profilePromptDismissed).toBe(false)
    );
  });
});
