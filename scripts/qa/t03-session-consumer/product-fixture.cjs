const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");
const { createRequire } = require("node:module");
const { productSchema } = require("./product-schema.cjs");
const { captureEffectiveCatalog } = require("./effective-catalog.cjs");
const { sha256 } = require("../t03-exact-sync/manifest.cjs");
const root = path.resolve(__dirname, "../../..");
const fixtureRoot = path.join(
  root,
  ".superpowers/sdd/2026-10-25-astra-readiness-remediation/T03/runner-prep/pg17",
);
const receiptPath = path.resolve(process.env.T03_FIXTURE_RECEIPT_PATH ?? "");
assert.ok(
  path.relative(fixtureRoot, receiptPath) &&
    !path.relative(fixtureRoot, receiptPath).startsWith("..") &&
    !path.isAbsolute(path.relative(fixtureRoot, receiptPath)),
  "explicit owned fixture receipt required",
);
const receipt = JSON.parse(fs.readFileSync(receiptPath, "utf8"));
const originalBytes = fs.readFileSync(
  path.join(fixtureRoot, "owned-process.json"),
);
assert.equal(
  sha256(originalBytes),
  "c4503d12c63fcb73fcbb1da5e15ea31c4848ccce461b1fd41e1791ccd0edf4d0",
);
const original = JSON.parse(originalBytes);
assert.equal(receipt.status, "verified");
assert.equal(receipt.port, 55473);
assert.equal(receipt.listen, "127.0.0.1");
assert.equal(
  path.resolve(receipt.dataDirectory),
  path.join(fixtureRoot, "data"),
);
assert.equal(receipt.binary, original.binary);
assert.equal(receipt.systemIdentifier, original.systemIdentifier);
assert.equal(
  fs
    .readFileSync(path.join(receipt.dataDirectory, "PG_VERSION"), "utf8")
    .trim(),
  "17",
);
assert.ok(Number.isSafeInteger(receipt.pid) && receipt.pid > 0);
// Every iteration gets a new explicit synthetic database; no prior DB is reset or dropped.
const database = `t03_product_ledger_synthetic_${receipt.pid}`;
const apiRequire = createRequire(path.join(root, "apps/api/package.json"));
apiRequire("ts-node").register({
  project: path.join(root, "apps/api/tsconfig.json"),
});
const { Client } = apiRequire("pg");

async function connect(user, name = database) {
  const client = new Client({
    host: "127.0.0.1",
    port: 55473,
    database: name,
    user,
    password: "",
    ssl: false,
    connectionTimeoutMillis: 1000,
    query_timeout: 8000,
  });
  await client.connect();
  return client;
}

async function initialize() {
  const control = await connect("t03_owner", "postgres");
  try {
    const identity = (
      await control.query(
        "select current_setting('server_version_num')::int version,current_setting('data_directory') data,current_setting('listen_addresses') listen,inet_server_port() port,(pg_control_system()).system_identifier::text system,pg_postmaster_start_time() started",
      )
    ).rows[0];
    assert.ok(identity.version >= 170000 && identity.version < 180000);
    assert.equal(
      path.resolve(identity.data),
      path.resolve(receipt.dataDirectory),
    );
    assert.equal(identity.listen, "127.0.0.1");
    assert.equal(identity.port, 55473);
    assert.equal(identity.system, receipt.systemIdentifier);
    assert.ok(
      Math.abs(identity.started.getTime() - Date.parse(receipt.start)) < 2000,
    );
    assert.equal(
      (
        await control.query("select 1 from pg_database where datname=$1", [
          database,
        ])
      ).rowCount,
      0,
      "never reset or adopt a prior product fixture database",
    );
    await control.query(`create database ${database}`);
  } finally {
    await control.end();
  }
  const admin = await connect("t03_owner");
  try {
    await admin.query("create schema extensions");
    const schema = productSchema();
    fs.writeFileSync(
      path.join(receipt.runDirectory, "product-schema-selection.json"),
      JSON.stringify(schema, null, 2),
      { flag: "wx" },
    );
    for (const file of schema.files) {
      assert.equal(
        sha256(fs.readFileSync(path.join(root, file.path))),
        file.sha256,
      );
      await admin.query("begin");
      try {
        await admin.query(
          "grant masarifi_migration to current_user with inherit false,set true",
        );
        let current = "admin";
        for (const statement of schema.applied.filter(
          (entry) => entry.file === file.path,
        )) {
          if (statement.executionRole !== current) {
            await admin.query(
              statement.executionRole === "migration"
                ? "set local role masarifi_migration"
                : "reset role",
            );
            current = statement.executionRole;
          }
          try {
            await admin.query(statement.sql);
          } catch (error) {
            error.message = `${file.path}:statement${statement.statement}:${error.code ?? "ERROR"}:${error.message}`;
            throw error;
          }
        }
        await admin.query("reset role");
        await admin.query(
          "revoke masarifi_migration from current_user granted by current_user",
        );
        await admin.query("commit");
      } catch (error) {
        await admin.query("rollback");
        throw error;
      }
    }
    assert.equal(
      (await admin.query("select to_regnamespace('pgmq') present")).rows[0]
        .present,
      null,
    );
    await admin.query(
      "grant usage on schema public,private,audit,extensions to t03_bootstrap",
    );
    await admin.query(
      "grant select on all tables in schema public,private,audit to t03_bootstrap",
    );
    const reader = await connect("t03_bootstrap");
    try {
      await reader.query("begin read only");
      const capabilities = (
        await reader.query(
          `select has_schema_privilege(current_user,'public','USAGE') and has_schema_privilege(current_user,'private','USAGE') and has_schema_privilege(current_user,'audit','USAGE') and has_schema_privilege(current_user,'extensions','USAGE') "schemaUsage",has_table_privilege(current_user,'public.client_mutations','SELECT') "globalRead",row_security_active('public.client_mutations'::regclass) filtered,pg_has_role(current_user,'masarifi_worker','SET') "canSetWorker",has_function_privilege(current_user,'private.claim_client_mutations(text,integer,integer)','EXECUTE') "canClaim"`,
        )
      ).rows[0];
      assert.deepEqual(
        capabilities,
        {
          schemaUsage: true,
          globalRead: true,
          filtered: false,
          canSetWorker: false,
          canClaim: false,
        },
        "representative bootstrap reader namespace/read access never transfers worker privileges",
      );
    } finally {
      try {
        await reader.query("rollback");
      } finally {
        await reader.end();
      }
    }
    fs.writeFileSync(
      path.join(receipt.runDirectory, "product-database.json"),
      JSON.stringify(
        {
          database,
          systemIdentifier: receipt.systemIdentifier,
          selectedMigrationFiles: schema.files,
          statements: schema.applied.length,
          omissions: schema.omitted.length,
          pgmqAbsent: true,
        },
        null,
        2,
      ),
      { flag: "wx" },
    );
    await captureEffectiveCatalog(
      admin,
      receipt.runDirectory,
      database,
      receipt.systemIdentifier,
    );
    return admin;
  } catch (error) {
    await admin.end();
    throw error;
  }
}

module.exports = { root, receipt, database, apiRequire, connect, initialize };
