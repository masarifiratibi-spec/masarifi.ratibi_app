import type { PhoneVerificationAttempt } from '@/services/contracts/app-shell-service';

export interface VerificationAttempt extends PhoneVerificationAttempt {
  code: string;
}

export interface ResendResult {
  previous: VerificationAttempt;
  next: VerificationAttempt;
}

const codeLength = 6;
const expiryMs = 5 * 60 * 1000;
const resendDelayMs = 30 * 1000;
const maxInvalidAttempts = 5;

export function createVerificationAttempt({
  sessionId,
  countryCode,
  phoneValue,
  code = '000000',
  now
}: {
  sessionId: string;
  countryCode: string;
  phoneValue: string;
  code?: string;
  now: number;
}): VerificationAttempt {
  return {
    sessionId,
    countryCode,
    phoneValue,
    codeLength,
    status: 'sent',
    issuedAt: now,
    resendAvailableAt: now + resendDelayMs,
    invalidAttempts: 0,
    replacedBy: null,
    code
  };
}

export function verifyAttemptCode(
  attempt: VerificationAttempt,
  code: string,
  now: number
): VerificationAttempt {
  if (attempt.replacedBy) return { ...attempt, status: 'expired' };
  if (now - attempt.issuedAt > expiryMs) return { ...attempt, status: 'expired' };
  if (code.length !== codeLength || code !== attempt.code) {
    const invalidAttempts = attempt.invalidAttempts + 1;
    return {
      ...attempt,
      invalidAttempts,
      status: invalidAttempts >= maxInvalidAttempts ? 'rate_limited' : 'invalid'
    };
  }
  return { ...attempt, status: 'verified' };
}

export function resendVerificationAttempt(
  attempt: VerificationAttempt,
  nextSessionId: string,
  now: number
): ResendResult {
  if (now < attempt.resendAvailableAt) {
    throw new Error('resend unavailable');
  }
  return {
    previous: { ...attempt, replacedBy: nextSessionId, status: 'expired' },
    next: createVerificationAttempt({
      sessionId: nextSessionId,
      countryCode: attempt.countryCode,
      phoneValue: attempt.phoneValue,
      now
    })
  };
}
