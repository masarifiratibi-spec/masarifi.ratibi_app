import * as LocalAuthentication from 'expo-local-authentication';

import type {
  BiometricKind,
  BiometricService
} from '@/services/contracts/app-shell-service';

const kindByNativeType: Record<number, BiometricKind> = {
  1: 'fingerprint',
  2: 'face'
};

export function createBiometricService(): BiometricService {
  return {
    async getAvailability() {
      if (!(await LocalAuthentication.hasHardwareAsync())) {
        return { status: 'unsupported' };
      }
      if (!(await LocalAuthentication.isEnrolledAsync())) {
        return { status: 'not_enrolled' };
      }
      const nativeTypes = await LocalAuthentication.supportedAuthenticationTypesAsync();
      const kinds = nativeTypes
        .map((nativeType) => kindByNativeType[nativeType])
        .filter((kind): kind is BiometricKind => kind !== undefined);
      return { status: 'supported', kinds };
    },
    async authenticate() {
      const result = await LocalAuthentication.authenticateAsync();
      if (result.success) return { status: 'authenticated' };
      if (result.error === 'lockout') return { status: 'locked_out' };
      if (result.error === 'user_cancel' || result.error === 'system_cancel') {
        return { status: 'cancelled' };
      }
      return { status: 'failed' };
    }
  };
}
