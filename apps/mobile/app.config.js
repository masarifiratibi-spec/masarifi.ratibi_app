/* eslint-disable @typescript-eslint/no-var-requires -- Expo loads app configuration as CommonJS. */
const { URL } = globalThis;
const {
  validateBenchmarkBuildEnvironment
} = require('./scripts/benchmark-build-policy.cjs');
const {
  assertNormalBuildComposition
} = require('./scripts/performance-qa-exclusion.cjs');

module.exports = ({ config }) => {
  assertNormalBuildComposition(process.env, config);
  // EAS CLI resolves profile env locally before setting EAS_BUILD_PROFILE.
  const iosAdHoc = process.env.MASARIFI_IOS_AD_HOC === 'true';
  if (
    iosAdHoc &&
    ((process.env.EAS_BUILD_PROFILE &&
      process.env.EAS_BUILD_PROFILE !== 'ios-ad-hoc') ||
      (process.env.EAS_BUILD_PLATFORM &&
        process.env.EAS_BUILD_PLATFORM !== 'ios'))
  )
    throw new Error('iPhone Ad Hoc marker requires its own iOS profile');
  if (validateBenchmarkBuildEnvironment(process.env)) {
    return {
      ...config,
      ...(process.env.MASARIFI_RELEASE_VERSION_NAME
        ? { version: process.env.MASARIFI_RELEASE_VERSION_NAME }
        : {}),
      name: 'Masarifi Benchmark',
      scheme: 'masarifi-benchmark',
      plugins: config.plugins.map((plugin) =>
        (Array.isArray(plugin) ? plugin[0] : plugin) === 'expo-dev-client'
          ? ['expo-dev-client', { addGeneratedScheme: false }]
          : plugin
      ),
      ios: { ...config.ios, bundleIdentifier: 'com.masarifi.mobile.benchmark' },
      android: {
        ...config.android,
        package: 'com.masarifi.mobile.benchmark',
        googleServicesFile: './google-services.benchmark.json'
      }
    };
  }
  const variant = process.env.MASARIFI_APP_VARIANT;
  const privacy = variant === 'staging-development-privacy';
  const privacyApi = 'https://api.staging.masarifiratibi.com/dev-privacy';
  if (
    (privacy ||
      process.env.EXPO_PUBLIC_APP_VARIANT === 'staging-development-privacy' ||
      process.env.EAS_BUILD_PROFILE === 'development-staging-privacy' ||
      isPrivacyApiNamespace(process.env.EXPO_PUBLIC_API_URL)) &&
    (!privacy ||
      process.env.EXPO_PUBLIC_APP_VARIANT !== 'staging-development-privacy' ||
      process.env.EAS_BUILD_PROFILE !== 'development-staging-privacy' ||
      process.env.EXPO_PUBLIC_CLIENT_MODE !== 'live' ||
      process.env.EXPO_PUBLIC_API_URL !== privacyApi ||
      !/^pk_test_[A-Za-z0-9_-]{10,}$/.test(
        process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY ?? ''
      ))
  )
    throw new Error(
      'Privacy development requires its isolated Staging API, test key, variant and build profile'
    );
  if (!variant) {
    if (
      iosAdHoc ||
      ['production', 'ios-ad-hoc'].includes(process.env.EAS_BUILD_PROFILE)
    ) {
      const version = process.env.MASARIFI_RELEASE_VERSION_NAME;
      if (!/^\d+\.\d+\.\d+$/.test(version ?? ''))
        throw new Error('Approved release version required');
      return { ...config, version };
    }
    return config;
  }
  if (variant !== 'staging-development' && !privacy)
    throw new Error('Unknown app variant');
  if (
    !privacy &&
    (process.env.EXPO_PUBLIC_CLIENT_MODE !== 'live' ||
      process.env.EXPO_PUBLIC_API_URL !==
        'https://api.staging.masarifiratibi.com' ||
      (process.env.EAS_BUILD_PROFILE &&
        process.env.EAS_BUILD_PROFILE !== 'development-staging'))
  ) {
    throw new Error(
      'Staging development requires the live Staging API and its own build profile'
    );
  }

  // Each development identity must use its own registered Firebase client.
  const android = { ...config.android };
  if (privacy) delete android.googleServicesFile;
  else android.googleServicesFile = './google-services.dev.json';
  return {
    ...config,
    name: privacy ? 'Masarifi Ratibi Dev Privacy' : 'Masarifi Ratibi Dev',
    scheme: privacy ? 'masarifi-dev-privacy' : 'masarifi-dev',
    plugins: [
      ...config.plugins,
      ['expo-dev-client', { addGeneratedScheme: false }]
    ],
    ios: {
      ...config.ios,
      bundleIdentifier: privacy
        ? 'com.masarifi.mobile.dev.privacy'
        : 'com.masarifi.mobile.dev'
    },
    android: {
      ...android,
      package: privacy
        ? 'com.masarifi.mobile.dev.privacy'
        : 'com.masarifi.mobile.dev'
    }
  };
};

function isPrivacyApiNamespace(value) {
  try {
    const url = new URL(value ?? '');
    if (
      url.hostname.toLowerCase().replace(/\.$/, '') !==
      'api.staging.masarifiratibi.com'
    )
      return false;
    let path = url.pathname;
    while (path.includes('%')) {
      try {
        path = decodeURIComponent(path);
      } catch {
        break;
      }
    }
    const segments = [];
    for (const segment of path.replace(/\\/g, '/').split('/')) {
      if (segment === '..') segments.pop();
      else if (segment && segment !== '.') segments.push(segment);
    }
    return segments[0] === 'dev-privacy';
  } catch {
    return false;
  }
}
