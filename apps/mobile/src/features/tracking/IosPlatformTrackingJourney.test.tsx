import { resolveTrackingRouteCapability } from './tracking-route-guard';

describe('iOS platform tracking journey', () => {
  it('redirects Android tracking routes to iOS alternatives', () => {
    expect(resolveTrackingRouteCapability('ios')).toEqual({
      platform: 'ios',
      canUseAndroidTracking: false,
      fallbackRoute: '/(onboarding)/ios-capture-options'
    });
  });
});
