import { createHash } from 'node:crypto';

export interface SafeWorkerException {
  name: string;
  code?: string;
  reason: string;
  messageHash?: string;
  frames: string[];
}

const names = new Set([
  'Error',
  'TypeError',
  'RangeError',
  'SyntaxError',
  'AggregateError',
  'ReferenceError',
  'URIError',
  'EvalError',
  'AbortError',
  'DatabaseError',
  'HttpException',
  'AiGatewayError',
]);
const codes = new Set([
  'ECONNRESET',
  'ECONNREFUSED',
  'ETIMEDOUT',
  'EPIPE',
  'ENOENT',
  'EACCES',
  'ENOSPC',
  'ENOTFOUND',
  'EAI_AGAIN',
  'ABORT_ERR',
]);
const reasons = new Set([
  'Query read timeout',
  'Connection terminated unexpectedly',
  'Connection terminated',
  'timeout exceeded when trying to connect',
  'VOICE_SCOPE_INVALID',
  'ASSISTANT_SCOPE_INVALID',
  'VOICE_ANALYSIS_JOB_FORBIDDEN',
  'AI_WORK_FENCE_INVALID',
  'AI_UNAVAILABLE',
  'AI_SCHEMA_INVALID',
  'DATABASE_QUERY_TIMEOUT',
  'AI_DISPATCH_REJECTED',
  'AI_OUTPUT_TRUNCATED',
  'AI_REFUSED',
  'AI_ROUTE_POLICY_INVALID',
  'AI_TEMPORARILY_UNAVAILABLE',
  'AI_USAGE_ACCOUNTING_INCOMPLETE',
  'AI_WORK_CANCELLED',
  'AI_WORK_INPUT_INVALID',
  'AI_BUDGET_EXHAUSTED',
  'AI_QUOTA_EXCEEDED',
  'AI_DATABASE_UNAVAILABLE',
  'VOICE_STORAGE_UNAVAILABLE',
  'VOICE_STORAGE_INVALID',
  'VOICE_MEDIA_INVALID',
]);
const sqlStates = new Set([
  '08000',
  '08001',
  '08003',
  '08004',
  '08006',
  '08007',
  '08P01',
  '22001',
  '22003',
  '22007',
  '22008',
  '22012',
  '22023',
  '22P02',
  '23502',
  '23503',
  '23505',
  '23514',
  '25001',
  '25P02',
  '28000',
  '28P01',
  '40001',
  '40P01',
  '42501',
  '42601',
  '42703',
  '42883',
  '42P01',
  '53300',
  '53400',
  '54000',
  '55000',
  '55P03',
  '57014',
  '57P01',
  '57P02',
  '57P03',
  '58000',
  'P0001',
  'P0002',
  'P0003',
  'XX000',
  'XX001',
  'XX002',
]);
const builtins = new Map<object, string>([
  [Error.prototype, 'Error'],
  [TypeError.prototype, 'TypeError'],
  [RangeError.prototype, 'RangeError'],
  [SyntaxError.prototype, 'SyntaxError'],
  [AggregateError.prototype, 'AggregateError'],
  [ReferenceError.prototype, 'ReferenceError'],
  [URIError.prototype, 'URIError'],
  [EvalError.prototype, 'EvalError'],
]);
const sourcePaths = new Set([
  'platform/database/pool.service.js',
  'ai/ai.worker.js',
  'ai/ai.repository.js',
  'ai/ai.gateway.js',
  'ai/ai.storage.js',
  'ai/staging-voice.worker.js',
]);
// Node 24 provides Error.isError; the ES2023 TypeScript library predates it.
const isError = (Error as ErrorConstructor & { isError: (value: unknown) => boolean }).isError;

// Read data properties only: diagnostics must not execute an arbitrary error getter.
function field(value: unknown, key: string): unknown {
  if (!value || typeof value !== 'object') return undefined;
  try {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    // V8's native lazy stack getter also executes custom name/message getters and
    // Error.prepareStackTrace. Omit lazy stacks rather than execute any accessor.
    return descriptor?.value;
  } catch {
    return undefined;
  }
}

function errorName(error: unknown): string {
  const ownName = field(error, 'name');
  if (typeof ownName === 'string' && names.has(ownName)) return ownName;
  // Unlike instanceof, this native check does not run Proxy prototype traps.
  if (!isError(error)) return 'NonError';
  try {
    let prototype: object | null = Object.getPrototypeOf(error) as object | null;
    for (let depth = 0; prototype && depth < 8; depth++) {
      const name = builtins.get(prototype);
      if (name) return name;
      prototype = Object.getPrototypeOf(prototype) as object | null;
    }
  } catch {
    // An Error subclass may have an inaccessible prototype; keep a safe fallback.
  }
  return 'Error';
}

function describe(error: unknown): SafeWorkerException {
  const name = errorName(error);
  const rawCode = field(error, 'code');
  const rawMessage = field(error, 'message');
  const message = typeof rawMessage === 'string' ? rawMessage.slice(0, 4096) : undefined;
  const code =
    typeof rawCode === 'string' &&
    (codes.has(rawCode) || sqlStates.has(rawCode) || reasons.has(rawCode))
      ? rawCode
      : undefined;
  const stack = field(error, 'stack');
  // Skip the exception header; accept only frame lines at explicitly trusted paths.
  const frames =
    typeof stack === 'string'
      ? [
          ...stack
            .slice(0, 8192)
            .split('\n')
            .slice(1)
            .join('\n')
            .matchAll(
              /^\s+at (?:[^\n()]*\()?\/app\/dist\/src\/([a-z0-9_./-]+\.js):([0-9]{1,6}:[0-9]{1,6})\)?\s*$/gm,
            ),
        ]
          .flatMap((match) => {
            const path = match[1];
            return path && sourcePaths.has(path) && match[2] ? [`${path}:${match[2]}`] : [];
          })
          .slice(0, 4)
      : [];
  return {
    name,
    ...(code ? { code } : {}),
    reason: message && reasons.has(message) ? message : 'unclassified',
    ...(message && !reasons.has(message)
      ? { messageHash: createHash('sha256').update(message).digest('hex') }
      : {}),
    frames,
  };
}

export function workerErrorFields(error: unknown): {
  exception: SafeWorkerException;
  exceptionChain: SafeWorkerException[];
  causeTruncated: boolean;
} {
  const seen = new Set<unknown>();
  const chain: SafeWorkerException[] = [];
  let current = error;
  while (!seen.has(current) && chain.length < 4) {
    seen.add(current);
    chain.push(describe(current));
    const cause = field(current, 'cause');
    if (cause === undefined || cause === null)
      return {
        exception: chain[chain.length - 1] ?? describe(error),
        exceptionChain: chain,
        causeTruncated: false,
      };
    current = cause;
  }
  return {
    exception: chain[chain.length - 1] ?? describe(error),
    exceptionChain: chain,
    causeTruncated: true,
  };
}
