const path = require("node:path");
const apiRequire = require("node:module").createRequire(
  path.resolve(__dirname, "../../../apps/api/package.json"),
);
apiRequire("ts-node").register({
  project: path.resolve(__dirname, "../../../apps/api/tsconfig.json"),
});
const { normalizeMutationBatch } = apiRequire("./src/sync/sync.dto.ts");
const { hashSyncMutation } = apiRequire("./src/sync/sync.codec.ts");
const { hashNormalizedCommand } = apiRequire("./src/ledger/idempotency.ts");

function normalReceivedHash(row) {
  const normalized = normalizeMutationBatch({
    mutations: [
      {
        operationId: row.operation_id,
        domain: row.domain,
        resourceType: row.resource_type,
        schemaVersion: row.schema_version,
        dependsOn: row.depends_on,
        operation: row.operation,
        resourceId: row.resource_id,
        baseVersion: Number(row.base_version),
        payload: row.payload,
      },
    ],
  }).executionOrder[0];
  return hashSyncMutation(normalized);
}
const {
  syntheticManifest,
  id,
} = require("../t03-exact-sync/test-manifest.cjs");
const PHASES = [
  "QA-T03-WARM-20261025",
  null,
  "QA-T03-WARM-FINAL-20261025",
  null,
  "QA-T03-COLD-20261025",
  null,
];

function sessionFixture() {
  const initial = syntheticManifest();
  const resource = {
    transaction: {
      id: id(3),
      user_id: "synthetic-owner",
      version: 1,
      note: null,
      amount_minor: 2000,
      currency_code: "SAR",
      title: "Synthetic QA",
    },
    postings: [{ id: id(7), account_id: id(4), amount_minor: -2000 }],
  };
  const manifest = {
    version: 1,
    enabled: true,
    scope: "synthetic-fixture",
    sessionId: "t03-fixture-six",
    workerId: "t03-fixture-six",
    leaseSeconds: 60,
    maxClaims: 6,
    pollMs: 250,
    deadlineAt: "2026-10-25T18:00:00.000Z",
    phases: PHASES,
    binding: {
      userId: "synthetic-owner",
      deviceId: id(6),
      resourceId: id(3),
      initialVersion: 1,
      originalEffective: initial.binding.original,
      initialRow: initial.binding.row,
      resource: structuredClone(resource),
    },
  };
  manifest.binding.initialRow.payload.note = PHASES[0];
  manifest.binding.initialRow.payload_hash = normalReceivedHash(
    manifest.binding.initialRow,
  );
  const events = [];
  let phase = 0;
  let receipt;
  let time = Date.parse("2026-10-25T17:00:00Z");
  function nextRow() {
    const row = {
      ...structuredClone(initial.binding.row),
      id: id(20 + phase),
      operation_id: id(30 + phase),
      base_version: 1 + phase,
      created_at: new Date(time).toISOString(),
      payload: { note: PHASES[phase], reason: "Synthetic QA note edit" },
    };
    row.payload_hash = normalReceivedHash(row);
    return row;
  }
  let pending = structuredClone(manifest.binding.initialRow);
  const fixture = {
    manifest,
    events,
    resource,
    onObserve: undefined,
    onClaim: undefined,
    dependencies: {
      hashNormalizedCommand,
      now: () => time,
      sleep: async (ms) => {
        time += ms;
      },
      stopping: () => false,
      journal: {
        async begin() {
          events.push({ type: "begin" });
        },
        async save(state) {
          events.push({ type: "persist", state: structuredClone(state) });
        },
      },
      async observe(state) {
        await fixture.onObserve?.(state);
        if (state.phase > phase) {
          phase = state.phase;
          receipt = undefined;
          if (phase < 6) pending = nextRow();
        }
        return {
          observedAt: new Date(time).toISOString(),
          noActiveAutomaticSalaryLinks: true,
          pending: pending ? [structuredClone(pending)] : [],
          resource: structuredClone(resource),
          mutation: receipt ? structuredClone(receipt) : undefined,
          direct: [],
        };
      },
      async claimAndExecute(binding) {
        events.push({ type: "claim", row: structuredClone(binding.row) });
        await fixture.onClaim?.(binding);
        resource.transaction.note = binding.row.payload.note;
        resource.transaction.version += 1;
        receipt = {
          ...structuredClone(binding.row),
          status: "applied",
          attempt_count: 1,
          processed_at: new Date(time).toISOString(),
          result: {
            transaction: {
              transaction: {
                id: id(3),
                version: resource.transaction.version,
                note: resource.transaction.note,
              },
            },
          },
        };
        pending = undefined;
        return { outcome: "processed-once", claimed: 1, executed: 1 };
      },
    },
  };
  return fixture;
}
module.exports = { sessionFixture, normalReceivedHash, apiRequire };
