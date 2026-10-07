import { sha256 } from '@noble/hashes/sha256';
import { bytesToHex } from '@noble/hashes/utils';

export type ManualDiagnosticStage =
  'restore' | 'input' | 'prepare' | 'request' | 'receipt' | 'refresh' | 'failure';
interface Details {
  phase?: string;
  firstAttemptAt?: number;
  operationId?: string;
  requestId?: string;
  domainCode?: string;
  status?: number;
  uncertain?: boolean;
  failed?: boolean;
  validationRules?: readonly string[];
}
const entries: Record<string, string | number | boolean>[] = [];
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const validationRules = [
  'amount',
  'account_missing',
  'title',
  'note',
  'linked_note_multiline',
  'date',
  'account_reference',
  'account_status',
  'account_currency',
  'category_missing',
  'destination_reference',
  'destination_same',
  'destination_currency',
  'destination_status',
  'category_reference',
  'category_status',
  'category_type',
  'refund_reference',
  'refund_eligibility'
] as const;

// Temporary Staging metadata only; never accept request bodies or Error objects.
export function recordManualDiagnostic(
  stage: ManualDiagnosticStage,
  details: Details
): void {
  if (
    process.env.EXPO_PUBLIC_FINANCE_DIAGNOSTICS_ENABLED !== 'true' ||
    process.env.EXPO_PUBLIC_API_URL !== 'https://api.staging.masarifiratibi.com'
  )
    return;
  const entry: Record<string, string | number | boolean> = {
    stage,
    at: Date.now()
  };
  if (['submitting', 'unknown', 'saved', 'blocked'].includes(details.phase ?? ''))
    entry.phase = details.phase!;
  if (Number.isSafeInteger(details.firstAttemptAt) && details.firstAttemptAt! > 0)
    entry.firstAttemptAt = details.firstAttemptAt!;
  if (details.operationId && uuid.test(details.operationId))
    entry.operationHash = bytesToHex(
      sha256(Uint8Array.from(details.operationId, (char) => char.charCodeAt(0)))
    ).slice(0, 16);
  if (details.requestId && uuid.test(details.requestId))
    entry.requestId = details.requestId;
  if (details.domainCode && /^[A-Z][A-Z0-9_]{0,79}$/.test(details.domainCode))
    entry.domainCode = details.domainCode;
  if (
    Number.isInteger(details.status) &&
    details.status! >= 100 &&
    details.status! <= 599
  )
    entry.status = details.status!;
  if (typeof details.uncertain === 'boolean')
    entry.uncertain = details.uncertain;
  if (typeof details.failed === 'boolean') entry.failed = details.failed;
  const failedRules = validationRules.filter((rule) =>
    details.validationRules?.includes(rule)
  );
  if (failedRules.length) entry.validationRules = failedRules.join(',');
  entries.push(entry);
  if (entries.length > 200) entries.shift();
  try {
    console.info('MANUAL_DIAG', JSON.stringify(entry));
  } catch {
    // Diagnostics are best effort; a failed sink must never change a ledger outcome.
  }
}
export function readManualDiagnostics(): ReadonlyArray<
  Readonly<Record<string, string | number | boolean>>
> {
  return entries.map((entry) => ({ ...entry }));
}
export function clearManualDiagnostics(): void {
  entries.length = 0;
}
