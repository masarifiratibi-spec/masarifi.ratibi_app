import {
  createVerificationAttempt,
  resendVerificationAttempt,
  verifyAttemptCode,
  type VerificationAttempt
} from './phone-verification';

describe('phone verification state machine', () => {
  it('accepts six digits within five minutes and blocks incomplete codes', () => {
    const attempt = createVerificationAttempt({
      sessionId: 'attempt-1',
      countryCode: '+20',
      phoneValue: '5550100',
      code: '000000',
      now: 1_000
    });

    expect(verifyAttemptCode(attempt, '123', 1_100).status).toBe('invalid');
    expect(verifyAttemptCode(attempt, '000000', 1_100).status).toBe('verified');
  });

  it('enforces expiry, resend delay, invalid attempt limit, and replacement invalidation', () => {
    const attempt = createVerificationAttempt({
      sessionId: 'attempt-1',
      countryCode: '+20',
      phoneValue: '5550100',
      code: '000000',
      now: 1_000
    });

    expect(verifyAttemptCode(attempt, '000000', 301_001).status).toBe('expired');
    expect(() => resendVerificationAttempt(attempt, 'attempt-2', 1_010)).toThrow(
      'resend unavailable'
    );

    const replaced = resendVerificationAttempt(attempt, 'attempt-2', 31_000);
    expect(replaced.previous.replacedBy).toBe('attempt-2');

    const failed = Array.from({ length: 5 }).reduce<VerificationAttempt>(
      (current) => verifyAttemptCode(current, '111111', 1_100),
      attempt
    );
    expect(failed.status).toBe('rate_limited');
  });
});
