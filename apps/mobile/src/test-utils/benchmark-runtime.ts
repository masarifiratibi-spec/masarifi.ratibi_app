export const benchmarkEnvironment = {
  EXPO_PUBLIC_APP_VARIANT: 'staging-benchmark',
  EXPO_PUBLIC_BENCHMARK_READ_ONLY: 'true',
  EXPO_PUBLIC_CLIENT_MODE: 'live',
  EXPO_PUBLIC_API_URL: 'https://api.staging.masarifiratibi.com',
  EXPO_PUBLIC_RELEASE_CHANNEL: 'benchmark',
  EXPO_PUBLIC_BENCHMARK_OWNER_ID: 'user_benchmarkOwner'
};

export function installBenchmarkEnvironment() {
  const previous = Object.fromEntries(
    Object.keys(benchmarkEnvironment).map((key) => [key, process.env[key]])
  );
  Object.assign(process.env, benchmarkEnvironment);
  return () => {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  };
}

export function benchmarkExpoMock() {
  const actual = jest.requireActual<typeof import('expo')>('expo');
  return {
    ...actual,
    requireOptionalNativeModule: jest.fn((name: string) =>
      name === 'ExpoApplication'
        ? { applicationId: 'com.masarifi.mobile.benchmark' }
        : actual.requireOptionalNativeModule(name)
    )
  };
}
