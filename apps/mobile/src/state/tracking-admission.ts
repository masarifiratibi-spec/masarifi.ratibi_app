import { create } from 'zustand';
import {
  resolveClientMode,
  isBenchmarkReadOnly
} from '@/config/client-runtime';

export interface TrackingNativeLease {
  ownerDigest: string;
  generation: string;
}

export const useTrackingAdmission = create<{
  isolatedForOwnerId: string | null;
  ready: boolean;
  admittedOwnerId: string | null;
  revision: number;
  nativeLease: TrackingNativeLease | null;
  sessionAnchor: string | null;
  partitioned: boolean;
}>(() => ({
  isolatedForOwnerId: null,
  ready: resolveClientMode() !== 'live' || isBenchmarkReadOnly(),
  admittedOwnerId: null,
  revision: 0,
  nativeLease: null,
  sessionAnchor: null,
  partitioned: false
}));

export function beginTrackingAdmission(): void {
  useTrackingAdmission.setState((state) => ({
    ready: false,
    admittedOwnerId: null,
    nativeLease: null,
    sessionAnchor: null,
    revision: state.revision + 1
  }));
}

export function markTrackingOwnerPartitions(): void {
  useTrackingAdmission.setState({ partitioned: true });
}

export function isolateTrackingForOwner(ownerId: string): void {
  useTrackingAdmission.setState((state) => ({
    isolatedForOwnerId: ownerId,
    ready: false,
    admittedOwnerId: null,
    nativeLease: null,
    sessionAnchor: null,
    revision: state.revision + 1
  }));
}

export function admitTrackingOwner(
  ownerId: string,
  nativeLease: TrackingNativeLease | null = null,
  sessionAnchor: string | null = null
): void {
  useTrackingAdmission.setState((state) => ({
    isolatedForOwnerId: null,
    ready: true,
    admittedOwnerId: ownerId,
    nativeLease,
    sessionAnchor,
    partitioned: state.partitioned || nativeLease !== null,
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

export function refreshTrackingNativeLease(
  ownerId: string,
  lease: TrackingNativeLease,
  sessionAnchor: string
): void {
  assertTrackingAvailable(ownerId);
  const state = useTrackingAdmission.getState();
  if (
    state.admittedOwnerId !== ownerId ||
    state.sessionAnchor !== sessionAnchor
  )
    throw new Error('tracking_admission_changed');
  // Consent rotation changes the native capability, not the authenticated identity.
  useTrackingAdmission.setState({ nativeLease: lease });
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
