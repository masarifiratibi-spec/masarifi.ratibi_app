function assertNormalBuildComposition(environment, config = {}) {
  if (
    environment.MASARIFI_PERFORMANCE_QA_COMPOSITION !== undefined ||
    environment.EXPO_PUBLIC_PERFORMANCE_QA_MANIFEST_SHA256 !== undefined ||
    environment.MASARIFI_APP_VARIANT === 'performance-qa' ||
    environment.EXPO_PUBLIC_APP_VARIANT === 'performance-qa' ||
    environment.EXPO_PUBLIC_RELEASE_CHANNEL === 'performance-qa' ||
    environment.EAS_BUILD_PROFILE === 'performance-qa' ||
    config.android?.package === 'com.masarifi.mobile.performance' ||
    config.ios?.bundleIdentifier === 'com.masarifi.mobile.performance'
  )
    throw new Error('Performance QA requires private composition');
}

module.exports = { assertNormalBuildComposition };
