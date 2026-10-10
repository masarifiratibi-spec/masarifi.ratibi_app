"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { validate, validatePacket, approve, scopeHash } = require("./redmi-controls.cjs");

const NOW = Date.parse("2026-10-11T01:00:00.000Z");
const iso = (milliseconds) => new Date(milliseconds).toISOString();
function packet() {
  const service = () => ({
    sourceSha: "ac7bc92ab2e6e6c2e50a969de6c69463688febae",
    imageDigest: "a4f6c1ad71621b645d09880e943b5c15d27a8d8a4bd038ef4913fd3aebf3d383",
    running: true,
  });
  return {
    version: 2, mode: "canary", project: "qcffvfbpzvpwcwxwjyro", device: "f66a40694eca",
    attemptId: "11111111-1111-4111-8111-111111111111",
    sourceSha: "a".repeat(40), imageDigest: "b".repeat(64), apkHash: "c".repeat(64),
    controlHash: "d".repeat(64), migrationHash: "e".repeat(64),
    ownerId: "user_LOCALRedmiFixture", clerkSessionHash: "f".repeat(64),
    accountId: "22222222-2222-4222-8222-222222222222",
    categoryId: "33333333-3333-4333-8333-333333333333",
    kind: "expense", maxTransactions: 1, maxPostings: 1, expenseMinor: 1000,
    maxExpenseMinor: 1000, currency: "SAR", locale: "ar",
    startsAt: iso(NOW - 1000), deadline: iso(NOW + 299000),
    baseline: {
      observedAt: iso(NOW - 2000), accountsHash: "1".repeat(64),
      transactionsHash: "2".repeat(64), postingsHash: "3".repeat(64), balancesHash: "4".repeat(64),
      confirmedMinor: -5000, pendingMinor: 0, ledgerVersion: 1,
      accounts: 5, transactions: 30, postings: 30,
    },
    runtime: {
      api: service(), analysis: service(), assistant: service(),
      financial: { sourceSha: "976dd92fe73fccb0f4f9bde42e1fa41b8aa934bb", running: false },
      automaticPosting: false, activeFinancialEpochs: 0,
    },
    backup: { hash: "5".repeat(64), verified: true, rehearsed: true },
    declarations: { noOldReplay: true, unchangedTracking: true, noAutomaticNotificationOrSMSPosting: true },
  };
}
function approval(scope) {
  return {
    kind: "direct-human-financial-approval", packetHash: scopeHash(scope),
    messageReference: "test-only-human-turn-fixture",
    verbatimMessage: "TEST ONLY: approve this exact fictitious local scope.",
    receivedAt: iso(NOW - 3600000),
  };
}
function changed(scope, path, replacement) {
  const copy = structuredClone(scope);
  const keys = path.split(".");
  const field = keys.pop();
  keys.reduce((parent, key) => parent[key], copy)[field] = replacement;
  return copy;
}

test("preparation validates without granting financial approval or modifying evidence", () => {
  const scope = packet(), before = structuredClone(scope);
  assert.equal(validatePacket(scope, NOW), scope);
  assert.equal(validate(scope, undefined, NOW), scope);
  assert.throws(() => approve(scope, undefined, NOW), /APPROVAL/);
  assert.deepEqual(scope, before);
});

test("an exact fictitious scope accepts retained approval only during its fresh activation window", () => {
  const scope = packet(), humanEvidence = approval(scope);
  assert.equal(approve(scope, humanEvidence, NOW), scope);
  assert.equal(validate(scope, humanEvidence, NOW), scope);
  assert.equal(approve(scope, humanEvidence, Date.parse(scope.startsAt)), scope);
  assert.throws(() => approve(scope, humanEvidence, Date.parse(scope.deadline)), /WINDOW/);
  assert.throws(() => approve(scope, humanEvidence, Date.parse(scope.startsAt) - 1), /WINDOW/);
});

test("reordered JSON and a later fresh window preserve approval while financial scope changes invalidate it", () => {
  const scope = packet(), humanEvidence = approval(scope);
  const reordered = Object.fromEntries(Object.entries(scope).reverse());
  reordered.baseline = Object.fromEntries(Object.entries(scope.baseline).reverse());
  assert.equal(scopeHash(reordered), scopeHash(scope));
  const later = structuredClone(scope);
  later.startsAt = iso(NOW + 7200000);
  later.deadline = iso(NOW + 7500000);
  later.baseline.observedAt = iso(NOW + 7199000);
  assert.equal(approve(later, humanEvidence, NOW + 7200000), later);
  for (const [path, replacement] of [
    ["baseline.accountsHash", "6".repeat(64)], ["baseline.balancesHash", "6".repeat(64)],
    ["baseline.transactionsHash", "6".repeat(64)], ["baseline.postingsHash", "6".repeat(64)],
    ["attemptId", "44444444-4444-4444-8444-444444444444"],
    ["ownerId", "user_OTHERLocalFixture"], ["clerkSessionHash", "6".repeat(64)],
    ["accountId", "44444444-4444-4444-8444-444444444444"],
    ["categoryId", "44444444-4444-4444-8444-444444444444"],
    ["sourceSha", "6".repeat(40)], ["imageDigest", "6".repeat(64)],
    ["apkHash", "6".repeat(64)], ["controlHash", "6".repeat(64)], ["migrationHash", "6".repeat(64)],
  ]) assert.throws(() => approve(changed(scope, path, replacement), humanEvidence, NOW), /MISMATCH/, path);
});

test("broadened or malformed scope, runtime, baseline and safety declarations fail closed", () => {
  const scope = packet();
  const mutations = [
    ["version", 1], ["version", "2"], ["mode", "operating"], ["project", "other"],
    ["device", "RK8XB00N33K"], ["kind", "income"], ["maxTransactions", 2],
    ["maxPostings", 2], ["expenseMinor", 2500], ["maxExpenseMinor", 2000],
    ["currency", "USD"], ["locale", "en"], ["locale", ["ar"]],
    ["ownerId", ""], ["ownerId", "user_fixture\n"], ["accountId", "../account"],
    ["categoryId", null], ["clerkSessionHash", "f".repeat(63)],
    ["sourceSha", "a".repeat(64)], ["imageDigest", "sha256:" + "b".repeat(64)],
    ["apkHash", undefined], ["controlHash", "G".repeat(64)], ["migrationHash", 123],
    ["baseline.confirmedMinor", 0], ["baseline.confirmedMinor", "-5000"],
    ["baseline.pendingMinor", 1], ["baseline.ledgerVersion", 2], ["baseline.accounts", 6],
    ["baseline.transactions", 31], ["baseline.postings", 31], ["baseline.postingsHash", "bad"],
    ["runtime.api.sourceSha", "a".repeat(40)], ["runtime.analysis.imageDigest", "b".repeat(64)],
    ["runtime.assistant.running", false], ["runtime.api.running", "true"],
    ["runtime.financial.running", true], ["runtime.financial.sourceSha", "a".repeat(40)],
    ["runtime.automaticPosting", true], ["runtime.activeFinancialEpochs", 1],
    ["backup.verified", false], ["backup.rehearsed", false], ["backup.hash", "bad"],
    ["declarations.noOldReplay", false], ["declarations.unchangedTracking", "true"],
    ["declarations.noAutomaticNotificationOrSMSPosting", false],
  ];
  for (const [path, replacement] of mutations)
    assert.throws(() => validatePacket(changed(scope, path, replacement), NOW), /PACKET/, path);
  assert.throws(() => validatePacket({ ...scope, activate: true }, NOW), /PACKET/);
  assert.throws(() => validatePacket({ ...scope, eachExpenseMinor: 1000 }, NOW), /PACKET/);
  assert.throws(() => validatePacket({ ...scope, locales: ["ar"] }, NOW), /PACKET/);
  assert.throws(() => validatePacket(changed(scope, "runtime.api.activate", true), NOW), /PACKET/);
});

test("missing required evidence is rejected instead of receiving defaults", () => {
  for (const path of ["ownerId", "migrationHash", "baseline", "runtime", "backup", "declarations"]) {
    const scope = packet();
    delete scope[path];
    assert.throws(() => validatePacket(scope, NOW), /PACKET/, path);
  }
});

test("a five minute maximum and baseline freshness use exact millisecond boundaries", () => {
  const scope = packet();
  assert.throws(() => validatePacket(changed(scope, "deadline", iso(NOW + 299001)), NOW), /WINDOW/);
  assert.throws(() => validatePacket(changed(scope, "deadline", scope.startsAt), NOW), /WINDOW/);
  assert.throws(() => validatePacket(changed(scope, "startsAt", "2026-10-11"), NOW), /TIME/);
  assert.throws(() => validatePacket(changed(scope, "baseline.observedAt", iso(NOW + 1)), NOW), /BASELINE/);
  assert.throws(() => validatePacket(changed(scope, "baseline.observedAt", iso(NOW - 300001)), NOW), /BASELINE/);
  assert.doesNotThrow(() => validatePacket(changed(scope, "baseline.observedAt", iso(NOW - 300000)), NOW));
  const almostStale = changed(scope, "baseline.observedAt", iso(NOW - 299000));
  assert.throws(() => approve(almostStale, approval(almostStale), NOW + 1001), /BASELINE/);
  const freshAtStart = changed(scope, "baseline.observedAt", scope.startsAt);
  assert.throws(() => approve(freshAtStart, approval(freshAtStart), NOW + 299001), /WINDOW/);
  for (const invalidNow of ["1791680400000", NaN, Infinity, -1])
    assert.throws(() => validatePacket(scope, invalidNow), /TIME/);
});

test("approval requires exact direct-human evidence and refuses future timestamps or changed scopes", () => {
  const scope = packet(), humanEvidence = approval(scope);
  for (const [field, replacement] of [
    ["kind", "agent-generated"], ["packetHash", "a".repeat(64)],
    ["messageReference", ""], ["messageReference", 123], ["verbatimMessage", "   "],
    ["verbatimMessage", true], ["receivedAt", iso(NOW + 1)], ["receivedAt", "yesterday"],
  ]) assert.throws(() => approve(scope, { ...humanEvidence, [field]: replacement }, NOW), /APPROVAL/, field);
  assert.throws(() => validate(scope, null, NOW), /APPROVAL/);
  assert.throws(() => approve(scope, { ...humanEvidence, activate: true }, NOW), /APPROVAL/);
});

test("canonical scope hashing has an independent digest and rejects non-JSON evidence", () => {
  // Sorted UTF-8 JSON bytes {"a":1,"b":2}; digest computed independently.
  assert.equal(scopeHash({ b: 2, a: 1 }), "43258cff783fe7036d8a43033f830adfc60ec037382473548ac742b888292777");
  for (const invalid of [undefined, { field: undefined }, { field: NaN }, { field: new Date(NOW) }])
    assert.throws(() => scopeHash(invalid), /PACKET/);
  const withGetter = Object.defineProperty({}, "a", { enumerable: true, get() { throw new Error("getter executed"); } });
  assert.throws(() => scopeHash(withGetter), /PACKET/);
  const cyclic = {}; cyclic.self = cyclic;
  assert.throws(() => scopeHash(cyclic), /PACKET/);
});
