"use strict";
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { resolve } = require("node:path");
const { test } = require("node:test");
const {
  lintDatabase,
  reviewedDynamicStatements,
  disposableConnection,
} = require("./lint-disposable-database.cjs");
const migration = readFileSync(
  resolve(
    __dirname,
    "../../supabase/migrations/20261107140000_owner_financial_reset.sql",
  ),
  "utf8",
);
const source = migration
  .slice(migration.indexOf("create function private.reset_financial_data("))
  .match(/as \$\$([\s\S]*?)\$\$;/)[1];
const known = {
  level: "error",
  message: 'syntax error at or near "{"',
  sqlState: "42601",
  statement: { lineNumber: "105", text: "EXECUTE" },
};
function fixture(options = {}) {
  const calls = [];
  const client = {
    query: async (text, values = []) => {
      calls.push({ text, values });
      if (text.includes("p.proname, p.oid::text AS function_oid"))
        return {
          rows:
            values[0] === "private"
              ? (
                  options.defaultRows ?? [
                    {
                      proname: "reset_financial_data",
                      plpgsql_check_function: JSON.stringify({
                        issues: [known],
                      }),
                    },
                  ]
                ).map((row) => ({ function_oid: "101", ...row }))
              : [],
        };
      if (text.startsWith("select oid::text AS oid,prosrc"))
        return {
          rows: [
            {
              oid: "101",
              prosrc: options.source ?? source,
              owner: "masarifi_migration",
              prosecdef: true,
              ...options.functionMetadata,
            },
          ],
        };
      if (text.startsWith("select pg_has_role"))
        return {
          rows: [
            options.membership ?? { allowed: false, existing_grant: false },
          ],
        };
      if (text.includes("constant_tracing:=false"))
        return { rows: options.recheckRows ?? [] };
      if (text.startsWith("EXPLAIN")) {
        if (options.planError) throw options.planError;
        return { rows: [] };
      }
      assert.ok(
        [
          "begin",
          "rollback",
          "CREATE EXTENSION IF NOT EXISTS plpgsql_check",
          "grant masarifi_migration to current_user with set true, inherit false granted by current_user",
          "set local role masarifi_migration",
          "set local search_path = ''",
        ].includes(text),
      );
      return { rows: [] };
    },
  };
  return { client, calls };
}
test("rechecks the reviewed inference diagnostic and plans all35 inserts and24 deletes without execution", async () => {
  const { client, calls } = fixture();
  assert.deepEqual(await lintDatabase(client), {
    errors: 0,
    explainedDynamicVariants: 59,
  });
  const plans = calls.filter(({ text }) => text.startsWith("EXPLAIN"));
  assert.equal(plans.filter(({ values }) => values.length === 2).length, 35);
  assert.equal(plans.filter(({ values }) => values.length === 1).length, 24);
  assert.ok(
    plans[0].text.includes('from "public"."transactions" where user_id=$1'),
  );
  assert.equal(
    plans.at(-1).text,
    'EXPLAIN (COSTS OFF) delete from "public"."savings_goals" where user_id=$1',
  );
  assert.equal(calls.at(-1).text, "rollback");
  const sql = calls.map((call) => call.text);
  const grant = sql.findIndex((text) => text.startsWith("grant "));
  assert.ok(
    grant > sql.findIndex((text) => text.includes("constant_tracing:=false")),
  );
  assert.deepEqual(sql.slice(grant + 1, grant + 3), [
    "set local role masarifi_migration",
    "set local search_path = ''",
  ]);
  assert.equal(sql[grant + 3], plans[0].text);
});
test("does not alter existing SET membership or widen a partial self-grant", async () => {
  const active = fixture({
    membership: { allowed: true, existing_grant: true },
  });
  assert.equal(
    (await lintDatabase(active.client)).explainedDynamicVariants,
    59,
  );
  assert.equal(
    active.calls.some((c) => c.text.startsWith("grant ")),
    false,
  );
  const partial = fixture({
    membership: { allowed: false, existing_grant: true },
  });
  await assert.rejects(lintDatabase(partial.client), /UNREVIEWED_MEMBERSHIP/);
  assert.equal(partial.calls.at(-1).text, "rollback");
  assert.equal(
    partial.calls.some((c) => c.text.startsWith("grant ")),
    false,
  );
});
test("rejects a changed definer before role selection or planning", async () => {
  for (const functionMetadata of [
    { owner: "postgres" },
    { prosecdef: false },
  ]) {
    const { client, calls } = fixture({ functionMetadata });
    await assert.rejects(lintDatabase(client), /UNREVIEWED_DEFINER/);
    assert.equal(
      calls.some((c) => c.text.startsWith("set local role")),
      false,
    );
    assert.equal(calls.at(-1).text, "rollback");
  }
});
test("keeps a default-clean schema clean without invoking the exception path", async () => {
  const { client, calls } = fixture({ defaultRows: [] });
  assert.deepEqual(await lintDatabase(client), {
    errors: 0,
    explainedDynamicVariants: 0,
  });
  assert.equal(
    calls.some(({ text }) => text.includes("constant_tracing")),
    false,
  );
});

for (const [name, report] of [
  ["null", null],
  ["missing issues", {}],
  ["null issues", { issues: null }],
])
  test(`accepts the CLI's clean ${name} result`, async () => {
    const { client } = fixture({
      defaultRows: [
        { proname: "clean", plpgsql_check_function: JSON.stringify(report) },
      ],
    });
    assert.deepEqual(await lintDatabase(client), {
      errors: 0,
      explainedDynamicVariants: 0,
    });
  });

for (const [name, report] of [
  ["scalar", 42],
  ["array", []],
  ["non-array issues", { issues: {} }],
  ["scalar issue", { issues: ["invalid"] }],
  ["numeric message", { issues: [{ level: "error", message: 3 }] }],
])
  test(`rejects a malformed ${name} report`, async () => {
    const { client } = fixture({
      defaultRows: [
        { proname: "invalid", plpgsql_check_function: JSON.stringify(report) },
      ],
    });
    await assert.rejects(lintDatabase(client), /DATABASE_LINT_REPORT_INVALID/);
  });

test("derives function identity from the catalog instead of an issue property", async () => {
  const { client } = fixture({
    defaultRows: [
      {
        proname: "reset_financial_data",
        plpgsql_check_function: JSON.stringify({
          function: "ignored",
          issues: [{ ...known, function: "ignored" }],
        }),
      },
    ],
  });
  assert.deepEqual(await lintDatabase(client), {
    errors: 0,
    explainedDynamicVariants: 59,
  });
});
for (const [name, issue] of [
  ["another function", { ...known, functionName: "unrelated" }],
  [
    "another line",
    { ...known, statement: { ...known.statement, lineNumber: "106" } },
  ],
  ["another error", { ...known, sqlState: "42703", message: "column missing" }],
])
  test(`blocks ${name} rather than inheriting the reviewed exception`, async () => {
    const { client, calls } = fixture({
      defaultRows: [
        {
          proname: issue.functionName ?? "reset_financial_data",
          plpgsql_check_function: JSON.stringify({ issues: [issue] }),
        },
      ],
    });
    await assert.rejects(lintDatabase(client), /DATABASE_LINT_ERRORS/);
    assert.equal(calls.at(-1).text, "rollback");
  });
test("blocks additional diagnostics alongside the known inference error", async () => {
  const { client } = fixture({
    defaultRows: [
      {
        proname: "reset_financial_data",
        plpgsql_check_function: JSON.stringify({
          issues: [known, { ...known, message: "real syntax error" }],
        }),
      },
    ],
  });
  await assert.rejects(lintDatabase(client), /DATABASE_LINT_ERRORS/);
});
test("blocks any reset source drift before changing checker options", async () => {
  const { client, calls } = fixture({ source: source + "\n-- changed" });
  await assert.rejects(lintDatabase(client), /UNREVIEWED_RESET_SOURCE/);
  assert.equal(
    calls.some(({ text }) => text.includes("constant_tracing")),
    false,
  );
});

test("refuses a same-name overload inheriting the reviewed function exception", async () => {
  const { client } = fixture({
    defaultRows: [
      {
        function_oid: "202",
        proname: "reset_financial_data",
        plpgsql_check_function: JSON.stringify({ issues: [known] }),
      },
    ],
  });
  await assert.rejects(lintDatabase(client), /UNREVIEWED_FUNCTION_OVERLOAD/);
});
test("blocks real static errors reported by the second check", async () => {
  const { client } = fixture({
    recheckRows: [
      {
        plpgsql_check_function: JSON.stringify({
          issues: [{ ...known, message: "missing static column" }],
        }),
      },
    ],
  });
  await assert.rejects(lintDatabase(client), /DATABASE_LINT_RECHECK_ERRORS/);
});
test("blocks any invalid concrete dynamic SQL target", async () => {
  const failure = new Error("relation or column missing");
  const { client, calls } = fixture({ planError: failure });
  await assert.rejects(lintDatabase(client), (error) => error === failure);
  assert.equal(calls.at(-1).text, "rollback");
});
test("requires the full reviewed source even when constructing dynamic checks directly", () => {
  assert.throws(
    () =>
      reviewedDynamicStatements(
        source.replace("where user_id=$1", "where missing=$1"),
      ),
    /UNREVIEWED_RESET_SOURCE/,
  );
});
test("refuses hosted and unapproved local databases before opening a connection", () => {
  for (const DATABASE_URL of [
    "postgresql://postgres@hosted.invalid:54322/postgres",
    "postgresql://postgres@127.0.0.1:55442/postgres",
    "postgresql://postgres@127.0.0.1:54322/other",
    "postgresql://postgres@127.0.0.1:54322/postgres?host=outside.invalid",
    "postgresql://postgres@127.0.0.1:54322/postgres?options=-crole%3Dother",
  ])
    assert.throws(
      () =>
        disposableConnection({
          DATABASE_URL,
          MASARIFI_LIVE_DATABASE_TESTS: "1",
        }),
      /DISPOSABLE_DATABASE_ONLY/,
    );
  assert.throws(
    () =>
      disposableConnection({
        DATABASE_URL: "postgresql://postgres@127.0.0.1:54322/postgres",
      }),
    /DISPOSABLE_DATABASE_ONLY/,
  );
});
