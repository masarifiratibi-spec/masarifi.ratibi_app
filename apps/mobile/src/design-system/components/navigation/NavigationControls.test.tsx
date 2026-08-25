import React from 'react';

import { renderWithProviders } from '@/test-utils/render';
import { changeLocale } from '@/localization/i18n';
import {
  SegmentedControl,
  StepIndicator,
  StickySectionHeader
} from './NavigationControls';

describe('NavigationControls', () => {
  afterEach(() => changeLocale('ar'));

  it('renders steps, selected segments, sticky heading, long labels, and screen-reader order', () => {
    const screen = renderWithProviders(
      <>
        <StepIndicator current={2} total={4} label="Setup" />
        <SegmentedControl
          selected="month"
          options={[
            { key: 'week', label: 'This week' },
            { key: 'month', label: 'This month with long label' }
          ]}
          onSelect={jest.fn()}
        />
        <StickySectionHeader title="Transactions" />
      </>
    );

    expect(screen.getByLabelText('Setup, 2/4')).toBeTruthy();
    expect(
      screen.getByLabelText('This month with long label').props
        .accessibilityState
    ).toMatchObject({ selected: true });
    expect(screen.getByText('Transactions')).toBeTruthy();
  });

  it.each(['ar', 'en'] as const)(
    'keeps progress fractions LTR in %s',
    (locale) => {
      changeLocale(locale);
      const screen = renderWithProviders(
        <StepIndicator current={2} total={4} label="Setup" />
      );

      expect(screen.getByText('2/4')).toHaveStyle({ writingDirection: 'ltr' });
    }
  );
});
