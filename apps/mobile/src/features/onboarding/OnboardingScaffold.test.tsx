import React from 'react';
import { fireEvent, screen } from '@testing-library/react-native';

import { OnboardingScaffold } from './OnboardingScaffold';
import { StyledText } from '@/components/StyledText';
import { renderWithProviders } from '@/test-utils/render';

describe('OnboardingScaffold', () => {
  it('renders progress, content, primary, and skip controls', () => {
    const onPrimary = jest.fn();
    const onSkip = jest.fn();

    renderWithProviders(
      <OnboardingScaffold
        currentStep={1}
        onPrimary={onPrimary}
        onSkip={onSkip}
        title="اختبار"
        totalSteps={3}
      >
        <StyledText>محتوى</StyledText>
      </OnboardingScaffold>
    );

    expect(screen.getByText('الخطوة 1 من 3')).toBeOnTheScreen();
    fireEvent.press(screen.getByLabelText('متابعة'));
    fireEvent.press(screen.getByLabelText('ليس الآن'));
    expect(onPrimary).toHaveBeenCalledTimes(1);
    expect(onSkip).toHaveBeenCalledTimes(1);
  });

  it('does not render an inert primary action when no handler exists', () => {
    renderWithProviders(<OnboardingScaffold title="اختبار" />);

    expect(screen.queryByLabelText('متابعة')).toBeNull();
  });
});
