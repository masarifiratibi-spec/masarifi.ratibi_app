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
  'native_unavailable',
  'native_function_missing',
  'write',
  'encrypt',
  'decrypt',
  'keystore',
  'argument',
  'jsi_argument_conversion',
  'kotlin_argument_conversion',
  'record_conversion',
  'converter_unavailable',
  'context_lost',
  'native_unexpected',
  'type',
  'unknown'
] as const;
type PreferencesErrorClass = (typeof preferencesErrorClasses)[number];
type PreferencesOperation = 'read' | 'write';
const rejectionShapes = [
  'code_message',
  'message_only',
  'other_object',
  'primitive',
  'unreadable'
] as const;
const preferencesBoundaries = [
  'kotlin_read_wrapper',
  'kotlin_write_wrapper',
  'jsi_conversion',
  'unrecognized'
] as const;
const argumentOrdinals = ['none', 'first', 'second', 'third'] as const;
type PreferencesFailure = {
  errorClass: PreferencesErrorClass;
  rejectionShape: (typeof rejectionShapes)[number];
  boundary: (typeof preferencesBoundaries)[number];
  argumentOrdinal: (typeof argumentOrdinals)[number];
};
type PreferencesEvent = {
  kind: 'preferences';
  operation: PreferencesOperation;
} & (
  | { outcome: 'success'; errorClass: 'none' }
  | ({ outcome: 'failure' } & PreferencesFailure)
);
type BenchmarkEvent =
  | { kind: 'timing'; stage: PerformanceStage; elapsedMs: number }
  | { kind: 'home'; outcome: HomeOutcome }
  | { kind: 'protected_route'; category: RouteCategory }
  | PreferencesEvent
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
        if (!['read', 'write'].includes(event.operation)) return;
        if (event.outcome === 'success') {
          if (
            event.errorClass !== 'none' ||
            'rejectionShape' in event ||
            'boundary' in event ||
            'argumentOrdinal' in event
          )
            return;
          metadata = {
            kind: 'preferences',
            operation: event.operation,
            outcome: 'success',
            errorClass: 'none'
          };
        } else if (
          event.outcome === 'failure' &&
          validPreferencesFailure(event)
        ) {
          metadata = {
            kind: 'preferences',
            operation: event.operation,
            outcome: 'failure',
            errorClass: event.errorClass,
            rejectionShape: event.rejectionShape,
            boundary: event.boundary,
            argumentOrdinal: event.argumentOrdinal
          };
        } else return;
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

function validPreferencesFailure(event: PreferencesFailure): boolean {
  if (
    !preferencesErrorClasses.includes(event.errorClass) ||
    !rejectionShapes.includes(event.rejectionShape) ||
    !preferencesBoundaries.includes(event.boundary) ||
    !argumentOrdinals.includes(event.argumentOrdinal)
  )
    return false;
  if (['primitive', 'unreadable'].includes(event.rejectionShape)) {
    return (
      event.errorClass === 'unknown' &&
      event.boundary === 'unrecognized' &&
      event.argumentOrdinal === 'none'
    );
  }
  return (
    (event.errorClass === 'jsi_argument_conversion') ===
      (event.boundary === 'jsi_conversion') &&
    (event.errorClass !== 'kotlin_argument_conversion' ||
      event.argumentOrdinal !== 'none')
  );
}

function preferencesBoundary(message: string): PreferencesFailure['boundary'] {
  if (
    message.includes("[getValueWithKeyAsync] Cannot convert '") ||
    message.includes("[setValueWithKeyAsync] Cannot convert '")
  )
    return 'jsi_conversion';
  if (
    message.includes(
      "Call to function 'ExpoSecureStore.getValueWithKeyAsync' has been rejected."
    )
  )
    return 'kotlin_read_wrapper';
  if (
    message.includes(
      "Call to function 'ExpoSecureStore.setValueWithKeyAsync' has been rejected."
    )
  )
    return 'kotlin_write_wrapper';
  return 'unrecognized';
}

function preferencesArgumentOrdinal(
  message: string
): PreferencesFailure['argumentOrdinal'] {
  const ordinal = /The (1st|2nd|3rd) argument cannot be cast to type /u.exec(
    message
  )?.[1];
  if (ordinal === '1st') return 'first';
  if (ordinal === '2nd') return 'second';
  if (ordinal === '3rd') return 'third';
  return 'none';
}

/** Fixed upstream fragments survive R8 merging; raw text never enters telemetry. */
function preferencesMessageErrorClass(
  message: string,
  details: PreferencesFailure
): PreferencesFailure['errorClass'] | null {
  if (details.boundary === 'jsi_conversion') return 'jsi_argument_conversion';
  if (
    message.includes("Cannot find type converter for '") ||
    message.includes("Cannot obtain ExpectedType form '")
  )
    return 'converter_unavailable';
  if (message.includes("Cannot create a record of the type: '"))
    return 'record_conversion';
  if (
    message.includes('The react context has been lost') ||
    message.includes('The app context has been lost')
  )
    return 'context_lost';
  if (details.argumentOrdinal !== 'none') return 'kotlin_argument_conversion';
  if (message.includes('An error occurred when writing to key')) return 'write';
  if (message.includes('Could not encrypt the value for key')) return 'encrypt';
  if (message.includes('Could not decrypt the value for key')) return 'decrypt';
  if (message.includes('An error occurred when accessing the keystore'))
    return 'keystore';
  if (
    message.includes('is not a function') &&
    (message.includes('setValueWithKeyAsync') ||
      message.includes('getValueWithKeyAsync'))
  )
    return 'native_function_missing';
  return null;
}

function preferencesCodeErrorClass(
  code: unknown
): PreferencesFailure['errorClass'] | null {
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
    case 'ERR_UNEXPECTED':
      return 'native_unexpected';
    default:
      return null;
  }
}

/** Inspect only fixed properties, with a bounded scan; return reconstructed enums only. */
function preferencesFailure(error: unknown): PreferencesFailure {
  const details: PreferencesFailure = {
    errorClass: 'unknown',
    rejectionShape: 'primitive',
    boundary: 'unrecognized',
    argumentOrdinal: 'none'
  };
  if (
    error === null ||
    (typeof error !== 'object' && typeof error !== 'function')
  )
    return details;
  try {
    const rejection = error as { code?: unknown; message?: unknown };
    const code = rejection.code;
    const rawMessage = rejection.message;
    details.rejectionShape =
      typeof rawMessage === 'string'
        ? typeof code === 'string'
          ? 'code_message'
          : 'message_only'
        : 'other_object';
    const message =
      typeof rawMessage === 'string' ? rawMessage.slice(0, 4096) : '';
    details.boundary = preferencesBoundary(message);
    details.argumentOrdinal = preferencesArgumentOrdinal(message);
    details.errorClass =
      preferencesMessageErrorClass(message, details) ??
      preferencesCodeErrorClass(code) ??
      (error instanceof TypeError ? 'type' : 'unknown');
    return details;
  } catch {
    return {
      errorClass: 'unknown',
      rejectionShape: 'unreadable',
      boundary: 'unrecognized',
      argumentOrdinal: 'none'
    };
  }
}

export function recordPreferencesStorageOutcome(
  operation: PreferencesOperation,
  outcome: 'success' | 'failure',
  error?: unknown
): void {
  try {
    if (!isBenchmarkReadOnly() || eventCount >= 400) return;
    recordBenchmarkEvent(
      outcome === 'success'
        ? {
            kind: 'preferences',
            operation,
            outcome: 'success',
            errorClass: 'none'
          }
        : {
            kind: 'preferences',
            operation,
            outcome: 'failure',
            ...preferencesFailure(error)
          }
    );
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
