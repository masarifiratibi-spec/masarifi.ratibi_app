import React from 'react';
import { AppState } from 'react-native';
import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';

import PermissionRoute from '../../../app/tracking/permission';
import { permissionState } from '@/services/mocks/tracking-permission-service';
import { automaticTrackingService } from '@/services/automatic-tracking-service';
import { translate } from '@/localization/i18n';
import { renderWithProviders } from '@/test-utils/render';
import { trackingSourcePreferences } from '@/services/tracking-source-preferences';

const mockPermissionService = {
  getState: jest.fn(),
  requestAfterEducation: jest.fn(),
  openSettings: jest.fn()
};
const mockUseLocalSearchParams = jest.fn();

jest.mock('@/services/platform/tracking-permission-service', () => ({
  createTrackingPermissionService: () => mockPermissionService
}));
jest.mock('expo-router', () => ({
  router: { back: jest.fn(), dismissTo: jest.fn() },
  useLocalSearchParams: () => mockUseLocalSearchParams()
}));

describe('tracking permission route', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseLocalSearchParams.mockReturnValue({ mode: 'review_all' });
    mockPermissionService.getState.mockResolvedValue(
      permissionState('not_requested')
    );
    mockPermissionService.requestAfterEducation.mockResolvedValue(
      permissionState('granted')
    );
  });

  afterEach(() => jest.restoreAllMocks());

  it('requests only after education and enables the requested mode after grant', async () => {
    const saveSource = jest
      .spyOn(trackingSourcePreferences, 'set')
      .mockResolvedValue({ smsEnabled: true, notificationEnabled: false });
    const setMode = jest
      .spyOn(automaticTrackingService, 'setMode')
      .mockResolvedValue({} as never);
    renderWithProviders(<PermissionRoute />);

    fireEvent.press(
      await screen.findByLabelText(translate('appShell.permission.enable'))
    );

    await waitFor(() => {
      expect(mockPermissionService.requestAfterEducation).toHaveBeenCalledTimes(
        1
      );
      expect(saveSource).toHaveBeenCalledWith('sms', true);
      expect(setMode).toHaveBeenCalledWith('review_all');
      expect(router.dismissTo).toHaveBeenCalledWith('/tracking');
    });
  });

  it('opens settings for a permanently denied permission without enabling', async () => {
    mockPermissionService.getState.mockResolvedValue(
      permissionState('permanently_denied')
    );
    const setMode = jest.spyOn(automaticTrackingService, 'setMode');
    renderWithProviders(<PermissionRoute />);

    fireEvent.press(
      await screen.findByLabelText(
        translate('appShell.permission.openSettings')
      )
    );

    await waitFor(() =>
      expect(mockPermissionService.openSettings).toHaveBeenCalledTimes(1)
    );
    expect(mockPermissionService.requestAfterEducation).not.toHaveBeenCalled();
    expect(setMode).not.toHaveBeenCalled();
  });

  it('finishes SMS activation after the owner grants access in Android settings', async () => {
    const listeners = new Set<() => void>();
    jest
      .spyOn(AppState, 'addEventListener')
      .mockImplementation((_event, listener) => {
        const resume = () => listener('active');
        if (_event === 'change') listeners.add(resume);
        return {
          remove: () => {
            listeners.delete(resume);
          }
        };
      });
    mockPermissionService.getState.mockResolvedValue(
      permissionState('permanently_denied')
    );
    const mode = jest
      .spyOn(automaticTrackingService, 'setMode')
      .mockResolvedValue({} as never);
    const source = jest
      .spyOn(trackingSourcePreferences, 'set')
      .mockResolvedValue({ smsEnabled: true, notificationEnabled: false });
    renderWithProviders(<PermissionRoute />);
    fireEvent.press(
      await screen.findByLabelText(
        translate('appShell.permission.openSettings')
      )
    );
    await waitFor(() =>
      expect(mockPermissionService.openSettings).toHaveBeenCalledTimes(1)
    );
    expect(mode).not.toHaveBeenCalled();
    mockPermissionService.getState.mockResolvedValue(
      permissionState('granted')
    );
    act(() => listeners.forEach((resume) => resume()));
    await waitFor(() => expect(source).toHaveBeenCalledWith('sms', true));
    expect(mode).toHaveBeenCalledTimes(1);
    expect(router.dismissTo).toHaveBeenCalledWith('/tracking');
  });

  it('sets the requested server mode before asking for source consent', async () => {
    let enabled = false;
    jest
      .spyOn(automaticTrackingService, 'setMode')
      .mockImplementation(async () => {
        enabled = true;
        return {} as never;
      });
    jest
      .spyOn(trackingSourcePreferences, 'set')
      .mockImplementation(async () => {
        if (!enabled) throw new Error('TRACKING_PREFERENCES_DISABLED');
        return { smsEnabled: true, notificationEnabled: false };
      });
    renderWithProviders(<PermissionRoute />);
    fireEvent.press(
      await screen.findByLabelText(translate('appShell.permission.enable'))
    );
    await waitFor(() =>
      expect(router.dismissTo).toHaveBeenCalledWith('/tracking')
    );
  });
});
