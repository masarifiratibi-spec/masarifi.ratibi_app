const { createHash } = require("node:crypto");

function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value !== null && typeof value === "object") {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function requireCondition(condition, code) {
  if (!condition) throw new Error(code);
}

function isLegacyTransactionUpdate(row) {
  const fields = ["title", "merchant", "note", "occurredAt", "amountMinor"];
  return (
    row?.schema_version === 1 &&
    row.domain === "transactions" &&
    row.resource_type === "transaction" &&
    row.operation === "update" &&
    row.payload &&
    !Object.hasOwn(row.payload, "reason") &&
    Object.keys(row.payload).length === fields.length &&
    fields.every((field) => Object.hasOwn(row.payload, field))
  );
}

// Keep all required execution pins explicit at this untrusted JSON boundary.
function validateManifest(manifest) {
  requireCondition(manifest?.enabled === true, "MANIFEST_DISABLED");
  requireCondition(manifest.version === 1, "MANIFEST_VERSION");
  requireCondition(
    ["staging", "synthetic-fixture"].includes(manifest.scope),
    "MANIFEST_SCOPE",
  );
  requireCondition(
    manifest.target && manifest.binding && manifest.provenance,
    "MANIFEST_INCOMPLETE",
  );
  const text = canonical(manifest);
  requireCondition(
    !/REQUIRED|PLACEHOLDER|<[^>]+>|TODO/.test(text),
    "MANIFEST_PLACEHOLDER",
  );
  const { target, binding, provenance } = manifest;
  for (const key of [
    "database",
    "user",
    "sessionUser",
    "address",
    "systemIdentifier",
    "workerSessionUser",
  ]) {
    requireCondition(
      typeof target[key] === "string" && target[key].length > 0,
      "MANIFEST_TARGET",
    );
  }
  requireCondition(
    Number.isInteger(target.port) && target.port > 0 && target.port <= 65535,
    "MANIFEST_TARGET",
  );
  if (manifest.scope === "staging") {
    requireCondition(
      target.project === "qcffvfbpzvpwcwxwjyro" &&
        target.api === "https://api.staging.masarifiratibi.com",
      "MANIFEST_TARGET",
    );
    requireCondition(
      binding.row?.operation_id === "10de16e6-a966-41b4-a583-1716314b285b",
      "MANIFEST_OPERATION",
    );
  } else {
    requireCondition(
      target.address === "127.0.0.1" && target.database === "t03_synthetic",
      "MANIFEST_FIXTURE_TARGET",
    );
  }
  validateBinding(binding);
  if (manifest.scope === "staging") {
    requireCondition(
      binding.original.amountMinor === 2000 &&
        binding.original.kind === "expense" &&
        binding.original.currencyCode === "SAR" &&
        binding.original.title === "QA-20261025-EXPENSE-20" &&
        binding.original.note === null &&
        binding.effective.note === "QA-T03-WARM-20261025",
      "MANIFEST_APPROVED_QA_PREDICATES",
    );
  }
  for (const key of [
    "catalogSha256",
    "imageSha256",
    "reviewedArtifactSha256",
    "claimSha256",
    "completeSha256",
    "retrySha256",
  ]) {
    requireCondition(
      /^[a-f0-9]{64}$/.test(provenance[key] ?? ""),
      "MANIFEST_PROVENANCE",
    );
  }
  requireCondition(
    provenance.sources && Object.keys(provenance.sources).length >= 4,
    "MANIFEST_SOURCES",
  );
  requireCondition(
    Object.entries(provenance.sources).every(
      ([path, hash]) => !path.includes("..") && /^[a-f0-9]{64}$/.test(hash),
    ),
    "MANIFEST_SOURCES",
  );
  requireCondition(
    /^t03-[a-z0-9-]{1,100}$/.test(manifest.workerId),
    "MANIFEST_WORKER",
  );
  requireCondition(
    Number.isInteger(manifest.leaseSeconds) &&
      manifest.leaseSeconds >= 1 &&
      manifest.leaseSeconds <= 300,
    "MANIFEST_LEASE",
  );
  return manifest;
}

function validateBinding(binding) {
  const row = binding.row;
  requireCondition(
    row &&
      ["id", "user_id", "device_id", "resource_id", "operation_id"].every(
        (key) => typeof row[key] === "string" && row[key].length > 0,
      ),
    "MANIFEST_BINDING",
  );
  requireCondition(
    row.domain === "transactions" &&
      row.resource_type === "transaction" &&
      row.operation === "update" &&
      row.schema_version === 1,
    "MANIFEST_OPERATION",
  );
  requireCondition(
    Number.isInteger(Number(row.base_version)) &&
      Number(row.base_version) >= 1 &&
      Array.isArray(row.depends_on) &&
      row.depends_on.length === 0,
    "MANIFEST_BINDING",
  );
  requireCondition(
    row.status === "received" &&
      row.attempt_count === 0 &&
      row.lease_token === null &&
      row.locked_by === null &&
      row.locked_until === null,
    "MANIFEST_STATE",
  );
  requireCondition(
    sha256(canonical(row.payload)) === binding.payloadSha256 &&
      /^[a-f0-9]{64}$/.test(binding.resourceSha256),
    "MANIFEST_PAYLOAD",
  );
  const original = binding.original;
  const effective = binding.effective;
  const fields = [
    "kind",
    "amountMinor",
    "accountId",
    "categoryId",
    "currencyCode",
    "occurredAt",
    "title",
    "merchant",
    "paymentMethod",
    "note",
  ];
  requireCondition(
    original &&
      effective &&
      fields.every((key) => Object.hasOwn(original, key)),
    "MANIFEST_EFFECTIVE",
  );
  requireCondition(
    typeof effective.note === "string" && effective.note !== original.note,
    "MANIFEST_NOTE",
  );
  requireCondition(
    canonical({ ...effective, note: original.note }) === canonical(original),
    "MANIFEST_NOT_NOTE_ONLY",
  );
  requireCondition(
    row.payload &&
      (isLegacyTransactionUpdate(row) ||
        (typeof row.payload.reason === "string" &&
          row.payload.reason.trim().length > 0)) &&
      Object.keys(row.payload).every(
        (key) =>
          key === "reason" ||
          (fields.includes(key) &&
            key !== "currencyCode" &&
            canonical(row.payload[key]) === canonical(effective[key])),
      ) &&
      row.payload.note === effective.note,
    "MANIFEST_EFFECTIVE_PAYLOAD",
  );
}

module.exports = {
  canonical,
  sha256,
  requireCondition,
  validateManifest,
  isLegacyTransactionUpdate,
};
