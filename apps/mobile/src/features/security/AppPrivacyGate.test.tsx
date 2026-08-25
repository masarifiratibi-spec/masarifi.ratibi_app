import React from 'react';
import { AppState, Text } from 'react-native';
import { act, render, screen } from '@testing-library/react-native';

import { AppPrivacyGate } from './AppPrivacyGate';

describe('AppPrivacyGate', () => {
  it('reveals the lock-recovery screen when the locked prop clears', () => {
    const rendered = render(
      <AppPrivacyGate locked>
        <Text>Unlock form</Text>
      </AppPrivacyGate>
    );
    expect(screen.queryByText('Unlock form')).toBeNull();

    rendered.rerender(
      <AppPrivacyGate locked={false}>
        <Text>Unlock form</Text>
      </AppPrivacyGate>
    );

    expect(screen.getByText('Unlock form')).toBeOnTheScreen();
  });

  it('keeps the recovery screen masked while the app is backgrounded', () => {
    let listener: ((state: string) => void) | null = null;
    jest.spyOn(AppState, 'addEventListener').mockImplementation((_type, callback) => {
      listener = callback as (state: string) => void;
      return { remove: jest.fn() };
    });
    const rendered = render(
      <AppPrivacyGate locked>
        <Text>Unlock form</Text>
      </AppPrivacyGate>
    );

    act(() => listener?.('background'));
    rendered.rerender(
      <AppPrivacyGate locked={false}>
        <Text>Unlock form</Text>
      </AppPrivacyGate>
    );

    expect(screen.queryByText('Unlock form')).toBeNull();
    act(() => listener?.('active'));
    expect(screen.getByText('Unlock form')).toBeOnTheScreen();
  });

  it('masks protected content while locked and on background transitions', () => {
    let listener: ((state: string) => void) | null = null;
    jest.spyOn(AppState, 'addEventListener').mockImplementation((_type, callback) => {
      listener = callback as (state: string) => void;
      return { remove: jest.fn() };
    });

    render(
      <AppPrivacyGate immediate>
        <Text>Protected</Text>
      </AppPrivacyGate>
    );
    expect(screen.getByText('Protected')).toBeOnTheScreen();
    act(() => {
      listener?.('background');
    });
    expect(screen.queryByText('Protected')).toBeNull();
    expect(screen.getByText('المحتوى محمي')).toBeOnTheScreen();
  });

  it('masks on the inactive app-switcher transition and locks only when configured', () => {
    let listener: ((state: string) => void) | null = null;
    const onLock = jest.fn();
    jest.spyOn(AppState, 'addEventListener').mockImplementation((_type, callback) => {
      listener = callback as (state: string) => void;
      return { remove: jest.fn() };
    });

    render(
      <AppPrivacyGate immediate onLock={onLock}>
        <Text>Protected</Text>
      </AppPrivacyGate>
    );
    act(() => {
      listener?.('inactive');
      listener?.('background');
    });

    expect(screen.queryByText('Protected')).toBeNull();
    expect(onLock).toHaveBeenCalledTimes(1);
  });

  it('applies a configured delayed lock when the app returns', () => {
    let listener: ((state: string) => void) | null = null;
    const onLock = jest.fn();
    const clock = jest.spyOn(Date, 'now');
    clock.mockReturnValueOnce(1_000).mockReturnValueOnce(62_000);
    jest.spyOn(AppState, 'addEventListener').mockImplementation((_type, callback) => {
      listener = callback as (state: string) => void;
      return { remove: jest.fn() };
    });

    render(
      <AppPrivacyGate lockAfterMs={60_000} onLock={onLock}>
        <Text>Protected</Text>
      </AppPrivacyGate>
    );
    act(() => {
      listener?.('background');
      listener?.('active');
    });

    expect(onLock).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('Protected')).toBeNull();
    clock.mockRestore();
  });
});
