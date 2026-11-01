const { Buffer } = require('node:buffer');

const benchmarkProfile = {
  developmentClient: false,
  distribution: 'internal',
  environment: 'preview',
  node: '24.16.0',
  autoIncrement: false,
  android: { buildType: 'apk' },
  env: {
    MASARIFI_APP_VARIANT: 'staging-benchmark',
    EXPO_PUBLIC_APP_VARIANT: 'staging-benchmark',
    EXPO_PUBLIC_BENCHMARK_READ_ONLY: 'true',
    EXPO_PUBLIC_CLIENT_MODE: 'live',
    EXPO_PUBLIC_API_URL: 'https://api.staging.masarifiratibi.com',
    EXPO_PUBLIC_RELEASE_CHANNEL: 'benchmark',
    EXPO_PUBLIC_DEMO_MODE: '0',
    EXPO_PUBLIC_APP_LOCK_ENABLED: 'true',
    EXPO_PUBLIC_MOBILE_AUTOMATION_ENABLED: 'false',
    EXPO_PUBLIC_VOICE_AUTOMATIC_POSTING: 'false',
    EXPO_PUBLIC_VOICE_TIMING_ENABLED: 'false',
    EXPO_PUBLIC_VOICE_DIAGNOSTICS_ENABLED: 'false',
    EXPO_PUBLIC_FINANCE_DIAGNOSTICS_ENABLED: 'false'
  }
};

function validateBenchmarkBuildEnvironment(environment) {
  const selected =
    environment.MASARIFI_APP_VARIANT === 'staging-benchmark' ||
    environment.EXPO_PUBLIC_APP_VARIANT === 'staging-benchmark' ||
    environment.EAS_BUILD_PROFILE === 'benchmark' ||
    environment.EXPO_PUBLIC_RELEASE_CHANNEL === 'benchmark' ||
    environment.EXPO_PUBLIC_BENCHMARK_READ_ONLY !== undefined;
  if (!selected) return false;
  if (
    environment.EAS_BUILD_PROFILE !== 'benchmark' ||
    Object.entries(benchmarkProfile.env).some(
      ([key, value]) => environment[key] !== value
    )
  )
    throw new Error(
      'Benchmark requires its exact profile, variants, Staging API and read-only flags'
    );
  const key = environment.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY ?? '';
  const host = 'clerk.staging.masarifiratibi.com';
  if (
    !/^pk_live_[A-Za-z0-9_-]{10,}$/.test(key) ||
    Buffer.from(key.slice('pk_live_'.length), 'base64url').toString('utf8') !==
      `${host}$`
  )
    throw new Error(
      'Benchmark requires the approved Staging Clerk live instance'
    );
  if (
    environment.MASARIFI_RELEASE_VERSION_NAME !== undefined &&
    !/^\d+\.\d+\.\d+$/.test(environment.MASARIFI_RELEASE_VERSION_NAME)
  )
    throw new Error('Benchmark requires a valid approved version');
  return true;
}
module.exports = { benchmarkProfile, validateBenchmarkBuildEnvironment };
