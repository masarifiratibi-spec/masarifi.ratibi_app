import { sha256 } from '@noble/hashes/sha256';
import { bytesToHex } from '@noble/hashes/utils';

type VoiceDiagnosticStage =
  | 'capture-start'
  | 'permission'
  | 'native-start'
  | 'native-stop'
  | 'file-check'
  | 'native-release'
  | 'journal-handoff'
  | 'request'
  | 'response'
  | 'request-error'
  | 'cleanup'
  | 'cleanup-error'
  | 'batch-result'
  | 'ui-state';
interface VoiceDiagnosticDetails {
  traceId?: string;
  captureId?: string;
  recordingId?: string;
  sessionId?: string;
  requestId?: string;
  operation?: string;
  phase?: string;
  bytes?: number;
  durationMs?: number;
  elapsedMs?: number;
  status?: number;
  domainCode?: 'VOICE_CANARY_RESTRICTED' | 'VOICE_AUTOMATIC_UNAVAILABLE';
}
const phases = new Set([
  'active',
  'inactive',
  'background',
  'start',
  'success',
  'failure',
  'timeout',
  'checking',
  'ready',
  'recording',
  'stopping',
  'captured',
  'created',
  'uploaded',
  'processing',
  'completed',
  'cancelled',
  'failed',
  'queued',
  'analyzing',
  'finalizing',
  'cancel_requested'
]);
const entries: Record<string, string | number>[] = [];

// Temporary, bounded Staging diagnostics. Explicit field selection prevents
// audio/content/credentials from reaching either the ring buffer or logcat.
export function recordVoiceDiagnostic(
  stage: VoiceDiagnosticStage,
  details: VoiceDiagnosticDetails
): void {
  if (
    process.env.EXPO_PUBLIC_VOICE_DIAGNOSTICS_ENABLED !== 'true' ||
    process.env.EXPO_PUBLIC_API_URL !== 'https://api.staging.masarifiratibi.com'
  )
    return;
  const entry: Record<string, string | number> = { stage, at: Date.now() };
  for (const key of [
    'traceId',
    'captureId',
    'recordingId',
    'sessionId'
  ] as const) {
    const value = details[key];
    if (value && /^[A-Za-z0-9-]{1,100}$/.test(value))
      entry[key + 'Hash'] = bytesToHex(
        sha256(Uint8Array.from(value, (char) => char.charCodeAt(0)))
      ).slice(0, 16);
  }
  if (
    details.requestId &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      details.requestId
    )
  )
    entry.requestId = details.requestId;
  if (details.phase && phases.has(details.phase)) entry.phase = details.phase;
  if (
    details.domainCode === 'VOICE_CANARY_RESTRICTED' ||
    details.domainCode === 'VOICE_AUTOMATIC_UNAVAILABLE'
  )
    entry.domainCode = details.domainCode;
  if (
    details.operation &&
    ['create', 'upload', 'process', 'status', 'cancel', 'recovery'].includes(
      details.operation
    )
  )
    entry.operation = details.operation;
  for (const [key, max] of [
    ['bytes', 12582912],
    ['durationMs', 60000],
    ['elapsedMs', 3600000],
    ['status', 599]
  ] as const) {
    const value = details[key];
    if (
      typeof value === 'number' &&
      Number.isFinite(value) &&
      value >= (key === 'status' ? 100 : 0) &&
      value <= max
    )
      entry[key] = Math.round(value);
  }
  entries.push(entry);
  if (entries.length > 200) entries.shift();
  try {
    console.info('VOICE_DIAG', JSON.stringify(entry));
  } catch {
    // Recording and durable handoff must survive a failed diagnostic sink.
  }
}
export function readVoiceDiagnostics(): ReadonlyArray<
  Readonly<Record<string, string | number>>
> {
  return entries.map((entry) => ({ ...entry }));
}
export function clearVoiceDiagnostics(): void {
  entries.length = 0;
}
