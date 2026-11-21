import type { LoggerService } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { SafeWorkerException } from './worker-error';
import { logContext } from './log-context';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface SafeLogFields {
  service?: string;
  operation?: string;
  outcome?: 'success' | 'failure';
  context?: string;
  requestId?: string;
  eventName?: string;
  code?: string;
  processKind?: string;
  version?: string;
  state?: string;
  permissionKey?: string;
  resourceType?: string;
  resourceId?: string;
  jobName?: string;
  severity?: string;
  durationMs?: number;
  attempt?: number;
  round?: number;
  readCount?: number;
  httpStatus?: number;
  failureStage?: string;
  exception?: SafeWorkerException;
  exceptionChain?: SafeWorkerException[];
  causeTruncated?: boolean;
  providerCode?: string;
  workload?: string;
  modelId?: string;
  provider?: string;
  providerReason?: 'UNSPECIFIED_INVALID_ARGUMENT';
  providerRequestIdHash?: string;
  rejectedFields?: string[];
  rejectedKeywords?: string[];
  extractedEventCount?: number;
  eligibleEventCount?: number;
  skippedEventCount?: number;
  skipReasonCounts?: Record<string, number>;
}

const levels: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};
const sensitiveKey =
  /authorization|cookie|credential|database.?url|password|secret|token|email|phone|session|subject|fingerprint|payload|cipher|otp|jwt|sms|transcript|audio|amount|balance|sql|parameters|body/i;
const sensitiveValue =
  /(?:bearer\s+\S+|postgres(?:ql)?:\/\/[^\s:@]+:[^\s@]+@|[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}|\+[1-9][0-9]{7,14}|(?:sk|whsec)_(?:test|live)?_?[A-Za-z0-9_-]+)/gi;

const allowedFields = new Set([
  'service',
  'operation',
  'outcome',
  'context',
  'requestId',
  'eventName',
  'code',
  'processKind',
  'version',
  'state',
  'permissionKey',
  'resourceType',
  'resourceId',
  'jobName',
  'severity',
  'durationMs',
  'attempt',
  'round',
  'readCount',
  'httpStatus',
  'failureStage',
  'exception',
  'exceptionChain',
  'causeTruncated',
  'providerCode',
  'workload',
  'modelId',
  'provider',
  'providerReason',
  'providerRequestIdHash',
  'rejectedFields',
  'rejectedKeywords',
  'extractedEventCount',
  'eligibleEventCount',
  'skippedEventCount',
  'skipReasonCounts',
]);
const eventIdentifier = /^[A-Za-z][A-Za-z0-9_.:-]{0,127}$/;
const legacyStates = new Set([
  'new',
  'received',
  'queued',
  'processing',
  'completed',
  'succeeded',
  'duplicate',
  'success',
  'failure',
  'failed',
  'rejected',
  'conflict',
  'hash_mismatch',
  'cancelled',
  'not_ready',
]);

function ownData(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  try {
    return Object.fromEntries(
      Object.entries(Object.getOwnPropertyDescriptors(value))
        .filter(([, descriptor]) => 'value' in descriptor)
        .map(([key, descriptor]) => [key, descriptor.value as unknown]),
    );
  } catch {
    return {};
  }
}
const safeSkipReasons = new Set([
  'missing_amount',
  'ambiguous_account',
  'invalid_category',
  'invalid_date',
  'currency_mismatch',
  'unsupported_event',
  'authorization_required',
  'invalid_event',
]);

export function redactSensitive(value: unknown, key = ''): unknown {
  if (sensitiveKey.test(key)) return '[REDACTED]';
  if (key === 'skipReasonCounts' && value && typeof value === 'object' && !Array.isArray(value)) {
    return Object.fromEntries(
      Object.entries(value).filter(
        ([reason, count]) =>
          safeSkipReasons.has(reason) &&
          typeof count === 'number' &&
          Number.isSafeInteger(count) &&
          count >= 0 &&
          count <= 1000,
      ),
    );
  }
  if (typeof value === 'string') return value.replace(sensitiveValue, '[REDACTED]');
  if (Array.isArray(value)) return value.map((item) => redactSensitive(item));
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([entryKey, entryValue]) => [
        entryKey,
        redactSensitive(entryValue, entryKey),
      ]),
    );
  }
  return value;
}

export class PlatformLogger implements LoggerService {
  constructor(
    private readonly writer: (line: string) => void = (line) => process.stdout.write(`${line}\n`),
    private readonly minimumLevel: LogLevel = 'info',
  ) {}

  debug(message: unknown, fields?: SafeLogFields): void {
    this.write('debug', message, fields);
  }

  log(message: unknown, fields?: SafeLogFields): void {
    this.info(message, fields);
  }

  info(message: unknown, fields?: SafeLogFields): void {
    this.write('info', message, fields);
  }

  warn(message: unknown, fields?: SafeLogFields): void {
    this.write('warn', message, fields);
  }

  error(message: unknown, fields?: SafeLogFields): void {
    this.write('error', message, fields);
  }

  private write(level: LogLevel, message: unknown, fields: SafeLogFields = {}): void {
    if (levels[level] < levels[this.minimumLevel]) return;
    const structured = ownData(message);
    const embedded: Record<string, unknown> = Object.fromEntries(
      Object.entries(structured).filter(
        ([key, value]) =>
          allowedFields.has(key) && ['string', 'number', 'boolean'].includes(typeof value),
      ),
    );
    const named = structured.eventName ?? structured.event;
    if (typeof named === 'string' && eventIdentifier.test(named)) embedded.eventName = named;
    if (embedded.outcome !== 'success' && embedded.outcome !== 'failure') {
      if (typeof embedded.outcome === 'string' && legacyStates.has(embedded.outcome))
        embedded.state = embedded.outcome;
      delete embedded.outcome;
    }
    if (
      logContext.getStore() ||
      typeof embedded.requestId !== 'string' ||
      !/^[A-Za-z0-9._:-]{1,128}$/.test(embedded.requestId)
    )
      delete embedded.requestId;
    const supplied: unknown = fields;
    fields = {
      ...embedded,
      ...(typeof supplied === 'string' && eventIdentifier.test(supplied)
        ? { context: supplied }
        : ownData(supplied)),
    };
    const event =
      typeof message === 'string' && eventIdentifier.test(message)
        ? message
        : typeof named === 'string' && eventIdentifier.test(named)
          ? named
          : 'application.message';
    const safeFields = Object.fromEntries(
      Object.entries(fields).filter(
        ([key, value]) => allowedFields.has(key) && value !== undefined,
      ),
    );
    const failed =
      level === 'error' ||
      fields.outcome === 'failure' ||
      [
        'failed',
        'failure',
        'error',
        'cancelled',
        'rejected',
        'not_ready',
        'hash_mismatch',
        'conflict',
      ].includes(fields.state ?? '') ||
      /(?:^|[._])(?:failed|failure|rejected|denied|unavailable|error)(?:$|[._])/i.test(
        fields.eventName ?? event,
      ) ||
      (fields.httpStatus ?? 0) >= 400;
    const record = redactSensitive({
      timestamp: new Date().toISOString(),
      level,
      service:
        process.env.MASARIFI_LOG_SERVICE ?? process.env.MASARIFI_PROCESS_KIND ?? 'application',
      version: process.env.MASARIFI_RELEASE_VERSION ?? 'unknown',
      message: event,
      operation: fields.eventName ?? event,
      outcome: failed ? 'failure' : 'success',
      code: fields.code ?? fields.exception?.code ?? (failed ? 'UNCLASSIFIED' : 'OK'),
      durationMs: fields.durationMs ?? 0,
      requestId:
        logContext.getStore()?.requestId ??
        ((fields.jobName || process.env.MASARIFI_PROCESS_KIND === 'worker') &&
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
          fields.resourceId ?? '',
        )
          ? fields.resourceId
          : randomUUID()),
      ...logContext.getStore(),
      ...safeFields,
    });
    this.writer(JSON.stringify(record));
  }
}
