const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { createHash } = require("node:crypto");
const { createRequire } = require("node:module");
const {
  createGuardedExportContext,
  MANIFEST,
  MAX_BYTES,
  MAX_ENTRIES,
  RETENTION_HOURS,
  ORIGINAL_CLAIM,
} = require("./guarded-export.cjs");
const product = fs.existsSync("/app/dist/src/security/security.worker.js")
  ? "/app/dist/src"
  : path.resolve(__dirname, "../../../apps/api/dist/src");
const apiRequire = createRequire(path.resolve(product, "../../package.json"));
apiRequire("reflect-metadata");
const { SecurityWorkerService } = require(
  path.join(product, "security/security.worker"),
);
const { SecurityRepository } = require(
  path.join(product, "security/security.repository"),
);
const { IdentityPrivacyHandler } = require(
  path.join(product, "identity/identity-privacy.handler"),
);
const { TrackingPrivacyHandler } = require(
  path.join(product, "tracking/tracking-privacy.handler"),
);
const { AiPrivacyHandler } = require(
  path.join(product, "ai/ai-privacy.handler"),
);
const { EngagementPrivacyHandler } = require(
  path.join(product, "engagement/engagement-privacy.handler"),
);
const { ExportStorage } = require(
  path.join(product, "security/export-storage"),
);
const owner = "synthetic-privacy-owner";
const ownerSha256 = createHash("sha256").update(owner).digest("hex");
const requestId = "00000000-0000-4000-8000-000000000001";
const policy = {
  ownerSha256,
  requestId,
  notBefore: "2026-10-29T20:00:00.000Z",
  deadline: "2026-10-29T20:10:00.000Z",
  maximumJobs: 1,
  sessionId: "synthetic-private-export-only",
};
const now = () => new Date("2026-10-29T20:00:10.000Z");
const unavailable = new Proxy(
  {},
  {
    get() {
      throw Error("UNUSED_EXTERNAL_CAPABILITY");
    },
  },
);
const manifest = ["ai@1", "engagement@1", "identity@1", "tracking@1"];
function config() {
  return {
    get: (key) =>
      key === "MASARIFI_PRIVACY_HANDLER_MANIFEST" ? manifest : undefined,
    getRequired: () => {
      throw Error("UNEXPECTED_CONFIGURATION");
    },
  };
}
function makeContext(reserve) {
  return createGuardedExportContext(policy, reserve, now);
}
test("the actual export worker must pin one approved request and owner before attempting a claim", async () => {
  const events = [],
    calls = [];
  const raw = {
    withClient: (callback) =>
      callback({
        query: async (sql, values = []) => {
          calls.push({ sql, values });
          events.push("sql");
          return { rows: [] };
        },
      }),
  };
  const context = makeContext((id) => events.push("reserve:" + id));
  const pool = context.pool(raw);
  const worker = new SecurityWorkerService(
    new SecurityRepository(pool),
    unavailable,
    new IdentityPrivacyHandler(pool, unavailable),
    new TrackingPrivacyHandler(pool, unavailable),
    new AiPrivacyHandler(pool, unavailable),
    new EngagementPrivacyHandler(pool, unavailable),
    config(),
    unavailable,
  );
  await worker.runJob("privacy.export-generate");
  const claim = calls.find((value) => value.sql.includes("with selected as"));
  assert.ok(claim, "Actual worker claim SQL must be observed");
  assert.equal(
    claim.values[0],
    requestId,
    "An unscoped claim cannot reach the database",
  );
  assert.equal(
    claim.values[1],
    ownerSha256,
    "Owner hash must bind the actual database claim",
  );
  assert.match(
    claim.sql,
    /scope=\$5::jsonb/,
    "Hosted scope is jsonb, not a PostgreSQL array",
  );
  assert.equal(claim.values[4], JSON.stringify(MANIFEST));
  assert.ok(
    events.includes("reserve:" + requestId),
    "Durable consumption precedes the claim, including uncertainty",
  );
});

function fixture(options = {}) {
  const calls = [],
    storageCalls = [],
    events = [];
  let zip = Buffer.alloc(0);
  const context = createGuardedExportContext(
    policy,
    (id) => events.push("reserve:" + id),
    options.now || now,
  );
  const raw = {
    withClient: (callback) =>
      callback({
        query: async (sql, values = []) => {
          calls.push({ sql, values });
          if (sql.includes("with selected as")) {
            events.push("claim");
            if (options.claimError) throw options.claimError;
            return {
              rows: [
                {
                  id: requestId,
                  user_id: options.returnedOwner || owner,
                  scope: options.returnedScope || [...MANIFEST],
                },
              ],
              rowCount: 1,
            };
          }
          if (sql.startsWith("update private.privacy_export_requests"))
            return { rows: [], rowCount: 1 };
          if (sql.includes("from public.profiles"))
            return { rows: [{ id: owner, status: "active" }], rowCount: 1 };
          return { rows: [], rowCount: 0 };
        },
      }),
  };
  const pool = options.withoutGuards ? raw : context.pool(raw);
  const settings = {
    SUPABASE_URL: "https://qcffvfbpzvpwcwxwjyro.supabase.co",
    SUPABASE_SERVICE_ROLE_KEY: "synthetic-not-a-credential",
    MASARIFI_EXPORT_MAX_BYTES: MAX_BYTES,
    MASARIFI_EXPORT_MAX_ENTRIES: MAX_ENTRIES,
    MASARIFI_EXPORT_RETENTION_HOURS: RETENTION_HOURS,
  };
  const configuration = {
    get: (key) =>
      key === "MASARIFI_PRIVACY_HANDLER_MANIFEST"
        ? [...MANIFEST]
        : settings[key],
    getRequired: (key) => {
      assert.ok(Object.hasOwn(settings, key), key);
      return settings[key];
    },
  };
  const rawFetcher = async (url, input) => {
    storageCalls.push({
      url: url.toString(),
      method: input.method,
      redirect: input.redirect,
    });
    if (!options.withoutGuards) assert.equal(input.redirect, "error");
    if (input.method === "PUT") {
      const chunks = [];
      for await (const chunk of input.body) chunks.push(chunk);
      zip = Buffer.concat(chunks);
      return new Response(null, { status: options.uploadStatus || 200 });
    }
    if (input.method === "HEAD")
      return new Response(null, {
        status: 200,
        headers: {
          "content-length": options.headValue
            ? options.headValue(zip.length)
            : String(zip.length + (options.badHead ? 1 : 0)),
        },
      });
    return new Response(null, { status: 204 });
  };
  const fetcher = options.withoutGuards
    ? rawFetcher
    : context.fetch(rawFetcher);
  const worker = new SecurityWorkerService(
    new SecurityRepository(pool),
    new ExportStorage(configuration, fetcher),
    new IdentityPrivacyHandler(pool, unavailable),
    new TrackingPrivacyHandler(pool, unavailable),
    new AiPrivacyHandler(pool, unavailable),
    new EngagementPrivacyHandler(pool, unavailable),
    configuration,
    unavailable,
  );
  return { context, pool, worker, calls, storageCalls, events, zip: () => zip };
}
async function admit(value) {
  await value.pool.withClient(async (client) => {
    await client.query("begin");
    await client.query("set local role masarifi_worker");
    await client.query(ORIGINAL_CLAIM);
    await client.query("commit");
  });
}
test("the actual worker, four existing handlers, ZIP packager and storage finish only the admitted export", async () => {
  const value = fixture();
  await value.worker.runJob("privacy.export-generate");
  assert.equal(value.context.progress.status, "ready");
  assert.equal(value.context.progress.event, true);
  assert.equal(value.context.progress.reads, 32);
  assert.deepEqual(value.events, ["reserve:" + requestId, "claim"]);
  assert.deepEqual(
    value.storageCalls.map((call) => call.method),
    ["PUT", "HEAD"],
  );
  assert.equal(value.zip().subarray(0, 4).toString("hex"), "504b0304");
  assert.equal(value.context.progress.bytes, value.zip().length);
  assert.ok(value.zip().length > 0 && value.zip().length <= MAX_BYTES);
  for (const call of value.calls.filter(
    (call) => call.sql.includes("export_") || call.sql.includes("from public."),
  )) {
    if (
      !call.sql.includes("with selected as") &&
      !call.sql.startsWith("update") &&
      !call.sql.includes("enqueue_outbox")
    )
      assert.equal(call.values[0], owner);
  }
});
test("a failed or uncertain claim stays consumed and cannot be replayed", async () => {
  const value = fixture({
    claimError: Error("synthetic-uncertain-connection"),
  });
  await assert.rejects(admit(value), /synthetic-uncertain/);
  await assert.rejects(admit(value), /EXPORT_QA_ALREADY_CONSUMED/);
  assert.equal(
    value.calls.filter((call) => call.sql.includes("with selected as")).length,
    1,
  );
  assert.equal(value.context.progress.consumed, true);
});
test("foreign owner or manifest results never reach a data handler or storage", async () => {
  for (const options of [
    { returnedOwner: "other-synthetic-owner" },
    { returnedScope: ["identity@1"] },
  ]) {
    const value = fixture(options);
    await assert.rejects(
      value.worker.runJob("privacy.export-generate"),
      /EXPORT_QA_CLAIM/,
    );
    assert.equal(value.context.progress.admitted, false);
    assert.equal(value.storageCalls.length, 0);
  }
});
test("arbitrary SQL and foreign-owner reads are refused before the underlying client", async () => {
  const value = fixture();
  await admit(value);
  for (const [sql, values] of [
    ["delete from public.profiles", []],
    [
      "select private.export_tracking_batch($1,$2,$3::uuid,500) value",
      ["another-owner", "history", null],
    ],
    [
      "select private.export_engagement_batch($1,$2,$3::uuid,500) value",
      [owner, "unknown-resource", null],
    ],
  ]) {
    const before = value.calls.length;
    await assert.rejects(
      value.pool.withClient(async (client) => {
        await client.query("begin");
        await client.query("set local role masarifi_worker");
        await client.query(sql, values);
      }),
      /EXPORT_QA_(SQL_FORBIDDEN|READ_SCOPE)/,
    );
    assert.equal(value.calls.length, before + 2);
  }
});
test("a conflicting pre-existing object cannot be deleted by failure compensation", async () => {
  const value = fixture({ uploadStatus: 409 });
  await value.worker.runJob("privacy.export-generate");
  assert.equal(value.context.progress.status, "failed");
  assert.equal(value.context.progress.deleted, false);
  assert.deepEqual(
    value.storageCalls.map((call) => call.method),
    ["PUT"],
  );
  assert.equal(value.context.progress.event, false);
});
test("a failed integrity check can compensate only the newly created request object", async () => {
  const value = fixture({ badHead: true });
  await value.worker.runJob("privacy.export-generate");
  assert.equal(value.context.progress.status, "failed");
  assert.equal(value.context.progress.deleted, true);
  assert.equal(value.context.progress.head, false);
  assert.deepEqual(
    value.storageCalls.map((call) => call.method),
    ["PUT", "HEAD", "DELETE"],
  );
  assert.equal(new Set(value.storageCalls.map((call) => call.url)).size, 1);
  assert.equal(value.context.progress.event, false);
});
test("other storage origins, keys and signing operations have no network side effect", async () => {
  const value = fixture();
  await admit(value);
  let dispatched = 0;
  const fetcher = value.context.fetch(async () => {
    dispatched++;
    return new Response(null);
  });
  for (const target of [
    "https://example.invalid/storage/v1/object/report-exports/exports/" +
      requestId +
      "/privacy.zip",
    "https://qcffvfbpzvpwcwxwjyro.supabase.co/storage/v1/object/sign/report-exports/exports/" +
      requestId +
      "/privacy.zip",
    "https://qcffvfbpzvpwcwxwjyro.supabase.co/storage/v1/object/report-exports/exports/00000000-0000-4000-8000-000000000002/privacy.zip",
  ])
    await assert.rejects(
      fetcher(target, { method: "GET" }),
      /EXPORT_QA_STORAGE_SCOPE/,
    );
  assert.equal(dispatched, 0);
});
test("expired windows and larger budgets are refused before a claim", async () => {
  assert.throws(
    () =>
      createGuardedExportContext({ ...policy, maximumJobs: 2 }, () => {}, now),
    /EXPORT_QA_POLICY/,
  );
  const value = fixture({ now: () => new Date("2026-10-29T20:10:00.001Z") });
  await assert.rejects(admit(value), /EXPORT_QA_DEADLINE/);
  assert.equal(
    value.calls.filter((call) => call.sql.includes("with selected as")).length,
    0,
  );
  assert.equal(value.context.progress.consumed, false);
});

test("a non-decimal HEAD byte count cannot establish a ready export", async () => {
  const value = fixture({ headValue: (bytes) => "0x" + bytes.toString(16) });
  await value.worker.runJob("privacy.export-generate");
  assert.equal(value.context.progress.status, "failed");
  assert.equal(value.context.progress.head, false);
  assert.equal(value.context.progress.event, false);
});

test("a failed durable reservation prevents the database claim", async () => {
  let claims = 0;
  const context = createGuardedExportContext(
    policy,
    () => {
      throw Error("synthetic-journal-fsync-failure");
    },
    now,
  );
  const pool = context.pool({
    withClient: (callback) =>
      callback({
        query: async (sql) => {
          if (sql.includes("with selected as")) claims++;
          return { rows: [] };
        },
      }),
  });
  await assert.rejects(
    pool.withClient(async (client) => {
      await client.query("begin");
      await client.query("set local role masarifi_worker");
      await client.query(ORIGINAL_CLAIM);
    }),
    /synthetic-journal-fsync-failure/,
  );
  assert.equal(claims, 0);
});

test("the underlying worker itself preserves an object after a rejected upload", async () => {
  const value = fixture({ withoutGuards: true, uploadStatus: 409 });
  await value.worker.runJob("privacy.export-generate");
  assert.deepEqual(
    value.storageCalls.map((call) => call.method),
    ["PUT"],
  );
  assert.equal(
    value.calls.filter((call) => call.sql.includes("enqueue_outbox_event"))
      .length,
    0,
  );
});

test("the underlying private storage itself disables redirects for credential-bearing calls", async () => {
  const value = fixture({ withoutGuards: true });
  await value.worker.runJob("privacy.export-generate");
  assert.deepEqual(
    value.storageCalls.map((call) => call.method),
    ["PUT", "HEAD"],
  );
  assert.ok(value.storageCalls.every((call) => call.redirect === "error"));
});
