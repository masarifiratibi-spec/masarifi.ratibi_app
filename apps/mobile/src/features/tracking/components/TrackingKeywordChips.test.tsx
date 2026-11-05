import { renderWithProviders } from '@/test-utils/render';
import React, { useState } from 'react';
import { act, render, fireEvent, screen } from '@testing-library/react-native';
import { Dimensions, PixelRatio, View } from 'react-native';
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
it('updates the memoized keyword layout when the phone font scale changes', () => {
  const window = Dimensions.get('window');
  const display = Dimensions.get('screen');
  const font = jest.spyOn(PixelRatio, 'getFontScale').mockReturnValue(1);
  Dimensions.set({ window: { ...window, fontScale: 1 }, screen: display });
  const view = render(<Harness />);
  try {
    act(() => {
      font.mockReturnValue(2);
      Dimensions.set({ window: { ...window, fontScale: 2 }, screen: display });
    });
    expect(screen.getByTestId('tracking-keyword-header')).toHaveStyle({
      flexDirection: 'column'
    });
  } finally {
    view.unmount();
    act(() => Dimensions.set({ window, screen: display }));
    font.mockRestore();
  }
});
it('can toggle a default off and on independently from deletion', () => {
  render(<Harness />);
  expect(screen.queryByTestId('tracking-keyword-edit-builtin')).toBeNull();
  expect(
    screen.queryByTestId('tracking-keyword-remove-builtin')
  ).not.toBeNull();
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
it('deletes a default from the visible effective list', () => {
  render(<Harness />);
  fireEvent.press(screen.getByTestId('tracking-keyword-remove-builtin'));
  expect(screen.queryByText('purchase')).toBeNull();
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

it('bounds native view work for 113 keywords while keeping every keyword actionable', () => {
  const rules: KeywordRule[] = Array.from({ length: 113 }, (_, index) => ({
    id: `keyword-${index}`,
    value: `merchant${index}`,
    normalizedValue: `merchant${index}`,
    group: 'financial',
    language: 'en',
    origin: index < 6 ? 'custom' : 'default',
    enabled: true
  }));
  let changed: KeywordRule[] | undefined;
  const view = renderWithProviders(
    <TrackingKeywordChips
      rules={rules}
      onChange={(next) => {
        changed = next;
      }}
      onRestore={() => undefined}
    />
  );

  // The Redmi incident had long mount/draw frames even with warm data.
  // This is a native-view work budget, not a Jest timing or device-speed claim.
  expect(view.UNSAFE_getAllByType(View).length).toBeLessThanOrEqual(492);
  expect(screen.getAllByRole('switch')).toHaveLength(113);
  fireEvent.press(screen.getByTestId('tracking-keyword-toggle-keyword-112'));
  expect(changed?.find((rule) => rule.id === 'keyword-112')?.enabled).toBe(
    false
  );
});
