"use strict";
const { createHash } = require("node:crypto");
const { createRequire } = require("node:module");
const { resolve } = require("node:path");

// Supabase CLI v2.116.0's mass-check, with its original schema/error policy.
// https://github.com/supabase/cli/blob/v2.116.0/apps/cli/src/legacy/commands/db/lint/lint.lint-sql.ts
const CHECK_SCHEMA = `SELECT p.proname, p.oid::text AS function_oid, plpgsql_check_function(p.oid, format:='json')
FROM pg_catalog.pg_namespace n
JOIN pg_catalog.pg_proc p ON pronamespace = n.oid
JOIN pg_catalog.pg_language l ON p.prolang = l.oid
WHERE l.lanname = 'plpgsql' AND p.prorettype <> 2279 AND n.nspname = $1::text`;
const SIGNATURE = "private.reset_financial_data(text,uuid)";
const SOURCE_HASH =
  "51cb0845b650f24b4d31559db602bb933e9f296a92cc3fb6f197bd0bdd70b228";
const SOURCE_QUERY =
  "select oid::text AS oid,prosrc,prosecdef,proowner::regrole::text as owner from pg_catalog.pg_proc where oid=to_regprocedure($1)";
const PLAN_MEMBERSHIP = `select pg_has_role(current_user,'masarifi_migration','SET') as allowed,
  exists(select from pg_catalog.pg_auth_members where roleid='masarifi_migration'::regrole
    and member=current_user::regrole and grantor=current_user::regrole) as existing_grant`;
// Documented per-call inference option; checking itself stays enabled.
// https://github.com/okbob/plpgsql_check#arguments
const RECHECK = `select plpgsql_check_function($1::regprocedure,
  format:='json', constant_tracing:=false, fatal_errors:=false)`;

function reviewedDynamicStatements(source) {
  if (typeof source !== "string")
    throw new Error("DATABASE_LINT_SOURCE_MISSING");
  source = source.replaceAll("\r\n", "\n");
  if (createHash("sha256").update(source).digest("hex") !== SOURCE_HASH)
    throw new Error("DATABASE_LINT_UNREVIEWED_RESET_SOURCE");
  const inserts = source.match(
    /for resource in select \* from \(values([\s\S]*?)\) as v\(tbl,kind\) loop\s+execute format\('([^']+)',resource.tbl::regclass\)\s+using p_owner,resource.kind;/,
  );
  const deletes = source.match(
    /foreach item in array array\[([\s\S]*?)\]::regclass\[\] loop\s+execute format\('([^']+)',item\) using p_owner;/,
  );
  if (
    !inserts ||
    !deletes ||
    (source.match(/execute format\(/g) ?? []).length !== 2
  )
    throw new Error("DATABASE_LINT_DYNAMIC_TEMPLATE_CHANGED");
  const quote = (table) => {
    if (!/^(public|private)\.[a-z_]+$/.test(table))
      throw new Error("DATABASE_LINT_TARGET_INVALID");
    return table
      .split(".")
      .map((name) => `"${name}"`)
      .join(".");
  };
  const commands = [
    ...inserts[1].matchAll(/\('([a-z_]+\.[a-z_]+)','([a-z-]+)'\)/g),
  ].map(([, table, kind]) => ({
    text: `EXPLAIN (COSTS OFF) ${inserts[2].replace("%s", quote(table))}`,
    values: ["lint_owner_probe", kind],
  }));
  const insertCount = commands.length;
  commands.push(
    ...[...deletes[1].matchAll(/'([a-z_]+\.[a-z_]+)'/g)].map(([, table]) => ({
      text: `EXPLAIN (COSTS OFF) ${deletes[2].replace("%s", quote(table))}`,
      values: ["lint_owner_probe"],
    })),
  );
  if (insertCount !== 35 || commands.length !== 59)
    throw new Error("DATABASE_LINT_DYNAMIC_INVENTORY_CHANGED");
  return commands;
}

function errorIssues(rows, schema) {
  return rows.flatMap((row) => {
    const result = JSON.parse(row.plpgsql_check_function);
    if (result === null) return [];
    if (
      typeof result !== "object" ||
      Array.isArray(result) ||
      (result.function != null && typeof result.function !== "string")
    )
      throw new Error("DATABASE_LINT_REPORT_INVALID");
    const issues = result.issues ?? [];
    if (!Array.isArray(issues)) throw new Error("DATABASE_LINT_REPORT_INVALID");
    return issues.flatMap((issue) => {
      if (issue === null) return [];
      if (typeof issue !== "object" || Array.isArray(issue))
        throw new Error("DATABASE_LINT_REPORT_INVALID");
      for (const key of [
        "level",
        "message",
        "sqlState",
        "hint",
        "detail",
        "context",
      ])
        if (issue[key] != null && typeof issue[key] !== "string")
          throw new Error("DATABASE_LINT_REPORT_INVALID");
      for (const [key, fields] of [
        ["statement", ["lineNumber", "text"]],
        ["query", ["position", "text"]],
      ]) {
        if (issue[key] == null) continue;
        if (
          typeof issue[key] !== "object" ||
          Array.isArray(issue[key]) ||
          fields.some(
            (field) =>
              issue[key][field] != null &&
              typeof issue[key][field] !== "string",
          )
        )
          throw new Error("DATABASE_LINT_REPORT_INVALID");
      }
      return issue.level === "error"
        ? [
            {
              ...issue,
              function: `${schema}.${row.proname}`,
              functionOid: row.function_oid,
            },
          ]
        : [];
    });
  });
}

function knownInferenceError(issue) {
  return (
    issue.function === "private.reset_financial_data" &&
    issue.sqlState === "42601" &&
    issue.message === 'syntax error at or near "{"' &&
    issue.statement?.lineNumber === "105" &&
    issue.statement?.text === "EXECUTE"
  );
}

async function lintDatabase(client) {
  await client.query("begin");
  try {
    await client.query("CREATE EXTENSION IF NOT EXISTS plpgsql_check");
    const errors = [];
    for (const schema of ["public", "private", "audit"])
      errors.push(
        ...errorIssues(
          (await client.query(CHECK_SCHEMA, [schema])).rows,
          schema,
        ),
      );
    if (errors.length === 0) return { errors: 0, explainedDynamicVariants: 0 };
    if (errors.length !== 1 || !knownInferenceError(errors[0]))
      throw new Error(`DATABASE_LINT_ERRORS:${JSON.stringify(errors)}`);

    const reviewed = (await client.query(SOURCE_QUERY, [SIGNATURE])).rows[0];
    if (!reviewed || errors[0].functionOid !== reviewed.oid)
      throw new Error("DATABASE_LINT_UNREVIEWED_FUNCTION_OVERLOAD");
    if (!reviewed.prosecdef || reviewed.owner !== "masarifi_migration")
      throw new Error("DATABASE_LINT_UNREVIEWED_DEFINER");
    const commands = reviewedDynamicStatements(reviewed.prosrc);
    const remaining = errorIssues(
      (await client.query(RECHECK, [SIGNATURE])).rows.map((row) => ({
        ...row,
        proname: "reset_financial_data",
        function_oid: reviewed.oid,
      })),
      "private",
    );
    if (remaining.length)
      throw new Error(
        `DATABASE_LINT_RECHECK_ERRORS:${JSON.stringify(remaining)}`,
      );
    // Plain EXPLAIN never executes these writes. Validate every actual target,
    // identifier, parameter type and column while constant inference is disabled.
    // The standalone plans do not inherit the SECURITY DEFINER function's
    // owner. Reproduce its role and empty search path only for these plans.
    // The disposable session ALWAYS rolls back, including any bootstrap grant.
    const membership = (await client.query(PLAN_MEMBERSHIP)).rows[0];
    if (membership?.allowed !== true) {
      if (membership?.allowed !== false || membership.existing_grant !== false)
        throw new Error("DATABASE_LINT_UNREVIEWED_MEMBERSHIP");
      await client.query(
        "grant masarifi_migration to current_user with set true, inherit false granted by current_user",
      );
    }
    await client.query("set local role masarifi_migration");
    await client.query("set local search_path = ''");
    for (const command of commands)
      await client.query(command.text, command.values);
    return { errors: 0, explainedDynamicVariants: commands.length };
  } finally {
    // Match the CLI: no extension/catalog/data changes survive the lint session.
    await client.query("rollback");
  }
}

function disposableConnection(environment) {
  const target = new URL(environment.DATABASE_URL ?? "invalid:");
  if (
    environment.MASARIFI_LIVE_DATABASE_TESTS !== "1" ||
    target.protocol !== "postgresql:" ||
    !["127.0.0.1", "localhost", "[::1]"].includes(target.hostname) ||
    target.port !== "54322" ||
    target.search !== "" ||
    target.hash !== "" ||
    target.pathname !== "/postgres"
  )
    throw new Error("DISPOSABLE_DATABASE_ONLY");
  return environment.DATABASE_URL;
}

async function main() {
  const connectionString = disposableConnection(process.env);
  const apiRequire = createRequire(
    resolve(__dirname, "../../apps/api/package.json"),
  );
  const client = new (apiRequire("pg").Client)({
    connectionString,
    connectionTimeoutMillis: 1000,
    query_timeout: 30_000,
  });
  await client.connect();
  try {
    console.log(JSON.stringify(await lintDatabase(client)));
  } finally {
    await client.end();
  }
}
if (require.main === module)
  main().catch((error) => {
    console.error(
      error instanceof Error ? error.message : "DATABASE_LINT_FAILED",
    );
    process.exitCode = 1;
  });
module.exports = {
  lintDatabase,
  reviewedDynamicStatements,
  disposableConnection,
};
