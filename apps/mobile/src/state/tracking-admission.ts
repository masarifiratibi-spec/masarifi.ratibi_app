import { create } from 'zustand';
import { resolveClientMode, isBenchmarkReadOnly } from '@/config/client-runtime';

export const useTrackingAdmission = create<{
  isolatedForOwnerId: string | null;
  ready: boolean;
  admittedOwnerId: string | null;
  revision: number;
}>(() => ({
  isolatedForOwnerId: null,
  ready: resolveClientMode() !== 'live' || isBenchmarkReadOnly(),
  admittedOwnerId: null,
  revision: 0
}));

export function beginTrackingAdmission(): void {
  useTrackingAdmission.setState((state) => ({
    ready: false,
    admittedOwnerId: null,
    revision: state.revision + 1
  }));
}

export function isolateTrackingForOwner(ownerId: string): void {
  useTrackingAdmission.setState((state) => ({
    isolatedForOwnerId: ownerId,
    ready: false,
    admittedOwnerId: null,
    revision: state.revision + 1
  }));
}

export function admitTrackingOwner(ownerId: string): void {
  useTrackingAdmission.setState((state) => ({
    isolatedForOwnerId: null,
    ready: true,
    admittedOwnerId: ownerId,
    revision: state.revision + 1
  }));
}

export function assertTrackingAvailable(ownerId?: string): void {
  const state = useTrackingAdmission.getState();
  if (
    !state.ready ||
    (ownerId && state.admittedOwnerId && ownerId !== state.admittedOwnerId)
  )
    throw new Error('tracking_owner_isolated');
}

export function captureTrackingAdmission(ownerId?: string): () => void {
  assertTrackingAvailable(ownerId);
  const revision = useTrackingAdmission.getState().revision;
  return () => {
    assertTrackingAvailable(ownerId);
    if (useTrackingAdmission.getState().revision !== revision)
      throw new Error('tracking_admission_changed');
  };
}
