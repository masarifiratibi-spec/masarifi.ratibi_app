import React from 'react';
import { fireEvent, screen } from '@testing-library/react-native';

import { renderWithProviders } from '@/test-utils/render';
import { deriveProfileCompletionSteps } from './profile-completion';
import { ProfileCompletionCard } from './ProfileCompletionCard';

describe('ProfileCompletionCard', () => {
  it('shows incomplete rows only, supports dismissal and reopen, and stays non-blocking', () => {
    const onDismiss = jest.fn();
    const steps = deriveProfileCompletionSteps({
      name: false,
      firstAccount: true,
      salary: false,
      budget: 'unavailable',
      obligation: false,
      savingsGoal: false
    });

    renderWithProviders(<ProfileCompletionCard onDismiss={onDismiss} reopened steps={steps} />);
    expect(screen.getByText('استكمال الإعداد')).toBeOnTheScreen();
    expect(screen.getByText('الاسم')).toBeOnTheScreen();
    expect(screen.queryByText('أول حساب')).toBeNull();
    expect(screen.queryByText('الميزانية')).toBeNull();
    fireEvent.press(screen.getByLabelText('إخفاء استكمال الإعداد'));
    expect(onDismiss).toHaveBeenCalled();
  });
});
