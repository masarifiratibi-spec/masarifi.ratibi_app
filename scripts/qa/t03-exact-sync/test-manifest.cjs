const { readFileSync } = require("node:fs");
const { resolve } = require("node:path");
const { canonical, sha256 } = require("./manifest.cjs");
const { requiredSources } = require("./runner.cjs");

const sourceRoot = resolve(__dirname, "../../..");
const id = (suffix) =>
  `11111111-1111-4111-8111-${String(suffix).padStart(12, "0")}`;

function syntheticManifest() {
  const original = {
    kind: "expense",
    amountMinor: 2000,
    accountId: id(4),
    categoryId: id(5),
    currencyCode: "SAR",
    occurredAt: "2026-10-20T12:00:00.000Z",
    title: "Synthetic QA",
    merchant: null,
    paymentMethod: null,
    note: null,
  };
  const payload = { note: "Synthetic note", reason: "Synthetic QA note edit" };
  return {
    version: 1,
    enabled: true,
    scope: "synthetic-fixture",
    workerId: "t03-synthetic-one",
    leaseSeconds: 60,
    target: {
      database: "t03_synthetic",
      user: "t03_bootstrap",
      sessionUser: "t03_bootstrap",
      workerSessionUser: "t03_normal",
      address: "127.0.0.1",
      port: 55473,
      systemIdentifier: "synthetic-test-only",
    },
    binding: {
      row: {
        id: id(1),
        operation_id: id(2),
        resource_id: id(3),
        user_id: "synthetic-owner",
        device_id: id(6),
        domain: "transactions",
        resource_type: "transaction",
        operation: "update",
        schema_version: 1,
        base_version: 1,
        depends_on: [],
        status: "received",
        attempt_count: 0,
        lease_token: null,
        locked_by: null,
        locked_until: null,
        payload,
      },
      payloadSha256: sha256(canonical(payload)),
      resourceSha256: "a".repeat(64),
      original,
      effective: { ...original, note: payload.note },
    },
    provenance: {
      sources: Object.fromEntries(
        requiredSources.map((path) => [
          path,
          sha256(readFileSync(resolve(sourceRoot, path))),
        ]),
      ),
      catalogSha256: "b".repeat(64),
      claimSha256: "c".repeat(64),
      completeSha256: "d".repeat(64),
      retrySha256: "e".repeat(64),
      imageSha256: "f".repeat(64),
      reviewedArtifactSha256: "a".repeat(64),
    },
  };
}

module.exports = { syntheticManifest, sourceRoot, id };
