const { readFileSync, writeFileSync } = require("node:fs");
const { resolve } = require("node:path");
const { sha256 } = require("../t03-exact-sync/manifest.cjs");

/** Fixture-only metadata capture after all original DDL/DO rewrites, before tests. */
async function captureEffectiveCatalog(
  client,
  runDirectory,
  database,
  systemIdentifier,
) {
  await client.query("begin isolation level repeatable read read only");
  let captured;
  try {
    await client.query("set local statement_timeout='5000ms'");
    await client.query("set local lock_timeout='1000ms'");
    await client.query(
      "set local idle_in_transaction_session_timeout='10000ms'",
    );
    const identity = (
      await client.query(
        "select current_database() database,(pg_control_system()).system_identifier::text system,current_setting('server_version_num')::int version,clock_timestamp() captured",
      )
    ).rows[0];
    if (
      identity.database !== database ||
      identity.system !== systemIdentifier ||
      identity.version < 170000 ||
      identity.version >= 180000
    )
      throw new Error("EFFECTIVE_CATALOG_FIXTURE_IDENTITY");
    const catalog = (
      await client.query(
        readFileSync(
          resolve(__dirname, "../t03-exact-sync/catalog.sql"),
          "utf8",
        ),
      )
    ).rows[0].catalog;
    const functions = (
      await client.query(
        `select n.nspname schema,p.proname "name",p.oid::regprocedure::text signature,pg_get_function_identity_arguments(p.oid) arguments,pg_get_function_result(p.oid) "returns",pg_get_userbyid(p.proowner) owner,p.prosecdef security_definer,p.proisstrict strict,p.provolatile volatility,p.proparallel parallel,p.proconfig configuration,p.proacl::text acl,p.prosrc source from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public','private','audit') and p.prokind='f' order by n.nspname,p.oid::regprocedure::text`,
      )
    ).rows.map((entry) => ({
      ...entry,
      sourceSha256: sha256(entry.source),
      sourceLfSha256: sha256(entry.source.replaceAll("\r\n", "\n")),
    }));
    const columns = (
      await client.query(
        `select c.oid::regclass::text relation,a.attname "column",a.attnum "position",a.attacl::text acl from pg_attribute a join pg_class c on c.oid=a.attrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname in ('public','private','audit') and a.attnum>0 and not a.attisdropped order by c.oid::regclass::text,a.attnum`,
      )
    ).rows;
    const indexes = (
      await client.query(
        `select i.indrelid::regclass::text relation,i.indexrelid::regclass::text name,i.indisunique "unique",i.indisvalid valid,i.indisready ready,pg_get_indexdef(i.indexrelid) definition from pg_index i join pg_class c on c.oid=i.indrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname in ('public','private','audit') order by i.indrelid::regclass::text,i.indexrelid::regclass::text`,
      )
    ).rows;
    captured = {
      identity,
      catalog,
      functions,
      columns,
      indexes,
      capture:
        "effective installed definitions/ACLs/RLS/triggers/rules after all selected original DDL and DO rewrites; no row data",
      comparisonNormalization:
        "CRLF to LF only for explicitly named sourceLfSha256; raw source and SHA retained",
    };
  } finally {
    await client.query("rollback");
  }
  writeFileSync(
    resolve(runDirectory, "product-effective-catalog.json"),
    JSON.stringify(captured, null, 2),
    { flag: "wx" },
  );
}
module.exports = { captureEffectiveCatalog };
