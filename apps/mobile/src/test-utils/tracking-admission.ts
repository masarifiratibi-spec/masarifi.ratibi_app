import { useTrackingAdmission } from '@/state/tracking-admission';

// Service-only fixtures do not mount the SDK/bootstrap which admits real owners.
export function clearTrackingIsolation(): void {
  useTrackingAdmission.setState((state) => ({
    ready: true,
    admittedOwnerId: null,
    isolatedForOwnerId: null,
    nativeLease: null,
    sessionAnchor: null,
    partitioned: false,
    revision: state.revision + 1
  }));
}
