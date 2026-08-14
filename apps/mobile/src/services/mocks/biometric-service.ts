import type {
  BiometricAvailability,
  BiometricResult,
  BiometricService
} from '@/services/contracts/app-shell-service';
import { biometricServiceCapability } from '@/services/contracts/app-shell-service';
import type { CapabilityProviderHandle } from '@/services/contracts/capability-contract';

export function createMockBiometricService(
  availability: BiometricAvailability['status'] = 'supported',
  result: BiometricResult['status'] = 'authenticated'
): CapabilityProviderHandle<BiometricService> {
  return {
    metadata: {
      id: 'mock-biometric',
      capability: biometricServiceCapability.capability,
      majorVersion: biometricServiceCapability.majorVersion,
      kind: 'mock',
      availability: availability === 'unsupported' || result === 'unavailable' ? 'unavailable' : 'available'
    },
    async getAvailability() {
      return { status: availability };
    },
    async authenticate() {
      return { status: result };
    }
  };
}
