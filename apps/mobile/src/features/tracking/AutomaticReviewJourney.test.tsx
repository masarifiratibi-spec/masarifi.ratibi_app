import { createMockAutomaticTrackingService } from '@/services/mocks/automatic-tracking-service';
import { createMockTrackingPermissionService } from '@/services/mocks/tracking-permission-service';
import { makeMockEvent } from '@/test-utils/automatic-tracking-fixtures';

describe('automatic review journey', () => {
  it('covers uncertain, duplicate, lifecycle, and obligation review outcomes', async () => {
    const service = createMockAutomaticTrackingService({
      persistent: false,
      permissionService: createMockTrackingPermissionService('granted'),
      storage: {
        loadTrackingPreference: async () => ({
          mode: 'automatic_clear',
          selectedAt: 1,
          isRecommended: true
        }),
        saveTrackingPreference: async () => undefined,
        loadKeywords: async () => [],
        saveKeywords: async () => undefined
      } as never
    });

    await service.processMockEvent(
      makeMockEvent('uncertain', { confidenceBasisPoints: 8_900 })
    );
    await service.processMockEvent(
      makeMockEvent('duplicate-review', {
        duplicateTransactionId: 'transaction-existing'
      })
    );
    await service.processMockEvent(
      makeMockEvent('obligation-review-full', {
        eventType: 'installment',
        obligationCandidateCount: 2
      })
    );

    expect((await service.listReviewItems()).items).toHaveLength(3);
  });
});
