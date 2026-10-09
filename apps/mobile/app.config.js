module.exports = ({ config }) => {
  const variant = process.env.MASARIFI_APP_VARIANT;
  if (!variant) return config;
  if (variant !== 'staging-development') throw new Error('Unknown app variant');
  if (
    process.env.EXPO_PUBLIC_CLIENT_MODE !== 'live' ||
    process.env.EXPO_PUBLIC_API_URL !== 'https://api.staging.masarifiratibi.com' ||
    (process.env.EAS_BUILD_PROFILE && process.env.EAS_BUILD_PROFILE !== 'development-staging')
  ) {
    throw new Error('Staging development requires the live Staging API and its own build profile');
  }

  // The ordinary Firebase Android client is registered for the ordinary package.
  // This independent development package supports local notifications, not FCM push.
  const android = { ...config.android };
  delete android.googleServicesFile;
  return {
    ...config,
    name: 'Masarifi Dev',
    scheme: 'masarifi-dev',
    plugins: [...config.plugins, ['expo-dev-client', { addGeneratedScheme: false }]],
    ios: { ...config.ios, bundleIdentifier: 'com.masarifi.mobile.dev' },
    android: { ...android, package: 'com.masarifi.mobile.dev' }
  };
};
