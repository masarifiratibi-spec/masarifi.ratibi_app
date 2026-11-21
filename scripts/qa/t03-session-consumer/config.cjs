const { parseEnv } = require("node:util");
const { sha256, requireCondition } = require("../t03-exact-sync/manifest.cjs");

const CA_PATH = "/etc/ssl/certs/masarifi-database-ca.crt";
const API_POLICY_KEYS = [
  "NODE_ENV",
  "MASARIFI_PROCESS_KIND",
  "DATABASE_URL",
  "MASARIFI_DATABASE_POOL_MAX",
  "MASARIFI_RECENT_AUTH_MAX_AGE_SECONDS",
  "MASARIFI_LEDGER_RECENT_AUTH_THRESHOLDS",
  "SUPABASE_URL",
  "MASARIFI_STAGING_PLANNING_REPAIR_OWNER_ID",
  "NODE_EXTRA_CA_CERTS",
  "NODE_TLS_REJECT_UNAUTHORIZED",
];

function policyHash(environment) {
  const normalize = (value) =>
    value === undefined
      ? null
      : Array.isArray(value)
        ? value.map(normalize)
        : value && typeof value === "object"
          ? Object.fromEntries(
              Object.keys(value)
                .sort()
                .map((key) => [key, normalize(value[key])]),
            )
          : value;
  return sha256(
    JSON.stringify(
      Object.fromEntries(
        API_POLICY_KEYS.map((key) => [key, normalize(environment[key])]),
      ),
    ),
  );
}

function parseEnvData(bytes) {
  requireCondition(
    Buffer.isBuffer(bytes) && bytes.length > 0 && bytes.length <= 65536,
    "QA_ENV_SIZE_INVALID",
  );
  let text;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    throw new Error("QA_ENV_ENCODING_INVALID");
  }
  requireCondition(!text.includes("\0"), "QA_ENV_ENCODING_INVALID");
  const keys = [
    ...text.matchAll(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=/gm),
  ].map((entry) => entry[1]);
  requireCondition(new Set(keys).size === keys.length, "QA_ENV_DUPLICATE_KEY");
  requireCondition(
    !keys.some((key) =>
      ["__proto__", "constructor", "prototype"].includes(key),
    ),
    "QA_ENV_KEY_INVALID",
  );
  try {
    return Object.freeze(parseEnv(text));
  } catch {
    throw new Error("QA_ENV_SYNTAX_INVALID");
  }
}

function assertPolicy(policy) {
  requireCondition(
    policy?.project === "qcffvfbpzvpwcwxwjyro" &&
      policy.normal &&
      policy.api &&
      policy.bootstrap &&
      policy.tls,
    "QA_CONFIG_POLICY_INCOMPLETE",
  );
  for (const profile of [policy.normal, policy.api, policy.bootstrap]) {
    requireCondition(
      /^[a-f0-9]{64}$/.test(profile.envSha256 ?? "") &&
        typeof profile.host === "string" &&
        profile.host.length > 0 &&
        typeof profile.login === "string" &&
        profile.login.length > 0,
      "QA_CONFIG_POLICY_INCOMPLETE",
    );
  }
  requireCondition(
    policy.normal.login === "masarifi_worker_login" &&
      policy.bootstrap.login === "postgres",
    "QA_CONFIG_IDENTITY_POLICY",
  );
  requireCondition(
    policy.normal.overlay &&
      Object.keys(policy.normal.overlay).length === 1 &&
      policy.normal.overlay.MASARIFI_PROCESS_KIND === "worker",
    "QA_REVIEWED_WORKER_OVERLAY_REQUIRED",
  );
  requireCondition(
    /^[a-z][a-z0-9_]+$/.test(policy.api.login) &&
      ![policy.normal.login, policy.bootstrap.login].includes(
        policy.api.login,
      ) &&
      policy.api.overlay &&
      Object.keys(policy.api.overlay).length === 1 &&
      policy.api.overlay.MASARIFI_PROCESS_KIND === "api",
    "QA_REVIEWED_API_POLICY_REQUIRED",
  );
  requireCondition(
    /^[a-f0-9]{64}$/.test(policy.api.normalizedPolicySha256 ?? ""),
    "QA_REVIEWED_API_POLICY_REQUIRED",
  );
  requireCondition(
    policy.tls.extraCaCertsPath === CA_PATH &&
      /^[a-f0-9]{64}$/.test(policy.tls.caSha256 ?? ""),
    "QA_TLS_POLICY_INVALID",
  );
}

function assertTrust(trust, policy) {
  requireCondition(
    trust &&
      trust.extraCaCertsPath === CA_PATH &&
      Buffer.isBuffer(trust.caBytes) &&
      sha256(trust.caBytes) === policy.tls.caSha256,
    "QA_CA_TRUST_MISMATCH",
  );
  requireCondition(
    trust.nodeTlsRejectUnauthorized === undefined ||
      trust.nodeTlsRejectUnauthorized === "1",
    "QA_TLS_VERIFICATION_DISABLED",
  );
}

function assertConnection(uri, profile, project) {
  let parsed;
  try {
    parsed = new URL(uri);
  } catch {
    throw new Error("QA_CONNECTION_URI_INVALID");
  }
  requireCondition(
    typeof uri === "string" &&
      uri === uri.trim() &&
      parsed.protocol === "postgresql:" &&
      parsed.port === "5432" &&
      parsed.pathname === "/postgres" &&
      !parsed.hash,
    "QA_CONNECTION_TARGET_INVALID",
  );
  let login;
  try {
    login = decodeURIComponent(parsed.username);
  } catch {
    throw new Error("QA_CONNECTION_IDENTITY_INVALID");
  }
  requireCondition(
    parsed.hostname === profile.host &&
      [profile.login, `${profile.login}.${project}`].includes(login),
    "QA_CONNECTION_IDENTITY_MISMATCH",
  );
  requireCondition(
    parsed.hostname.includes(project) || login.endsWith(`.${project}`),
    "QA_CONNECTION_PROJECT_MISMATCH",
  );
  const query = [...parsed.searchParams];
  requireCondition(
    query.length === 1 &&
      query[0][0] === "sslmode" &&
      query[0][1] === "verify-full",
    "QA_CONNECTION_TLS_INVALID",
  );
}

function privateConfig(environment) {
  return Object.freeze({
    get: (key) => environment[key],
    getRequired(key) {
      const value = environment[key];
      requireCondition(
        value !== undefined && value !== "",
        "QA_WORKER_CONFIG_MISSING",
      );
      return value;
    },
  });
}

function preparePrivateConfiguration(input, policy, runtime) {
  assertPolicy(policy);
  requireCondition(
    input &&
      Buffer.isBuffer(input.worker) &&
      Buffer.isBuffer(input.api) &&
      Buffer.isBuffer(input.bootstrap),
    "QA_ENV_SIZE_INVALID",
  );
  requireCondition(
    runtime &&
      typeof runtime.validateEnvironment === "function" &&
      typeof runtime.Client === "function",
    "QA_CONFIG_RUNTIME_UNVERIFIED",
  );
  requireCondition(
    sha256(input.worker) === policy.normal.envSha256 &&
      sha256(input.api) === policy.api.envSha256 &&
      sha256(input.bootstrap) === policy.bootstrap.envSha256,
    "QA_CONFIG_HASH_MISMATCH",
  );
  assertTrust(runtime.trust, policy);
  const worker = { ...parseEnvData(input.worker), ...policy.normal.overlay };
  const api = { ...parseEnvData(input.api), ...policy.api.overlay };
  const bootstrap = parseEnvData(input.bootstrap);
  requireCondition(
    worker.MASARIFI_PROCESS_KIND === "worker" &&
      !Object.keys(worker).some((key) =>
        /BOOTSTRAP|MIGRATION_DATABASE/.test(key),
      ),
    "QA_CONFIG_SEPARATION_INVALID",
  );
  requireCondition(
    api.MASARIFI_PROCESS_KIND === "api" &&
      !Object.keys(api).some((key) => /BOOTSTRAP|MIGRATION_DATABASE/.test(key)),
    "QA_CONFIG_SEPARATION_INVALID",
  );
  assertConnection(worker.DATABASE_URL, policy.normal, policy.project);
  assertConnection(bootstrap.DATABASE_URL, policy.bootstrap, policy.project);
  assertConnection(api.DATABASE_URL, policy.api, policy.project);
  requireCondition(
    new Set([worker.DATABASE_URL, api.DATABASE_URL, bootstrap.DATABASE_URL])
      .size === 3,
    "QA_CONFIG_SEPARATION_INVALID",
  );
  let normal;
  let apiNormal;
  try {
    normal = Object.freeze(runtime.validateEnvironment(worker));
  } catch {
    throw new Error("QA_WORKER_CONFIG_INVALID");
  }
  try {
    apiNormal = Object.freeze(runtime.validateEnvironment(api));
  } catch {
    throw new Error("QA_API_CONFIG_INVALID");
  }
  requireCondition(
    policyHash(apiNormal) === policy.api.normalizedPolicySha256,
    "QA_API_POLICY_MISMATCH",
  );
  return Object.freeze({
    normalConfig: privateConfig(normal),
    apiConfig: privateConfig(apiNormal),
    createBootstrapClient: () =>
      new runtime.Client({
        connectionString: bootstrap.DATABASE_URL,
        connectionTimeoutMillis: 1000,
        query_timeout: 5000,
        application_name: "masarifi-t03-qa-bootstrap",
      }),
    fingerprints: Object.freeze({
      worker: policy.normal.envSha256,
      api: policy.api.envSha256,
      bootstrap: policy.bootstrap.envSha256,
      ca: policy.tls.caSha256,
    }),
  });
}

module.exports = { CA_PATH, parseEnvData, preparePrivateConfiguration };
