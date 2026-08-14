import { createMockAuthService } from '@/services/mocks/auth-service';
import type { PhoneVerificationAttempt } from '@/services/contracts/app-shell-service';

export const authService = createMockAuthService();

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
