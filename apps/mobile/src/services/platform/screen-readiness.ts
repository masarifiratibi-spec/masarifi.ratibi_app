import {
  hasReadableSnapshot,
  offlineSnapshot,
  remoteSnapshotSince
} from '@/services/read-snapshot';

export type ScreenDataState =
  'pending' | 'cached' | 'fresh' | 'offline' | 'failed';
export type ScreenMilestone =
  | 'visible'
  | 'cached'
  | 'refreshed'
  | 'offline'
  | 'interactive'
  | 'failed'
  | 'aborted';
export type ScreenRead = {
  data: unknown;
  isError: boolean;
  error?: unknown;
  isFetching?: boolean;
  dataUpdatedAt?: number;
  isPlaceholderData?: boolean;
};

export function classifyScreenReads(
  reads: readonly ScreenRead[],
  startedAt: number,
  startedAtMonotonic = 0
): ScreenDataState {
  if (!reads.length) return 'pending';
  if (reads.some((read) => read.isError && !hasReadableSnapshot(read)))
    return 'failed';
  if (
    !reads.every(hasReadableSnapshot) ||
    reads.some((read) => read.isPlaceholderData)
  )
    return 'pending';
  if (reads.some((read) => offlineSnapshot(read.data))) return 'offline';
  return reads.every(
    (read) =>
      !read.isFetching &&
      !read.isError &&
      Number.isFinite(read.dataUpdatedAt) &&
      (read.dataUpdatedAt ?? 0) >= startedAt &&
      (read.dataUpdatedAt ?? Infinity) <= Date.now() &&
      remoteSnapshotSince(read.data, startedAtMonotonic)
  )
    ? 'fresh'
    : 'cached';
}

/** Observes usable data without controlling loading, reads or navigation. */
export class ScreenReadiness {
  private closed = false;
  private laidOut = false;
  private emitted = new Set<string>();
  state: ScreenDataState = 'pending';

  observe(state: ScreenDataState): ScreenMilestone[] {
    if (this.closed) return [];
    this.state = state;
    if (state === 'failed') return this.finish('failed');
    return state === 'pending'
      ? []
      : this.once(state === 'fresh' ? 'refreshed' : state);
  }

  layout(width: number, height: number): ScreenMilestone[] {
    if (this.closed || width <= 0 || height <= 0) return [];
    this.laidOut = true;
    return this.once('visible');
  }

  frame(): ScreenMilestone[] {
    if (
      this.closed ||
      !this.laidOut ||
      ['pending', 'failed'].includes(this.state)
    )
      return [];
    return this.once('interactive', `interactive:${this.state}`);
  }

  finish(outcome: 'failed' | 'aborted'): ScreenMilestone[] {
    if (this.closed) return [];
    this.closed = true;
    const usable = [...this.emitted].some((key) =>
      key.startsWith('interactive:')
    );
    return outcome === 'aborted' && usable ? [] : [outcome];
  }

  private once(
    milestone: ScreenMilestone,
    key: string = milestone
  ): ScreenMilestone[] {
    if (this.emitted.has(key)) return [];
    this.emitted.add(key);
    return [milestone];
  }
}
