import * as LocalAuthentication from 'expo-local-authentication';
import { Platform } from 'react-native';

import type {
  BiometricKind,
  BiometricResult,
  BiometricService
} from '@/services/contracts/app-shell-service';

const kindByNativeType: Record<number, BiometricKind> = {
  1: 'fingerprint',
  2: 'face'
};

let activeAuthentication: Promise<BiometricResult> | null = null;

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
    authenticate() {
      if (activeAuthentication) return activeAuthentication;
      const request = authenticateOnce();
      activeAuthentication = request;
      void request.then(
        () => {
          if (activeAuthentication === request) activeAuthentication = null;
        },
        () => {
          if (activeAuthentication === request) activeAuthentication = null;
        }
      );
      return request;
    },
    async cancel() {
      if (Platform.OS === 'android') {
        await LocalAuthentication.cancelAuthenticate();
      }
    }
  };
}

async function authenticateOnce(): Promise<BiometricResult> {
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
  if (
    result.error === 'not_available' ||
    result.error === 'not_enrolled'
  ) {
    return { status: 'unavailable' };
  }
  return { status: 'failed' };
}
