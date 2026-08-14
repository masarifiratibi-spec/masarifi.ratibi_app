import { applicationPreferencesSchema, privacyRequestSchema, representativeSessionSchema, securityEventSchema, userProfileSchema } from './settings';

test('validates protected profile and application preference defaults', () => {
  expect(userProfileSchema.safeParse({ name: 'A', avatar: 'default', phone: null, googleAccount: null, email: 'a@example.com', country: 'SA', currency: 'SAR', timeZone: 'Asia/Riyadh', completion: [], version: 1 }).success).toBe(true);
  expect(applicationPreferencesSchema.safeParse({ locale: 'ar', theme: 'system', hideBalances: true, reducedMotion: false, baseCurrencyCode: 'SAR', timeZone: 'Asia/Riyadh', firstDayOfWeek: 'sunday', defaultAccountId: null, transactionDefaults: {}, dashboardSections: [], voiceEnabled: true }).success).toBe(true);
});

test('allows safe session/security events and request-only privacy outcomes', () => {
  expect(representativeSessionSchema.safeParse({ id: 's1', deviceLabel: 'Phone', platform: 'android', createdAt: 1, lastActiveAt: 1, isCurrentDevice: true, status: 'active' }).success).toBe(true);
  expect(securityEventSchema.safeParse({ id: 'e1', type: 'new_session', deviceLabel: 'Phone', platform: 'android', occurredAt: 1, status: 'succeeded', recoveryDestination: { kind: 'settings', key: 'security' } }).success).toBe(true);
  expect(privacyRequestSchema.safeParse({ id: 'p1', operationId: 'op-1', kind: 'data_export', status: 'accepted', requestedAt: 1, updatedAt: 1, safeFailure: null }).success).toBe(true);
});

test('rejects unsafe application defaults and invalid profile input', () => {
  expect(applicationPreferencesSchema.safeParse({ timeZone: 'not-a-zone', firstDayOfWeek: 'friday', defaultAccountId: 'raw-account', transactionDefaults: { secret: true }, dashboardSections: ['anything'], voiceEnabled: true }).success).toBe(false);
  expect(userProfileSchema.safeParse({ name: 'A', avatar: 'default', phone: null, googleAccount: null, email: 'bad', country: 'SA', currency: 'sar', timeZone: 'Asia/Riyadh', completion: [], version: 1 }).success).toBe(false);
});
