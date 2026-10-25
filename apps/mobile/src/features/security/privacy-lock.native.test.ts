import { createPinCredential, verifyPin } from './privacy-lock';
import { MasarifiPinCrypto } from '../../../modules/masarifi-pin-crypto';

jest.mock('expo-router', () => ({ usePathname: () => '/' }));

jest.mock('expo-crypto', () => ({
  getRandomBytesAsync: async (length: number) =>
    new Uint8Array(jest.requireActual('node:crypto').randomBytes(length))
}));

jest.mock('expo-modules-core', () => ({
  ...jest.requireActual('expo-modules-core'),
  requireOptionalNativeModule: (name: string) =>
    name === 'MasarifiPinCrypto'
      ? {
          derivePinHash: async (
            pin: string,
            salt: string,
            iterations: number
          ) => {
            const { pbkdf2Sync } =
              jest.requireActual<typeof import('node:crypto')>('node:crypto');
            return pbkdf2Sync(
              pin,
              Buffer.from(salt, 'hex'),
              iterations,
              32,
              'sha256'
            ).toString('hex');
          }
        }
      : jest
          .requireActual('expo-modules-core')
          .requireOptionalNativeModule(name)
}));

// On supported Android devices, PIN verification must not run the slow JS KDF.
jest.mock('@noble/hashes/pbkdf2', () => ({
  pbkdf2Async: jest.fn(() => {
    throw new Error('PIN derivation unexpectedly blocked the JS runtime');
  })
}));

const saltHex = '000102030405060708090a0b0c0d0e0f';
const hashHex =
  '8e8969ceadd8a2436d1f93af29a693c244eb6c659390930fc4832f86caab330e';
const credential = `pbkdf2-sha256:120000:${saltHex}:${hashHex}`;

test('native derivation creates the same credential without reducing its cost', async () => {
  await expect(
    createPinCredential('123456', '123456', async () =>
      Uint8Array.from({ length: 16 }, (_, index) => index)
    )
  ).resolves.toEqual({ credential });
});

test('native verification preserves existing credentials, wrong-PIN rejection and stored cost', async () => {
  await expect(verifyPin('123456', credential)).resolves.toBe(true);
  await expect(verifyPin('654321', credential)).resolves.toBe(false);
  await expect(
    verifyPin('123456', credential.replace(':120000:', ':120001:'))
  ).resolves.toBe(false);
});

test('an unsupported Android version retains the existing SHA256 algorithm', async () => {
  const nativeDerivation = jest
    .spyOn(MasarifiPinCrypto!, 'derivePinHash')
    .mockResolvedValueOnce(null);
  jest
    .requireMock('@noble/hashes/pbkdf2')
    .pbkdf2Async.mockImplementationOnce(
      jest.requireActual('@noble/hashes/pbkdf2').pbkdf2Async
    );
  await expect(
    verifyPin(
      '123456',
      `pbkdf2-sha256:10000:${saltHex}:a9660861d611d46a191971eccf0cc895ee7cd58091c1973ee6d60a5c4f304219`
    )
  ).resolves.toBe(true);
  nativeDerivation.mockRestore();
});

test('a native derivation failure propagates without retrying expensive JS work', async () => {
  const nativeDerivation = jest
    .spyOn(MasarifiPinCrypto!, 'derivePinHash')
    .mockRejectedValueOnce(new Error('Native derivation unavailable'));
  await expect(verifyPin('123456', credential)).rejects.toThrow(
    'Native derivation unavailable'
  );
  nativeDerivation.mockRestore();
});
