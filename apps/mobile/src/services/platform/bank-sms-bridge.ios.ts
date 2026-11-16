import { requireOptionalNativeModule } from 'expo-modules-core';

type BankSmsStatus = {
  enabled: boolean;
  pending: number;
  lastSaved?: number;
  lastTransactionId?: string;
  outcome?:
    | 'enabled'
    | 'queued'
    | 'saved'
    | 'skipped'
    | 'duplicate'
    | 'session'
    | 'capacity'
    | 'expired';
};

type BankSmsNative = {
  revision(): Promise<number>;
  enable(setup: string): Promise<void>;
  status(owner: string, session: string): Promise<BankSmsStatus>;
  disable(owner: string, erase: boolean): Promise<void>;
};

export function bankSmsNative() {
  return requireOptionalNativeModule<BankSmsNative>('MasarifiBankSms');
}

export async function disableBankSmsForOwner(owner: string, erase = false) {
  await bankSmsNative()?.disable(owner, erase);
}
