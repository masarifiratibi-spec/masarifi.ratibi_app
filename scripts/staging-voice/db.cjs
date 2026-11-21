"use strict";
// Run inside the pinned application image with migration credentials and verified CA.
const fs = require("node:fs");
const assert = require("node:assert/strict");
const { createRequire } = require("node:module");
const g = require("./controls.cjs");
const { Pool } = createRequire("/app/dist/src/ai/ai.worker.js")("pg");
async function baseline(c, owner) {
  const balances = (
    await c.query(
      "select account_id,confirmed_minor::text,pending_minor::text from public.account_balances order by account_id",
    )
  ).rows;
  const ledger = (
    await c.query(
      "select id,user_id,amount_minor::text,currency_code,version::text from public.transactions order by id",
    )
  ).rows;
  const postings = (
    await c.query(
      "select id,transaction_id,account_id from public.transaction_postings order by id",
    )
  ).rows;
  const ownerAccounts = (
    await c.query(
      "select id,currency_code,status,version::text from public.accounts where user_id=$1 order by id",
      [owner],
    )
  ).rows;
  return {
    hash: g.hash(JSON.stringify({ balances, ledger, postings, ownerAccounts })),
    observedAt: new Date().toISOString(),
    balances,
    transactions: ledger.length,
    postings: postings.length,
  };
}
async function run(mode, dir) {
  const p = JSON.parse(fs.readFileSync(dir + "/packet.json", "utf8"));
  g.validatePacket(p);
  g.environment(process.env, p, "migration");
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 1,
    connectionTimeoutMillis: 5000,
    query_timeout: 15000,
  });
  const c = await pool.connect();
  try {
    await c.query("begin");
    await c.query("set local statement_timeout='15s'");
    // No permanent runtime grant: the controlled migration identity owns the capabilities.
    await c.query(
      "grant masarifi_migration to current_user with set true, inherit false",
    );
    await c.query("set local role masarifi_migration");
    let result;
    const control =
      mode === "prepare" || mode === "baseline"
        ? null
        : JSON.parse(fs.readFileSync(dir + "/epoch.json", "utf8"));
    if (control) {
      assert.match(control.epochId, /^[0-9a-f-]{36}$/);
      assert.equal(control.packetHash, g.hash(JSON.stringify(p)));
    }
    if (mode === "prepare") {
      assert.equal(
        (await c.query("select enabled from private.voice_automatic_policy"))
          .rows[0].enabled,
        false,
        "POSTING_MUST_BE_OFF",
      );
      result = (
        await c.query(
          "select private.prepare_staging_voice_epoch($1,$2::jsonb) result",
          [g.PROJECT, JSON.stringify(p)],
        )
      ).rows[0].result;
      result.packetHash = g.hash(JSON.stringify(p));
    } else if (mode === "activate") {
      g.approve(p, JSON.parse(fs.readFileSync(dir + "/approval.json", "utf8")));
      assert.equal(
        (await baseline(c, p.ownerId)).hash,
        p.baseline.hash,
        "FINANCIAL_BASELINE_CHANGED",
      );
      result = (
        await c.query(
          "select private.activate_staging_voice_epoch($1,$2,$3) result",
          [control.epochId, control.manifestHash, p.deadline],
        )
      ).rows[0].result;
    } else if (mode === "baseline") {
      result = await baseline(c, p.ownerId);
    } else if (mode === "close") {
      await c.query(
        "select private.close_staging_voice_epoch($1,'operator_closed')",
        [control.epochId],
      );
      const closed = (
        await c.query(
          "select (select enabled from private.voice_automatic_policy) posting,(select state from private.staging_voice_epochs where id=$1) state",
          [control.epochId],
        )
      ).rows[0];
      assert.equal(closed.posting, false);
      assert.equal(closed.state, "closed");
      result = closed;
    } else if (mode === "status") {
      result = (
        await c.query(
          `select e.id,e.state,e.closed_reason,e.heartbeat_at,e.expires_at,
        (select enabled from private.voice_automatic_policy) posting,
        (select count(*)::int from private.staging_voice_members where epoch_id=e.id) captures,
        (select count(*)::int from private.voice_events v join private.voice_batches b on b.id=v.batch_id join private.staging_voice_members m on m.session_id=b.session_id where m.epoch_id=e.id and v.status='committed') committed,
        (select count(*)::int from public.voice_sessions s join private.staging_voice_members m on m.session_id=s.id where m.epoch_id=e.id and s.status='failed') failed,
        (select min(s.created_at) from public.voice_sessions s join private.staging_voice_members m on m.session_id=s.id where m.epoch_id=e.id and s.status in ('uploaded','processing')) oldest_pending_at
        from private.staging_voice_epochs e where e.id=$1`,
          [control.epochId],
        )
      ).rows[0];
      assert(result, "EPOCH_MISSING");
    } else throw Error("UNKNOWN_DB_MODE");
    await c.query("reset role");
    await c.query(
      "revoke masarifi_migration from current_user granted by current_user",
    );
    await c.query("commit");
    return result;
  } catch (e) {
    await c.query("rollback");
    throw e;
  } finally {
    c.release();
    await pool.end();
  }
}
module.exports = { run };
if (require.main === module)
  run(process.argv[2], process.argv[3])
    .then((r) => console.log(JSON.stringify(r)))
    .catch(() => {
      console.error("VOICE_CONTROL_DB_FAILED");
      process.exitCode = 1;
    });
