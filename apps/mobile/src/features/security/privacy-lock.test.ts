import {
  createPinCredential,
  failUnlock,
  isValidPin,
  resetLock,
  verifyPin
} from './privacy-lock';

describe('privacy lock', () => {
  it('validates six English numerals and confirmation', () => {
    expect(isValidPin('123456')).toBe(true);
    expect(isValidPin('12345')).toBe(false);
    expect(createPinCredential('123456', '654321')).toMatchObject({
      error: 'mismatch'
    });
    expect(createPinCredential('123456', '123456')).toMatchObject({
      hash: 'pin:123456'
    });
  });

  it('counts five failures into a 30-second temporary lock and resets after success', () => {
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
    expect(verifyPin('123456', 'pin:123456')).toBe(true);
    expect(resetLock(50)).toMatchObject({
      invalidAttempts: 0,
      lockedUntil: null
    });
  });
});
