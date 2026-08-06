/**
 * Maps a PermissionStatus to its user-facing message key.
 *
 * Keeps the panel free of switch-on-status logic; the UI only renders the
 * resolved label and its accessibility name.
 */

import { translate } from '@/localization/i18n';
import type { MessageKey } from '@/localization/messages/en';
import type { PermissionStatus } from '@/domain/foundation';

const STATUS_KEY: Record<PermissionStatus, MessageKey> = {
  not_requested: 'capture.permission.notRequested',
  granted: 'capture.permission.granted',
  denied: 'capture.permission.denied',
  permanently_denied: 'capture.permission.permanentlyDenied',
  revoked: 'capture.permission.revoked',
  unavailable: 'capture.permission.unavailable'
};

export function permissionStatusLabel(status: PermissionStatus): string {
  return translate(STATUS_KEY[status]);
}
