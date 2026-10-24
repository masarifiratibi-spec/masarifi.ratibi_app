import type { TrackingPermissionService } from '@/services/contracts/app-shell-service';
import { permissionState } from './permission-state';

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
