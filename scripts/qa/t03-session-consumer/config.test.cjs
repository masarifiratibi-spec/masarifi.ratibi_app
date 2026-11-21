const { test } = require("node:test");
const assert = require("node:assert/strict");
const { preparePrivateConfiguration } = require("./config.cjs");
const { parseEnvData } = require("./config.cjs");
const { configFixture } = require("./config-fixture.cjs");
const { sha256 } = require("../t03-exact-sync/manifest.cjs");

test("worker/bootstrap credentials remain separate and neither configuration creates a connection", () => {
  const input = {
    worker: Buffer.from("DATABASE_URL=worker"),
    bootstrap: Buffer.from("DATABASE_URL=bootstrap"),
  };
  assert.throws(
    () => preparePrivateConfiguration(input, {}),
    /QA_CONFIG_POLICY_INCOMPLETE/,
  );
});

test("only worker data reaches the real validated normal configuration; bootstrap remains a separate deferred client", () => {
  const f = configFixture();
  const prepared = preparePrivateConfiguration(f.input, f.policy, f.runtime);
  assert.equal(prepared.normalConfig.get("DATABASE_URL"), f.normalUrl);
  assert.equal(prepared.normalConfig.get("MIGRATION_ONLY"), undefined);
  assert.equal(prepared.normalConfig.get("MASARIFI_PROCESS_KIND"), "worker");
  assert.equal(
    prepared.normalConfig.getRequired("MASARIFI_SYNC_MAX_ATTEMPTS"),
    10,
  );
  assert.equal(prepared.apiConfig.get("DATABASE_URL"), f.apiUrl);
  assert.equal(prepared.apiConfig.get("MASARIFI_PROCESS_KIND"), "api");
  assert.equal(prepared.apiConfig.get("MIGRATION_ONLY"), undefined);
  assert.notEqual(
    prepared.apiConfig.get("DATABASE_URL"),
    prepared.normalConfig.get("DATABASE_URL"),
  );
  assert.equal(f.constructed.length, 0);
  const bootstrap = prepared.createBootstrapClient();
  assert.equal(bootstrap.options.connectionString, f.bootstrapUrl);
  assert.equal(
    Object.hasOwn(bootstrap.options, "ssl"),
    false,
    "retain verify-full URL and exact Node extra-CA trust without override",
  );
  assert.equal(bootstrap.options.connectionTimeoutMillis, 1000);
  assert.equal(bootstrap.options.query_timeout, 5000);
  assert.equal(JSON.stringify(prepared).includes("SYNTHETIC_"), false);
});

test("environment input is data only and duplicate keys fail closed", () => {
  const parsed = parseEnvData(Buffer.from('A="$(not-executed)"\nB=${A}\n'));
  assert.equal(parsed.A, "$(not-executed)");
  assert.equal(parsed.B, "${A}");
  assert.throws(
    () => parseEnvData(Buffer.from("DATABASE_URL=one\nDATABASE_URL=two")),
    /QA_ENV_DUPLICATE_KEY/,
  );
});

for (const [name, change, expected] of [
  [
    "wrong config hash",
    (f) => {
      f.policy.normal.envSha256 = "0".repeat(64);
    },
    /QA_CONFIG_HASH_MISMATCH/,
  ],
  [
    "wrong CA",
    (f) => {
      f.runtime.trust.caBytes = Buffer.from("other");
    },
    /QA_CA_TRUST_MISMATCH/,
  ],
  [
    "missing Node extra CA",
    (f) => {
      f.runtime.trust.extraCaCertsPath = undefined;
    },
    /QA_CA_TRUST_MISMATCH/,
  ],
  [
    "globally disabled TLS",
    (f) => {
      f.runtime.trust.nodeTlsRejectUnauthorized = "0";
    },
    /QA_TLS_VERIFICATION_DISABLED/,
  ],
  [
    "weak URL TLS",
    (f) => {
      f.input.worker = Buffer.from(
        f.input.worker
          .toString()
          .replace("sslmode=verify-full", "sslmode=disable"),
      );
      f.policy.normal.envSha256 = sha256(f.input.worker);
    },
    /QA_CONNECTION_TLS_INVALID/,
  ],
  [
    "query authority override",
    (f) => {
      f.input.worker = Buffer.from(
        f.input.worker
          .toString()
          .replace("sslmode=verify-full", "sslmode=verify-full&user=postgres"),
      );
      f.policy.normal.envSha256 = sha256(f.input.worker);
    },
    /QA_CONNECTION_TLS_INVALID/,
  ],
  [
    "bootstrap mixed into worker",
    (f) => {
      f.input.worker = Buffer.from(
        f.input.worker.toString().replace(f.normalUrl, f.bootstrapUrl),
      );
      f.policy.normal.envSha256 = sha256(f.input.worker);
    },
    /QA_CONNECTION_IDENTITY_MISMATCH/,
  ],
  [
    "missing API config",
    (f) => {
      delete f.input.api;
    },
    /QA_ENV_SIZE_INVALID/,
  ],
  [
    "bootstrap mixed into API",
    (f) => {
      f.input.api = Buffer.from(
        f.input.api.toString().replace(f.apiUrl, f.bootstrapUrl),
      );
      f.policy.api.envSha256 = sha256(f.input.api);
    },
    /QA_CONNECTION_IDENTITY_MISMATCH/,
  ],
  [
    "API normal policy changed",
    (f) => {
      f.policy.api.normalizedPolicySha256 = "0".repeat(64);
    },
    /QA_API_POLICY_MISMATCH/,
  ],
])
  test(`${name} aborts before creating clients and does not expose credentials`, () => {
    const f = configFixture();
    change(f);
    let error;
    try {
      preparePrivateConfiguration(f.input, f.policy, f.runtime);
    } catch (caught) {
      error = caught;
    }
    assert.ok(error, "mismatched input must fail before client creation");
    assert.match(error.message, expected);
    assert.equal(error.stack.includes("SYNTHETIC_WORKER_SECRET"), false);
    assert.equal(error.stack.includes("SYNTHETIC_BOOTSTRAP_SECRET"), false);
    assert.equal(error.stack.includes("SYNTHETIC_API_SECRET"), false);
    assert.equal(f.constructed.length, 0);
  });
