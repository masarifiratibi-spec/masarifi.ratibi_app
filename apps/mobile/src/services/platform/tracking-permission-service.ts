import type { TrackingPermissionService } from '@/services/contracts/app-shell-service';
import { permissionState } from '@/services/mocks/tracking-permission-service';

export function createTrackingPermissionService(): TrackingPermissionService {
  return {
    async getState() {
      return permissionState('unavailable');
    },
    async requestAfterEducation() {
      return permissionState('unavailable');
    },
    async openSettings() {
      return undefined;
    }
  };
}
