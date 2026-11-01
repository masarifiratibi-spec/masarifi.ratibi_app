import { isBenchmarkReadOnly } from '@/config/client-runtime';

export const performanceStages = [
  'planning.auth',
  'planning.read',
  'reports.auth',
  'reports.read',
  'startup.fonts',
  'startup.restore',
  'startup.profile',
  'startup.identity',
  'identity.cache.read',
  'identity.token.read',
  'identity.token.fresh',
  'identity.profile.remote',
  'identity.preferences',
  'identity.onboarding',
  'identity.local.read',
  'identity.local.write',
  'ledger.categories',
  'ledger.read',
  'ledger.today',
  'storage.draft.read',
  'storage.draft.write',
  'sync.core'
] as const;
export type PerformanceStage = (typeof performanceStages)[number];
type HomeOutcome = 'ready' | 'failed' | 'left_route';
type RouteCategory = 'unlock' | 'home' | 'other';
type EndpointGroup = 'ledger' | 'reports' | 'planning' | 'identity' | 'other';
const preferencesErrorClasses = [
  'none',
  'native_unavailable',
  'native_function_missing',
  'write',
  'encrypt',
  'decrypt',
  'keystore',
  'argument',
  'type',
  'unknown'
] as const;
type PreferencesErrorClass = (typeof preferencesErrorClasses)[number];
type PreferencesOperation = 'read' | 'write';
type BenchmarkEvent =
  | { kind: 'timing'; stage: PerformanceStage; elapsedMs: number }
  | { kind: 'home'; outcome: HomeOutcome }
  | { kind: 'protected_route'; category: RouteCategory }
  | {
      kind: 'preferences';
      operation: PreferencesOperation;
      outcome: 'success' | 'failure';
      errorClass: PreferencesErrorClass;
    }
  | {
      kind: 'transport';
      group: EndpointGroup;
      method: 'GET' | 'HEAD';
      requestSequence: number;
      status: number | null;
      payloadBytes: number | null;
      elapsedMs: number;
      outcome: 'response' | 'network' | 'aborted';
    };

let eventCount = 0;
let requestSequence = 0;
let protectedRouteRecorded = false;
const nonnegative = (value: number) => Number.isFinite(value) && value >= 0;
const nullableInteger = (value: number | null) =>
  value === null || (Number.isSafeInteger(value) && value >= 0);

/** Reconstruct every field; never serialize callers' objects or free-form strings. */
export function recordBenchmarkEvent(event: BenchmarkEvent): void {
  try {
    if (!isBenchmarkReadOnly() || eventCount >= 400) return;
    let metadata: BenchmarkEvent;
    switch (event.kind) {
      case 'timing':
        if (
          !performanceStages.includes(event.stage) ||
          !nonnegative(event.elapsedMs)
        )
          return;
        metadata = {
          kind: 'timing',
          stage: event.stage,
          elapsedMs: event.elapsedMs
        };
        break;
      case 'home':
        if (!['ready', 'failed', 'left_route'].includes(event.outcome)) return;
        metadata = { kind: 'home', outcome: event.outcome };
        break;
      case 'protected_route':
        if (!['unlock', 'home', 'other'].includes(event.category)) return;
        metadata = { kind: 'protected_route', category: event.category };
        break;
      case 'preferences':
        if (
          !['read', 'write'].includes(event.operation) ||
          !['success', 'failure'].includes(event.outcome) ||
          !preferencesErrorClasses.includes(event.errorClass) ||
          (event.outcome === 'success') !== (event.errorClass === 'none')
        )
          return;
        metadata = {
          kind: 'preferences',
          operation: event.operation,
          outcome: event.outcome,
          errorClass: event.errorClass
        };
        break;
      case 'transport':
        if (
          !['ledger', 'reports', 'planning', 'identity', 'other'].includes(
            event.group
          ) ||
          !['GET', 'HEAD'].includes(event.method) ||
          !['response', 'network', 'aborted'].includes(event.outcome) ||
          !Number.isSafeInteger(event.requestSequence) ||
          event.requestSequence < 1 ||
          !nullableInteger(event.status) ||
          !nullableInteger(event.payloadBytes) ||
          !nonnegative(event.elapsedMs)
        )
          return;
        metadata = {
          kind: 'transport',
          group: event.group,
          method: event.method,
          requestSequence: event.requestSequence,
          status: event.status,
          payloadBytes: event.payloadBytes,
          elapsedMs: event.elapsedMs,
          outcome: event.outcome
        };
        break;
      default:
        return;
    }
    const atMs = performance.now();
    if (!nonnegative(atMs)) return;
    eventCount++;
    console.info('BENCHMARK_METRIC', JSON.stringify({ ...metadata, atMs }));
  } catch {
    // Telemetry must never affect application outcomes, even if its sink fails.
  }
}

/** Fixed upstream fragments survive R8 class merging; the text never enters telemetry. */
function preferencesMessageErrorClass(error: unknown): PreferencesErrorClass {
  const message =
    error && typeof error === 'object' && 'message' in error
      ? error.message
      : undefined;
  if (typeof message === 'string') {
    if (message.includes('An error occurred when writing to key'))
      return 'write';
    if (message.includes('Could not encrypt the value for key'))
      return 'encrypt';
    if (message.includes('Could not decrypt the value for key'))
      return 'decrypt';
    if (message.includes('An error occurred when accessing the keystore'))
      return 'keystore';
    if (
      message.includes('is not a function') &&
      (message.includes('setValueWithKeyAsync') ||
        message.includes('getValueWithKeyAsync'))
    )
      return 'native_function_missing';
  }
  return error instanceof TypeError ? 'type' : 'unknown';
}

/** Exact dependency whitelist only; never retain or emit error text, names or stacks. */
function preferencesErrorClass(error: unknown): PreferencesErrorClass {
  try {
    const code =
      error && typeof error === 'object' && 'code' in error
        ? error.code
        : undefined;
    switch (code) {
      case 'ERR_UNAVAILABLE':
      case 'ERR_MODULE_NOT_FOUND':
        return 'native_unavailable';
      case 'ERR_METHOD_NOT_FOUND':
        return 'native_function_missing';
      case 'ERR_WRITE':
        return 'write';
      case 'ERR_ENCRYPT':
        return 'encrypt';
      case 'ERR_DECRYPT':
        return 'decrypt';
      case 'ERR_KEY_STORE':
        return 'keystore';
      case 'ERR_NULL_KEY':
      case 'ERR_INVALID_ARGS_NUMBER':
      case 'ERR_NULL_ARGUMENT':
      case 'ERR_INCOMPATIBLE_ARG_TYPE':
      case 'ERR_DYNAMIC_CAST':
      case 'ERR_MISSING_TYPE_CONVERTER':
      case 'ERR_INVALID_EXPECTED_TYPE':
        return 'argument';
      default:
        return preferencesMessageErrorClass(error);
    }
  } catch {
    return 'unknown';
  }
}

export function recordPreferencesStorageOutcome(
  operation: PreferencesOperation,
  outcome: 'success' | 'failure',
  error?: unknown
): void {
  try {
    if (!isBenchmarkReadOnly() || eventCount >= 400) return;
    recordBenchmarkEvent({
      kind: 'preferences',
      operation,
      outcome,
      errorClass: outcome === 'success' ? 'none' : preferencesErrorClass(error)
    });
  } catch {
    // Diagnostics cannot replace a storage result or rejection.
  }
}

export function recordFirstProtectedRoute(category: RouteCategory): void {
  if (!isBenchmarkReadOnly() || protectedRouteRecorded) return;
  protectedRouteRecorded = true;
  recordBenchmarkEvent({ kind: 'protected_route', category });
}

function endpointGroup(url: string): EndpointGroup {
  const path = url.replace(/^https?:\/\/[^/]+/u, '');
  if (
    /^\/api\/v1\/(transactions|transfers|accounts|categories)(?:[/?]|$)/u.test(
      path
    )
  )
    return 'ledger';
  if (/^\/api\/v1\/reports(?:[/?]|$)/u.test(path)) return 'reports';
  if (
    /^\/api\/v1\/(obligations|savings-goals|payment-matches|planning|budgets|salary-profiles)(?:[/?]|$)/u.test(
      path
    )
  )
    return 'planning';
  if (/^\/api\/v1\/(me|profile)(?:[/?]|$)/u.test(path)) return 'identity';
  return 'other';
}

/** Fetch-to-response only: excludes auth and JSON decoding; bytes are Content-Length, not measured wire traffic. */
export function benchmarkFetch(
  request: typeof fetch,
  url: string,
  init: RequestInit
): Promise<Response> {
  const method = init.method ?? 'GET';
  if (!isBenchmarkReadOnly() || (method !== 'GET' && method !== 'HEAD'))
    return request(url, init);
  const sequence = ++requestSequence;
  const started = performance.now();
  const group = endpointGroup(url);
  return (async () => {
    let response: Response;
    try {
      response = await request(url, init);
    } catch (error) {
      recordBenchmarkEvent({
        kind: 'transport',
        group,
        method,
        requestSequence: sequence,
        status: null,
        payloadBytes: null,
        elapsedMs: Math.max(0, performance.now() - started),
        outcome: init.signal?.aborted ? 'aborted' : 'network'
      });
      throw error;
    }
    let payloadBytes: number | null = null;
    try {
      const length = response.headers?.get('content-length');
      if (
        length &&
        /^\d+$/u.test(length) &&
        Number.isSafeInteger(Number(length))
      )
        payloadBytes = Number(length);
    } catch {
      /* Missing header metadata stays unknown. */
    }
    recordBenchmarkEvent({
      kind: 'transport',
      group,
      method,
      requestSequence: sequence,
      status: response.status,
      payloadBytes,
      elapsedMs: Math.max(0, performance.now() - started),
      outcome: 'response'
    });
    return response;
  })();
}
