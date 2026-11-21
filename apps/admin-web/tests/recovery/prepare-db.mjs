import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
const root = fileURLToPath(new URL("../../../../", import.meta.url));
const { Client } = createRequire(path.join(root, "apps/api/package.json"))(
  "pg",
);

// Clone only the plan-owned native source-fresh database; never reset an existing database.
(async () => {
  const client = new Client({
    host: "127.0.0.1",
    port: 55442,
    user: "postgres",
    database: "postgres",
  });
  await client.connect();
  try {
    const directory = (await client.query("show data_directory")).rows[0]
      .data_directory;
    const expected = path.join(
      root,
      ".superpowers/sdd/2026-10-23-admin-dashboard-recovery/native-db/data",
    );
    if (
      path.normalize(directory).toLowerCase() !==
      path.normalize(expected).toLowerCase()
    )
      throw new Error("PLAN_OWNED_CLUSTER_REQUIRED");
    const exists =
      (
        await client.query(
          "select 1 from pg_database where datname='admin_recovery_browser'",
        )
      ).rowCount > 0;
    if (!exists)
      await client.query(
        "create database admin_recovery_browser template admin_recovery_fresh",
      );
  } finally {
    await client.end();
  }
  const browser = new Client({
    host: "127.0.0.1",
    port: 55442,
    user: "postgres",
    database: "admin_recovery_browser",
  });
  await browser.connect();
  try {
    const sources = fs
      .readdirSync(path.join(root, "supabase/migrations"))
      .filter((file) => /^\d{14}_.+\.sql$/.test(file))
      .map((file) => file.slice(0, 14));
    const applied = (
      await browser.query(
        "select version from supabase_migrations.schema_migrations",
      )
    ).rows.map((row) => row.version);
    if (
      sources.length !== applied.length ||
      sources.some((version) => !applied.includes(version))
    )
      throw new Error("BROWSER_DATABASE_SOURCE_MISMATCH");
    process.stdout.write(
      `Owned browser database ready: ${applied.length} migrations\n`,
    );
  } finally {
    await browser.end();
  }
})().catch((error) => {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
});
