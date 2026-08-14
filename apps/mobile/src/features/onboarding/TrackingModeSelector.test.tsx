import React from 'react';
import { fireEvent, screen } from '@testing-library/react-native';

import { renderWithProviders } from '@/test-utils/render';
import { TrackingModeSelector } from './TrackingModeSelector';

describe('TrackingModeSelector', () => {
  it('defaults to recommended automatic mode and exposes all selected states', () => {
    const onChange = jest.fn();
    renderWithProviders(<TrackingModeSelector onChange={onChange} />);

    expect(screen.getByLabelText('العناصر الواضحة تلقائيًا')).toHaveAccessibilityState({
      selected: true
    });
    expect(screen.getByText('مراجعة كل العناصر')).toBeOnTheScreen();
    expect(screen.getByText('متوقف مؤقتًا')).toBeOnTheScreen();

    fireEvent.press(screen.getByLabelText('مراجعة كل العناصر'));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ mode: 'review_all' }));
  });
});
