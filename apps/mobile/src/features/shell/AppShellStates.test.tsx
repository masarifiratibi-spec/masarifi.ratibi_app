import React from 'react';
import { screen } from '@testing-library/react-native';

import { mapAppShellError } from './app-shell-errors';
import { createMockTrackingPermissionService } from '@/services/mocks/tracking-permission-service';
import { UnlockScreen } from '@/features/security/UnlockScreen';
import { renderWithProviders } from '@/test-utils/render';

describe('app shell states', () => {
  it('maps loading/error/permission/recovery states to one valid next action', async () => {
    expect(mapAppShellError({ code: 'offline' })).toMatchObject({
      recoveryAction: 'retry'
    });
    await expect(createMockTrackingPermissionService('denied').getState()).resolves.toMatchObject({
      recoveryAction: 'retry'
    });

    renderWithProviders(<UnlockScreen expectedHash="pin:123456" sessionExpired />);
    expect(screen.getByText('سجل الدخول للمتابعة')).toBeOnTheScreen();
  });
});
