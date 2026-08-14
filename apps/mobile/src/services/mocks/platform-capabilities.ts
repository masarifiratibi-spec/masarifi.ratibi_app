/**
 * Deterministic platform-capability adapters (mock).
 *
 * Android exposes SMS tracking as a permission-gated capability with manual and
 * voice fallbacks. iOS honestly omits SMS and offers manual, voice, and approved
 * alternatives. Platform differences are resolved here, never inferred inside
 * components (UI Contract §2). Constitution Principle II (Platform Honest).
 */

import {
  PERMISSION_TRANSITIONS,
  type CaptureMethod,
  type PermissionAction,
  type PermissionState,
  type PermissionStatus,
  type Platform,
  type PlatformCapability
} from '@/domain/foundation';
import type { PlatformCapabilityService } from '@/services/contracts/foundation-service';
import { platformCapabilityServiceCapability } from '@/services/contracts/foundation-service';
import type { CapabilityProviderHandle } from '@/services/contracts/capability-contract';
import { InvalidTransitionError } from '@/storage/errors';

const disableSms: PermissionAction = {
  key: 'capture.permission.disable',
  kind: 'disable'
};
const recoverSettings: PermissionAction = {
  key: 'capture.permission.recover',
  kind: 'recovery'
};

const smsPermission = (status: PermissionStatus): PermissionState => ({
  id: 'sms',
  status,
  purposeKey: 'capture.sms.purpose',
  dataUseKey: 'capture.sms.dataUse',
  disableAction: disableSms,
  recoveryAction: recoveryFor(status),
  blocking: false
});

function recoveryFor(status: PermissionStatus): PermissionAction | null {
  switch (status) {
    case 'denied':
    case 'revoked':
    case 'permanently_denied':
      return recoverSettings;
    default:
      return null;
  }
}

const manualCapture: CaptureMethod = {
  kind: 'manual',
  platformAvailability: new Set<Platform>(['android', 'ios']),
  permissionId: null,
  fallbackCapabilityId: null,
  availability: 'available'
};

const voiceCapture: CaptureMethod = {
  kind: 'voice',
  platformAvailability: new Set<Platform>(['android', 'ios']),
  permissionId: null,
  fallbackCapabilityId: null,
  availability: 'available'
};

const androidSmsCapture: CaptureMethod = {
  kind: 'automatic',
  platformAvailability: new Set<Platform>(['android']),
  permissionId: 'sms',
  fallbackCapabilityId: 'manual-entry',
  availability: 'permission_required'
};

export function buildAndroidCapabilities(
  initialPermission: PermissionStatus = 'not_requested'
): CapabilityProviderHandle<PlatformCapabilityService> {
  const androidSms: PlatformCapability = {
    id: 'sms-tracking',
    platform: 'android',
    availability: 'permission_required',
    explanationKey: 'capture.sms.title',
    fallbackCapabilityIds: ['manual-entry', 'voice-entry']
  };

  return {
    metadata: {
      id: 'mock-android-platform-capabilities',
      capability: platformCapabilityServiceCapability.capability,
      majorVersion: platformCapabilityServiceCapability.majorVersion,
      kind: 'mock',
      availability: 'available'
    },
    listCapabilities: () => [androidSms],
    listPermissions: () => [smsPermission(initialPermission)],
    listCaptureMethods: () => [androidSmsCapture, manualCapture, voiceCapture]
  };
}

export function buildIosCapabilities(): CapabilityProviderHandle<PlatformCapabilityService> {
  return {
    metadata: {
      id: 'mock-ios-platform-capabilities',
      capability: platformCapabilityServiceCapability.capability,
      majorVersion: platformCapabilityServiceCapability.majorVersion,
      kind: 'mock',
      availability: 'available'
    },
    listCapabilities: () => [],
    listPermissions: () => [],
    listCaptureMethods: () => [manualCapture, voiceCapture]
  };
}

/**
 * Guard a permission state transition against the allowed table. Throws a typed
 * error on invalid transitions so the UI can render a recovery action instead
 * of a raw system message (Constitution FR-025).
 */
export function permissionTransition(
  from: PermissionStatus,
  to: PermissionStatus
): PermissionStatus {
  const allowed = PERMISSION_TRANSITIONS.get(from);
  if (!allowed || !allowed.has(to)) {
    throw new InvalidTransitionError(from, to);
  }
  return to;
}
