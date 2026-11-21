import { supportsTrackingOwnerPartitions } from './tracking-owner-context';
import { resolveTrackingRouteCapability } from '@/features/tracking/tracking-route-guard';
import { restoreTrackingOwnerAdmission } from './tracking-background-runtime';
import { useTrackingAdmission } from '@/state/tracking-admission';
import { clearTrackingIsolation } from '@/test-utils/tracking-admission';

// An iPhone must not import the Android-specific entry point at all.
jest.mock('./platform/tracking-native-runtime.android', () => {
  throw new Error('Android tracking entry point loaded on iPhone');
});

test('an iPhone without the SMS native module can load ownership services and use capture alternatives', () => {
  expect(supportsTrackingOwnerPartitions()).toBe(false);
  expect(resolveTrackingRouteCapability('ios')).toEqual({
    platform: 'ios',
    canUseAndroidTracking: false,
    fallbackRoute: '/(onboarding)/ios-capture-options'
  });
});

afterEach(clearTrackingIsolation);

test('restoring an iPhone owner without Android capture does not block session admission', async () => {
  await expect(
    restoreTrackingOwnerAdmission('owner-iphone')
  ).resolves.toBeUndefined();
  expect(useTrackingAdmission.getState()).toMatchObject({
    ready: true,
    admittedOwnerId: 'owner-iphone'
  });
});
