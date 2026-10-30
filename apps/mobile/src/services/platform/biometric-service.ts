import * as LocalAuthentication from 'expo-local-authentication';
import { Platform } from 'react-native';
import { translate } from '@/localization/i18n';

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
let activeOwnerId: string | null = null;

export function createBiometricService(ownerId: string | null = null): BiometricService {
  return {
    async getAvailability() {
      const [hardware, enrolled, level] = await Promise.all([
        LocalAuthentication.hasHardwareAsync(),
        LocalAuthentication.isEnrolledAsync(),
        LocalAuthentication.getEnrolledLevelAsync()
      ]);
      const deviceCredential = level >= LocalAuthentication.SecurityLevel.SECRET;
      if (!hardware && !deviceCredential) return { status: 'unsupported' };
      if (!enrolled && !deviceCredential) return { status: 'not_enrolled' };
      const nativeTypes =
        enrolled ? await LocalAuthentication.supportedAuthenticationTypesAsync() : [];
      const kinds = nativeTypes
        .map((nativeType) => kindByNativeType[nativeType])
        .filter((kind): kind is BiometricKind => kind !== undefined);
      return { status: 'supported', kinds, deviceCredential: true };
    },
    authenticate() {
      if (activeAuthentication) {
        return activeOwnerId === ownerId
          ? activeAuthentication
          : Promise.resolve({ status: 'cancelled' });
      }
      const request = authenticateOnce();
      activeAuthentication = request;
      activeOwnerId = ownerId;
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
    disableDeviceFallback: false,
    biometricsSecurityLevel: 'strong',
    promptMessage: translate('appShell.security.nativeUnlock')
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
    result.error === 'not_enrolled' ||
    result.error === 'passcode_not_set'
  ) {
    return { status: 'unavailable' };
  }
  return { status: 'failed' };
}
