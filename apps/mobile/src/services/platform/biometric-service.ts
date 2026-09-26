import * as LocalAuthentication from 'expo-local-authentication';
import { Platform } from 'react-native';

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
      const nativeTypes =
        await LocalAuthentication.supportedAuthenticationTypesAsync();
      const kinds = nativeTypes
        .map((nativeType) => kindByNativeType[nativeType])
        .filter((kind): kind is BiometricKind => kind !== undefined);
      return { status: 'supported', kinds };
    },
    async authenticate() {
      if (Platform.OS === 'android') {
        await LocalAuthentication.cancelAuthenticate();
      }
      const result = await LocalAuthentication.authenticateAsync({
        disableDeviceFallback: true
      });
      if (result.success) return { status: 'authenticated' };
      if (result.error === 'lockout') return { status: 'locked_out' };
      if (
        result.error === 'app_cancel' ||
        result.error === 'user_cancel' ||
        result.error === 'system_cancel'
      ) {
        return { status: 'cancelled' };
      }
      return { status: 'failed' };
    }
  };
}
