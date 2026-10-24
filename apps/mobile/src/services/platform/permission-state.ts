import type { PermissionState } from '@/domain/app-shell';
const recoveryByStatus: Record<
  PermissionState['status'],
  PermissionState['recoveryAction']
> = {
  not_requested: 'request',
  granted: 'continue',
  denied: 'retry',
  permanently_denied: 'open_settings',
  revoked: 'open_settings',
  unavailable: 'continue'
};

export function permissionState(
  status: PermissionState['status']
): PermissionState {
  return {
    id: 'sms',
    status,
    blocking: false,
    recoveryAction: recoveryByStatus[status]
  };
}
