"use strict";
const assert = require("node:assert/strict");
const { createHash } = require("node:crypto");

const HEX64 = /^[a-f0-9]{64}$/;
const SHA40 = /^[a-f0-9]{40}$/;
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
const API_SOURCE = "ac7bc92ab2e6e6c2e50a969de6c69463688febae";
const API_IMAGE = "a4f6c1ad71621b645d09880e943b5c15d27a8d8a4bd038ef4913fd3aebf3d383";
const FINANCIAL_SOURCE = "976dd92fe73fccb0f4f9bde42e1fa41b8aa934bb";
const FIVE_MINUTES = 300000;

function plainRecord(record) {
  return record !== null && typeof record === "object" &&
    [Object.prototype, null].includes(Object.getPrototypeOf(record));
}

function canonicalJson(evidence, ancestors = new Set()) {
  if (evidence === null || ["string", "boolean"].includes(typeof evidence)) return JSON.stringify(evidence);
  if (typeof evidence === "number") {
    assert(Number.isFinite(evidence), "PACKET_JSON_NUMBER_INVALID");
    return JSON.stringify(evidence);
  }
  assert(Array.isArray(evidence) || plainRecord(evidence), "PACKET_JSON_REQUIRED");
  assert(!ancestors.has(evidence), "PACKET_JSON_CYCLE_INVALID");
  const descriptors = Object.getOwnPropertyDescriptors(evidence);
  const keys = Reflect.ownKeys(descriptors);
  assert(keys.every((key) => typeof key === "string" && "value" in descriptors[key]), "PACKET_JSON_DATA_REQUIRED");
  ancestors.add(evidence);
  let serialized;
  if (Array.isArray(evidence)) {
    assert(keys.length === evidence.length + 1 && keys.includes("length"), "PACKET_JSON_ARRAY_INVALID");
    serialized = "[" + Array.from({ length: evidence.length }, (_, index) => {
      assert(Object.hasOwn(descriptors, index), "PACKET_JSON_ARRAY_INVALID");
      return canonicalJson(descriptors[index].value, ancestors);
    }).join(",") + "]";
  } else {
    assert(keys.every((key) => descriptors[key].enumerable), "PACKET_JSON_DATA_REQUIRED");
    serialized = "{" + keys.sort().map((key) =>
      JSON.stringify(key) + ":" + canonicalJson(descriptors[key].value, ancestors)
    ).join(",") + "}";
  }
  ancestors.delete(evidence);
  return serialized;
}

// Approval binds all identities, financial hashes and deployment controls. Only
// activation times and baseline observation time may be refreshed after a human
// replies. This hash verifies evidence binding, not human-message authenticity.
function scopeHash(packet) {
  const immutableScope = JSON.parse(canonicalJson(packet));
  if (plainRecord(immutableScope)) {
    delete immutableScope.startsAt;
    delete immutableScope.deadline;
    if (plainRecord(immutableScope.baseline)) delete immutableScope.baseline.observedAt;
  }
  return createHash("sha256").update(canonicalJson(immutableScope)).digest("hex");
}

function exactKeys(record, expected, code = "PACKET_FIELDS_INVALID") {
  assert(plainRecord(record), code);
  assert.deepEqual(Object.keys(record).sort(), [...expected].sort(), code);
}

function encodedIdentifier(identifier, pattern, length) {
  assert(typeof identifier === "string" && identifier.trim() === identifier, "PACKET_IDENTIFIER_INVALID");
  assert(!length || identifier.length === length, "PACKET_IDENTIFIER_INVALID");
  assert(pattern.test(identifier), "PACKET_IDENTIFIER_INVALID");
}

function timestamp(isoTime, code) {
  assert(typeof isoTime === "string", code);
  const milliseconds = Date.parse(isoTime);
  assert(Number.isFinite(milliseconds) && new Date(milliseconds).toISOString() === isoTime, code);
  return milliseconds;
}

function validateWindow(packet, now) {
  assert(Number.isSafeInteger(now) && now >= 0, "PACKET_TIME_INVALID");
  const start = timestamp(packet.startsAt, "PACKET_TIME_INVALID");
  const deadline = timestamp(packet.deadline, "PACKET_TIME_INVALID");
  assert(deadline > start && deadline - start <= FIVE_MINUTES && now < deadline, "PACKET_WINDOW_INVALID");
  const observed = timestamp(packet.baseline.observedAt, "PACKET_BASELINE_TIME_INVALID");
  assert(observed <= start && observed <= now && start - observed <= FIVE_MINUTES && now - observed <= FIVE_MINUTES, "PACKET_BASELINE_STALE");
}

function validateBaseline(baseline) {
  exactKeys(baseline, ["observedAt", "accountsHash", "transactionsHash", "postingsHash", "balancesHash", "confirmedMinor", "pendingMinor", "ledgerVersion", "accounts", "transactions", "postings"]);
  for (const field of ["accountsHash", "transactionsHash", "postingsHash", "balancesHash"])
    encodedIdentifier(baseline[field], HEX64, 64);
  for (const [field, expected] of Object.entries({ confirmedMinor: -5000, pendingMinor: 0, ledgerVersion: 1, accounts: 5, transactions: 30, postings: 30 }))
    assert.equal(baseline[field], expected, "PACKET_BASELINE_CHANGED");
}

function validateRuntime(runtime) {
  exactKeys(runtime, ["api", "analysis", "assistant", "financial", "automaticPosting", "activeFinancialEpochs"]);
  for (const service of [runtime.api, runtime.analysis, runtime.assistant]) {
    exactKeys(service, ["sourceSha", "imageDigest", "running"]);
    assert.equal(service.sourceSha, API_SOURCE, "PACKET_RUNTIME_SOURCE_CHANGED");
    assert.equal(service.imageDigest, API_IMAGE, "PACKET_RUNTIME_IMAGE_CHANGED");
    assert.equal(service.running, true, "PACKET_RUNTIME_NOT_RUNNING");
  }
  exactKeys(runtime.financial, ["sourceSha", "running"]);
  assert.equal(runtime.financial.sourceSha, FINANCIAL_SOURCE, "PACKET_FINANCIAL_SOURCE_CHANGED");
  assert.equal(runtime.financial.running, false, "PACKET_FINANCIAL_NOT_STOPPED");
  assert.equal(runtime.automaticPosting, false, "PACKET_GLOBAL_POSTING_CHANGED");
  assert.equal(runtime.activeFinancialEpochs, 0, "PACKET_FINANCIAL_EPOCH_PRESENT");
}

function validatePreservation(packet) {
  exactKeys(packet.backup, ["hash", "verified", "rehearsed"]);
  encodedIdentifier(packet.backup.hash, HEX64, 64);
  assert.equal(packet.backup.verified, true, "PACKET_BACKUP_UNVERIFIED");
  assert.equal(packet.backup.rehearsed, true, "PACKET_BACKUP_UNREHEARSED");
  exactKeys(packet.declarations, ["noOldReplay", "unchangedTracking", "noAutomaticNotificationOrSMSPosting"]);
  for (const declaration of Object.values(packet.declarations))
    assert.equal(declaration, true, "PACKET_PRESERVATION_REQUIRED");
}

function validatePacket(packet, now = Date.now()) {
  canonicalJson(packet);
  exactKeys(packet, ["version", "mode", "project", "device", "attemptId", "sourceSha", "imageDigest", "apkHash", "controlHash", "migrationHash", "ownerId", "clerkSessionHash", "accountId", "categoryId", "kind", "maxTransactions", "maxPostings", "expenseMinor", "maxExpenseMinor", "currency", "locale", "startsAt", "deadline", "baseline", "runtime", "backup", "declarations"]);
  for (const [field, expected] of Object.entries({ version: 2, mode: "canary", project: "qcffvfbpzvpwcwxwjyro", device: "f66a40694eca", kind: "expense", maxTransactions: 1, maxPostings: 1, expenseMinor: 1000, maxExpenseMinor: 1000, currency: "SAR", locale: "ar" }))
    assert.equal(packet[field], expected, "PACKET_SCOPE_INVALID");
  for (const field of ["attemptId", "accountId", "categoryId"]) encodedIdentifier(packet[field], UUID, 36);
  encodedIdentifier(packet.ownerId, /^user_[a-zA-Z0-9_]{1,123}$/);
  encodedIdentifier(packet.sourceSha, SHA40, 40);
  for (const field of ["imageDigest", "apkHash", "controlHash", "migrationHash", "clerkSessionHash"])
    encodedIdentifier(packet[field], HEX64, 64);
  validateBaseline(packet.baseline);
  validateRuntime(packet.runtime);
  validatePreservation(packet);
  validateWindow(packet, now);
  return packet;
}

function approvalText(message, maximum) {
  assert(typeof message === "string" && message.trim().length >= 8 && message.length <= maximum, "APPROVAL_HUMAN_EVIDENCE_REQUIRED");
}

// Retained human approval may predate activation by hours. Execution is allowed
// only within [startsAt, deadline), with <=5-minute baseline age at this check.
// Validators never obtain approval, activate a service, write evidence or post money.
function approve(packet, approval, now = Date.now()) {
  validatePacket(packet, now);
  assert(Date.parse(packet.startsAt) <= now, "APPROVAL_WINDOW_NOT_STARTED");
  exactKeys(approval, ["kind", "packetHash", "messageReference", "verbatimMessage", "receivedAt"], "APPROVAL_FIELDS_REQUIRED");
  canonicalJson(approval);
  assert.equal(approval.kind, "direct-human-financial-approval", "APPROVAL_DIRECT_HUMAN_REQUIRED");
  assert.equal(approval.packetHash, scopeHash(packet), "APPROVAL_SCOPE_MISMATCH");
  approvalText(approval.messageReference, 256);
  approvalText(approval.verbatimMessage, 4096);
  assert(timestamp(approval.receivedAt, "APPROVAL_TIME_INVALID") <= now, "APPROVAL_TIME_FUTURE");
  return packet;
}

function validate(packet, approval, now = Date.now()) {
  return approval === undefined ? validatePacket(packet, now) : approve(packet, approval, now);
}

module.exports = { validate, validatePacket, approve, scopeHash };
