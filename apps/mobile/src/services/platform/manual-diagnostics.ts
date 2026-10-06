import { sha256 } from '@noble/hashes/sha256';
import { bytesToHex } from '@noble/hashes/utils';

export type ManualDiagnosticStage =
  'input' | 'prepare' | 'request' | 'receipt' | 'refresh' | 'failure';
interface Details {
  operationId?: string;
  requestId?: string;
  domainCode?: string;
  status?: number;
  uncertain?: boolean;
  failed?: boolean;
}
const entries: Record<string, string | number | boolean>[] = [];
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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
  entries.push(entry);
  if (entries.length > 200) entries.shift();
  console.info('MANUAL_DIAG', JSON.stringify(entry));
}
export function readManualDiagnostics(): ReadonlyArray<
  Readonly<Record<string, string | number | boolean>>
> {
  return entries.map((entry) => ({ ...entry }));
}
export function clearManualDiagnostics(): void {
  entries.length = 0;
}
