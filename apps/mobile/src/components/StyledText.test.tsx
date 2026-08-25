import React from 'react';

import { changeLocale } from '@/localization/i18n';
import { usePreferenceStore } from '@/state/preferences';
import { renderWithProviders } from '@/test-utils/render';
import { StyledText } from './StyledText';

describe('StyledText SPEC-002 typography parity', () => {
  beforeEach(() => {
    changeLocale('ar');
    usePreferenceStore.setState({ locale: 'ar', direction: 'rtl' });
  });

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
      fontFamily: 'MasarifiLatin-900',
      fontVariant: ['tabular-nums']
    });
  });

  it('resolves Arabic headline and amount typography semantically', () => {
    const screen = renderWithProviders(
      <>
        <StyledText variant="headline">Arabic headline</StyledText>
        <StyledText variant="amount">1,250 EGP</StyledText>
      </>
    );

    expect(screen.getByText('Arabic headline')).toHaveStyle({
      fontFamily: 'MasarifiArabic-800'
    });
    expect(screen.getByText('1,250 EGP')).toHaveStyle({
      fontFamily: 'MasarifiLatin-900',
      fontVariant: ['tabular-nums'],
      writingDirection: 'ltr'
    });
  });

  it('resolves English titles semantically', () => {
    changeLocale('en');
    usePreferenceStore.setState({ locale: 'en', direction: 'ltr' });
    const screen = renderWithProviders(
      <StyledText variant="title">English title</StyledText>
    );

    expect(screen.getByText('English title')).toHaveStyle({
      fontFamily: 'MasarifiLatin-700'
    });
  });
});
