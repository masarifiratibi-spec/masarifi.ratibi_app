export type PerformanceStage =
  | 'planning.auth'
  | 'planning.read'
  | 'reports.auth'
  | 'reports.read'
  | 'startup.fonts'
  | 'startup.restore'
  | 'startup.profile'
  | 'startup.identity'
  | 'identity.cache.read'
  | 'identity.token.read'
  | 'identity.token.fresh'
  | 'identity.profile.remote'
  | 'identity.preferences'
  | 'identity.onboarding'
  | 'identity.local.read'
  | 'identity.local.write'
  | 'ledger.categories'
  | 'ledger.read'
  | 'ledger.today'
  | 'storage.draft.read'
  | 'storage.draft.write'
  | 'sync.core';

const timings: Partial<Record<PerformanceStage, number[]>> = {};
type PerformanceSpan = { stage: PerformanceStage; startedAt: number; endedAt: number };
const spans: PerformanceSpan[] = [];

export function recordPerformanceTiming(
  stage: PerformanceStage,
  milliseconds: number
): void {
  if (!Number.isFinite(milliseconds) || milliseconds < 0) return;
  const elapsed = Math.round(milliseconds);
  const endedAt = performance.now();
  spans.push({ stage, startedAt: endedAt - milliseconds, endedAt });
  if (spans.length > 200) spans.shift();
  timings[stage] = [...(timings[stage] ?? []).slice(-49), elapsed];
  if (
    process.env.EXPO_PUBLIC_FINANCE_DIAGNOSTICS_ENABLED === 'true' &&
    process.env.EXPO_PUBLIC_API_URL === 'https://api.staging.masarifiratibi.com'
  ) {
    try {
      console.info('PERFORMANCE_TIMING', stage, elapsed);
    } catch {
      /* Observational only. */
    }
  }
}

/** Timing-only ring buffers: never receive identifiers, URLs or payloads. */
export async function measurePerformance<T>(
  stage: PerformanceStage,
  action: () => Promise<T>
): Promise<T> {
  const started = performance.now();
  try {
    return await action();
  } finally {
    recordPerformanceTiming(stage, Math.max(0, performance.now() - started));
  }
}

export function readPerformanceTimings(): Readonly<
  Partial<Record<PerformanceStage, readonly number[]>>
> {
  return Object.fromEntries(
    Object.entries(timings).map(([stage, values]) => [stage, [...values]])
  );
}

export function readPerformanceSpans(): readonly Readonly<PerformanceSpan>[] {
  return spans.map((span) => ({ ...span }));
}
