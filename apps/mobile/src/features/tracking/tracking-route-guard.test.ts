import { resolveTrackingRouteCapability } from './tracking-route-guard';

describe('tracking route guard', () => {
  it('keeps Android tracking separate from iOS alternatives', () => {
    expect(resolveTrackingRouteCapability('android')).toMatchObject({
      canUseAndroidTracking: true,
      fallbackRoute: '/(tabs)/add'
    });
    expect(resolveTrackingRouteCapability('ios')).toMatchObject({
      canUseAndroidTracking: false,
      fallbackRoute: '/(onboarding)/ios-capture-options'
    });
    expect(resolveTrackingRouteCapability('web').canUseAndroidTracking).toBe(false);
  });
});
