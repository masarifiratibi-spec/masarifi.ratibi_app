import { createMockTrackingPermissionService } from '@/services/mocks/tracking-permission-service';
import { createTrackingPermissionService } from './tracking-permission-service';

describe('tracking permission services', () => {
  it.each([
    ['not_requested', 'request'],
    ['granted', 'continue'],
    ['denied', 'retry'],
    ['permanently_denied', 'open_settings'],
    ['revoked', 'open_settings'],
    ['unavailable', 'continue']
  ] as const)('maps mock %s state to one recovery action', async (status, recoveryAction) => {
    const service = createMockTrackingPermissionService(status);
    await expect(service.getState()).resolves.toMatchObject({
      status,
      recoveryAction
    });
  });

  it('requires education before requesting permission', async () => {
    const service = createMockTrackingPermissionService('not_requested');
    await expect(service.requestAfterEducation(false)).resolves.toMatchObject({
      status: 'not_requested'
    });
    await expect(service.requestAfterEducation(true)).resolves.toMatchObject({
      status: 'granted'
    });
  });

  it('keeps settings recovery non-blocking', async () => {
    const service = createMockTrackingPermissionService('permanently_denied');
    await service.openSettings();
    await expect(service.getState()).resolves.toMatchObject({
      status: 'revoked',
      blocking: false,
      recoveryAction: 'open_settings'
    });
  });

  it('maps every production platform to unavailable until ingestion exists', async () => {
    await expect(createTrackingPermissionService().getState()).resolves.toMatchObject({
      status: 'unavailable',
      recoveryAction: 'continue'
    });
    await expect(
      createTrackingPermissionService().requestAfterEducation()
    ).resolves.toMatchObject({
      status: 'unavailable',
      recoveryAction: 'continue'
    });
  });
});
