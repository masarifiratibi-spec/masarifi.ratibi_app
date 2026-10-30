const { test } = require("node:test");
const assert = require("node:assert/strict");
const { splitStatements, productSchema } = require("./product-schema.cjs");

test("fixture selection retains complete dollar-quoted product functions and omits only declared external/setup statements", () => {
  assert.deepEqual(
    splitStatements(
      "create function x() returns void as $$begin perform ';'; end$$ language plpgsql;\nselect 'a;''b';",
    ),
    [
      "create function x() returns void as $$begin perform ';'; end$$ language plpgsql;",
      "\nselect 'a;''b';",
    ],
  );
  const schema = productSchema();
  assert.ok(
    schema.applied.some((entry) =>
      /create function private\.revise_transaction\(/i.test(entry.sql),
    ),
  );
  assert.ok(
    schema.applied.some((entry) =>
      /create function private\.enqueue_outbox_event\(/i.test(entry.sql),
    ),
  );
  assert.ok(
    schema.omitted.some(
      (entry) => entry.sql.trim() === "select pgmq.create('platform-events');",
    ),
  );
  assert.ok(!schema.applied.some((entry) => /pgmq\./.test(entry.sql)));
  assert.ok(
    schema.applied.some((entry) =>
      /create policy transactions_api_owner_select/i.test(entry.sql),
    ),
  );
  const cursor = schema.applied.findIndex((entry) =>
    /create table private\.sync_cursor_positions/i.test(entry.sql),
  );
  const fence = schema.applied.findIndex((entry) =>
    /create trigger a_owner_payload_write_fence/i.test(entry.sql),
  );
  assert.ok(
    cursor >= 0 && fence > cursor,
    "cursor state exists before the original owner-fence installer runs",
  );
  assert.ok(
    schema.applied.some(
      (entry) =>
        /create or replace function private\.assert_active_profile/i.test(
          entry.sql,
        ) &&
        /is distinct from/i.test(entry.sql) &&
        /for share/i.test(entry.sql),
    ),
  );
  assert.ok(
    schema.applied.some(
      (entry) =>
        /create or replace function private\.attach_outbox_sync_metadata/i.test(
          entry.sql,
        ) &&
        /private\.next_sync_cursor\(owner_id,sync_domain\)/i.test(entry.sql),
    ),
  );
  assert.ok(
    !schema.applied.some((entry) =>
      /sync_cursor_migration_barrier|create function private\.redact_frozen_owner_webhook|insert into private\.sync_cursor_positions\(user_id,domain,last_cursor\)\s*select user_id,domain,last_cursor from high_water/i.test(
        entry.sql,
      ),
    ),
  );
});
