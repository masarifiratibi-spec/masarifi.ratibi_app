// Operational fixture checks. Never supplies or rewrites model output.
const assert = require("node:assert/strict");
const { createHash } = require("node:crypto");
const { isDeepStrictEqual } = require("node:util");
const { inspectCategory } = require("./voice-category-acceptance.cjs");
const FOOD_CATEGORY_ID = "04000000-0000-4000-8000-000000000002";
const SHOPPING_CATEGORY_ID = "04000000-0000-4000-8000-000000000006";
const fingerprint = (value) =>
  createHash("sha256").update(JSON.stringify(value)).digest("hex");
function preflight(context, references) {
  const expected = references.filter((x) => x.id === FOOD_CATEGORY_ID);
  const unique =
    expected.length === 1 &&
    expected[0].kind === "category" &&
    expected[0].data?.kind === "expense";
  const aliases = references.map((x) => x.alias),
    ids = references.map((x) => x.id);
  const uniqueMapping =
    aliases.every((x) => typeof x === "string" && x.length > 0) &&
    new Set(aliases).size === aliases.length &&
    new Set(ids).size === ids.length;
  const descriptors = references.map(({ alias, kind, version, data }) => ({
    alias,
    kind,
    version,
    data,
  }));
  const inclusion = isDeepStrictEqual(context.references, descriptors);
  if (!unique || !uniqueMapping || !inclusion)
    throw new Error("VOICE_CANARY_REFERENCE_INVALID");
  return {
    expectedReferenceUnique: true,
    aliasMappingUnique: true,
    outgoingDescriptorsMatch: true,
    referenceFingerprint: fingerprint(references),
    contextReferenceFingerprint: fingerprint(descriptors),
  };
}
function categoryEvidence(value, rawValue, references) {
  const selected = typeof value === "string" && value.length > 0;
  const matches = selected
    ? references.filter((x) => x.alias === value || x.id === value)
    : [];
  const match = matches.length === 1 ? matches[0] : undefined;
  const classification = !selected
    ? "missing"
    : !match
      ? "unknown"
      : match.kind !== "category" || match.data?.kind !== "expense"
        ? "wrong_kind"
        : match.id === FOOD_CATEGORY_ID
          ? "food"
          : match.id === SHOPPING_CATEGORY_ID
            ? "shopping"
            : "other_supplied_expense";
  const identifierForm =
    typeof rawValue !== "string"
      ? "invalid"
      : rawValue === ""
        ? "empty"
        : /^CATEGORY-[1-9][0-9]*$/.test(rawValue)
          ? "alias"
          : /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
                rawValue,
              )
            ? "uuid"
            : "invalid";
  return {
    identifierForm,
    unchanged:
      typeof rawValue === "string" && rawValue.length > 0 && value === rawValue,
    classification,
    ...inspectCategory(value, references, FOOD_CATEGORY_ID),
  };
}
function semanticChecks(output, context, references = context.references) {
  return {
    transcriptPresent:
      typeof output.transcript === "string" && output.transcript.length > 0,
    languageEnglish: output.language === "en",
    amountCorrect: output.proposal?.amountMinor === "1500",
    currencyCorrect: output.proposal?.currency === "SAR",
    expenseCorrect: output.proposal?.type === "transaction.create",
    dateCorrect: output.proposal?.date === context.capture.referenceLocalDate,
    accountCorrect: references.some(
      (x) =>
        (x.alias === output.proposal?.accountId ||
          x.id === output.proposal?.accountId) &&
        x.kind === "account" &&
        x.data?.type === "cash" &&
        x.data?.currency === "SAR",
    ),
    ...inspectCategory(
      output.proposal?.categoryId,
      references,
      FOOD_CATEGORY_ID,
    ),
    transcriptCorrect:
      /fifteen|15/i.test(output.transcript) &&
      /grocer/i.test(output.transcript) &&
      /cash/i.test(output.transcript),
  };
}
async function completeCanary(
  complete,
  input,
  references,
  evidence,
  readRawCategory = () => undefined,
) {
  const context = JSON.parse(input.userContent[0].text);
  evidence.preflight = preflight(context, references);
  // Observe the original parser. Semantic assertions run only after gateway completion.
  const result = await complete({
    ...input,
    parse(value) {
      evidence.normalization = true;
      evidence.canonicalValidation = false;
      const output = input.parse(value);
      evidence.canonicalValidation = true;
      return output;
    },
  });
  evidence.category = categoryEvidence(
    result.value.proposal?.categoryId,
    readRawCategory(),
    references,
  );
  evidence.semantic = semanticChecks(result.value, context, references);
  evidence.semanticAccepted = Object.values(evidence.semantic).every(
    (x) => x === true,
  );
  if (!evidence.semanticAccepted)
    throw new Error("VOICE_CANARY_SEMANTIC_FAILED");
  return result;
}
function receiptEvidence(receipt) {
  const generation = receipt.generationId;
  const usage = receipt.usage;
  return {
    generationId:
      typeof generation === "string" &&
      generation.length <= 160 &&
      /^gen-[A-Za-z0-9-]+$/.test(generation)
        ? generation
        : null,
    model:
      receipt.model === "google/gemini-3.5-flash-lite" ? receipt.model : null,
    requestedProvider:
      receipt.provider === "google-vertex" ? receipt.provider : null,
    fallbackUsed:
      typeof receipt.fallbackUsed === "boolean" ? receipt.fallbackUsed : null,
    usage:
      usage &&
      ["inputTokens", "outputTokens", "cost"].every(
        (k) => Number.isFinite(usage[k]) && usage[k] >= 0,
      )
        ? {
            inputTokens: usage.inputTokens,
            outputTokens: usage.outputTokens,
            cost: usage.cost,
          }
        : null,
    latencyMs:
      Number.isFinite(receipt.latencyMs) && receipt.latencyMs >= 0
        ? receipt.latencyMs
        : null,
  };
}
async function saveCanaryResult(save, args, evidence) {
  evidence.resolution = true;
  evidence.persistence = false;
  const result = await save(...args);
  evidence.persistence = true;
  evidence.proposalPersisted = true;
  evidence.workStatus = "proposed";
  evidence.failureCode = null;
  return result;
}
function assertCanaryEvidence(evidence) {
  assert.equal(evidence.dispatches, 1);
  assert.equal(evidence.claimed, 1);
  assert.equal(evidence.proposalPersisted, true);
  assert.equal(evidence.failureCode, null);
  assert.equal(evidence.envelope.model, "google/gemini-3.5-flash-lite");
  assert.equal(evidence.envelope.finishReason, "stop");
  assert.equal(evidence.receipt.fallbackUsed, false);
  assert(
    Object.values(evidence.semantic).every((x) => x === true),
    "VOICE_CANARY_SEMANTIC_FAILED",
  );
}
module.exports = {
  saveCanaryResult,
  assertCanaryEvidence,
  FOOD_CATEGORY_ID,
  receiptEvidence,
  preflight,
  categoryEvidence,
  semanticChecks,
  completeCanary,
};
