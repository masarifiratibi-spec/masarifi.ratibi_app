const { createRequire } = require("node:module");
const { resolve } = require("node:path");
const { sha256 } = require("../t03-exact-sync/manifest.cjs");

const apiRequire = createRequire(
  resolve(__dirname, "../../../apps/api/package.json"),
);
apiRequire("ts-node").register({
  project: resolve(__dirname, "../../../apps/api/tsconfig.json"),
});
const { validateEnvironment } = apiRequire(
  "./src/platform/config/environment.schema.ts",
);

function configFixture() {
  const host = "db.qcffvfbpzvpwcwxwjyro.supabase.co";
  const normalUrl = `postgresql://masarifi_worker_login:SYNTHETIC_WORKER_SECRET@${host}:5432/postgres?sslmode=verify-full`;
  const bootstrapUrl = `postgresql://postgres:SYNTHETIC_BOOTSTRAP_SECRET@${host}:5432/postgres?sslmode=verify-full`;
  const apiUrl = `postgresql://synthetic_api_login:SYNTHETIC_API_SECRET@${host}:5432/postgres?sslmode=verify-full`;
  const key = (byte) => Buffer.alloc(32, byte).toString("base64url");
  const worker = {
    NODE_ENV: "test",
    MASARIFI_PROCESS_KIND: "worker",
    MASARIFI_RELEASE_VERSION: "synthetic-fixture",
    DATABASE_URL: normalUrl,
    CLERK_SECRET_KEY: "sk_test_nonfunctionalfixture",
    MASARIFI_PUSH_TOKEN_HASH_KEY: key(1),
    MASARIFI_PUSH_TOKEN_ENCRYPTION_KEYS: `active:${key(2)}`,
    MASARIFI_SECURITY_IP_HASH_KEYS: `active:${key(3)}`,
    SUPABASE_URL: `https://qcffvfbpzvpwcwxwjyro.supabase.co`,
    SUPABASE_SERVICE_ROLE_KEY: "local_nonfunctional_service_role_fixture",
    MASARIFI_EXPORT_MAX_BYTES: "16777216",
    MASARIFI_EXPORT_MAX_ENTRIES: "100",
    MASARIFI_EXPORT_RETENTION_HOURS: "24",
    MASARIFI_DELETION_COOLING_OFF_HOURS: "72",
    MASARIFI_SECURITY_WORKER_POLL_MS: "500",
    MASARIFI_SECURITY_JOB_BATCH_SIZE: "25",
    MASARIFI_PRIVACY_HANDLER_MANIFEST:
      "ai@1,engagement@1,identity@1,tracking@1",
    EMAIL_SMTP_HOST: "smtp.example.invalid",
    EMAIL_SMTP_PORT: "587",
    EMAIL_SMTP_USERNAME: "synthetic",
    EMAIL_SMTP_PASSWORD: "synthetic-only",
    EMAIL_FROM: "qa@example.invalid",
  };
  const apiValues = Object.fromEntries(
    Object.entries(worker).filter(([name]) => !name.startsWith("EMAIL_")),
  );
  Object.assign(apiValues, {
    CLERK_PUBLISHABLE_KEY: "pk_test_nonfunctionalfixture",
    CLERK_INSTANCE_DOMAIN: "example.clerk.accounts.dev",
    CLERK_AUTHORIZED_PARTIES: "https://admin.example.test",
    CLERK_WEBHOOK_SIGNING_SECRET: "whsec_nonfunctionalfixture",
    MASARIFI_ADMIN_INVITATION_REDIRECT_URL:
      "https://admin.example.test/invitations/accept",
    MASARIFI_EXPORT_SIGNED_URL_SECONDS: "300",
    MASARIFI_SYNC_CURSOR_KEY: key(4),
  });
  const input = {
    worker: Buffer.from(
      Object.entries(worker)
        .map(([key, value]) => `${key}=${value}`)
        .join("\n"),
    ),
    api: Buffer.from(
      Object.entries({
        ...apiValues,
        MASARIFI_PROCESS_KIND: "api",
        DATABASE_URL: apiUrl,
      })
        .map(([key, value]) => `${key}=${value}`)
        .join("\n"),
    ),
    bootstrap: Buffer.from(
      `DATABASE_URL=${bootstrapUrl}\nMIGRATION_ONLY=SYNTHETIC_BOOTSTRAP_MARKER`,
    ),
  };
  const caBytes = Buffer.from(
    "synthetic-ca-byte-fixture-never-used-for-a-connection",
  );
  const policy = {
    project: "qcffvfbpzvpwcwxwjyro",
    normal: {
      envSha256: sha256(input.worker),
      host,
      login: "masarifi_worker_login",
      overlay: { MASARIFI_PROCESS_KIND: "worker" },
    },
    bootstrap: { envSha256: sha256(input.bootstrap), host, login: "postgres" },
    tls: {
      extraCaCertsPath: "/etc/ssl/certs/masarifi-database-ca.crt",
      caSha256: sha256(caBytes),
    },
  };
  const constructed = [];
  const literalPolicy = {
    NODE_ENV: "test",
    MASARIFI_PROCESS_KIND: "api",
    DATABASE_URL: apiUrl,
    MASARIFI_DATABASE_POOL_MAX: 10,
    MASARIFI_RECENT_AUTH_MAX_AGE_SECONDS: 600,
    MASARIFI_LEDGER_RECENT_AUTH_THRESHOLDS: null,
    SUPABASE_URL: "https://qcffvfbpzvpwcwxwjyro.supabase.co",
    MASARIFI_STAGING_PLANNING_REPAIR_OWNER_ID: null,
    NODE_EXTRA_CA_CERTS: null,
    NODE_TLS_REJECT_UNAUTHORIZED: null,
  };
  policy.api = {
    envSha256: sha256(input.api),
    host,
    login: "synthetic_api_login",
    overlay: { MASARIFI_PROCESS_KIND: "api" },
    normalizedPolicySha256: sha256(JSON.stringify(literalPolicy)),
  };
  class Client {
    constructor(options) {
      constructed.push(options);
      this.options = options;
    }
  }
  return {
    input,
    policy,
    normalUrl,
    apiUrl,
    bootstrapUrl,
    constructed,
    runtime: {
      validateEnvironment,
      Client,
      trust: { extraCaCertsPath: policy.tls.extraCaCertsPath, caBytes },
    },
  };
}

module.exports = { configFixture };
