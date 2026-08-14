import type { PlanningDataState } from '@/domain/financial-planning';

export type PlanningUiState =
  | 'loading'
  | 'empty'
  | 'partial'
  | 'stale'
  | 'error'
  | 'offline'
  | 'pending'
  | 'failed'
  | 'conflict'
  | 'ready';

export function mapPlanningState(input: {
  loading?: boolean;
  error?: boolean;
  dataState?: PlanningDataState;
  pending?: boolean;
  failed?: boolean;
  conflict?: boolean;
}): PlanningUiState {
  if (input.loading) return 'loading';
  if (input.error) return 'error';
  if (input.conflict) return 'conflict';
  if (input.failed) return 'failed';
  if (input.pending) return 'pending';
  if (input.dataState === 'empty') return 'empty';
  if (input.dataState === 'partial') return 'partial';
  if (input.dataState === 'stale') return 'stale';
  if (input.dataState === 'offline') return 'offline';
  return 'ready';
}

export function retryablePlanningState(state: PlanningUiState): boolean {
  return state === 'error' || state === 'failed' || state === 'offline';
}
