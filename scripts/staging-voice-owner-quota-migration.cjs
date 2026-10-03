// Staging-only activation through the existing checksum/history/lock/transaction runner.
// This is not an inference runner. Never logs connection strings or owner IDs.
const assert = require("node:assert/strict");
const { createHash } = require("node:crypto");
const { existsSync } = require("node:fs");
const path = require("node:path");
const { createRequire } = require("node:module");
const databasePin =
  "aa628a4b7905163827e85a8b5ac6bafa7e37e150686a192913090a615f77e7c2";
const ownerPin =
  "e8a7dda4e09c741322e4e2ee3d1f4c4cb8d1950749e0f524854e560fc074c2c3";
const migrationVersion = "20261003083000";
const sha = (value) =>
  createHash("sha256").update(JSON.stringify(value)).digest("hex");

function assertStagingTarget(connectionString) {
  const u = new URL(connectionString);
  assert(
    ["postgres:", "postgresql:"].includes(u.protocol),
    "CONNECTION_PROTOCOL_DENIED",
  );
  for (const key of u.searchParams.keys()) {
    assert(
      ["sslmode", "sslrootcert"].includes(key),
      "CONNECTION_QUERY_OVERRIDE_DENIED",
    );
  }
  assert.equal(
    sha({
      hostname: u.hostname,
      port: u.port || "5432",
      username: decodeURIComponent(u.username),
      database: u.pathname,
    }),
    databasePin,
    "STAGING_DATABASE_MISMATCH",
  );
}

async function main() {
  assertStagingTarget(process.env.DATABASE_URL);
  const expectedSha = process.argv
    .find((item) => item.startsWith("--sha="))
    ?.slice(6);
  assert(/^[a-f0-9]{40}$/.test(expectedSha || ""), "RELEASE_SHA_REQUIRED");
  assert.equal(process.env.MASARIFI_RELEASE_VERSION, expectedSha);
  assert.equal(process.env.MASARIFI_PROCESS_KIND, "migration");
  const root = existsSync("/app/dist/src")
    ? "/app/dist/src"
    : path.resolve(__dirname, "../apps/api/dist/src");
  const load = createRequire(
    path.join(root, "platform/database/pool.service.js"),
  );
  const { PoolService } = load(
    path.join(root, "platform/database/pool.service.js"),
  );
  const { MigrationRunner } = load(
    path.join(root, "platform/database/migration-runner.js"),
  );
  const pool = new PoolService({
    get: (key) =>
      ({
        DATABASE_URL: process.env.DATABASE_URL,
        MASARIFI_DATABASE_POOL_MAX: 1,
        MASARIFI_PROCESS_KIND: "migration",
      })[key],
  });
  const facts = async (client) => {
    const q = async (sql, values = []) =>
      (await client.query(sql, values)).rows;
    const owner = (
      await q(
        "select id from public.profiles where status='active' and encode(pg_catalog.sha256(pg_catalog.convert_to(id,'UTF8')),'hex')=$1",
        [ownerPin],
      )
    )[0]?.id;
    assert(owner, "ACTIVE_OWNER_MISSING");
    return {
      usage: sha(await q("select * from private.ai_usage_events order by id")),
      attempts: sha(
        await q(
          "select * from private.voice_provider_attempts order by operation_id,attempt_no",
        ),
      ),
      routes: sha(
        await q("select * from private.ai_feature_routes order by id"),
      ),
      privacy: sha(await q("select * from private.ai_providers order by id")),
      safety: sha(await q("select * from private.ai_safety_rules order by id")),
      settings: sha(
        await q(
          "select * from private.system_settings where setting_key<>'ai.voice.staging_owner_quota' order by setting_key",
        ),
      ),
      holds: await q(
        "select count(*) count,sum(estimated_cost) reserved from private.ai_usage_events where reservation_status='reserved'",
      ),
      used: Number(
        (
          await q(
            "select count(*) count from private.ai_usage_events where user_id=$1 and created_at>clock_timestamp()-interval '24 hours' and reservation_status<>'released'",
            [owner],
          )
        )[0]?.count,
      ),
      finance: sha(await q("select * from public.transactions order by id")),
      // Owner remains transient and is never emitted.
      owner,
    };
  };
  try {
    await pool.withClient(async (client) => {
      const history = (
        await client.query(
          "select version from supabase_migrations.schema_migrations order by version",
        )
      ).rows.map((row) => row.version);
      assert(
        !history.includes(migrationVersion),
        "QUOTA_MIGRATION_ALREADY_APPLIED",
      );
      assert.equal(
        history.at(-1),
        "20261001211129",
        "UNEXPECTED_STAGING_HISTORY",
      );
      const before = await facts(client);
      if (process.argv.includes("--preflight")) {
        console.log(
          JSON.stringify({
            at: new Date().toISOString(),
            mode: "read-only-quota-migration-preflight",
            databasePinned: true,
            ownerMatched: true,
            used: before.used,
            holds: before.holds,
            inferenceRequests: 0,
          }),
        );
        return;
      }
      // Session bindings are on this dedicated client and reset before release.
      // MigrationRunner starts its own transactions, so transaction-local settings here would disappear.
      await client.query(
        "select set_config('masarifi.migration_target','staging',false),set_config('masarifi.staging_voice_owner_hash',$1,false)",
        [ownerPin],
      );
      try {
        const runner = new MigrationRunner(
          { withClient: (action) => action(client) },
          { get: () => 30000 },
        );
        await runner.run(
          existsSync("/app/supabase") ? "/app" : path.resolve(__dirname, ".."),
        );
      } finally {
        await client.query(
          "select set_config('masarifi.migration_target','',false),set_config('masarifi.staging_voice_owner_hash','',false)",
        );
      }
      const after = await facts(client);
      for (const key of [
        "usage",
        "attempts",
        "routes",
        "privacy",
        "safety",
        "settings",
        "finance",
      ])
        assert.equal(after[key], before[key], `${key.toUpperCase()}_CHANGED`);
      assert.deepEqual(after.holds, before.holds, "HOLDS_CHANGED");
      let limits;
      await client.query("begin");
      try {
        await client.query(
          "grant masarifi_migration to current_user with set true, inherit false",
        );
        await client.query("set local role masarifi_migration");
        limits = (
          await client.query(
            "select private.ai_effective_rolling_limit($1,'voice_transcription') voice,private.ai_effective_rolling_limit($1,'financial_assistant') assistant,private.ai_effective_rolling_limit('unmatched-owner','voice_transcription') other",
            [after.owner],
          )
        ).rows[0];
      } finally {
        // All temporary role membership is rolled back, including on a failed check.
        await client.query("rollback");
      }
      assert.deepEqual(limits, { voice: 30, assistant: 5, other: 5 });
      console.log(
        JSON.stringify({
          at: new Date().toISOString(),
          migrationVersion,
          databasePinned: true,
          ownerMatched: true,
          limits,
          used: after.used,
          holds: after.holds,
          historicalAccountingUnchanged: true,
          controlsUnchanged: true,
          financialMutation: false,
          inferenceRequests: 0,
        }),
      );
    });
  } finally {
    await pool.onModuleDestroy();
  }
}

module.exports = { assertStagingTarget };
if (require.main === module)
  main().catch((error) => {
    console.error(
      JSON.stringify({
        stage: "governed-staging-quota-migration",
        code:
          typeof error.code === "string"
            ? error.code
            : "MIGRATION_GUARD_FAILED",
        inferenceRequests: 0,
      }),
    );
    process.exitCode = 1;
  });
