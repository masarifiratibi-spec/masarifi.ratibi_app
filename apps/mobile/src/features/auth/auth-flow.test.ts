import { createAuthService } from './auth-flow';

describe('production auth service selection', () => {
  it('fails closed when explicit demo mode is disabled', async () => {
    const service = createAuthService(false);

    expect(service.metadata.availability).toBe('unavailable');
    await expect(service.signInWithGoogle()).resolves.toEqual({
      status: 'failed',
      errorCode: 'appShell.auth.unavailable'
    });
    await expect(
      service.startPhone({ countryCode: '+966', phoneValue: '500000000' })
    ).rejects.toThrow('appShell.auth.unavailable');
  });

  it('keeps synthetic authentication behind explicit demo mode', async () => {
    const service = createAuthService(true);

    expect(service.metadata.availability).toBe('available');
    await expect(service.signInWithGoogle()).resolves.toMatchObject({
      status: 'authenticated'
    });
  });
});
