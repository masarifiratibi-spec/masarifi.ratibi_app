import { z } from 'zod';

export const authSessionStatuses = [
  'signed_out',
  'restoring',
  'authenticated',
  'expired'
] as const;
export const authMethods = ['phone', 'google'] as const;
export const restorationStatuses = [
  'idle',
  'pending',
  'restored',
  'missing',
  'failed'
] as const;

export const authSessionSchema = z
  .object({
    status: z.enum(authSessionStatuses),
    userId: z.string().min(1).nullable(),
    method: z.enum(authMethods).nullable(),
    issuedAt: z.number().int().nonnegative().nullable(),
    expiresAt: z.number().int().nonnegative().nullable(),
    restoration: z.enum(restorationStatuses)
  })
  .superRefine((session, ctx) => {
    if (session.status !== 'authenticated') return;
    if (!session.userId || !session.method || !session.issuedAt || !session.expiresAt) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'authenticated sessions require identity and expiry data'
      });
    }
  });

export type AuthenticationSession = z.infer<typeof authSessionSchema>;
export type AuthSessionStatus = AuthenticationSession['status'];

const authTransitions: Record<AuthSessionStatus, readonly AuthSessionStatus[]> = {
  signed_out: ['restoring'],
  restoring: ['authenticated', 'signed_out'],
  authenticated: ['expired', 'signed_out'],
  expired: ['authenticated', 'signed_out']
};

export function canTransitionAuthSession(
  from: AuthSessionStatus,
  to: AuthSessionStatus
): boolean {
  return authTransitions[from].includes(to);
}

export const navigationGates = [
  'hydrating',
  'authentication',
  'unlock',
  'onboarding',
  'ready'
] as const;

export const navigationContextSchema = z.object({
  requestedDestination: z.string().min(1).nullable(),
  safeReturnDestination: z.string().min(1).nullable(),
  gate: z.enum(navigationGates),
  localeDirection: z.enum(['rtl', 'ltr'])
});

export type NavigationContext = z.infer<typeof navigationContextSchema>;

export const onboardingSteps = [
  'tracking_intro',
  'permission_education',
  'permission_request',
  'keywords',
  'preference',
  'demo',
  'platform_explanation',
  'capture_options',
  'optional_automation',
  'manual_voice_demo',
  'complete'
] as const;

export const trackingPreferenceSchema = z
  .object({
    mode: z.enum(['automatic_clear', 'review_all', 'paused']),
    selectedAt: z.number().int().nonnegative(),
    isRecommended: z.boolean()
  })
  .superRefine((preference, ctx) => {
    if (preference.isRecommended !== (preference.mode === 'automatic_clear')) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'only automatic_clear can be recommended'
      });
    }
  });

export type TrackingPreference = z.infer<typeof trackingPreferenceSchema>;

export const onboardingProgressSchema = z.object({
  platformPath: z.enum(['android', 'ios', 'conservative']),
  status: z.enum(['not_started', 'in_progress', 'completed', 'skipped']),
  completedSteps: z.array(z.enum(onboardingSteps)),
  skippedSteps: z.array(z.enum(onboardingSteps)),
  currentStep: z.enum(onboardingSteps).nullable(),
  permissionEducationSeen: z.boolean(),
  trackingPreference: trackingPreferenceSchema.nullable(),
  updatedAt: z.number().int().nonnegative()
});

export type OnboardingProgress = z.infer<typeof onboardingProgressSchema>;

export const permissionStateSchema = z.object({
  id: z.literal('sms'),
  status: z.enum([
    'not_requested',
    'granted',
    'denied',
    'permanently_denied',
    'revoked',
    'unavailable'
  ]),
  blocking: z.literal(false),
  recoveryAction: z.enum(['request', 'retry', 'open_settings', 'continue']).nullable()
});

export type PermissionState = z.infer<typeof permissionStateSchema>;

export function canRequestPermission(
  progress: OnboardingProgress,
  permission: PermissionState
): boolean {
  return (
    progress.platformPath === 'android' &&
    progress.permissionEducationSeen &&
    ['not_requested', 'denied', 'revoked'].includes(permission.status)
  );
}

export const keywordRuleSchema = z
  .object({
    id: z.string().min(1),
    group: z.enum([
      'expense',
      'income',
      'transfer',
      'withdrawal',
      'deposit',
      'refund',
      'subscription',
      'installment',
      'fee',
      'failed_transaction',
      'reversal'
    ]),
    language: z.enum(['ar', 'en']),
    value: z.string(),
    normalizedValue: z.string(),
    origin: z.enum(['default', 'custom']),
    enabled: z.boolean()
  })
  .transform((rule, ctx) => {
    const value = rule.value.trim();
    if (!value) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'keyword value is required'
      });
      return z.NEVER;
    }
    return {
      ...rule,
      value,
      normalizedValue: value.toLocaleLowerCase(rule.language === 'ar' ? 'ar' : 'en')
    };
  });

export type KeywordRule = z.infer<typeof keywordRuleSchema>;

export const privacyLockPreferenceSchema = z.object({
  pinConfigured: z.boolean(),
  biometricStatus: z.enum([
    'unsupported',
    'not_enrolled',
    'disabled',
    'enabled',
    'locked_out'
  ]),
  autoLockDuration: z.enum(['immediate', 'one_minute', 'five_minutes', 'fifteen_minutes']),
  invalidAttempts: z.number().int().min(0).max(5),
  lockedUntil: z.number().int().nonnegative().nullable(),
  appLockStatus: z.enum(['unlocked', 'locked', 'temporarily_locked'])
});

export type PrivacyLockPreference = z.infer<typeof privacyLockPreferenceSchema>;

export const profileCompletionStepSchema = z.object({
  id: z.enum([
    'name',
    'first_account',
    'salary',
    'budget',
    'obligation',
    'savings_goal'
  ]),
  status: z.enum(['incomplete', 'completed', 'unavailable']),
  destination: z.string().min(1),
  dismissed: z.boolean()
});

export type ProfileCompletionStep = z.infer<typeof profileCompletionStepSchema>;
