import { assertCompatibleProvider } from './capability-contract';
import {
  appShellStorageCapability,
  authServiceCapability,
  biometricServiceCapability,
  onboardingServiceCapability,
  trackingPermissionServiceCapability
} from './app-shell-service';
import {
  financialSummaryServiceCapability,
  platformCapabilityServiceCapability
} from './foundation-service';
import { createMockAuthService } from '@/services/mocks/auth-service';
import { createMockBiometricService } from '@/services/mocks/biometric-service';
import { createMockOnboardingService } from '@/services/mocks/onboarding-service';
import { createMockTrackingPermissionService } from '@/services/mocks/tracking-permission-service';
import { buildAndroidCapabilities, buildIosCapabilities } from '@/services/mocks/platform-capabilities';
import { createMockFinancialSummaryService } from '@/services/mocks/financial-summary';
import { createAppShellStorage } from '@/storage/app-shell-storage';

describe('auth/app-shell/foundation provider compatibility', () => {
  it('declares compatible providers for successful app-shell and foundation services', async () => {
    const auth = createMockAuthService({ now: () => 1 });
    const onboarding = createMockOnboardingService();
    const tracking = createMockTrackingPermissionService('not_requested');
    const biometric = createMockBiometricService('supported', 'authenticated');
    const storage = createAppShellStorage();
    const capabilities = buildAndroidCapabilities('granted');
    const summary = createMockFinancialSummaryService();

    expect(assertCompatibleProvider(authServiceCapability, auth.metadata)).toBe(auth.metadata);
    expect(assertCompatibleProvider(onboardingServiceCapability, onboarding.metadata)).toBe(onboarding.metadata);
    expect(assertCompatibleProvider(trackingPermissionServiceCapability, tracking.metadata)).toBe(tracking.metadata);
    expect(assertCompatibleProvider(biometricServiceCapability, biometric.metadata)).toBe(biometric.metadata);
    expect(assertCompatibleProvider(appShellStorageCapability, storage.metadata)).toBe(storage.metadata);
    expect(assertCompatibleProvider(platformCapabilityServiceCapability, capabilities.metadata)).toBe(capabilities.metadata);
    expect(assertCompatibleProvider(financialSummaryServiceCapability, summary.metadata)).toBe(summary.metadata);

    await expect(auth.signInWithGoogle()).resolves.toMatchObject({ status: 'authenticated' });
  });

  it('keeps safe failure and unavailable outcomes contract-shaped', async () => {
    const auth = createMockAuthService({ googleMode: 'offline' });
    const tracking = createMockTrackingPermissionService('unavailable');
    const biometric = createMockBiometricService('unsupported', 'unavailable');
    const iosCapabilities = buildIosCapabilities();

    expect(assertCompatibleProvider(authServiceCapability, auth.metadata)).toBe(auth.metadata);
    await expect(auth.signInWithGoogle()).resolves.toEqual({
      status: 'failed',
      errorCode: 'offline'
    });
    expect(assertCompatibleProvider(trackingPermissionServiceCapability, tracking.metadata)).toBe(tracking.metadata);
    await expect(tracking.getState()).resolves.toMatchObject({
      status: 'unavailable',
      recoveryAction: 'continue'
    });
    expect(assertCompatibleProvider(biometricServiceCapability, biometric.metadata)).toBe(biometric.metadata);
    await expect(biometric.authenticate()).resolves.toEqual({ status: 'unavailable' });
    expect(assertCompatibleProvider(platformCapabilityServiceCapability, iosCapabilities.metadata)).toBe(iosCapabilities.metadata);
    expect(iosCapabilities.listCaptureMethods('ios').map((item) => item.kind)).toEqual(['manual', 'voice']);
  });

  it('rejects incompatible providers before execution', () => {
    const execute = jest.fn();
    expect(() =>
      assertCompatibleProvider(authServiceCapability, {
        id: 'wrong-major',
        capability: authServiceCapability.capability,
        majorVersion: authServiceCapability.majorVersion + 1,
        kind: 'mock',
        availability: 'available'
      })
    ).toThrow('incompatible provider');
    expect(execute).not.toHaveBeenCalled();
  });
});
