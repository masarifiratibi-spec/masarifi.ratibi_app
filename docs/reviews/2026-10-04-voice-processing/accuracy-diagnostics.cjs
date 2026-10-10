// Offline/transient comparison only. No provider, database, proposal or ledger capabilities.
const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const adapter = require('../../../apps/api/dist/src/ai/voice-batch.js');

function matchFields(command, expected) {
  return command && command.kind === expected.kind &&
    command.accountId === expected.accountId && expected.categoryIds.includes(command.categoryId) &&
    command.currency === expected.currency && command.occurredAt === expected.occurredAt && command.source === 'voice';
}
function distinctMatches(matrix) {
  const assigned = new Map();
  function assign(wanted, visited) {
    for (let slot = 0; slot < matrix[wanted].length; slot++) {
      if (!matrix[wanted][slot] || visited.has(slot)) continue;
      visited.add(slot);
      if (!assigned.has(slot) || assign(assigned.get(slot), visited)) {
        assigned.set(slot, wanted);
        return true;
      }
    }
    return false;
  }
  return matrix.map((_, wanted) => assign(wanted, new Set()));
}
function comparePipeline(raw, context, expected) {
  assert(expected.length >= 1 && expected.length <= 10);
  for (const row of expected) {
    assert(Number.isSafeInteger(row.amountMinor) && row.amountMinor > 0);
    assert(Number.isInteger(row.minorUnit) && row.minorUnit >= 0 && row.minorUnit <= 4);
  }
  const metadata = {
    declaredComplete: raw?.complete === true,
    languageMatches: raw?.language === context.locale,
    providerEventCount: Array.isArray(raw?.events) ? Math.min(raw.events.length, 11) : 0,
    envelopeAccepted: false
  };
  let decoded;
  try { decoded = adapter.parseVoiceBatchProviderOutput(raw); }
  catch { return metadata; }
  const decisions = adapter.decideVoiceBatch(decoded, context);
  const matches = expected.map(wanted => decisions.map(decision => decision.status === 'eligible' &&
    matchFields(decision.command, wanted) && decision.command.amountMinor === wanted.amountMinor));
  const present = distinctMatches(matches);
  return {
    ...metadata, envelopeAccepted: true, decodedEventCount: decoded.events.length, decisionCount: decisions.length,
    expectedOccurrencePresent: present,
    allExpected: metadata.languageMatches && decisions.length === expected.length && present.every(Boolean),
    amountChecks: expected.map(wanted => decisions.map((decision, ordinal) => {
      const command = decision.status === 'eligible' ? decision.command : null;
      const signed = wanted.kind === 'income' ? -wanted.amountMinor : wanted.amountMinor;
      const scale = 10 ** wanted.minorUnit;
      const rawAmount = raw.events[ordinal]?.a;
      const decodedAmount = decoded.events[ordinal]?.amountMinor;
      return {
        identityFieldsMatch: Boolean(matchFields(command, wanted)),
        providerEqualsExpected: rawAmount === String(signed),
        providerEqualsMajorScale: rawAmount === String(signed / scale),
        decodedEqualsExpected: decodedAmount === String(signed),
        decodedEqualsMajorScale: decodedAmount === String(signed / scale),
        canonicalEqualsExpected: command?.amountMinor === wanted.amountMinor,
        canonicalEqualsMajorScale: command?.amountMinor === wanted.amountMinor / scale
      };
    }))
  };
}
function captureMetadata(bytes, declaredDurationMs, probe) {
  assert(Buffer.isBuffer(bytes) && bytes.length >= 12 && bytes.length <= 12582912);
  assert(Number.isInteger(declaredDurationMs) && declaredDurationMs > 0 && declaredDurationMs <= 60000);
  assert(bytes.toString('ascii', 4, 8) === 'ftyp', 'M4A_CONTAINER_REQUIRED');
  const stream = probe.streams?.filter(row => row.codec_type === 'audio');
  assert(stream?.length === 1 && stream[0].codec_name === 'aac', 'AAC_AUDIO_REQUIRED');
  const durationMs = Math.round(Number(stream[0].duration ?? probe.format?.duration) * 1000);
  const sampleRate = Number(stream[0].sample_rate);
  assert(Number.isSafeInteger(durationMs) && durationMs > 0 && durationMs <= 61000);
  assert(Number.isSafeInteger(sampleRate) && sampleRate >= 8000 && sampleRate <= 192000);
  assert(Number.isInteger(stream[0].channels) && stream[0].channels >= 1 && stream[0].channels <= 2);
  return { sizeBytes: bytes.length, audioHash: createHash('sha256').update(bytes).digest('hex'), declaredDurationMs,
    containerDurationMs: durationMs, durationDeltaMs: durationMs - declaredDurationMs, codec: 'aac',
    channels: stream[0].channels, sampleRate };
}
module.exports = { comparePipeline, captureMetadata };
