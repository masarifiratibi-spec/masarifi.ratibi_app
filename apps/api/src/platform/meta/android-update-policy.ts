import type { PlatformConfigService } from '../config/platform-config.service';

export type AndroidRelease = Readonly<{ version: string; versionCode: number }>;
export const ANDROID_STORE_URL =
  'https://play.google.com/store/apps/details?id=com.masarifi.mobile';
const versionPattern = /^(0|[1-9]\d{0,8})\.(0|[1-9]\d{0,8})\.(0|[1-9]\d{0,8})$/;

export function validAndroidRelease(value: unknown): value is AndroidRelease {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const release = value as AndroidRelease;
  return (
    Object.keys(value).length === 2 &&
    typeof release.version === 'string' &&
    versionPattern.test(release.version) &&
    Number.isSafeInteger(release.versionCode) &&
    release.versionCode > 0 &&
    release.versionCode <= 2_100_000_000
  );
}

export function androidUpdatePolicy(input: {
  published?: boolean;
  version?: string;
  versionCode?: number;
}) {
  const release = { version: input.version, versionCode: input.versionCode };
  const enabled = input.published === true && validAndroidRelease(release);
  return {
    schemaVersion: 1 as const,
    enabled,
    release: enabled ? release : null,
    storeUrl: ANDROID_STORE_URL,
  };
}

export function configuredAndroidUpdate(config: PlatformConfigService) {
  return androidUpdatePolicy({
    published: config.get('MASARIFI_ANDROID_UPDATE_PUBLISHED'),
    version: config.get('MASARIFI_ANDROID_LATEST_VERSION'),
    versionCode: config.get('MASARIFI_ANDROID_LATEST_VERSION_CODE'),
  });
}

export function sameAndroidRelease(
  policy: ReturnType<typeof androidUpdatePolicy>,
  release: unknown,
) {
  return (
    policy.enabled &&
    validAndroidRelease(release) &&
    policy.release?.version === release.version &&
    policy.release.versionCode === release.versionCode
  );
}

export function needsAndroidUpdate(registered: string, release: AndroidRelease): boolean {
  if (!validAndroidRelease(release) || typeof registered !== 'string' || registered.length > 32)
    return false;
  const [version, build, extra] = registered.split('+');
  if (!version || !versionPattern.test(version) || extra !== undefined) return false;
  if (build !== undefined) {
    if (!/^[1-9]\d{0,9}$/.test(build)) return false;
    const code = Number(build);
    return Number.isSafeInteger(code) && code <= 2_100_000_000 && code < release.versionCode;
  }
  const current = version.split('.').map(Number),
    latest = release.version.split('.').map(Number);
  for (let index = 0; index < 3; index += 1) {
    if (current[index] !== latest[index]) return Number(current[index]) < Number(latest[index]);
  }
  return false;
}
