import { requireOptionalNativeModule } from 'expo-modules-core';

interface MasarifiPinCryptoModule {
  derivePinHash(
    pin: string,
    saltHex: string,
    iterations: number
  ): Promise<string | null>;
}

export const MasarifiPinCrypto =
  requireOptionalNativeModule<MasarifiPinCryptoModule>('MasarifiPinCrypto');
