import * as LocalAuthentication from 'expo-local-authentication';

import { createMockBiometricService } from '@/services/mocks/biometric-service';
import { createBiometricService } from './biometric-service';

jest.mock('expo-local-authentication', () => ({
  authenticateAsync: jest.fn(),
  hasHardwareAsync: jest.fn(),
  isEnrolledAsync: jest.fn()
}));

const hasHardware = jest.mocked(LocalAuthentication.hasHardwareAsync);
const isEnrolled = jest.mocked(LocalAuthentication.isEnrolledAsync);
const authenticate = jest.mocked(LocalAuthentication.authenticateAsync);

describe('biometric service', () => {
  it('serves deterministic mock availability and results', async () => {
    const service = createMockBiometricService('supported', 'cancelled');
    await expect(service.getAvailability()).resolves.toEqual({ status: 'supported' });
    await expect(service.authenticate()).resolves.toEqual({ status: 'cancelled' });
  });

  it('maps native availability and authentication states', async () => {
    const service = createBiometricService();
    hasHardware.mockResolvedValue(false);
    await expect(service.getAvailability()).resolves.toEqual({ status: 'unsupported' });

    hasHardware.mockResolvedValue(true);
    isEnrolled.mockResolvedValue(false);
    await expect(service.getAvailability()).resolves.toEqual({ status: 'not_enrolled' });

    isEnrolled.mockResolvedValue(true);
    authenticate.mockResolvedValue({ success: true });
    await expect(service.authenticate()).resolves.toEqual({ status: 'authenticated' });

    authenticate.mockResolvedValue({ success: false, error: 'lockout' });
    await expect(service.authenticate()).resolves.toEqual({ status: 'locked_out' });
  });
});
