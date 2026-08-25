import {
  createPinCredential,
  failUnlock,
  isValidPin,
  resetLock,
  verifyPin
} from './privacy-lock';

describe('privacy lock', () => {
  const fixedRandom = async (length: number) =>
    Uint8Array.from({ length }, (_, index) => index + 1);

  it('validates six English numerals and stores a salted one-way verifier', async () => {
    expect(isValidPin('123456')).toBe(true);
    expect(isValidPin('12345')).toBe(false);
    await expect(createPinCredential('123456', '654321')).resolves.toMatchObject({
      error: 'mismatch'
    });
    const credential = await createPinCredential(
      '123456',
      '123456',
      fixedRandom
    );
    expect(credential).toHaveProperty('hash');
    if (!credential.hash) throw new Error('credential missing');
    expect(credential.hash).toMatch(/^pbkdf2-sha256:/);
    expect(credential.hash).not.toContain('123456');
    await expect(verifyPin('123456', credential.hash)).resolves.toBe(true);
    await expect(verifyPin('654321', credential.hash)).resolves.toBe(false);
  });

  it('counts five failures into a 30-second temporary lock and supports one legacy verification for migration', async () => {
    let lock = resetLock(1);
    for (let index = 0; index < 4; index += 1) {
      lock = failUnlock(lock, 10);
      expect(lock.appLockStatus).toBe('locked');
    }
    lock = failUnlock(lock, 10);
    expect(lock).toMatchObject({
      appLockStatus: 'temporarily_locked',
      lockedUntil: 30_010
    });
    await expect(verifyPin('123456', 'pin:123456')).resolves.toBe(true);
    expect(resetLock(50)).toMatchObject({
      invalidAttempts: 0,
      lockedUntil: null
    });
  });
});
