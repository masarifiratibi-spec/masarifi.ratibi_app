import React, { useState } from 'react';
import { render, fireEvent, screen } from '@testing-library/react-native';
import type { KeywordRule } from '@/domain/app-shell';
import { TrackingKeywordChips } from './TrackingKeywordChips';
const builtin: KeywordRule = {
  id: 'builtin',
  origin: 'default',
  group: 'expense',
  language: 'en',
  value: 'purchase',
  normalizedValue: 'purchase',
  enabled: true
};
function Harness() {
  const [rules, setRules] = useState([builtin]);
  return (
    <TrackingKeywordChips
      rules={rules}
      onChange={setRules}
      onRestore={() => undefined}
    />
  );
}
it('can toggle a default off and on without hiding it or offering misleading edit/delete', () => {
  render(<Harness />);
  expect(screen.queryByTestId('tracking-keyword-edit-builtin')).toBeNull();
  expect(screen.queryByTestId('tracking-keyword-remove-builtin')).toBeNull();
  const toggle = screen.getByTestId('tracking-keyword-toggle-builtin');
  fireEvent.press(toggle);
  expect(screen.getByText('purchase')).toBeOnTheScreen();
  expect(
    screen.getByTestId('tracking-keyword-toggle-builtin')
  ).toHaveAccessibilityState({ checked: false });
  fireEvent.press(screen.getByTestId('tracking-keyword-toggle-builtin'));
  expect(
    screen.getByTestId('tracking-keyword-toggle-builtin')
  ).toHaveAccessibilityState({ checked: true });
});
it('new wording is a neutral financial signal', () => {
  const changed = jest.fn();
  render(
    <TrackingKeywordChips
      rules={[]}
      onChange={changed}
      onRestore={() => undefined}
    />
  );
  fireEvent.press(screen.getByTestId('tracking-add-keyword-toggle'));
  fireEvent.changeText(
    screen.getByTestId('tracking-new-keyword-input'),
    'MyBank alert'
  );
  fireEvent.press(screen.getByTestId('tracking-submit-add-keyword'));
  expect(changed).toHaveBeenCalledWith([
    expect.objectContaining({
      group: 'financial',
      origin: 'custom',
      value: 'MyBank alert'
    })
  ]);
});
