import {
  authSessionSchema,
  canRequestPermission,
  canTransitionAuthSession,
  keywordRuleSchema,
  navigationContextSchema,
  onboardingProgressSchema,
  permissionStateSchema,
  pinCredentialSchema,
  privacyLockPreferenceSchema,
  profileCompletionStepSchema,
  trackingPreferenceSchema
} from './app-shell';

describe('app-shell domain', () => {
  it('validates authenticated sessions and auth transition order', () => {
    expect(
      authSessionSchema.safeParse({
        status: 'authenticated',
        userId: null,
        method: 'phone',
        issuedAt: 1,
        expiresAt: 2,
        restoration: 'restored'
      }).success
    ).toBe(false);

    expect(canTransitionAuthSession('signed_out', 'restoring')).toBe(true);
    expect(canTransitionAuthSession('signed_out', 'expired')).toBe(false);
  });

  it('validates navigation, onboarding, and permission gate records', () => {
    expect(
      navigationContextSchema.parse({
        requestedDestination: '/(tabs)/home',
        safeReturnDestination: null,
        gate: 'onboarding',
        localeDirection: 'rtl'
      }).gate
    ).toBe('onboarding');

    const progress = onboardingProgressSchema.parse({
      platformPath: 'android',
      status: 'in_progress',
      completedSteps: ['tracking_intro'],
      skippedSteps: [],
      currentStep: 'permission_request',
      permissionEducationSeen: false,
      trackingPreference: null,
      updatedAt: 10
    });

    const permission = permissionStateSchema.parse({
      id: 'sms',
      status: 'not_requested',
      blocking: false,
      recoveryAction: 'request'
    });

    expect(canRequestPermission(progress, permission)).toBe(false);
  });

  it('normalizes keyword rules and rejects empty keyword values', () => {
    const rule = keywordRuleSchema.parse({
      id: 'kw-1',
      group: 'expense',
      language: 'en',
      value: '  Grocery  ',
      normalizedValue: 'ignored',
      origin: 'custom',
      enabled: true
    });

    expect(rule.value).toBe('Grocery');
    expect(rule.normalizedValue).toBe('grocery');
    expect(
      keywordRuleSchema.safeParse({
        ...rule,
        value: '   '
      }).success
    ).toBe(false);
  });

  it('validates tracking, privacy lock, and profile completion records', () => {
    expect(
      trackingPreferenceSchema.parse({
        mode: 'automatic_clear',
        selectedAt: 10,
        isRecommended: true
      }).isRecommended
    ).toBe(true);

    expect(
      trackingPreferenceSchema.safeParse({
        mode: 'paused',
        selectedAt: 10,
        isRecommended: true
      }).success
    ).toBe(false);

    expect(
      privacyLockPreferenceSchema.safeParse({
        pinConfigured: true,
        biometricStatus: 'enabled',
        autoLockDuration: 'immediate',
        invalidAttempts: 6,
        lockedUntil: null,
        appLockStatus: 'locked'
      }).success
    ).toBe(false);

    expect(
      profileCompletionStepSchema.parse({
        id: 'first_account',
        status: 'incomplete',
        destination: '/accounts',
        dismissed: false
      }).destination
    ).toBe('/accounts');
  });

  it('accepts only bounded PBKDF2 App PIN credentials', () => {
    expect(
      pinCredentialSchema.safeParse(
        `pbkdf2-sha256:120000:${'01'.repeat(16)}:${'ab'.repeat(32)}`
      ).success
    ).toBe(true);

    for (const credential of [
      'pin:123456',
      `pbkdf2-sha256:9999:${'01'.repeat(16)}:${'ab'.repeat(32)}`,
      `pbkdf2-sha256:500001:${'01'.repeat(16)}:${'ab'.repeat(32)}`,
      `pbkdf2-sha256:120000:${'01'.repeat(15)}:${'ab'.repeat(32)}`,
      `pbkdf2-sha256:120000:${'01'.repeat(16)}:${'ab'.repeat(31)}`,
      `pbkdf2-sha256:120000:${'GG'.repeat(16)}:${'ab'.repeat(32)}`
    ]) {
      expect(pinCredentialSchema.safeParse(credential).success).toBe(false);
    }
  });
});
