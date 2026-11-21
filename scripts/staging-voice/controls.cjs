"use strict";
const assert = require("node:assert/strict");
const { createHash } = require("node:crypto");
const fs = require("node:fs");
const hash = (value) => createHash("sha256").update(value).digest("hex");
const HEX64 = /^[a-f0-9]{64}$/;
const PROJECT = "qcffvfbpzvpwcwxwjyro";
function validatePacket(p) {
  assert.match(
    p.attemptId,
    /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/,
  );
  assert.equal(p.version, 1);
  assert.equal(p.mode, "canary");
  assert.equal(p.project, PROJECT);
  assert.match(p.sourceSha, /^[a-f0-9]{40}$/);
  for (const key of [
    "imageDigest",
    "apkHash",
    "controlHash",
    "clerkSessionHash",
  ])
    assert.match(p[key], HEX64);
  assert.equal(p.device, "RK8XB00N33K");
  assert.equal(p.ownerId, "user_3K8mSI8JwKzzOJ55tNuWrcx9lPy");
  assert.equal(p.accountId, "cf321db5-b5ff-4192-b94f-621505ac7801");
  assert.equal(p.categoryId, "04000000-0000-4000-8000-000000000002");
  assert.equal(p.maxTransactions, 2);
  assert.equal(p.maxPostings, 2);
  assert.equal(p.maxExpenseMinor, 5000);
  assert.equal(p.eachExpenseMinor, 2500);
  assert.equal(p.currency, "SAR");
  assert.deepEqual(p.locales, ["en", "ar"]);
  assert.equal(p.preserveEvidence, true);
  assert.equal(p.maxReplayPerEvent, 1);
  assert.equal(p.manualSave, false);
  const start = Date.parse(p.startsAt),
    end = Date.parse(p.deadline),
    baseline = Date.parse(p.baseline?.observedAt);
  assert(
    Number.isFinite(start) &&
      Number.isFinite(end) &&
      end > start &&
      end - start <= 600000,
    "WINDOW_INVALID",
  );
  assert(
    Number.isFinite(baseline) &&
      baseline <= start &&
      start - baseline <= 300000,
    "FRESH_BASELINE_REQUIRED",
  );
  assert.match(p.baseline.hash, HEX64);
  for (const name of [
    "api.env",
    "worker.env",
    "migration.env",
    "compose.env",
    "admin.env",
  ])
    assert.match(p.envHashes?.[name], HEX64);
  return p;
}
function controlDirectory(p) {
  validatePacket(p);
  return "/opt/masarifi/staging-voice-" + p.sourceSha + "-" + p.attemptId;
}
function makeControlsReadable(dir, names, disk = fs) {
  disk.chownSync(dir, 0, 65532);
  disk.chmodSync(dir, 0o710);
  for (const name of names) {
    assert(
      ["packet.json", "epoch.json", "approval.json"].includes(name),
      "CONTROL_FILE_INVALID",
    );
    const file = dir + "/" + name;
    assert.equal(disk.realpathSync(file), file, "CONTROL_SYMLINK_FORBIDDEN");
    disk.chownSync(file, 65532, 65532);
    disk.chmodSync(file, 0o400);
  }
}
function approve(p, a, now = Date.now()) {
  validatePacket(p);
  assert.equal(
    a?.kind,
    "direct-human-financial-approval",
    "DIRECT_HUMAN_APPROVAL_REQUIRED",
  );
  assert.equal(
    a.packetHash,
    hash(JSON.stringify(p)),
    "APPROVED_PACKET_MISMATCH",
  );
  assert(
    typeof a.messageReference === "string" &&
      a.messageReference.length >= 8 &&
      a.messageReference.length <= 256,
    "HUMAN_REFERENCE_REQUIRED",
  );
  assert(
    typeof a.verbatimMessage === "string" &&
      a.verbatimMessage.length >= 8 &&
      a.verbatimMessage.length <= 4096,
    "HUMAN_MESSAGE_REQUIRED",
  );
  const start = Date.parse(p.startsAt),
    received = Date.parse(a.receivedAt);
  assert(
    received <= start && received > start - 86400000,
    "APPROVAL_TIME_INVALID",
  );
  assert(
    start <= now && now < Date.parse(p.deadline),
    "APPROVED_WINDOW_CLOSED",
  );
  return p;
}
async function cleanup(a) {
  await a.target();
  const errors = [];
  for (const step of ["closeEpoch", "stopScoped"]) {
    try {
      const closed = await a[step]();
      if (step === "closeEpoch") {
        assert.equal(closed?.posting,false,"POSTING_CLOSURE_UNCONFIRMED");
        assert.equal(closed?.state,"closed","EPOCH_CLOSURE_UNCONFIRMED");
      }
    } catch (e) {
      errors.push(e);
    }
  }
  if (errors.length)
    throw new AggregateError(errors, "VOICE_CLOSURE_UNCONFIRMED");
  return {
    posting: false,
    admission: false,
    sharedApi: "preserved",
    analysisRestoration: "explicit_guarded_cohort_required",
  };
}
function environment(env, p, kind) {
  assert.equal(env.MASARIFI_PROCESS_KIND, kind);
  assert.equal(env.MASARIFI_RELEASE_VERSION, p.sourceSha);
  const db = new URL(env.DATABASE_URL);
  assert(
    db.hostname.endsWith(".supabase.com") &&
      decodeURIComponent(db.username).endsWith("." + PROJECT),
    "STAGING_DATABASE_REQUIRED",
  );
  if (kind === "worker")
    assert.equal(env.SUPABASE_URL, "https://" + PROJECT + ".supabase.co");
}
module.exports = {
  hash,
  PROJECT,
  validatePacket,
  approve,
  cleanup,
  environment,
  controlDirectory,
  makeControlsReadable,
};
