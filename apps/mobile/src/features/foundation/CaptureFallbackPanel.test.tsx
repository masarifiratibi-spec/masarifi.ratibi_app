import React from 'react';
import { fireEvent } from '@testing-library/react-native';

import { CaptureFallbackPanel } from './CaptureFallbackPanel';
import { renderWithProviders } from '@/test-utils/render';
import { changeLocale } from '@/localization/i18n';
import {
  buildAndroidCapabilities,
  buildIosCapabilities
} from '@/services/mocks/platform-capabilities';

beforeEach(() => changeLocale('en'));

describe('CaptureFallbackPanel on Android', () => {
  const caps = buildAndroidCapabilities('denied');

  it('shows SMS tracking with a permission explanation and fallback actions', () => {
    const { getByText } = renderWithProviders(
      <CaptureFallbackPanel capabilities={caps} platform="android" />
    );
    expect(getByText('SMS tracking (Android)')).toBeTruthy();
    expect(getByText('Add manually')).toBeTruthy();
    expect(getByText('Add by voice')).toBeTruthy();
  });

  it('states that manual entry remains available when permission is denied', () => {
    const { getByText } = renderWithProviders(
      <CaptureFallbackPanel capabilities={caps} platform="android" />
    );
    expect(getByText(/Permission denied/)).toBeTruthy();
  });

  it('offers a skip action so denial does not block the app', () => {
    const onAction = jest.fn();
    const { getByLabelText } = renderWithProviders(
      <CaptureFallbackPanel
        capabilities={caps}
        platform="android"
        onAction={onAction}
      />
    );
    fireEvent.press(getByLabelText('Skip for now'));
    expect(onAction).toHaveBeenCalledWith('skip-permission');
  });

  it('makes manual and voice fallback methods actionable', () => {
    const onAction = jest.fn();
    const { getByLabelText } = renderWithProviders(
      <CaptureFallbackPanel
        capabilities={caps}
        platform="android"
        onAction={onAction}
      />
    );

    fireEvent.press(getByLabelText('Add manually'));
    fireEvent.press(getByLabelText('Add by voice'));

    expect(onAction).toHaveBeenNthCalledWith(1, 'manual');
    expect(onAction).toHaveBeenNthCalledWith(2, 'voice');
  });
});

describe('CaptureFallbackPanel on iOS', () => {
  const caps = buildIosCapabilities();

  it('never mentions SMS tracking', () => {
    const { queryByText } = renderWithProviders(
      <CaptureFallbackPanel capabilities={caps} platform="ios" />
    );
    expect(queryByText('SMS tracking (Android)')).toBeNull();
  });

  it('explains SMS is unavailable and lists honest alternatives', () => {
    const { getByText } = renderWithProviders(
      <CaptureFallbackPanel capabilities={caps} platform="ios" />
    );
    expect(getByText(/not available on iOS/)).toBeTruthy();
    expect(getByText('Add manually')).toBeTruthy();
    expect(getByText('Add by voice')).toBeTruthy();
  });
});

describe('CaptureFallbackPanel offline entry', () => {
  it('shows failed state and invokes retry', () => {
    const retry = jest.fn();
    const { getByText, getByLabelText } = renderWithProviders(
      <CaptureFallbackPanel
        capabilities={buildAndroidCapabilities('denied')}
        platform="android"
        offlineEntry={{
          localId: 'local-1',
          payload: {
            amount: 100,
            currencyCode: 'SAR',
            categoryKey: 'food',
            note: null
          },
          syncStatus: 'failed',
          createdAt: 1,
          updatedAt: 1,
          lastErrorKey: 'capture.offline.failed'
        }}
        offlineActions={{
          edit: jest.fn(),
          delete: jest.fn(),
          startSync: jest.fn(),
          confirmSync: jest.fn(),
          failSync: jest.fn(),
          conflictSync: jest.fn(),
          retry
        }}
      />
    );

    expect(getByText(/Sync failed/)).toBeTruthy();
    fireEvent.press(getByLabelText('Retry sync'));
    expect(retry).toHaveBeenCalledTimes(1);
  });
});
