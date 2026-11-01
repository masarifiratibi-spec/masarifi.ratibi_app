import { requireOptionalNativeModule } from 'expo';

export type ClientMode = 'live' | 'demo' | 'test';

type RuntimeEnvironment = Record<string, string | undefined>;

export interface ClientRuntime {
  apiUrl: string | null;
  // TODO(report-8.2): Implement real subscription billing in the final closure phase; verify the intended Stripe integration against current Google Play Payments requirements and applicable regional programs before enabling purchases. Deferred, not resolved.
  billingAvailable: false;
  clerkPublishableKey: string | null;
  mode: ClientMode;
}

const clientModes = new Set<ClientMode>(['live', 'demo', 'test']);
const clerkKeyPattern = /^pk_(?:live|test)_[A-Za-z0-9_-]{10,}$/;
const publicSecretPattern = /^EXPO_PUBLIC_.*(?:API_KEY|SECRET|SERVICE_ROLE)/;
const bundledEnvironment = (): RuntimeEnvironment => ({
  EXPO_PUBLIC_APP_LOCK_ENABLED: process.env.EXPO_PUBLIC_APP_LOCK_ENABLED,
  EXPO_PUBLIC_CLIENT_MODE: process.env.EXPO_PUBLIC_CLIENT_MODE,
  EXPO_PUBLIC_DEMO_MODE: process.env.EXPO_PUBLIC_DEMO_MODE,
  EXPO_PUBLIC_API_URL: process.env.EXPO_PUBLIC_API_URL,
  EXPO_PUBLIC_APP_VARIANT: process.env.EXPO_PUBLIC_APP_VARIANT,
  EXPO_PUBLIC_BENCHMARK_READ_ONLY: process.env.EXPO_PUBLIC_BENCHMARK_READ_ONLY,
  EXPO_PUBLIC_BENCHMARK_OWNER_ID: process.env.EXPO_PUBLIC_BENCHMARK_OWNER_ID,
  EXPO_PUBLIC_RELEASE_CHANNEL: process.env.EXPO_PUBLIC_RELEASE_CHANNEL,
  EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY:
    process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY
});

export function isBenchmarkReadOnly(
  environment?: RuntimeEnvironment,
  applicationId?: string | null
): boolean {
  if (
    !environment &&
    process.env.EXPO_PUBLIC_APP_VARIANT !== 'staging-benchmark' &&
    process.env.EXPO_PUBLIC_RELEASE_CHANNEL !== 'benchmark' &&
    process.env.EXPO_PUBLIC_BENCHMARK_READ_ONLY === undefined &&
    applicationId !== 'com.masarifi.mobile.benchmark'
  )
    return false;
  environment ??= bundledEnvironment();
  const selected =
    environment.EXPO_PUBLIC_APP_VARIANT === 'staging-benchmark' ||
    environment.EXPO_PUBLIC_RELEASE_CHANNEL === 'benchmark' ||
    environment.EXPO_PUBLIC_BENCHMARK_READ_ONLY !== undefined ||
    applicationId === 'com.masarifi.mobile.benchmark';
  // Ordinary apps never consult native modules or change transport behavior.
  if (!selected) return false;
  if (
    environment.EXPO_PUBLIC_APP_VARIANT !== 'staging-benchmark' ||
    environment.EXPO_PUBLIC_BENCHMARK_READ_ONLY !== 'true' ||
    environment.EXPO_PUBLIC_RELEASE_CHANNEL !== 'benchmark' ||
    environment.EXPO_PUBLIC_CLIENT_MODE !== 'live' ||
    !/^user_[A-Za-z0-9]+$/.test(
      environment.EXPO_PUBLIC_BENCHMARK_OWNER_ID ?? ''
    ) ||
    environment.EXPO_PUBLIC_API_URL !==
      'https://api.staging.masarifiratibi.com' ||
    (applicationId === undefined
      ? requireOptionalNativeModule<{ applicationId: string | null }>(
          'ExpoApplication'
        )?.applicationId
      : applicationId) !== 'com.masarifi.mobile.benchmark'
  )
    throw new Error('Invalid benchmark runtime identity');
  return true;
}

export function assertBenchmarkRead(method: string | undefined): void {
  if (
    isBenchmarkReadOnly() &&
    method !== undefined &&
    method !== 'GET' &&
    method !== 'HEAD'
  )
    throw new Error('benchmark_read_only');
}

export function isDevPrivacyDeletionEnabled(): boolean {
  return devPrivacyDeletionApiUrl() !== null;
}

export function devPrivacyDeletionApiUrl(): string | null {
  const variant = process.env.EXPO_PUBLIC_APP_VARIANT;
  if (
    ![undefined, 'staging-development', 'staging-development-privacy'].includes(
      variant
    )
  )
    return null;
  if (
    !process.env.EXPO_PUBLIC_API_URL ||
    !process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY
  )
    return null;
  const runtime = resolveClientRuntime();
  const staging = 'https://api.staging.masarifiratibi.com';
  const expected =
    variant === 'staging-development-privacy'
      ? `${staging}/dev-privacy`
      : staging;
  return runtime.mode === 'live' && runtime.apiUrl === expected
    ? `${staging}/${variant === 'staging-development-privacy' ? 'dev-privacy' : 'account-deletion'}`
    : null;
}

export function isAppLockEnabled(
  environment: RuntimeEnvironment = bundledEnvironment(),
  runtime = {
    development: typeof __DEV__ !== 'undefined' && __DEV__,
    nodeEnvironment: process.env.NODE_ENV,
    applicationId:
      requireOptionalNativeModule<{ applicationId: string | null }>(
        'ExpoApplication'
      )?.applicationId ?? null
  }
): boolean {
  return !(
    runtime.development &&
    runtime.nodeEnvironment === 'development' &&
    environment.EXPO_PUBLIC_CLIENT_MODE === 'live' &&
    ((environment.EXPO_PUBLIC_API_URL ===
      'https://api.staging.masarifiratibi.com' &&
      environment.EXPO_PUBLIC_APP_VARIANT === 'staging-development' &&
      runtime.applicationId === 'com.masarifi.mobile.dev') ||
      (environment.EXPO_PUBLIC_API_URL ===
        'https://api.staging.masarifiratibi.com/dev-privacy' &&
        environment.EXPO_PUBLIC_APP_VARIANT === 'staging-development-privacy' &&
        runtime.applicationId === 'com.masarifi.mobile.dev.privacy'))
  );
}

export function resolveClientMode(
  environment: RuntimeEnvironment = bundledEnvironment(),
  nodeEnvironment = process.env.NODE_ENV
): ClientMode {
  const rawMode =
    environment.EXPO_PUBLIC_CLIENT_MODE ??
    (environment.EXPO_PUBLIC_DEMO_MODE === '1'
      ? 'demo'
      : nodeEnvironment === 'test'
        ? 'test'
        : nodeEnvironment === 'production'
          ? 'live'
          : 'demo');

  if (!clientModes.has(rawMode as ClientMode))
    throw new Error('invalid client mode');
  return rawMode as ClientMode;
}

export function resolveClientRuntime(
  environment: RuntimeEnvironment = bundledEnvironment(),
  nodeEnvironment = process.env.NODE_ENV
): ClientRuntime {
  isBenchmarkReadOnly(environment);
  const exposedSecret = Object.entries(environment).find(
    ([name, value]) => value && publicSecretPattern.test(name)
  );
  if (exposedSecret) throw new Error('forbidden public secret variable');

  const mode = resolveClientMode(environment, nodeEnvironment);
  const privacyVariant =
    environment.EXPO_PUBLIC_APP_VARIANT === 'staging-development-privacy';
  const privacyApi = 'https://api.staging.masarifiratibi.com/dev-privacy';
  if (
    (privacyVariant ||
      isPrivacyApiNamespace(environment.EXPO_PUBLIC_API_URL)) &&
    (!privacyVariant ||
      environment.EXPO_PUBLIC_API_URL !== privacyApi ||
      mode !== 'live' ||
      !/^pk_test_[A-Za-z0-9_-]{10,}$/.test(
        environment.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY ?? ''
      ))
  )
    throw new Error(
      'privacy development requires its isolated API, variant and test publishable key'
    );
  if (mode !== 'live')
    return {
      apiUrl: null,
      billingAvailable: false,
      clerkPublishableKey: null,
      mode
    };

  const apiUrl = validHttpsUrl(environment.EXPO_PUBLIC_API_URL);
  if (!apiUrl) throw new Error('live mode requires a valid HTTPS API URL');

  const clerkPublishableKey = environment.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY;
  if (!clerkPublishableKey || !clerkKeyPattern.test(clerkPublishableKey))
    throw new Error('live mode requires a valid Clerk publishable key');
  if (
    nodeEnvironment === 'production' &&
    !clerkPublishableKey.startsWith('pk_live_') &&
    !privacyVariant
  )
    throw new Error('production Clerk publishable key must use pk_live');

  return { apiUrl, billingAvailable: false, clerkPublishableKey, mode };
}

function validHttpsUrl(value: string | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (
      url.protocol !== 'https:' ||
      !url.hostname ||
      url.username ||
      url.password
    )
      return null;
    return value.replace(/\/+$/, '');
  } catch {
    return null;
  }
}

function isPrivacyApiNamespace(value: string | undefined): boolean {
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
