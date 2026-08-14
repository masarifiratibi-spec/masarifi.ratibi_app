import { createMockAutomaticTrackingService } from '@/services/mocks/automatic-tracking-service';
import { createMockTrackingPermissionService } from '@/services/mocks/tracking-permission-service';

describe('tracking status', () => {
  it('composes permission, mode, service, and rule counts', async () => {
    const service = createMockAutomaticTrackingService({
      persistent: false,
      platform: 'android',
      permissionService: createMockTrackingPermissionService('denied'),
      storage: {
        loadTrackingPreference: async () => ({
          mode: 'review_all',
          selectedAt: 1,
          isRecommended: false
        }),
        saveTrackingPreference: async () => undefined,
        loadKeywords: async () => [
          { enabled: true },
          { enabled: false }
        ],
        saveKeywords: async () => undefined
      } as never
    });

    await expect(service.getStatus()).resolves.toMatchObject({
      platform: 'android',
      mode: 'review_all',
      permissionStatus: 'denied',
      serviceState: 'healthy',
      activeKeywordCount: 1
    });
  });
});
