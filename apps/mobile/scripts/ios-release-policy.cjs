const profiles = ['ios-ad-hoc', 'ios-app-store'];

// EAS first supplies profile env without EAS_BUILD_PROFILE/PLATFORM or NODE_ENV.
// Config/Metro can also receive the name before the platform. Worker validation
// requires the platform separately; an explicitly different platform is never allowed.
function iosReleaseProfile(environment) {
  const adhoc = environment.MASARIFI_IOS_AD_HOC === 'true';
  const store = environment.MASARIFI_IOS_APP_STORE === 'true';
  const marker = store ? 'ios-app-store' : adhoc ? 'ios-ad-hoc' : null;
  const named = profiles.includes(environment.EAS_BUILD_PROFILE)
    ? environment.EAS_BUILD_PROFILE
    : null;
  const label = store || named === 'ios-app-store' ? 'App Store' : 'Ad Hoc';
  if (
    (adhoc && store) ||
    (marker &&
      environment.EAS_BUILD_PROFILE &&
      marker !== environment.EAS_BUILD_PROFILE)
  )
    throw new Error(`iPhone ${label} marker requires its own iOS profile`);
  const profile = named ?? marker;
  if (!profile) return null;
  if (
    environment.EAS_BUILD_PLATFORM &&
    environment.EAS_BUILD_PLATFORM !== 'ios'
  )
    throw new Error(`iPhone ${label} requires the ios build platform`);
  if (
    (environment.EXPO_PUBLIC_APP_VARIANT &&
      environment.EXPO_PUBLIC_APP_VARIANT !== 'production') ||
    (!named && environment.EXPO_PUBLIC_APP_VARIANT !== 'production') ||
    environment.MASARIFI_APP_VARIANT
  )
    throw new Error(`iPhone ${label} requires the production app variant`);
  return profile;
}

module.exports = { iosReleaseProfile };
