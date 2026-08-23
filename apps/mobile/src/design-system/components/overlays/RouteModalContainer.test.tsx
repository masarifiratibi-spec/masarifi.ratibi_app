import React from 'react';
import { fireEvent } from '@testing-library/react-native';
import { Text } from 'react-native';

import { renderWithProviders } from '@/test-utils/render';
import { usePreferenceStore } from '@/state/preferences';
import { RouteModalContainer } from './RouteModalContainer';

describe('RouteModalContainer', () => {
  it('adds route modal chrome without owning feature content or commands', () => {
    const onDismiss = jest.fn();
    const screen = renderWithProviders(
      <RouteModalContainer title="Planning conflict" closeLabel="Close planning conflict" onDismiss={onDismiss}>
        <Text>Feature-owned conflict content</Text>
      </RouteModalContainer>
    );

    expect(screen.getByLabelText('Planning conflict')).toBeTruthy();
    expect(screen.getByText('Feature-owned conflict content')).toBeTruthy();
    fireEvent.press(screen.getByLabelText('Close planning conflict'));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('removes card inset chrome for a full-screen picker route', () => {
    const screen = renderWithProviders(
      <RouteModalContainer
        fullScreen
        title="Choose account"
        closeLabel="Close account picker"
        onDismiss={jest.fn()}
      >
        <Text>Accounts</Text>
      </RouteModalContainer>
    );

    expect(screen.getByTestId('route-modal-container')).toHaveStyle({
      borderRadius: 0,
      borderWidth: 0,
      margin: 0
    });
  });

  it('centers the title and mirrors the close control in Arabic', () => {
    usePreferenceStore.setState({ locale: 'ar', direction: 'rtl' });
    const screen = renderWithProviders(
      <RouteModalContainer
        fullScreen
        title="اختر الحساب"
        closeLabel="إغلاق اختيار الحساب"
        onDismiss={jest.fn()}
      >
        <Text>الحسابات</Text>
      </RouteModalContainer>
    );

    expect(screen.getByTestId('route-modal-header')).toHaveStyle({
      flexDirection: 'row-reverse'
    });
    expect(screen.getByText('اختر الحساب')).toHaveStyle({ textAlign: 'center' });
  });
});
