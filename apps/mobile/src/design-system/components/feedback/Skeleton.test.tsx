import React from 'react';

import { renderWithProviders } from '@/test-utils/render';
import { SkeletonBlock, SkeletonCard } from './Skeleton';

describe('Skeleton', () => {
  it('keeps fixed dimensions and hides placeholder from accessibility', () => {
    const screen = renderWithProviders(
      <>
        <SkeletonBlock width={120} height={20} />
        <SkeletonCard width={240} height={120} />
      </>
    );

    const block = screen.getByTestId('skeleton-block', { includeHiddenElements: true });
    const card = screen.getByTestId('skeleton-card', { includeHiddenElements: true });
    expect(block).toHaveStyle({ width: 120, height: 20 });
    expect(card).toHaveStyle({ width: 240, height: 120 });
    expect(block.props.accessibilityElementsHidden).toBe(true);
  });
});
