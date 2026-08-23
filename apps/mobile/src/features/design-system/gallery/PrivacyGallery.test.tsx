import React from 'react';
import { fireEvent } from '@testing-library/react-native';

import { renderWithProviders } from '@/test-utils/render';
import { usePreferenceStore } from '@/state/preferences';
import { PrivacyGallery } from './PrivacyGallery';

describe('PrivacyGallery', () => {
  it('starts masked, supports authorized reveal, reset, and safe screen-reader output', () => {
    usePreferenceStore.setState({ hideBalances: true });
    const screen = renderWithProviders(<PrivacyGallery />);

    expect(screen.getByText('****')).toBeTruthy();
    expect(screen.getByLabelText('Value hidden')).toBeTruthy();
    fireEvent.press(screen.getByLabelText('Reveal value'));
    expect(screen.getByText('4,200 EGP')).toBeTruthy();
    fireEvent.press(screen.getByLabelText('Hide value'));
    expect(screen.getByText('****')).toBeTruthy();
  });
});
