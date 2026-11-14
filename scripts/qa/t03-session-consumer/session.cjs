const {
  canonical,
  sha256,
  requireCondition: requireThat,
  isLegacyTransactionUpdate,
} = require("../t03-exact-sync/manifest.cjs");

const PHASES = Object.freeze([
  "QA-T03-WARM-20261025",
  null,
  "QA-T03-WARM-FINAL-20261025",
  null,
  "QA-T03-COLD-20261025",
  null,
]);
const COPY_FIELDS = [
  "kind",
  "amountMinor",
  "accountId",
  "categoryId",
  "occurredAt",
  "title",
  "merchant",
  "paymentMethod",
];

function financialFingerprint(resource) {
  requireThat(
    resource?.transaction && Array.isArray(resource.postings),
    "SESSION_RESOURCE_MISSING",
  );
  const financial = Object.fromEntries(
    Object.entries(resource.transaction).filter(
      ([key]) => !["note", "version", "updated_at"].includes(key),
    ),
  );
  return sha256(
    canonical({ transaction: financial, postings: resource.postings }),
  );
}

function validateSession(m, now) {
  requireThat(
    m?.enabled === true &&
      m.version === 1 &&
      ["staging", "synthetic-fixture"].includes(m.scope),
    "SESSION_DISABLED_OR_SCOPE",
  );
  requireThat(
    /^t03-[a-z0-9-]{1,100}$/.test(m.sessionId ?? "") &&
      m.maxClaims === 6 &&
      canonical(m.phases) === canonical(PHASES),
    "SESSION_LIMIT_OR_PHASES",
  );
  requireThat(
    /^t03-[a-z0-9-]{1,100}$/.test(m.workerId ?? "") &&
      Number.isInteger(m.leaseSeconds) &&
      m.leaseSeconds >= 1 &&
      m.leaseSeconds <= 300,
    "SESSION_WORKER_OR_LEASE",
  );
  requireThat(
    Number.isInteger(m.pollMs) &&
      m.pollMs >= 250 &&
      m.pollMs <= 10000 &&
      Date.parse(m.deadlineAt) > now &&
      Date.parse(m.deadlineAt) <= now + 7200000,
    "SESSION_DEADLINE",
  );
  const b = m.binding;
  requireThat(
    b &&
      ["userId", "deviceId", "resourceId"].every(
        (key) => typeof b[key] === "string" && b[key].length > 0,
      ) &&
      Number.isSafeInteger(b.initialVersion) &&
      b.initialVersion >= 1 &&
      b.originalEffective,
    "SESSION_BINDING",
  );
  requireThat(
    b.resource.transaction.id === b.resourceId &&
      b.resource.transaction.user_id === b.userId &&
      b.resource.transaction.note === null &&
      Number(b.resource.transaction.version) === b.initialVersion,
    "SESSION_INITIAL_RESOURCE",
  );
  financialFingerprint(b.resource);
  requireThat(
    b.initialRow &&
      b.initialRow.operation_id ===
        (m.scope === "staging"
          ? "10de16e6-a966-41b4-a583-1716314b285b"
          : b.initialRow.operation_id),
    "SESSION_INITIAL_OPERATION",
  );
  if (m.scope === "staging")
    requireThat(
      b.originalEffective.kind === "expense" &&
        b.originalEffective.amountMinor === 2000 &&
        b.originalEffective.currencyCode === "SAR" &&
        b.originalEffective.title === "QA-20261025-EXPENSE-20" &&
        b.originalEffective.note === null,
      "SESSION_QA_PREDICATES",
    );
  return m;
}

function assertResource(resource, manifest, expectedVersion, expectedNote) {
  requireThat(
    financialFingerprint(resource) ===
      financialFingerprint(manifest.binding.resource),
    "SESSION_FINANCIAL_DRIFT",
  );
  requireThat(
    Number(resource.transaction.version) === expectedVersion &&
      resource.transaction.note === expectedNote,
    "SESSION_STATE_MISMATCH",
  );
}

function normalizedMutationEnvelope(row) {
  return {
    operationId: row.operation_id,
    domain: row.domain,
    resourceType: row.resource_type,
    schemaVersion: row.schema_version,
    dependsOn: row.depends_on,
    operation: row.operation,
    resourceId: row.resource_id,
    baseVersion: row.base_version === null ? null : Number(row.base_version),
    payload: row.payload,
  };
}

function assertCandidate(row, m, state, hashNormalizedCommand) {
  const b = m.binding;
  requireThat(
    row &&
      row.user_id === b.userId &&
      row.device_id === b.deviceId &&
      row.resource_id === b.resourceId &&
      row.domain === "transactions" &&
      row.resource_type === "transaction" &&
      row.operation === "update" &&
      row.schema_version === 1 &&
      Number(row.base_version) === state.version,
    "SESSION_OPERATION_BINDING",
  );
  requireThat(
    row.status === "received" &&
      row.attempt_count === 0 &&
      row.locked_by === null &&
      row.locked_until === null &&
      row.lease_token === null &&
      Array.isArray(row.depends_on) &&
      row.depends_on.length === 0 &&
      row.result == null &&
      row.error == null,
    "SESSION_OPERATION_STATE",
  );
  requireThat(
    !state.operations.includes(row.operation_id) &&
      !state.mutations.includes(row.id),
    "SESSION_OPERATION_REPLAY",
  );
  if (state.phase === 0)
    requireThat(
      canonical(row) === canonical(b.initialRow),
      "SESSION_INITIAL_ROW_CHANGED",
    );
  else
    requireThat(
      Date.parse(row.created_at) >= Date.parse(state.phaseStartedAt),
      "SESSION_OLD_OPERATION",
    );
  requireThat(
    row.payload &&
      row.payload.note === m.phases[state.phase] &&
      (isLegacyTransactionUpdate(row) ||
        (typeof row.payload.reason === "string" &&
          row.payload.reason.trim().length > 0)) &&
      Object.entries(row.payload).every(
        ([key, value]) =>
          key === "reason" ||
          key === "note" ||
          (COPY_FIELDS.includes(key) &&
            canonical(value) === canonical(b.originalEffective[key])),
      ),
    "SESSION_PAYLOAD_NOT_NOTE_ONLY",
  );
  requireThat(
    typeof hashNormalizedCommand === "function" &&
      row.payload_hash ===
        hashNormalizedCommand(normalizedMutationEnvelope(row)),
    "SESSION_PAYLOAD_HASH",
  );
}

function receiptSummary(body) {
  return body?.transaction?.transaction;
}

function verifyApplied(observation, binding, manifest, state) {
  requireThat(
    observation.noActiveAutomaticSalaryLinks === true,
    "SESSION_ACTIVE_SALARY_LINK",
  );
  const row = observation.mutation;
  requireThat(
    row?.id === binding.row.id &&
      row.operation_id === binding.row.operation_id &&
      row.user_id === manifest.binding.userId &&
      row.resource_id === manifest.binding.resourceId &&
      row.status === "applied" &&
      row.attempt_count === 1 &&
      row.processed_at &&
      !row.error &&
      row.lease_token === null &&
      row.locked_by === null &&
      row.locked_until === null,
    "SESSION_APPLIED_RECEIPT_REQUIRED",
  );
  const result = receiptSummary(row.result);
  requireThat(
    result?.id === manifest.binding.resourceId &&
      result.version === state.version + 1 &&
      result.note === manifest.phases[state.phase],
    "SESSION_APPLIED_RESULT_MISMATCH",
  );
  assertResource(
    observation.resource,
    manifest,
    state.version + 1,
    manifest.phases[state.phase],
  );
}

function directCleanup(observation, m, state) {
  requireThat(
    state.phase % 2 === 1 && observation.pending.length === 0,
    "SESSION_UNEXPECTED_DIRECT_CHANGE",
  );
  assertResource(observation.resource, m, state.version + 1, null);
  const matches = observation.direct.filter((receipt) => {
    const result = receiptSummary(receipt.response_body);
    return (
      receipt.actor_id === m.binding.userId &&
      receipt.scope === "ledger.transaction.revise" &&
      receipt.resource_ref === m.binding.resourceId &&
      receipt.state === "completed" &&
      receipt.response_status === 200 &&
      /^sha256:[a-f0-9]{64}$/.test(receipt.key_hash ?? "") &&
      !state.directReceipts.includes(receipt.key_hash) &&
      Date.parse(receipt.created_at) >= Date.parse(state.phaseStartedAt) &&
      result?.id === m.binding.resourceId &&
      result.version === state.version + 1 &&
      result.note === null &&
      typeof receipt.response_body.requestId === "string" &&
      receipt.response_body.requestId ===
        receipt.response_body.transaction.requestId
    );
  });
  requireThat(matches.length === 1, "SESSION_DIRECT_RECEIPT_AMBIGUOUS");
  return matches[0].key_hash;
}

/** All observations and exact private bindings use a reviewed adapter, never a scheduler. */
async function runSession(input, dependencies) {
  const m = validateSession(input, dependencies.now());
  requireThat(!m.restoredSuccessor, "SUCCESSOR_SEPARATE_ADMISSION_REQUIRED");
  const state = {
    sessionId: m.sessionId,
    manifestSha256: sha256(canonical(m)),
    phase: 0,
    claims: 0,
    version: m.binding.initialVersion,
    note: null,
    operations: [],
    mutations: [],
    directReceipts: [],
    inflight: null,
    phaseStartedAt: new Date(dependencies.now()).toISOString(),
    deadlineAt: m.deadlineAt,
    status: "running",
  };
  // Exclusive durable begin prevents concurrent/restarted invocations resetting phase or budget.
  await dependencies.journal.begin(state);
  return runState(m, dependencies, state);
}

async function runRestoredSuccessor(input, dependencies) {
  const m = validateSession(input, dependencies.now());
  requireThat(!dependencies.stopping(), "SESSION_SHUTDOWN");
  requireThat(
    typeof dependencies.admitRestoredSuccessor === "function" &&
      typeof dependencies.journal.beginRestoredSuccessor === "function",
    "SUCCESSOR_ADMISSION_REQUIRED",
  );
  const fresh = await dependencies.admitRestoredSuccessor(m);
  const state = require("./successor.cjs").restoredSeed(
    m,
    fresh.evidence,
    fresh.observation,
  );
  requireThat(
    !dependencies.stopping() && dependencies.now() < Date.parse(m.deadlineAt),
    "SESSION_SHUTDOWN_OR_DEADLINE",
  );
  await dependencies.journal.beginRestoredSuccessor(state);
  return runState(m, dependencies, state);
}

async function runState(m, dependencies, state) {
  try {
    while (state.phase < m.phases.length) {
      requireThat(!dependencies.stopping(), "SESSION_SHUTDOWN");
      requireThat(
        dependencies.now() < Date.parse(m.deadlineAt),
        "SESSION_DEADLINE",
      );
      const observation = await dependencies.observe(state);
      requireThat(
        observation.noActiveAutomaticSalaryLinks === true,
        "SESSION_ACTIVE_SALARY_LINK",
      );
      let phaseObservedAt = observation.observedAt;
      requireThat(
        Array.isArray(observation.pending) && observation.pending.length <= 1,
        "SESSION_UNRELATED_PENDING",
      );
      if (observation.pending.length) {
        assertResource(observation.resource, m, state.version, state.note);
        const row = observation.pending[0];
        assertCandidate(row, m, state, dependencies.hashNormalizedCommand);
        requireThat(state.claims < m.maxClaims, "SESSION_CLAIM_LIMIT");
        requireThat(
          !dependencies.stopping() &&
            dependencies.now() < Date.parse(m.deadlineAt),
          "SESSION_SHUTDOWN_OR_DEADLINE",
        );
        const binding = {
          row,
          resource: observation.resource,
          phase: state.phase,
        };
        state.inflight = binding;
        state.claims += 1;
        state.operations.push(row.operation_id);
        state.mutations.push(row.id);
        // Binding and consumed budget reach durable storage BEFORE any mutable claim.
        await dependencies.journal.save(state);
        const executed = await dependencies.claimAndExecute(binding);
        requireThat(
          executed?.outcome === "processed-once" &&
            executed.claimed === 1 &&
            executed.executed === 1,
          "SESSION_EXECUTION_UNCERTAIN",
        );
        const after = await dependencies.observe(state);
        verifyApplied(after, binding, m, state);
        phaseObservedAt = after.observedAt;
        state.inflight = null;
      } else if (
        Number(observation.resource.transaction.version) !== state.version ||
        observation.resource.transaction.note !== state.note
      ) {
        state.directReceipts.push(directCleanup(observation, m, state));
      } else {
        assertResource(observation.resource, m, state.version, state.note);
        await dependencies.sleep(m.pollMs);
        continue;
      }
      state.note = m.phases[state.phase];
      state.version += 1;
      state.phase += 1;
      requireThat(
        Number.isFinite(Date.parse(phaseObservedAt)),
        "SESSION_SERVER_CLOCK_MISSING",
      );
      state.phaseStartedAt = new Date(phaseObservedAt).toISOString();
      await dependencies.journal.save(state);
    }
    state.status = "completed";
    await dependencies.journal.save(state);
    return { outcome: "completed", phases: state.phase, claims: state.claims };
  } catch (error) {
    state.status = "stopped";
    state.failure = /^[A-Z][A-Z0-9_]+$/.test(error.message ?? "")
      ? error.message
      : "SESSION_EXECUTION_FAILED";
    await dependencies.journal.save(state);
    throw new Error(state.failure);
  }
}

module.exports = {
  PHASES,
  validateSession,
  financialFingerprint,
  normalizedMutationEnvelope,
  runSession,
  runRestoredSuccessor,
};
