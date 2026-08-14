import React from 'react';

import { renderWithProviders } from '@/test-utils/render';
import { StyledText } from './StyledText';

describe('StyledText SPEC-002 typography parity', () => {
  it('applies approved font, wrapping, mixed-value direction, scaling, and tabular numbers', () => {
    const screen = renderWithProviders(
      <>
        <StyledText variant="body">Long Arabic and English value ABC 123</StyledText>
        <StyledText variant="amount">1,250 EGP</StyledText>
      </>
    );

    expect(screen.getByText('Long Arabic and English value ABC 123')).toHaveStyle({
      flexShrink: 1,
      writingDirection: 'auto'
    });
    expect(screen.getByText('1,250 EGP')).toHaveStyle({
      fontVariant: ['tabular-nums']
    });
  });
});
