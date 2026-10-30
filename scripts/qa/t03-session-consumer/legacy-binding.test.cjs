const { test } = require("node:test");
const assert = require("node:assert/strict");
const { syntheticManifest } = require("../t03-exact-sync/test-manifest.cjs");
const {
  validateManifest,
  canonical,
  sha256,
} = require("../t03-exact-sync/manifest.cjs");
const { deriveInitialSession } = require("./host-entry.cjs");
test("composed manifest accepts exact legacy five-field partial note update without inventing a stored reason", () => {
  const m = syntheticManifest(),
    original = m.binding.original;
  const payload = {
    title: original.title,
    merchant: original.merchant,
    note: m.binding.effective.note,
    occurredAt: original.occurredAt,
    amountMinor: original.amountMinor,
  };
  const raw = JSON.stringify(payload);
  m.binding.row.payload = payload;
  m.binding.payloadSha256 = sha256(canonical(payload));
  validateManifest(m);
  assert.equal(JSON.stringify(payload), raw);
  assert.equal(Object.hasOwn(payload, "reason"), false);
  for (const extra of [
    { unexpected: true },
    { reason: null },
    { reason: "" },
  ]) {
    const bad = structuredClone(m);
    Object.assign(bad.binding.row.payload, extra);
    bad.binding.payloadSha256 = sha256(canonical(bad.binding.row.payload));
    assert.throws(() => validateManifest(bad), /MANIFEST_EFFECTIVE_PAYLOAD/);
  }
});
test("authoritative projection cannot adopt a supplied different account through composed manifest validation", () => {
  const m = syntheticManifest();
  const row = {
    ...m.binding.row,
    payload: { ...m.binding.row.payload, accountId: "different-account" },
  };
  const o = m.binding.original;
  const resource = {
    transaction: {
      version: 1,
      status: "confirmed",
      kind: o.kind,
      amount_minor: o.amountMinor,
      currency_code: o.currencyCode,
      category_id: o.categoryId,
      title: o.title,
      merchant: o.merchant,
      payment_method: o.paymentMethod,
      note: o.note,
      occurred_at: o.occurredAt,
    },
    postings: [
      {
        account_id: o.accountId,
        amount_minor: -2000,
        clearing_state: "confirmed",
      },
    ],
  };
  const session = deriveInitialSession(
    {},
    row,
    resource,
    "t03-synthetic",
    "2026-10-26T01:00:00Z",
  );
  m.binding = {
    ...m.binding,
    row,
    original: session.binding.originalEffective,
    effective: { ...session.binding.originalEffective, note: row.payload.note },
    payloadSha256: sha256(canonical(row.payload)),
  };
  assert.throws(() => validateManifest(m), /MANIFEST_EFFECTIVE_PAYLOAD/);
  assert.equal(row.payload.accountId, "different-account");
});
