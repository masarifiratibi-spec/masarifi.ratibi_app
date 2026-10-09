import Constants from 'expo-constants';

type Stage = 'identity_timeout' | 'identity_retry_failure' | 'identity_error'
  | 'sso_start' | 'sso_result' | 'sso_failure' | 'sso_ready';

// Development-only metadata. Never emit messages, URLs, OAuth parameters or identities.
export function recordDevelopmentAuthDiagnostic(stage: Stage, error?: unknown): void {
  if (Constants.expoConfig?.scheme !== 'masarifi-dev' ||
      process.env.EXPO_PUBLIC_API_URL !== 'https://api.staging.masarifiratibi.com') return;
  const entry: Record<string, unknown> = { stage, at: Date.now() };
  if (error && typeof error === 'object') {
    const metadata = error as { status?: unknown; code?: unknown; errors?: unknown; message?: unknown };
    if (typeof metadata.status === 'number' && Number.isInteger(metadata.status) && metadata.status >= 100 && metadata.status <= 599) entry.status = metadata.status;
    const candidates = [metadata.code];
    if (Array.isArray(metadata.errors)) {
      for (const item of metadata.errors.slice(0, 5)) {
        if (item && typeof item === 'object' && 'code' in item) candidates.push(item.code);
      }
    }
    const codes = candidates.filter((code): code is string => typeof code === 'string' && /^[a-z][a-z_]{0,79}$/.test(code));
    if (codes.length) entry.codes = [...new Set(codes)];
    if (metadata.message === 'appShell.auth.unavailable') entry.localFailure = 'auth_unavailable';
    else if (metadata.message === 'googleAuth.incomplete') entry.localFailure = 'registration_incomplete';
    else if (metadata.message === 'Clerk session missing') entry.localFailure = 'activated_session_missing';
  }
  console.info('DEV_AUTH_DIAG', JSON.stringify(entry));
}
