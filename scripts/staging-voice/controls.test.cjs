"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const {
  validatePacket,
  approve,
  cleanup,
  hash,
  controlDirectory,
  makeControlsReadable,
} = require("./controls.cjs");
const now = Date.now();
function packet() {
  return {
    attemptId: "11111111-1111-4111-8111-111111111111",
    version: 1,
    mode: "canary",
    project: "qcffvfbpzvpwcwxwjyro",
    sourceSha: "a".repeat(40),
    imageDigest: "b".repeat(64),
    apkHash: "c".repeat(64),
    controlHash: "d".repeat(64),
    clerkSessionHash: "e".repeat(64),
    device: "RK8XB00N33K",
    ownerId: "user_3K8mSI8JwKzzOJ55tNuWrcx9lPy",
    accountId: "cf321db5-b5ff-4192-b94f-621505ac7801",
    categoryId: "04000000-0000-4000-8000-000000000002",
    maxTransactions: 2,
    maxPostings: 2,
    maxExpenseMinor: 5000,
    eachExpenseMinor: 2500,
    currency: "SAR",
    locales: ["en", "ar"],
    preserveEvidence: true,
    maxReplayPerEvent: 1,
    manualSave: false,
    startsAt: new Date(now - 1000).toISOString(),
    deadline: new Date(now + 599000).toISOString(),
    baseline: {
      observedAt: new Date(now - 5000).toISOString(),
      hash: "f".repeat(64),
    },
    envHashes: Object.fromEntries(
      [
        "api.env",
        "worker.env",
        "migration.env",
        "compose.env",
        "admin.env",
      ].map((n) => [n, "f".repeat(64)]),
    ),
  };
}
test("same candidate supports distinct immutable rehearsal and actual attempt directories", () => {
  const a = packet(),
    b = { ...packet(), attemptId: "22222222-2222-4222-8222-222222222222" };
  assert.notEqual(controlDirectory(a), controlDirectory(b));
  assert(controlDirectory(a).includes(a.sourceSha));
  assert.throws(() => controlDirectory({ ...a, attemptId: "../../escape" }));
});
test("published controls are readable only by root and the image identity", () => {
  const state = new Map();
  const disk = {
    realpathSync: (p) => p,
    chownSync: (p, uid, gid) => state.set(p, { ...state.get(p), uid, gid }),
    chmodSync: (p, mode) => state.set(p, { ...state.get(p), mode }),
  };
  makeControlsReadable(
    "/control",
    ["packet.json", "epoch.json", "approval.json"],
    disk,
  );
  assert.deepEqual(state.get("/control"), { uid: 0, gid: 65532, mode: 0o710 });
  for (const n of ["packet.json", "epoch.json", "approval.json"])
    assert.deepEqual(state.get("/control/" + n), {
      uid: 65532,
      gid: 65532,
      mode: 0o400,
    });
});
function approval(p) {
  return {
    kind: "direct-human-financial-approval",
    packetHash: hash(JSON.stringify(p)),
    receivedAt: new Date(now - 2000).toISOString(),
    messageReference: "human-turn-123",
    verbatimMessage: "Approved this exact bounded packet.",
  };
}
test("preparation validates a scope without granting activation", () => {
  const p = packet();
  validatePacket(p);
  assert.throws(() => approve(p, undefined, now), /APPROVAL/);
  assert.doesNotThrow(() => approve(p, approval(p), now));
});
test("rejects broader amounts, device/owner drift, reordered captures, stale baselines and longer windows", () => {
  for (const changed of [
    { maxExpenseMinor: 5001 },
    { maxTransactions: 3 },
    { device: "another" },
    { ownerId: "another" },
    { locales: ["ar", "en"] },
    { manualSave: true },
    { preserveEvidence: false },
    { deadline: new Date(now + 600001).toISOString() },
    {
      baseline: {
        observedAt: new Date(now - 400000).toISOString(),
        hash: "f".repeat(64),
      },
    },
  ]) {
    const p = { ...packet(), ...changed };
    assert.throws(() => validatePacket(p));
  }
});
test("approval binds the immutable packet and exact window with no automatic extension", () => {
  const p = packet(),
    a = approval(p);
  assert.throws(() => approve({ ...p, apkHash: "a".repeat(64) }, a, now));
  assert.throws(() => approve(p, a, Date.parse(p.deadline)));
  assert.throws(() => approve(p, a, Date.parse(p.startsAt) - 1));
});
test("closure attempts every OFF step and refuses restoration on unconfirmed closure", async () => {
  for (const failing of [
    "stopApi",
    "stopScoped",
    "stopGeneral",
    "closeEpoch",
  ]) {
    const calls = [];
    const adapter = Object.fromEntries(
      [
        "target",
        "stopApi",
        "stopScoped",
        "stopGeneral",
        "closeEpoch",
        "pins",
        "restore",
        "health",
      ].map((n) => [
        n,
        async () => {
          calls.push(n);
          if (n === failing) throw Error("unavailable");
        },
      ]),
    );
    await assert.rejects(cleanup(adapter), /CLOSURE/);
    assert.deepEqual(calls, [
      "target",
      "stopApi",
      "stopScoped",
      "stopGeneral",
      "closeEpoch",
    ]);
  }
});
test("mutable pin drift cannot suppress OFF closure; successful closure restores healthy analysis", async () => {
  const calls = [];
  let drift = true;
  const a = Object.fromEntries(
    [
      "target",
      "stopApi",
      "stopScoped",
      "stopGeneral",
      "closeEpoch",
      "pins",
      "restore",
      "health",
    ].map((n) => [
      n,
      async () => {
        calls.push(n);
        if (n === "pins" && drift) throw Error("drift");
      },
    ]),
  );
  await assert.rejects(cleanup(a), /drift/);
  assert.deepEqual(calls, [
    "target",
    "stopApi",
    "stopScoped",
    "stopGeneral",
    "closeEpoch",
    "pins",
  ]);
  calls.length = 0;
  drift = false;
  await cleanup(a);
  assert.deepEqual(calls, [
    "target",
    "stopApi",
    "stopScoped",
    "stopGeneral",
    "closeEpoch",
    "pins",
    "restore",
    "health",
  ]);
});
