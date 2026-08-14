import React from 'react';
import { StyleSheet, Text } from 'react-native';
import { screen } from '@testing-library/react-native';

import { ActionButton } from '@/design-system/components/ActionButton';
import { StatusBadge } from '@/design-system/components/StatusBadge';
import { renderWithProviders } from '@/test-utils/render';
import { changeLocale } from '@/localization/i18n';

test('SPEC-009 controls expose names, state, non-color cues, and minimum touch targets', () => {
  changeLocale('en');
  renderWithProviders(<>
    <ActionButton label="notifications.center.retry" onPress={() => undefined} />
    <StatusBadge status="danger" label="notifications.center.actionExpired" />
  </>);

  const button = screen.getByRole('button', { name: 'Retry' });
  expect(button.props.accessibilityState).toMatchObject({ disabled: false, busy: false });
  expect(StyleSheet.flatten(button.props.style).minHeight).toBeGreaterThanOrEqual(44);
  expect(screen.getByLabelText('Action expired')).toBeTruthy();
  expect(screen.getByText('!')).toBeTruthy();
  expect(screen.UNSAFE_getAllByType(Text).every((node) => node.props.allowFontScaling !== false)).toBe(true);
});
