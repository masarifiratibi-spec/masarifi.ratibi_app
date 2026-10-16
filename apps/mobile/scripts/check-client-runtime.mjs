import { URL } from 'node:url';

const clerkKeyPattern = /^pk_(?:live|test)_[A-Za-z0-9_-]{10,}$/;
const publicSecretPattern = /^EXPO_PUBLIC_.*(?:API_KEY|SECRET|SERVICE_ROLE)/;

export function validateClientBuildEnvironment(environment = process.env) {
  const exposed = Object.entries(environment).find(
    ([name, value]) => value && publicSecretPattern.test(name)
  );
  if (exposed) throw new Error(`forbidden public secret variable: ${exposed[0]}`);
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
      !/^pk_test_[A-Za-z0-9_-]{10,}$/.test(environment.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY ?? '')
    ) throw new Error('Privacy development requires its isolated Staging API, test key, variant and build profile');
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
  if (apiUrl.protocol !== 'https:' || !apiUrl.hostname || apiUrl.username || apiUrl.password)
    throw new Error('production requires a valid HTTPS API URL');
  const clerkKey = environment.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY;
  if (!clerkKey || !clerkKeyPattern.test(clerkKey) || !clerkKey.startsWith('pk_live_'))
    throw new Error('production requires a valid Clerk live publishable key');
}

function isPrivacyApiNamespace(value) {
  try {
    const url = new URL(value ?? '');
    if (url.hostname.toLowerCase().replace(/\.$/, '') !== 'api.staging.masarifiratibi.com') return false;
    let path = url.pathname;
    while (path.includes('%')) {
      try { path = decodeURIComponent(path); } catch { break; }
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

if (process.argv[1] && import.meta.url === new URL(`file:///${process.argv[1].replace(/\\/g, '/')}`).href)
  validateClientBuildEnvironment();
