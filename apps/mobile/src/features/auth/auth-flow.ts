import { isDemoModeEnabled } from '@/config/demo-mode';
import type { AuthenticationSession } from '@/domain/app-shell';
import { createMockAuthService } from '@/services/mocks/auth-service';
import {
  authServiceCapability,
  type AuthService,
  type PhoneVerificationAttempt
} from '@/services/contracts/app-shell-service';
import type { CapabilityProviderHandle } from '@/services/contracts/capability-contract';

export function createAuthService(
  demoMode = isDemoModeEnabled()
): CapabilityProviderHandle<AuthService> {
  return demoMode ? createMockAuthService() : createUnavailableAuthService();
}

export const authService = createAuthService();

let activePhoneAttempt: PhoneVerificationAttempt | null = null;

export function setActivePhoneAttempt(attempt: PhoneVerificationAttempt): void {
  activePhoneAttempt = attempt;
}

export function getActivePhoneAttempt(): PhoneVerificationAttempt | null {
  return activePhoneAttempt;
}

export function clearActivePhoneAttempt(): void {
  activePhoneAttempt = null;
}

function createUnavailableAuthService(): CapabilityProviderHandle<AuthService> {
  const unavailable = 'appShell.auth.unavailable';
  const signedOut: AuthenticationSession = {
    status: 'signed_out',
    userId: null,
    method: null,
    issuedAt: null,
    expiresAt: null,
    restoration: 'missing'
  };
  return {
    metadata: {
      id: 'unavailable-auth',
      capability: authServiceCapability.capability,
      majorVersion: authServiceCapability.majorVersion,
      kind: 'mock',
      availability: 'unavailable'
    },
    async startPhone() {
      throw new Error(unavailable);
    },
    async verifyPhone() {
      return { status: 'failed', errorCode: unavailable };
    },
    async resendPhone() {
      throw new Error(unavailable);
    },
    async signInWithGoogle() {
      return { status: 'failed', errorCode: unavailable };
    },
    async reverifyConflict() {
      return { status: 'failed', errorCode: unavailable };
    },
    async restoreSession() {
      return signedOut;
    },
    async signOut() {}
  };
}
