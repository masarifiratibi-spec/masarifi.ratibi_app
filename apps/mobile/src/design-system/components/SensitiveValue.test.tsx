import React from 'react';
import { fireEvent } from '@testing-library/react-native';

import { renderWithProviders } from '@/test-utils/render';
import { SensitiveValue } from './SensitiveValue';

describe('SensitiveValue', () => {
  it('keeps masked layout stable, safe accessible text, reveal action, and remask behavior', () => {
    const onReveal = jest.fn();
    const onHide = jest.fn();
    const screen = renderWithProviders(
      <SensitiveValue value="4,200 EGP" revealed={false} onReveal={onReveal} onHide={onHide} />
    );

    expect(screen.getByText('****')).toBeTruthy();
    expect(screen.getByLabelText('Value hidden')).toBeTruthy();
    fireEvent.press(screen.getByLabelText('Reveal value'));
    expect(onReveal).toHaveBeenCalledTimes(1);

    const revealed = renderWithProviders(
      <SensitiveValue value="4,200 EGP" revealed onReveal={onReveal} onHide={onHide} />
    );
    expect(revealed.getByText('4,200 EGP')).toBeTruthy();
    fireEvent.press(revealed.getByLabelText('Hide value'));
    expect(onHide).toHaveBeenCalledTimes(1);
  });
});
