import React from 'react';
import { View } from 'react-native';

import { MenuLink } from './MenuLink';
import { renderWithProviders } from '@/test-utils/render';

describe('MenuLink', () => {
  it('forwards its native ref for Expo Router Link asChild', () => {
    const ref = React.createRef<View>();

    renderWithProviders(<MenuLink ref={ref} label="Destination" />);

    expect(ref.current).not.toBeNull();
  });
});
