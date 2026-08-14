import { Platform } from 'react-native';

export interface TrackingRouteCapability {
  platform: 'android' | 'ios' | 'conservative';
  canUseAndroidTracking: boolean;
  fallbackRoute: '/(onboarding)/ios-capture-options' | '/(tabs)/add';
}

export function resolveTrackingRouteCapability(
  os: string = Platform.OS
): TrackingRouteCapability {
  if (os === 'android') {
    return {
      platform: 'android',
      canUseAndroidTracking: true,
      fallbackRoute: '/(tabs)/add'
    };
  }
  if (os === 'ios') {
    return {
      platform: 'ios',
      canUseAndroidTracking: false,
      fallbackRoute: '/(onboarding)/ios-capture-options'
    };
  }
  return {
    platform: 'conservative',
    canUseAndroidTracking: false,
    fallbackRoute: '/(tabs)/add'
  };
}
