import { z } from 'zod';
import type { InstalledApplication } from '@/services/platform/application-version';
export {
  installedApplication,
  registeredApplicationVersion
} from '@/services/platform/application-version';

export const ANDROID_STORE_URL =
  'https://play.google.com/store/apps/details?id=com.masarifi.mobile';
const version = z
  .string()
  .max(32)
  .regex(/^(0|[1-9]\d{0,8})\.(0|[1-9]\d{0,8})\.(0|[1-9]\d{0,8})$/);
const buildCode = z.number().int().positive().max(2_100_000_000);
const release = z.object({ version, versionCode: buildCode }).strict();
const common = {
  schemaVersion: z.literal(1),
  storeUrl: z.literal(ANDROID_STORE_URL)
};
const policySchema = z.discriminatedUnion('enabled', [
  z.object({ ...common, enabled: z.literal(true), release }).strict(),
  z.object({ ...common, enabled: z.literal(false), release: z.null() }).strict()
]);
export type UpdatePolicy = z.infer<typeof policySchema>;

export function parseUpdatePolicy(input: unknown): UpdatePolicy {
  return policySchema.parse(input);
}

export function updateAvailable(
  policy: UpdatePolicy,
  installed: InstalledApplication
): boolean {
  if (!policy.enabled) return false;
  if (buildCode.safeParse(installed.versionCode).success)
    return installed.versionCode! < policy.release.versionCode;
  if (!version.safeParse(installed.version).success) return false;
  const current = installed.version!.split('.').map(Number);
  const latest = policy.release.version.split('.').map(Number);
  for (let index = 0; index < 3; index += 1) {
    if (current[index] !== latest[index])
      return current[index]! < latest[index]!;
  }
  return false;
}

export async function openAndroidStore(
  open: (url: string) => Promise<unknown>
): Promise<void> {
  try {
    await open('market://details?id=com.masarifi.mobile');
  } catch {
    await open(ANDROID_STORE_URL);
  }
}

export async function requestUpdatePolicy(
  baseUrl: string | undefined = process.env.EXPO_PUBLIC_API_URL,
  request: typeof fetch = fetch,
  options: { signal?: AbortSignal; timeoutMs?: number } = {}
): Promise<UpdatePolicy> {
  const base = new URL(baseUrl ?? '');
  if (
    base.protocol !== 'https:' ||
    base.username ||
    base.password ||
    base.search ||
    base.hash
  )
    throw new Error('APP_UPDATE_UNAVAILABLE');
  const controller = new AbortController();
  const abort = () => controller.abort();
  if (options.signal?.aborted) throw new Error('APP_UPDATE_CANCELLED');
  options.signal?.addEventListener('abort', abort);
  const timeout = setTimeout(abort, options.timeoutMs ?? 4_000);
  try {
    const response = await request(
      `${baseUrl!.replace(/\/+$/, '')}/api/v1/meta/mobile-update`,
      {
        signal: controller.signal,
        headers: { Accept: 'application/json' }
      }
    );
    if (!response.ok) throw new Error('APP_UPDATE_UNAVAILABLE');
    return parseUpdatePolicy(await response.json());
  } finally {
    clearTimeout(timeout);
    options.signal?.removeEventListener('abort', abort);
  }
}
