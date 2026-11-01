import { URL } from 'node:url';
import { Buffer } from 'node:buffer';
import benchmarkPolicy from './benchmark-build-policy.cjs';

const clerkKeyPattern = /^pk_(?:live|test)_[A-Za-z0-9_-]{10,}$/;
const publicSecretPattern = /^EXPO_PUBLIC_.*(?:API_KEY|SECRET|SERVICE_ROLE)/;

export function validateClientBuildEnvironment(environment = process.env) {
  const exposed = Object.entries(environment).find(
    ([name, value]) => value && publicSecretPattern.test(name)
  );
  if (exposed)
    throw new Error(`forbidden public secret variable: ${exposed[0]}`);
  if (benchmarkPolicy.validateBenchmarkBuildEnvironment(environment)) return;
  const privacyVariant = 'staging-development-privacy';
  const privacyApi = 'https://api.staging.masarifiratibi.com/dev-privacy';
  if (
    environment.MASARIFI_APP_VARIANT === privacyVariant ||
    environment.EXPO_PUBLIC_APP_VARIANT === privacyVariant ||
    environment.EAS_BUILD_PROFILE === 'development-staging-privacy' ||
    isPrivacyApiNamespace(environment.EXPO_PUBLIC_API_URL)
  ) {
    if (
      environment.MASARIFI_APP_VARIANT !== privacyVariant ||
      environment.EXPO_PUBLIC_APP_VARIANT !== privacyVariant ||
      environment.EAS_BUILD_PROFILE !== 'development-staging-privacy' ||
      environment.EXPO_PUBLIC_CLIENT_MODE !== 'live' ||
      environment.EXPO_PUBLIC_API_URL !== privacyApi ||
      !/^pk_test_[A-Za-z0-9_-]{10,}$/.test(
        environment.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY ?? ''
      )
    )
      throw new Error(
        'Privacy development requires its isolated Staging API, test key, variant and build profile'
      );
    return;
  }
  if (environment.EAS_BUILD_PROFILE === 'development') {
    if (environment.EXPO_PUBLIC_CLIENT_MODE !== 'demo')
      throw new Error('development build requires demo client mode');
    return;
  }
  if (environment.NODE_ENV !== 'production') return;
  if (environment.EXPO_PUBLIC_CLIENT_MODE !== 'live')
    throw new Error('production requires live client mode');
  let apiUrl;
  try {
    apiUrl = new URL(environment.EXPO_PUBLIC_API_URL ?? '');
  } catch {
    throw new Error('production requires a valid HTTPS API URL');
  }
  if (
    apiUrl.protocol !== 'https:' ||
    !apiUrl.hostname ||
    apiUrl.username ||
    apiUrl.password
  )
    throw new Error('production requires a valid HTTPS API URL');
  const clerkKey = environment.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY;
  if (
    !clerkKey ||
    !clerkKeyPattern.test(clerkKey) ||
    !clerkKey.startsWith('pk_live_')
  )
    throw new Error('production requires a valid Clerk live publishable key');
  if (
    ['staging-client', 'preview', 'development-staging'].includes(
      environment.EAS_BUILD_PROFILE
    )
  )
    return;
  if (
    environment.EAS_BUILD_PROFILE &&
    environment.EAS_BUILD_PROFILE !== 'production'
  )
    throw new Error('unknown release build profile');
  if (environment.EXPO_PUBLIC_RELEASE_CHANNEL !== 'production')
    throw new Error('production requires its release channel');
  const approvedOrigin = environment.MASARIFI_PRODUCTION_API_ORIGIN;
  if (
    !approvedOrigin ||
    apiUrl.origin !== approvedOrigin ||
    apiUrl.pathname !== '/' ||
    apiUrl.search ||
    apiUrl.hash ||
    /(?:^|[.-])(?:staging|dev|test|preview|localhost)(?:[.-]|$)/i.test(
      apiUrl.hostname
    )
  )
    throw new Error('production requires the approved production API origin');
  const approvedClerkHost =
    environment.MASARIFI_PRODUCTION_CLERK_INSTANCE_DOMAIN;
  const decodedClerkHost = Buffer.from(
    clerkKey.slice('pk_live_'.length),
    'base64url'
  ).toString('utf8');
  if (
    !approvedClerkHost ||
    !/^[a-z0-9]+(?:[.-][a-z0-9]+)*\.[a-z]{2,}$/i.test(approvedClerkHost) ||
    decodedClerkHost !== `${approvedClerkHost}$` ||
    /(?:^|[.-])(?:staging|dev|test|preview|localhost)(?:[.-]|$)/i.test(
      approvedClerkHost
    )
  )
    throw new Error(
      'production requires the approved production Clerk instance'
    );
  if (environment.EXPO_PUBLIC_APP_LOCK_ENABLED !== 'true')
    throw new Error('production requires app lock enabled');
  for (const name of [
    'EXPO_PUBLIC_MOBILE_AUTOMATION_ENABLED',
    'EXPO_PUBLIC_VOICE_TIMING_ENABLED',
    'EXPO_PUBLIC_VOICE_DIAGNOSTICS_ENABLED',
    'EXPO_PUBLIC_FINANCE_DIAGNOSTICS_ENABLED'
  ]) {
    if (environment[name] !== 'false')
      throw new Error(`production requires ${name}=false`);
  }
  if (environment.EXPO_PUBLIC_DEMO_MODE !== '0')
    throw new Error('production requires demo mode disabled');
  if (!/^\d+\.\d+\.\d+$/.test(environment.MASARIFI_RELEASE_VERSION_NAME ?? ''))
    throw new Error('production requires an approved release version');
}

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

if (
  process.argv[1] &&
  import.meta.url ===
    new URL(`file:///${process.argv[1].replace(/\\/g, '/')}`).href
)
  validateClientBuildEnvironment();
