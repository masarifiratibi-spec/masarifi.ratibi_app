import { getClerkInstance } from '@clerk/expo';
import { startAccountDeletionVerification } from './account-deletion-auth';

jest.mock('@clerk/expo', () => ({ getClerkInstance: jest.fn() }));

const clerkInstance = getClerkInstance as jest.Mock;

function signedIn() {
  const session = {
    id: 'session-a',
    status: 'active',
    startVerification: jest.fn().mockResolvedValue({
      supportedFirstFactors: [
        {
          strategy: 'email_code',
          emailAddressId: 'email-a',
          safeIdentifier: 'd***@example.test'
        }
      ]
    }),
    prepareFirstFactorVerification: jest
      .fn()
      .mockResolvedValue({ status: 'needs_first_factor' }),
    attemptFirstFactorVerification: jest
      .fn()
      .mockResolvedValue({ status: 'complete' }),
    getToken: jest.fn().mockResolvedValue('fresh-token')
  };
  const clerk = { user: { id: 'owner-a' }, session };
  clerkInstance.mockReturnValue(clerk);
  return clerk;
}

test('reverifies the current authenticated session and refreshes its recent-auth token', async () => {
  const clerk = signedIn();
  const verification = await startAccountDeletionVerification();
  expect(verification.safeIdentifier).toBe('d***@example.test');
  await verification.verify('123456');
  expect(clerk.session.attemptFirstFactorVerification).toHaveBeenCalledWith({
    strategy: 'email_code',
    code: '123456'
  });
  expect(clerk.session.getToken).toHaveBeenCalledWith({ skipCache: true });
});

test('rejects late verification after an account switch before refreshing another owner token', async () => {
  const clerk = signedIn();
  const verification = await startAccountDeletionVerification();
  clerk.user.id = 'owner-b';
  await expect(verification.verify('123456')).rejects.toMatchObject({
    code: 'session_expired'
  });
  expect(clerk.session.getToken).not.toHaveBeenCalled();
});

test('continues when Clerk refreshes the same active session resource after each verification step', async () => {
  const clerk = signedIn();
  const first = clerk.session;
  const started = {
    supportedFirstFactors: [
      {
        strategy: 'email_code',
        emailAddressId: 'email-a',
        safeIdentifier: 'd***@example.test'
      }
    ]
  };
  first.startVerification.mockImplementation(async () => {
    clerk.session = { ...clerk.session };
    return started;
  });
  first.prepareFirstFactorVerification.mockImplementation(async function (
    this: typeof first
  ) {
    expect(this).toBe(clerk.session);
    clerk.session = { ...clerk.session };
    return { status: 'needs_first_factor' };
  });
  first.attemptFirstFactorVerification.mockImplementation(async function (
    this: typeof first
  ) {
    expect(this).toBe(clerk.session);
    clerk.session = { ...clerk.session };
    return { status: 'complete' };
  });
  first.getToken.mockImplementation(async function (this: typeof first) {
    expect(this).toBe(clerk.session);
    clerk.session = { ...clerk.session };
    return 'fresh-token';
  });
  const verification = await startAccountDeletionVerification('owner-a');
  await verification.verify('123456');
  expect(clerk.session).not.toBe(first);
  expect(clerk.session.id).toBe(first.id);
  expect(clerk.session.getToken).toHaveBeenCalledWith({ skipCache: true });
});

test.each(['different-session', 'inactive-session'])(
  'rejects a refreshed %s before sending a verification code',
  async (replacement) => {
    const clerk = signedIn();
    const first = clerk.session;
    first.startVerification.mockImplementation(async () => {
      clerk.session = {
        ...clerk.session,
        id: replacement === 'different-session' ? 'session-b' : first.id,
        status: replacement === 'inactive-session' ? 'ended' : 'active'
      };
      return { supportedFirstFactors: [] };
    });
    await expect(
      startAccountDeletionVerification('owner-a')
    ).rejects.toMatchObject({
      code: 'session_expired'
    });
    expect(first.prepareFirstFactorVerification).not.toHaveBeenCalled();
    expect(first.getToken).not.toHaveBeenCalled();
  }
);

test('keeps incomplete or unavailable factors from authorizing deletion', async () => {
  const clerk = signedIn();
  clerk.session.attemptFirstFactorVerification.mockResolvedValue({
    status: 'needs_second_factor'
  });
  const verification = await startAccountDeletionVerification();
  await expect(verification.verify('123456')).rejects.toMatchObject({
    code: 'forbidden'
  });
  expect(clerk.session.getToken).not.toHaveBeenCalled();
  clerk.session.startVerification.mockResolvedValue({
    supportedFirstFactors: [{ strategy: 'passkey' }]
  });
  await expect(startAccountDeletionVerification()).rejects.toMatchObject({
    code: 'provider_unavailable',
    domainCode: 'DELETION_VERIFICATION_UNAVAILABLE'
  });
});
