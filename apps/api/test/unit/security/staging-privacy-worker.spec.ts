import { stagingPrivacyScope } from '../../../src/staging-privacy-worker';

const valid = {
  MASARIFI_PROCESS_KIND: 'worker' as const,
  CLERK_SECRET_KEY: ['sk', 'test', 'nonfunctionalfixture'].join('_'),
  MASARIFI_RELEASE_VERSION: 'a'.repeat(40),
  SUPABASE_URL: 'https://qcffvfbpzvpwcwxwjyro.supabase.co',
  MASARIFI_STAGING_PRIVACY_OWNER_ID: 'user_Disposable123',
};

test('scoped privacy runtime pins a Staging owner and source without publishing the owner in health metadata', () => {
  expect(stagingPrivacyScope(valid).ownerHash).toMatch(/^[a-f0-9]{64}$/);
  expect(stagingPrivacyScope(valid)).toMatchObject({
    owner: 'user_Disposable123',
    source: 'a'.repeat(40),
  });
});

test.each([
  { MASARIFI_STAGING_PRIVACY_OWNER_ID: undefined },
  { MASARIFI_STAGING_PRIVACY_OWNER_ID: '' },
  { MASARIFI_STAGING_PRIVACY_OWNER_ID: 'user_bad owner' },
  { MASARIFI_RELEASE_VERSION: 'dirty-source' },
  { SUPABASE_URL: 'https://production.supabase.co' },
  { MASARIFI_PROCESS_KIND: 'api' as const },
])('scoped privacy refuses an invalid runtime %j', (patch) => {
  expect(() => stagingPrivacyScope({ ...valid, ...patch })).toThrow(
    'PRIVACY_SCOPED_RUNTIME_CONFIGURATION_INVALID',
  );
});

test.each([undefined, '', ['sk', 'live', 'nonfunctionalfixture'].join('_')])(
  'scoped privacy refuses a live-mode or absent Clerk test instance',
  (secretKey) => {
    const runtime = { ...valid, CLERK_SECRET_KEY: secretKey };
    expect(() => stagingPrivacyScope(runtime)).toThrow(
      'PRIVACY_SCOPED_TEST_CLERK_INSTANCE_REQUIRED',
    );
  },
);
