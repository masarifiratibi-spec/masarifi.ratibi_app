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
type BenchmarkEvent =
  | { kind: 'timing'; stage: PerformanceStage; elapsedMs: number }
  | { kind: 'home'; outcome: HomeOutcome }
  | { kind: 'protected_route'; category: RouteCategory }
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
