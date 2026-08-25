import React from 'react';
import { Text } from 'react-native';

import { AccessibilityStateGallery } from './AccessibilityStateGallery';
import { renderWithProviders } from '@/test-utils/render';
import { changeLocale } from '@/localization/i18n';

beforeEach(() => changeLocale('en'));

describe('AccessibilityStateGallery', () => {
  it('renders every core async state with a text cue beyond color', () => {
    const { getByTestId, getByText } = renderWithProviders(
      <AccessibilityStateGallery />
    );
    // UI Contract §10: loading, success, empty, error, offline minimum.
    // Each state card prefixes an icon cue so meaning never relies on color.
    expect(getByText(/Loading/)).toBeTruthy();
    expect(getByText(/Success/)).toBeTruthy();
    expect(getByText(/Nothing here yet/)).toBeTruthy();
    expect(getByText(/Error/)).toBeTruthy();
    expect(getByText(/offline/i)).toBeTruthy();
    expect(
      getByTestId('state-icon-loading', { includeHiddenElements: true })
    ).toBeTruthy();
    expect(
      getByTestId('state-icon-permission_required', {
        includeHiddenElements: true
      })
    ).toBeTruthy();
  });

  it('gives every interactive control an accessible name and role', () => {
    const { getAllByRole } = renderWithProviders(<AccessibilityStateGallery />);
    // Switches expose the switch role.
    const switches = getAllByRole('switch');
    expect(switches.length).toBeGreaterThanOrEqual(2);
    switches.forEach((node) => {
      expect(node.props.accessibilityLabel).toBeTruthy();
    });
    // Radio options expose the radio role, each with an accessible name.
    const radios = getAllByRole('radio');
    expect(radios.length).toBeGreaterThan(0);
    radios.forEach((node) => {
      expect(node.props.accessibilityLabel).toBeTruthy();
      expect(node).toHaveStyle({ minHeight: 44 });
    });
  });

  it('exposes state names semantically and provides an error recovery action', () => {
    const { getByLabelText, getByRole } = renderWithProviders(
      <AccessibilityStateGallery />
    );

    expect(getByLabelText('Loading')).toHaveProp('accessibilityRole', 'text');
    expect(getByLabelText('Error')).toHaveProp('accessibilityRole', 'text');
    expect(getByRole('button', { name: 'Retry' })).toHaveStyle({
      minHeight: 44
    });
  });

  it('renders every visible Text node with content or an accessible label', () => {
    const { UNSAFE_root } = renderWithProviders(<AccessibilityStateGallery />);
    const texts = UNSAFE_root.findAllByType(Text);
    const labelless = texts.filter(
      (node: { props: { children?: unknown; accessibilityLabel?: string } }) =>
        !node.props.children && !node.props.accessibilityLabel
    );
    expect(labelless).toHaveLength(0);
  });
});
