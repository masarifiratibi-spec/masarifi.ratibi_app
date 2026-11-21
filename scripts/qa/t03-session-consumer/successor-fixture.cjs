const { sessionFixture } = require("./session-fixture.cjs");
const { canonical, sha256 } = require("../t03-exact-sync/manifest.cjs");
const { KIND } = require("./successor.cjs");

function successorFixture() {
  const f = sessionFixture();
  const now = f.dependencies.now();
  const parent = structuredClone(f.manifest);
  parent.deadlineAt = new Date(now - 1000).toISOString();
  const row = parent.binding.initialRow;
  const state = {
    sessionId: parent.sessionId,
    manifestSha256: sha256(canonical(parent)),
    status: "stopped",
    failure: "SESSION_EXECUTION_FAILED",
    phase: 1,
    claims: 1,
    version: 2,
    note: parent.phases[0],
    inflight: null,
    operations: [row.operation_id],
    mutations: [row.id],
    directReceipts: [],
    deadlineAt: parent.deadlineAt,
  };
  const evidence = {
    parentManifestRaw: JSON.stringify(parent),
    parentJournalRaw: JSON.stringify({
      sequence: 3,
      previous: "a".repeat(64),
      state,
    }),
    ownedStop: {
      containerId: "b".repeat(64),
      contractMatch: true,
      running: false,
      portsEmpty: true,
      exitCode: 1,
      oomKilled: false,
    },
    journalChainValidated: true,
    generalWorkerRunning: false,
  };
  const requestId = "synthetic-normal-restore-request";
  const body = {
    requestId,
    transaction: {
      requestId,
      transaction: { id: row.resource_id, version: 3, note: null },
    },
  };
  const k = {
    actor_id: row.user_id,
    resource_ref: row.resource_id,
    scope: "ledger.transaction.revise",
    state: "completed",
    response_status: 200,
    key_hash: `sha256:${"c".repeat(64)}`,
    response_body: body,
    created_at: new Date(now - 15000).toISOString(),
  };
  const snapshot = (version) => ({
    transactionId: row.resource_id,
    amountMinor: 2000,
    effect: [
      {
        accountId: f.manifest.binding.originalEffective.accountId,
        amountMinor: -2000,
      },
    ],
    version,
    note: version === 2 ? parent.phases[0] : null,
  });
  const observation = {
    pending: [],
    ownerActive: true,
    deviceActiveSameOwner: true,
    noActiveAutomaticSalaryLinks: true,
    original: {
      ...structuredClone(row),
      status: "applied",
      attempt_count: 1,
      processed_at: new Date(now - 30000).toISOString(),
      result: {
        transaction: {
          transaction: {
            id: row.resource_id,
            version: 2,
            note: parent.phases[0],
          },
        },
      },
    },
    resource: structuredClone(parent.binding.resource),
    receipts: [
      { sqlText: JSON.stringify(k), bodySqlText: JSON.stringify(body) },
    ],
    revisions: [1, 2, 3].map((version) => ({
      sqlText: JSON.stringify({
        transaction_id: row.resource_id,
        revision_no: version,
        before_snapshot: version === 1 ? {} : snapshot(version - 1),
        after_snapshot: snapshot(version),
      }),
    })),
    observedAt: new Date(now).toISOString(),
  };
  observation.resource.transaction.version = 3;
  const pins = {
    parentManifestSha256: sha256(evidence.parentManifestRaw),
    parentJournalSha256: sha256(evidence.parentJournalRaw),
    containerId: evidence.ownedStop.containerId,
    receiptSqlSha256: sha256(observation.receipts[0].sqlText),
    receiptKeySha256: sha256(k.key_hash),
    receiptBodySqlSha256: sha256(observation.receipts[0].bodySqlText),
    requestIdSha256: sha256(requestId),
    revisionSqlSha256: sha256(observation.revisions[2].sqlText),
    originalPayloadHashSha256: sha256(row.payload_hash),
  };
  f.manifest.sessionId = "t03-restored-successor-fixture";
  f.manifest.deadlineAt = new Date(now + 60000).toISOString();
  f.manifest.restoredSuccessor = { kind: KIND, pins };
  return { ...f, parent, evidence, observation };
}
module.exports = { successorFixture };
