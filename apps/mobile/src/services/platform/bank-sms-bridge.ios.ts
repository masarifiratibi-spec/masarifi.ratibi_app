import { requireOptionalNativeModule } from 'expo-modules-core';

export type BankSmsAccountLink = {
  accountEnding?: string;
  issuer?: string;
  cashAccountId?: string;
};
export type BankSmsConfiguration = {
  expenseId?: string;
  incomeId?: string;
  feeId?: string;
  salaryId?: string;
  links?: Record<string, BankSmsAccountLink>;
};
type BankSmsChoice = {
  id: string;
  name: string;
  kind: string;
  nameAr?: string;
  nameEn?: string;
};
export type BankSmsAccountChoice = BankSmsChoice &
  BankSmsAccountLink & {
    currency: string;
    institution?: string;
    type: string;
    automaticRouting: boolean;
    lastFour?: string;
  };
type BankSmsStatus = {
  accounts?: BankSmsAccountChoice[];
  categories?: BankSmsChoice[];
  preferences?: Omit<BankSmsConfiguration, 'links'>;
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
  updateNotificationLocale(
    owner: string,
    session: string,
    locale: 'ar' | 'en'
  ): Promise<void>;
};

export function bankSmsNative() {
  return requireOptionalNativeModule<BankSmsNative>('MasarifiBankSms');
}

export async function disableBankSmsForOwner(owner: string, erase = false) {
  await bankSmsNative()?.disable(owner, erase);
}
