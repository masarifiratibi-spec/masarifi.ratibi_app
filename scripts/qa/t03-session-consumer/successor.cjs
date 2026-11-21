const {
  canonical,
  sha256,
  requireCondition: requireThat,
} = require("../t03-exact-sync/manifest.cjs");

const KIND = "t03-phase2-restored-once";
const STAGING = Object.freeze({
  parentManifestSha256:
    "f186ea4ed4b60d9a143b662d70c8208c9e9f76b33540d84a8d0889786bbbc5f6",
  parentJournalSha256:
    "88c7795aaab96f41c1f2ebe916d75b070338c287fa355d0368110ff45b5b4d8d",
  containerId:
    "b4c141b9faea43edb89dfcd164692985df4de94587ecdf1a799da3d228f681b4",
  receiptSqlSha256:
    "46c2b7cbcc66783b4f7e8efc48237436d108f4e337926fd261fcbd966046718f",
  receiptKeySha256:
    "132e34e5f47eec6f59a7484be7020e4a510c15aab2daba86d39eba57b6cd5a98",
  receiptBodySqlSha256:
    "14a4f9ef051ef2cdad9cc3f42276488bd93b8b17063b2ce0e39460681f582dda",
  requestIdSha256:
    "205ffd18b9e55dc27f58afa9084dc9b180a23c5e6b42dd9b8f88340de9cff62e",
  revisionSqlSha256:
    "0416b34a401e7c6ce81b31bd8dc103a4e64b2d8553e52aa2145cb8af65bb5c0e",
  originalPayloadHashSha256:
    "f4d652142a95f78c20b1264ec5545825a7781654887d8bbe2cbfb00c42e676f3",
});
const IMMUTABLE = [
  "id",
  "user_id",
  "device_id",
  "operation_id",
  "domain",
  "resource_type",
  "schema_version",
  "depends_on",
  "resource_id",
  "operation",
  "base_version",
  "payload",
  "payload_hash",
  "authenticated_at",
  "factor_age_seconds",
  "created_at",
];
const immutable = (row) =>
  Object.fromEntries(IMMUTABLE.map((key) => [key, row[key]]));
function parse(text, code) {
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(code);
  }
}

// Called only with evidence freshly read by the reviewed adapter's full RR reader.
// It returns a seed, never a reusable permission to skip a claim-time guard.
function restoredSeed(m, evidence, observation) {
  const { financialFingerprint } = require("./session.cjs");
  requireThat(
    m.restoredSuccessor?.kind === KIND && m.maxClaims === 6,
    "SUCCESSOR_FIXED_KIND_REQUIRED",
  );
  const pins = m.restoredSuccessor.pins;
  requireThat(
    pins &&
      Object.keys(STAGING).every((key) =>
        /^[a-f0-9]{64}$/.test(pins[key] ?? ""),
      ),
    "SUCCESSOR_PINS_REQUIRED",
  );
  if (m.scope === "staging")
    requireThat(
      canonical(pins) === canonical(STAGING),
      "SUCCESSOR_FIXED_PINS_MISMATCH",
    );
  requireThat(
    evidence &&
      typeof evidence.parentManifestRaw === "string" &&
      typeof evidence.parentJournalRaw === "string" &&
      sha256(evidence.parentManifestRaw) === pins.parentManifestSha256 &&
      sha256(evidence.parentJournalRaw) === pins.parentJournalSha256,
    "SUCCESSOR_PARENT_HASH_MISMATCH",
  );
  const parent = parse(evidence.parentManifestRaw, "SUCCESSOR_PARENT_INVALID");
  const p = parse(evidence.parentJournalRaw, "SUCCESSOR_PARENT_INVALID").state;
  const stop = evidence.ownedStop;
  requireThat(
    stop?.containerId === pins.containerId &&
      stop.contractMatch === true &&
      stop.running === false &&
      stop.portsEmpty === true &&
      stop.exitCode === 1 &&
      stop.oomKilled === false &&
      evidence.journalChainValidated === true &&
      evidence.generalWorkerRunning === false,
    "SUCCESSOR_PARENT_STOP_REQUIRED",
  );
  requireThat(
    parent.sessionId !== m.sessionId &&
      parent.maxClaims === 6 &&
      canonical(parent.phases) === canonical(m.phases) &&
      canonical(parent.binding) === canonical(m.binding),
    "SUCCESSOR_PARENT_BINDING_MISMATCH",
  );
  requireThat(
    p?.sessionId === parent.sessionId &&
      p.manifestSha256 === sha256(canonical(parent)) &&
      p.status === "stopped" &&
      p.failure === "SESSION_EXECUTION_FAILED" &&
      p.phase === 1 &&
      p.claims === 1 &&
      p.version === 2 &&
      p.note === m.phases[0] &&
      p.inflight === null &&
      canonical(p.operations) ===
        canonical([m.binding.initialRow.operation_id]) &&
      canonical(p.mutations) === canonical([m.binding.initialRow.id]) &&
      canonical(p.directReceipts) === "[]" &&
      p.deadlineAt === parent.deadlineAt,
    "SUCCESSOR_PARENT_STATE_MISMATCH",
  );
  if (m.scope === "staging")
    requireThat(
      m.binding.initialRow.operation_id ===
        "10de16e6-a966-41b4-a583-1716314b285b",
      "SUCCESSOR_ORIGINAL_OPERATION_MISMATCH",
    );
  requireThat(
    m.binding.initialVersion === 1 &&
      observation.pending?.length === 0 &&
      observation.noActiveAutomaticSalaryLinks === true &&
      observation.ownerActive === true &&
      observation.deviceActiveSameOwner === true,
    "SUCCESSOR_CURRENT_SAFETY_REQUIRED",
  );
  const row = observation.original;
  requireThat(
    row &&
      canonical(immutable(row)) ===
        canonical(immutable(m.binding.initialRow)) &&
      sha256(row.payload_hash) === pins.originalPayloadHashSha256 &&
      row.status === "applied" &&
      row.attempt_count === 1 &&
      row.processed_at &&
      !row.error &&
      row.lease_token === null &&
      row.locked_by === null &&
      row.locked_until === null &&
      row.result?.transaction?.transaction?.id === m.binding.resourceId &&
      row.result.transaction.transaction.version === 2 &&
      row.result.transaction.transaction.note === m.phases[0],
    "SUCCESSOR_ORIGINAL_APPLIED_REQUIRED",
  );
  requireThat(
    observation.resource?.transaction.version === 3 &&
      observation.resource.transaction.note === null &&
      financialFingerprint(observation.resource) ===
        financialFingerprint(m.binding.resource),
    "SUCCESSOR_RESTORED_RESOURCE_REQUIRED",
  );
  requireThat(
    observation.receipts?.length === 1,
    "SUCCESSOR_RESTORATION_RECEIPT_REQUIRED",
  );
  const r = observation.receipts[0];
  requireThat(
    sha256(r.sqlText) === pins.receiptSqlSha256,
    "SUCCESSOR_RESTORATION_HASH_MISMATCH",
  );
  const k = parse(r.sqlText, "SUCCESSOR_RESTORATION_INVALID");
  const body = k.response_body,
    result = body?.transaction?.transaction;
  requireThat(
    k.actor_id === m.binding.userId &&
      k.resource_ref === m.binding.resourceId &&
      k.scope === "ledger.transaction.revise" &&
      k.state === "completed" &&
      k.response_status === 200 &&
      /^sha256:[a-f0-9]{64}$/.test(k.key_hash ?? "") &&
      sha256(k.key_hash) === pins.receiptKeySha256 &&
      sha256(r.bodySqlText) === pins.receiptBodySqlSha256 &&
      canonical(parse(r.bodySqlText, "SUCCESSOR_RESTORATION_INVALID")) ===
        canonical(body) &&
      typeof body?.requestId === "string" &&
      body.requestId.length > 0 &&
      body.requestId === body.transaction.requestId &&
      sha256(body.requestId) === pins.requestIdSha256 &&
      result?.id === m.binding.resourceId &&
      result.version === 3 &&
      result.note === null &&
      Date.parse(k.created_at) >= Date.parse(row.processed_at),
    "SUCCESSOR_RESTORATION_CORRELATION_REQUIRED",
  );
  requireThat(
    observation.revisions?.length === 3,
    "SUCCESSOR_REVISIONS_REQUIRED",
  );
  const revisions = observation.revisions.map((entry) =>
    parse(entry.sqlText, "SUCCESSOR_REVISION_INVALID"),
  );
  const finance = (snapshot) =>
    Object.fromEntries(
      Object.entries(snapshot).filter(
        ([key]) => !["note", "version"].includes(key),
      ),
    );
  for (let i = 0; i < 3; i += 1) {
    const revision = revisions[i];
    requireThat(
      revision.transaction_id === m.binding.resourceId &&
        revision.revision_no === i + 1 &&
        canonical(finance(revision.after_snapshot)) ===
          canonical(finance(revisions[0].after_snapshot)) &&
        (!i ||
          canonical(revision.before_snapshot) ===
            canonical(revisions[i - 1].after_snapshot)),
      "SUCCESSOR_REVISION_FINANCIAL_MISMATCH",
    );
  }
  requireThat(
    sha256(observation.revisions[2].sqlText) === pins.revisionSqlSha256 &&
      revisions[1].after_snapshot.note === m.phases[0] &&
      revisions[1].after_snapshot.version === 2 &&
      revisions[2].after_snapshot.note === null &&
      revisions[2].after_snapshot.version === 3,
    "SUCCESSOR_RESTORATION_REVISION_MISMATCH",
  );
  requireThat(
    Number.isFinite(Date.parse(observation.observedAt)),
    "SUCCESSOR_OBSERVATION_CLOCK_REQUIRED",
  );
  return {
    sessionId: m.sessionId,
    manifestSha256: sha256(canonical(m)),
    phase: 2,
    claims: 1,
    version: 3,
    note: null,
    operations: [row.operation_id],
    mutations: [row.id],
    directReceipts: [k.key_hash],
    inflight: null,
    phaseStartedAt: observation.observedAt,
    deadlineAt: m.deadlineAt,
    status: "running",
    restoredSuccessor: {
      kind: KIND,
      parentSessionId: parent.sessionId,
      parentManifestSha256: pins.parentManifestSha256,
      parentJournalSha256: pins.parentJournalSha256,
      restorationReceiptSha256: pins.receiptSqlSha256,
      restorationRevisionSha256: pins.revisionSqlSha256,
    },
  };
}
module.exports = { KIND, STAGING, restoredSeed };
