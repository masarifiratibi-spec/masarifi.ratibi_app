import {
  createBiometricLock,
  createPinCredential,
  createPinLock,
  failUnlock,
  isValidPin,
  verifyPin
} from './privacy-lock';

test('creates an enabled biometric lock without a PIN fallback', () => {
  expect(createBiometricLock()).toEqual({
    pinConfigured: false,
    biometricStatus: 'enabled',
    autoLockDuration: 'immediate',
    invalidAttempts: 0,
    lockedUntil: null,
    appLockStatus: 'unlocked'
  });
});

describe('App PIN credentials', () => {
  test.each(['123456', '000000', '987654'])(
    'accepts a six-digit PIN',
    (pin) => {
      expect(isValidPin(pin)).toBe(true);
    }
  );

  test.each(['12345', '1234567', '12a456', '１２３４５６', ''])(
    'rejects an invalid PIN: %s',
    (pin) => {
      expect(isValidPin(pin)).toBe(false);
    }
  );

  test('creates a salted PBKDF2 credential only after confirmation', async () => {
    const randomBytes = jest
      .fn<Promise<Uint8Array>, [number]>()
      .mockResolvedValue(Uint8Array.from({ length: 16 }, (_, index) => index));

    await expect(
      createPinCredential('12345', '12345', randomBytes)
    ).resolves.toEqual({
      error: 'invalid'
    });
    await expect(
      createPinCredential('123456', '654321', randomBytes)
    ).resolves.toEqual({
      error: 'mismatch'
    });

    const result = await createPinCredential('123456', '123456', randomBytes);

    expect(randomBytes).toHaveBeenCalledTimes(1);
    expect(result).toEqual({
      credential: expect.stringMatching(
        /^pbkdf2-sha256:120000:[a-f0-9]{32}:[a-f0-9]{64}$/
      )
    });
  });

  test('verifies against the credential salt and stored iteration count', async () => {
    const first = await createPinCredential('123456', '123456', async () =>
      Uint8Array.from({ length: 16 }, (_, index) => index)
    );
    const second = await createPinCredential('123456', '123456', async () =>
      Uint8Array.from({ length: 16 }, (_, index) => index + 1)
    );

    if (!('credential' in first) || !('credential' in second)) {
      throw new Error('expected credentials');
    }

    expect(first.credential).not.toBe(second.credential);
    await expect(verifyPin('123456', first.credential)).resolves.toBe(true);
    await expect(verifyPin('654321', first.credential)).resolves.toBe(false);
    await expect(
      verifyPin('123456', first.credential.replace(':120000:', ':120001:'))
    ).resolves.toBe(false);
  });

  test.each([
    'pin:123456',
    'malformed',
    `pbkdf2-sha256:9999:${'01'.repeat(16)}:${'ab'.repeat(32)}`,
    `pbkdf2-sha256:120000:${'01'.repeat(15)}:${'ab'.repeat(32)}`
  ])('rejects an unsafe credential: %s', async (credential) => {
    await expect(verifyPin('123456', credential)).resolves.toBe(false);
  });
});

describe('App PIN lockout', () => {
  it('starts locked with PIN fallback and biometrics disabled', () => {
    expect(createPinLock()).toEqual({
      pinConfigured: true,
      biometricStatus: 'disabled',
      autoLockDuration: 'immediate',
      invalidAttempts: 0,
      lockedUntil: null,
      appLockStatus: 'locked'
    });
  });

  it('locks for 30 seconds after five failures and caps attempts', () => {
    const now = 1_000;
    let lock = createPinLock(now);

    for (let attempt = 1; attempt <= 4; attempt += 1) {
      lock = failUnlock(lock, now);
      expect(lock).toMatchObject({
        invalidAttempts: attempt,
        lockedUntil: null,
        appLockStatus: 'locked'
      });
    }

    lock = failUnlock(lock, now);
    expect(lock).toMatchObject({
      invalidAttempts: 5,
      lockedUntil: 31_000,
      appLockStatus: 'temporarily_locked'
    });

    expect(failUnlock(lock, now + 1)).toMatchObject({
      invalidAttempts: 5,
      lockedUntil: 31_001,
      appLockStatus: 'temporarily_locked'
    });
  });
});
