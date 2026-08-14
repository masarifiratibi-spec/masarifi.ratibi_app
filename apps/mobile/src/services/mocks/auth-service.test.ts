import { createMockAuthService } from './auth-service';

describe('createMockAuthService', () => {
  it('creates and restores a phone session after a valid mock code', async () => {
    const auth = createMockAuthService({ now: () => 1_000 });
    const attempt = await auth.startPhone({
      countryCode: '+20',
      phoneValue: '5550100'
    });

    expect(attempt).toMatchObject({ codeLength: 6, status: 'sent' });
    await expect(
      auth.verifyPhone({ sessionId: attempt.sessionId, code: '000000' })
    ).resolves.toMatchObject({ status: 'authenticated' });
    await expect(auth.restoreSession()).resolves.toMatchObject({
      status: 'authenticated',
      method: 'phone'
    });
  });

  it('covers Google success, cancellation, offline failure, conflict, and sign-out', async () => {
    await expect(createMockAuthService().signInWithGoogle()).resolves.toMatchObject({
      status: 'authenticated'
    });
    await expect(
      createMockAuthService({ googleMode: 'cancelled' }).signInWithGoogle()
    ).resolves.toEqual({ status: 'cancelled' });
    await expect(
      createMockAuthService({ googleMode: 'offline' }).signInWithGoogle()
    ).resolves.toEqual({ status: 'failed', errorCode: 'offline' });
    await expect(
      createMockAuthService({ googleMode: 'conflict' }).signInWithGoogle()
    ).resolves.toMatchObject({ status: 'conflict', existingMethod: 'phone' });

    const auth = createMockAuthService();
    await auth.signInWithGoogle();
    await auth.signOut('all');

    await expect(auth.restoreSession()).resolves.toMatchObject({
      status: 'signed_out'
    });
  });
});
