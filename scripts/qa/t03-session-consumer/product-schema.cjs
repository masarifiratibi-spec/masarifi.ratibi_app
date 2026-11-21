const fs = require("node:fs");
const path = require("node:path");
const {
  sha256,
  requireCondition: requireThat,
} = require("../t03-exact-sync/manifest.cjs");
const root = path.resolve(__dirname, "../../..");

// A fixture-only lexer preserves each selected original SQL statement byte-for-byte.
function splitStatements(sql) {
  const result = [];
  let start = 0,
    i = 0,
    quote = null,
    dollar = null,
    comment = 0,
    line = false;
  while (i < sql.length) {
    if (line) {
      if (sql[i] === "\n") line = false;
      i += 1;
      continue;
    }
    if (comment) {
      if (sql.startsWith("/*", i)) {
        comment += 1;
        i += 2;
      } else if (sql.startsWith("*/", i)) {
        comment -= 1;
        i += 2;
      } else i += 1;
      continue;
    }
    if (dollar) {
      if (sql.startsWith(dollar, i)) {
        i += dollar.length;
        dollar = null;
      } else i += 1;
      continue;
    }
    if (quote) {
      if (sql[i] === quote) {
        if (sql[i + 1] === quote) i += 2;
        else {
          quote = null;
          i += 1;
        }
      } else i += 1;
      continue;
    }
    if (sql.startsWith("--", i)) {
      line = true;
      i += 2;
      continue;
    }
    if (sql.startsWith("/*", i)) {
      comment = 1;
      i += 2;
      continue;
    }
    if (sql[i] === "'" || sql[i] === '"') {
      quote = sql[i];
      i += 1;
      continue;
    }
    if (sql[i] === "$") {
      const tag = sql.slice(i).match(/^\$(?:[A-Za-z_][A-Za-z0-9_]*)?\$/)?.[0];
      if (tag) {
        dollar = tag;
        i += tag.length;
        continue;
      }
    }
    if (sql[i] === ";") {
      result.push(sql.slice(start, i + 1));
      start = i + 1;
    }
    i += 1;
  }
  requireThat(
    !quote && !dollar && !comment,
    "PRODUCT_FIXTURE_SQL_UNTERMINATED",
  );
  requireThat(
    sql
      .slice(start)
      .replace(/--[^\n]*(?:\n|$)/g, "")
      .trim() === "",
    "PRODUCT_FIXTURE_SQL_TRAILING",
  );
  return result;
}

const head = (sql) =>
  sql
    .replace(/^(?:\s|--[^\n]*(?:\n|$)|\/\*[\s\S]*?\*\/)+/, "")
    .trim()
    .toLowerCase();
const wrappers = (s) =>
  /^(grant masarifi_migration to current_user|set local role masarifi_migration|reset role|revoke masarifi_migration from current_user)/.test(
    s,
  );
const full = () => true;
const securityObjects = [
  "public.admin_profiles",
  "public.roles",
  "public.permissions",
  "public.role_permissions",
  "public.admin_role_assignments",
  "public.admin_invitations",
  "public.security_events",
  "audit.audit_events",
];
function securitySelection(s) {
  if (
    /^(create|alter|revoke).*function (private\.(admin_has_permission|assert_admin_permission|assert_support_grant)|audit\.append_event)/s.test(
      s,
    )
  )
    return true;
  if (s.startsWith("grant execute on function"))
    return !s.includes("private.") || /private\.admin_has_permission/.test(s);
  if (s.startsWith("grant usage on schema audit")) return true;
  if (/^(alter table|create policy|grant |revoke )/.test(s)) {
    const mentioned = [
      ...s.matchAll(/\b(?:public|private|audit)\.[a-z_]+/g),
    ].map((entry) => entry[0]);
    return (
      mentioned.length > 0 &&
      mentioned.every(
        (name) =>
          securityObjects.includes(name) ||
          [
            "private.admin_has_permission",
            "public.current_clerk_user_id",
          ].includes(name),
      )
    );
  }
  return false;
}

const selections = [
  [
    "20260827000100_foundation_schemas_extensions.sql",
    (s) => !s.startsWith("create extension if not exists pgmq"),
  ],
  [
    "20260827000200_outbox_queue_functions.sql",
    (s) => !s.includes("pgmq.") && !s.includes("claim_outbox_batch"),
  ],
  [
    "20260827000400_foundation_grants.sql",
    (s) =>
      s.startsWith("revoke all on schema private") ||
      s.startsWith("revoke all on private.outbox_events") ||
      s.startsWith("grant usage on schema private") ||
      s.startsWith("grant execute on function private.enqueue_outbox_event") ||
      s.startsWith("create policy outbox_migration_owner_all"),
  ],
  ["20260827000500_identity_profiles_functions.sql", full],
  ["20260827000600_identity_profile_rls_grants.sql", full],
  ["20260827000700_identity_preferences.sql", full],
  ["20260827000900_identity_devices_push_tokens.sql", full],
  ["20260827001000_identity_devices_push_rls.sql", full],
  ["20260829062150_admin_access_tables.sql", full],
  ["20260829062155_audit_security_events.sql", full],
  ["20260829062203_admin_security_functions_rls_grants.sql", securitySelection],
  ["20260829080000_reference_account_tables_functions.sql", full],
  ["20260829080100_reference_seeds_permissions.sql", full],
  ["20260829080200_reference_runtime_access.sql", full],
  ["20260830080000_phase05_idempotency_bridge.sql", full],
  ["20260830080100_phase05_ledger_tables.sql", full],
  ["20260830080200_phase05_ledger_commands.sql", full],
  ["20260830080300_phase05_ledger_access.sql", full],
  ["20260831061405_phase06_sync_schema.sql", full],
  [
    "20260831120000_phase07_planning_tables.sql",
    (s) =>
      /^(create table public\.salary_(profiles|receipts)|alter table public\.salary_(profiles|receipts) owner|create .*index salary_(profiles|receipts)_)/s.test(
        s,
      ),
  ],
  [
    "20260901161000_sync_cursor_high_water.sql",
    (s) =>
      /^(create table private\.sync_cursor_positions|alter table private\.sync_cursor_positions owner|revoke all on private\.sync_cursor_positions|create function private\.next_sync_cursor|alter function private\.next_sync_cursor|revoke all on function private\.next_sync_cursor|create or replace function private\.attach_outbox_sync_metadata|alter function private\.attach_outbox_sync_metadata|revoke all on function private\.attach_outbox_sync_metadata)/.test(
        s,
      ),
  ],
  ["20261006090000_ledger_multiline_notes.sql", full],
  [
    "20261016101500_account_owner_payload_erasure.sql",
    (s) =>
      /^(create or replace function private\.assert_active_profile|create function private\.fence_frozen_owner_payload|alter function private\.fence_frozen_owner_payload|revoke all on function private\.fence_frozen_owner_payload)/.test(
        s,
      ) ||
      (s.startsWith("do $$") &&
        s.includes("create trigger a_owner_payload_write_fence")),
  ],
  [
    "20261017140043_automatic_salary_detection.sql",
    (s) =>
      s.startsWith("alter table public.salary_profiles add column") ||
      s.startsWith("alter table public.salary_receipts add column"),
  ],
  [
    "20261018154639_p0_refund_floor_currency_identity.sql",
    (s) =>
      s.startsWith("do $migration$") &&
      s.includes("refund_floor_migration_precondition"),
  ],
  ["20261021122922_manual_transaction_kind_revision.sql", full],
  [
    "20261022191918_shared_planning_payment_salary_reconciliation.sql",
    (s) =>
      /^(create function private\.reconcile_salary_receipts|alter function private\.reconcile_salary_receipts|revoke all on function private\.reconcile_salary_receipts)/.test(
        s,
      ) ||
      (s.startsWith("do $migration$") &&
        s.includes("salary_revision_precondition")),
  ],
  ["20261023232159_report_closure_sync_reauthentication.sql", full],
];

function productSchema() {
  const applied = [],
    omitted = [],
    files = [];
  for (const [name, include] of selections) {
    const file = `supabase/migrations/${name}`;
    const text = fs.readFileSync(path.join(root, file), "utf8");
    files.push({ path: file, sha256: sha256(text) });
    let executionRole = "admin";
    for (const [index, sql] of splitStatements(text).entries()) {
      const s = head(sql);
      if (s.startsWith("set local role masarifi_migration"))
        executionRole = "migration";
      if (s.startsWith("reset role")) executionRole = "admin";
      const selected = !wrappers(s) && include(s);
      (selected ? applied : omitted).push({
        file,
        sourceSha256: sha256(text),
        statement: index + 1,
        executionRole,
        sha256: sha256(sql),
        sql,
        ...(selected
          ? {}
          : {
              reason: wrappers(s)
                ? "transaction-role wrapper replaced only by fixture-owned transaction wrapper preserving original per-statement role"
                : "outside selected product-note dependency closure; no delivery or unrelated feature execution",
            }),
      });
    }
  }
  return { database: "t03_product_ledger_synthetic", files, applied, omitted };
}
module.exports = { splitStatements, productSchema };
