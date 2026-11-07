import { isAbsolute, join } from 'node:path';

import { validateEnvironment } from '../../../src/platform/config/environment.schema';

export interface QaRuntimeBinding {
  schemaVersion: number;
  projectId: string;
  systemIdentifier: string;
  role: string;
  password: string;
  validUntil: string;
  host: string;
  port: number;
  database: string;
  ssl: boolean;
}

interface QaKeyMaterial {
  pushHash: string;
  pushEncryption: string;
  syncCursor: string;
  ipHash: string;
}

interface QaDatabaseAdmission {
  systemIdentifier: string;
  profileRoot: string;
  sourceRevision: string;
}

const osKeys = new Set([
  'PATH',
  'WINDIR',
  'SYSTEMROOT',
  'COMSPEC',
  'PATHEXT',
  'PROCESSOR_ARCHITECTURE',
  'NUMBER_OF_PROCESSORS',
  'TEMP',
  'TMP',
  'PROGRAMDATA',
]);

function key(value: string): boolean {
  return /^[A-Za-z0-9_-]{43}$/.test(value) && Buffer.from(value, 'base64url').length === 32;
}

/** Only the test launcher imports this; normal API bootstrap has no fixture switch. */
export function buildQaChildEnvironment({
  parent,
  binding,
  keys,
  admission,
  nowMs = Date.now(),
}: {
  parent: NodeJS.ProcessEnv;
  binding: QaRuntimeBinding;
  keys: QaKeyMaterial;
  admission: QaDatabaseAdmission;
  nowMs?: number;
}): Record<string, string> {
  const expires = Date.parse(binding.validUntil);
  if (
    binding.schemaVersion !== 1 ||
    binding.projectId !== 'masarifi_perf_20261102_d959_r2' ||
    !/^[0-9]{1,20}$/.test(admission.systemIdentifier) ||
    binding.systemIdentifier !== admission.systemIdentifier ||
    binding.role !== 'masarifi_perf_r2_api_20261102' ||
    binding.host !== '127.0.0.1' ||
    binding.port !== 54332 ||
    binding.database !== 'postgres' ||
    !Object.is(binding.ssl, false) ||
    !key(binding.password) ||
    !Number.isFinite(nowMs) ||
    !Number.isFinite(expires) ||
    expires <= nowMs ||
    expires - nowMs > 72 * 60 * 60 * 1000 ||
    new Date(expires).toISOString() !== binding.validUntil ||
    !isAbsolute(admission.profileRoot) ||
    !/^[a-f0-9]{40}$/.test(admission.sourceRevision)
  )
    throw new Error('QA_RUNTIME_BINDING_INVALID');
  const material = Object.values(keys);
  if (material.length !== 4 || !material.every(key) || new Set(material).size !== 4) {
    throw new Error('QA_KEY_MATERIAL_INVALID');
  }
  const child = Object.fromEntries(
    Object.entries(parent).filter(
      (entry): entry is [string, string] =>
        osKeys.has(entry[0].toUpperCase()) && typeof entry[1] === 'string',
    ),
  );
  Object.assign(child, {
    USERPROFILE: admission.profileRoot,
    APPDATA: join(admission.profileRoot, 'AppData/Roaming'),
    LOCALAPPDATA: join(admission.profileRoot, 'AppData/Local'),
    NODE_ENV: 'test',
    CI: 'true',
    NO_COLOR: '1',
    TZ: 'UTC',
    MASARIFI_PROCESS_KIND: 'api',
    MASARIFI_HTTP_PORT: '8082',
    MASARIFI_RELEASE_VERSION: 'qa-perf-' + admission.sourceRevision.slice(0, 12),
    MASARIFI_DATABASE_POOL_MAX: '4',
    MASARIFI_RECENT_AUTH_MAX_AGE_SECONDS: '600',
    MASARIFI_LEDGER_RECENT_AUTH_THRESHOLDS: 'SAR:1000000,USD:1000000',
    DATABASE_URL:
      'postgresql://' +
      binding.role +
      ':' +
      encodeURIComponent(binding.password) +
      '@127.0.0.1:54332/postgres',
    MASARIFI_CORS_ORIGINS: 'https://performance.qa.invalid',
    CLERK_PUBLISHABLE_KEY: ['pk', 'test', 'nonfunctionalfixture'].join('_'),
    CLERK_SECRET_KEY: ['sk', 'test', 'nonfunctionalfixture'].join('_'),
    CLERK_INSTANCE_DOMAIN: 'example.clerk.accounts.dev',
    CLERK_AUTHORIZED_PARTIES: 'https://performance.qa.invalid',
    CLERK_WEBHOOK_SIGNING_SECRET: ['whsec', 'nonfunctionalfixture'].join('_'),
    MASARIFI_PUSH_TOKEN_HASH_KEY: keys.pushHash,
    MASARIFI_PUSH_TOKEN_ENCRYPTION_KEYS: 'active:' + keys.pushEncryption,
    MASARIFI_SYNC_CURSOR_KEY: keys.syncCursor,
    MASARIFI_SECURITY_IP_HASH_KEYS: 'active:' + keys.ipHash,
    MASARIFI_ADMIN_INVITATION_REDIRECT_URL: 'https://performance.qa.invalid/invitations/accept',
    SUPABASE_URL: 'http://127.0.0.1:1',
    SUPABASE_SERVICE_ROLE_KEY: 'local_nonfunctional_service_role_fixture',
    MASARIFI_EXPORT_RETENTION_HOURS: '24',
    MASARIFI_EXPORT_SIGNED_URL_SECONDS: '300',
    MASARIFI_DELETION_COOLING_OFF_HOURS: '72',
    MASARIFI_ADMIN_ROUTES_ENABLED: 'false',
    MASARIFI_AI_PROVIDER_ENABLED: 'false',
    MASARIFI_ASSISTANT_AGENT_ENABLED: 'false',
    MASARIFI_ASSISTANT_AGENT_PUBLIC_ENABLED: 'false',
    MASARIFI_MOBILE_AUTOMATION_ENABLED: 'false',
    MASARIFI_RETURN_REMINDERS_ENABLED: 'false',
    MASARIFI_FINANCE_DIAGNOSTICS_ENABLED: 'false',
  });
  validateEnvironment(child);
  return child;
}
