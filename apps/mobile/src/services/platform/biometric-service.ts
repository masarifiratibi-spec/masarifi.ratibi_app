import * as LocalAuthentication from 'expo-local-authentication';

import type { BiometricService } from '@/services/contracts/app-shell-service';

export function createBiometricService(): BiometricService {
  return {
    async getAvailability() {
      if (!(await LocalAuthentication.hasHardwareAsync())) {
        return { status: 'unsupported' };
      }
      if (!(await LocalAuthentication.isEnrolledAsync())) {
        return { status: 'not_enrolled' };
      }
      return { status: 'supported' };
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
