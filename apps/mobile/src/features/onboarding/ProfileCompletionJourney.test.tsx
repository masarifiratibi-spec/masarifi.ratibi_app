import React from 'react';
import { fireEvent } from '@testing-library/react-native';

import { ProfileCompletionCard } from './ProfileCompletionCard';
import { deriveProfileCompletionSteps, emptyProfileSummary } from './profile-completion';
import { useAppShellStore } from '@/state/app-shell';
import { renderWithProviders } from '@/test-utils/render';

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), replace: jest.fn(), back: jest.fn(), navigate: jest.fn() },
  useLocalSearchParams: () => ({})
}));

beforeEach(() => {
  useAppShellStore.getState().reset();
});

describe('profile completion journey', () => {
  it('renders steps and triggers dismiss correctly', async () => {
    const onDismiss = jest.fn();
    const steps = deriveProfileCompletionSteps(emptyProfileSummary);
    const view = renderWithProviders(
      <ProfileCompletionCard steps={steps} onDismiss={onDismiss} />
    );

    expect(view.getAllByText('استكمال الإعداد').length).toBeGreaterThan(0);
    fireEvent.press(view.getByLabelText('إخفاء استكمال الإعداد'));
    expect(onDismiss).toHaveBeenCalled();
  });
});
