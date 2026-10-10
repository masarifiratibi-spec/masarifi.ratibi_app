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
]);
const nativeStackDescriptor = Object.getOwnPropertyDescriptor(new Error(), 'stack');

// Read data properties only: diagnostics must not execute an arbitrary error getter.
function field(value: unknown, key: string): unknown {
  if (!value || typeof value !== 'object') return undefined;
  try {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (key === 'stack' && descriptor?.get && descriptor.get === nativeStackDescriptor?.get)
      return descriptor.get.call(value);
    return descriptor?.value;
  } catch {
    return undefined;
  }
}

function describe(error: unknown): SafeWorkerException {
  const ownName = field(error, 'name');
  const name =
    typeof ownName === 'string' && names.has(ownName)
      ? ownName
      : error instanceof Error
        ? 'Error'
        : 'NonError';
  const rawCode = field(error, 'code');
  const rawMessage = field(error, 'message');
  const message = typeof rawMessage === 'string' ? rawMessage.slice(0, 4096) : undefined;
  const code =
    typeof rawCode === 'string' && (codes.has(rawCode) || /^[0-9][0-9A-Z]{4}$/.test(rawCode))
      ? rawCode
      : undefined;
  const stack = field(error, 'stack');
  // Keep application source positions, never the exception line, methods or absolute paths.
  const frames =
    typeof stack === 'string'
      ? [
          ...stack
            .slice(0, 8192)
            .matchAll(/\/app\/dist\/src\/([a-z0-9_./-]+\.js:[0-9]{1,6}:[0-9]{1,6})(?=[)\s]|$)/g),
        ]
          .slice(0, 4)
          .flatMap((match) => (match[1] ? [match[1]] : []))
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
