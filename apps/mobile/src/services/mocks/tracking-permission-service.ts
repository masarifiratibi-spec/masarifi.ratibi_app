import type { PermissionState } from '@/domain/app-shell';
import {
  trackingPermissionServiceCapability,
  type TrackingPermissionService
} from '@/services/contracts/app-shell-service';
import type { CapabilityProviderHandle } from '@/services/contracts/capability-contract';

const recoveryByStatus: Record<PermissionState['status'], PermissionState['recoveryAction']> = {
  not_requested: 'request',
  granted: 'continue',
  denied: 'retry',
  permanently_denied: 'open_settings',
  revoked: 'open_settings',
  unavailable: 'continue'
};

export function permissionState(status: PermissionState['status']): PermissionState {
  return {
    id: 'sms',
    status,
    blocking: false,
    recoveryAction: recoveryByStatus[status]
  };
}

export function createMockTrackingPermissionService(
  initial: PermissionState['status'] = 'not_requested'
): CapabilityProviderHandle<TrackingPermissionService> & {
  requestAfterEducation(educationSeen?: boolean): Promise<PermissionState>;
} {
  let state = permissionState(initial);
  return {
    metadata: {
      id: 'mock-tracking-permission',
      capability: trackingPermissionServiceCapability.capability,
      majorVersion: trackingPermissionServiceCapability.majorVersion,
      kind: 'mock',
      availability: initial === 'unavailable' ? 'unavailable' : 'available'
    },
    async getState() {
      return state;
    },
    async requestAfterEducation(educationSeen = true) {
      if (!educationSeen) return state;
      state = permissionState('granted');
      return state;
    },
    async openSettings() {
      state = permissionState('revoked');
    }
  };
}
