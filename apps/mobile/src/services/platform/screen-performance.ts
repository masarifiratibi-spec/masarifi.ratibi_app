import { isBenchmarkReadOnly } from '@/config/client-runtime';
import { recordBenchmarkEvent } from './benchmark-observability';
import {
  ScreenReadiness,
  type ScreenDataState,
  type ScreenMilestone
} from './screen-readiness';

export type MeasuredScreen = 'home' | 'accounts' | 'transactions' | 'reports';
type NavigationStart = {
  route: MeasuredScreen;
  atMs: number;
  origin: 'tap' | 'mount';
};
let pending: ScreenTrace | null = null;
let pendingDeadline: ReturnType<typeof setTimeout> | undefined;
let sequence = 0;

export function measuredScreen(path: string): MeasuredScreen | null {
  const normalized = path.replace('/(tabs)', '');
  return (
    (['home', 'accounts', 'transactions', 'reports'].find(
      (route) => normalized === `/${route}`
    ) as MeasuredScreen | undefined) ?? null
  );
}

export function beginScreenNavigation(path: string): void {
  if (!isBenchmarkReadOnly()) return;
  finishPendingNavigation();
  const route = measuredScreen(path);
  if (!route) return;
  const attempt = new ScreenTrace({
    route,
    atMs: performance.now(),
    origin: 'tap'
  });
  pending = attempt;
  pendingDeadline = setTimeout(() => {
    if (pending === attempt) finishPendingNavigation();
  }, 30_000);
}

export function mountScreenTrace(route: MeasuredScreen): ScreenTrace {
  const now = performance.now();
  const attempt = pending;
  if (
    attempt?.route !== route ||
    now - attempt.startedAtMonotonicMs >= 30_000
  ) {
    finishPendingNavigation();
    return new ScreenTrace({ route, atMs: now, origin: 'mount' });
  }
  clearTimeout(pendingDeadline);
  pending = null;
  return attempt;
}

function finishPendingNavigation(): void {
  clearTimeout(pendingDeadline);
  pending?.finish();
  pending = null;
}

export class ScreenTrace {
  private readonly readiness = new ScreenReadiness();
  private readonly navigationSequence = ++sequence;
  readonly startedAtUnixMs = Date.now();
  readonly startedAtMonotonicMs = performance.now();
  get route(): MeasuredScreen {
    return this.start.route;
  }

  constructor(private readonly start: NavigationStart) {
    this.emit(['start']);
  }

  observe(state: ScreenDataState): void {
    this.emit(this.readiness.observe(state));
  }
  layout(width: number, height: number): void {
    this.emit(this.readiness.layout(width, height));
  }
  frame(): void {
    this.emit(this.readiness.frame());
  }
  finish(): void {
    this.emit(this.readiness.finish('aborted'));
  }

  private emit(phases: readonly (ScreenMilestone | 'start')[]): void {
    for (const phase of phases)
      recordBenchmarkEvent({
        kind: 'screen',
        route: this.start.route,
        origin: this.start.origin,
        phase,
        freshness: this.readiness.state,
        navigationSequence: this.navigationSequence,
        elapsedMs: Math.max(0, performance.now() - this.start.atMs)
      });
  }
}
