import { changeLocale } from '@/localization/i18n';
import { completeBankSmsSetup, disableBankSms, enableBankSms, readBankSmsSetup, refreshEnabledBankSms } from './bank-sms-setup.ios';
import { synchronizeBankSmsNotificationLocale } from './bank-sms-notice-locale.ios';

let setup: Record<string, unknown>;
let notificationLocale: string | undefined;
let mockCompleted = false;
const mockNative = {
  status: jest.fn(async () => ({ enabled: true, pending: 0 })),
  revision: async () => 0,
  enable: async (json: string) => {
    setup = JSON.parse(json);
  },
  updateNotificationLocale: async (
    _owner: string,
    _session: string,
    locale: string
  ) => {
    notificationLocale = locale;
  }
};
let mockSession = { status: 'authenticated', userId: 'owner' };

jest.mock('@/storage/voice-category-preference-repository', () => ({
  VoiceCategoryPreferenceRepository: class {
    async listActiveForOwner() {
      return [{ merchantKey: 'qa shop', categoryId: 'category' }];
    }
  }
}));

jest.mock('@/storage/app-shell-storage', () => ({
  createAppShellStorage: () => ({
    loadTrackingHomeCardDismissed: async () => mockCompleted,
    saveTrackingHomeCardDismissed: async (completed: boolean) => { mockCompleted = completed; }
  })
}));

jest.mock('./bank-sms-bridge.ios', () => ({
  bankSmsNative: () => mockNative,
  disableBankSmsForOwner: async () => undefined
}));
jest.mock('@/config/client-runtime', () => ({
  isBenchmarkReadOnly: () => false,
  resolveClientRuntime: () => ({
    mode: 'live',
    apiUrl: 'https://api.masarifiratibi.com',
    clerkPublishableKey: 'pk_live_qa'
  })
}));
jest.mock('@/state/app-shell', () => ({
  useAppShellStore: { getState: () => ({ session: mockSession }) }
}));
jest.mock('@/state/tracking-admission', () => ({
  captureTrackingAdmission: () => () => undefined
}));
jest.mock('../financial-generation', () => ({
  reconcileFinancialReset: async () => ({ generation: 0 })
}));
jest.mock('../live/auth-service', () => ({
  readLogoutSessionAnchor: async () => 'session',
  captureLiveClerkIdentity: async () => ({
    userId: 'owner',
    sessionId: 'session'
  })
}));
jest.mock('../live/account-service', () => ({
  createLiveAccountService: () => ({
    listAccounts: async () => [
      { id: 'account', name: 'QA Bank', status: 'active', currencyCode: 'KWD', type: 'bank', automaticTrackingEnabled: true, institution: 'QA', lastFour: '0123' }
    ]
  })
}));
jest.mock('../live/category-lifecycle-service', () => ({
  createLiveCategoryLifecycleService: () => ({
    listCategories: async () => [
      {
        id: 'category',
        status: 'active',
        financialType: 'expense',
        labelAr: 'التسوق',
        labelEn: 'Shopping'
      }
    ],
    serverCategoryId: () => 'server-category'
  })
}));

beforeEach(() => {
  mockCompleted = false;
  mockNative.status.mockReset().mockResolvedValue({ enabled: true, pending: 0 });
  changeLocale('ar');
  notificationLocale = undefined;
  mockSession = { status: 'authenticated', userId: 'owner' };
});

it('persists completion only after finishing the enabled guide and clears it on disabling', async () => {
  await enableBankSms();
  expect((await readBankSmsSetup()).setupCompleted).toBe(false);
  await completeBankSmsSetup();
  expect((await readBankSmsSetup()).setupCompleted).toBe(true);
  await disableBankSms();
  expect((await readBankSmsSetup()).setupCompleted).toBe(false);
});

it('requires capture consent before recording guide completion', async () => {
  mockNative.status.mockResolvedValue({ enabled: false, pending: 0 });
  await expect(completeBankSmsSetup()).rejects.toThrow('bank_sms_unavailable');
  expect(mockCompleted).toBe(false);
});

it('publishes the app locale, both category labels and the currency scale for native save notices', async () => {
  await enableBankSms();
  expect(setup).toMatchObject({
    notificationLocale: 'ar',
    preferences: { expenseId: 'server-category', merchants: { 'qa shop': 'server-category' } },
    accounts: [
      { id: 'account', name: 'QA Bank', currency: 'KWD', minorUnitScale: 3, automaticRouting: true, lastFour: '0123', institution: 'QA' }
    ],
    categories: [
      {
        id: 'server-category',
        name: 'التسوق',
        nameAr: 'التسوق',
        nameEn: 'Shopping'
      }
    ]
  });
});

it('updates notice language without enabling capture again', async () => {
  changeLocale('en');
  await synchronizeBankSmsNotificationLocale('en');
  expect(notificationLocale).toBe('en');
});

it('does not let a stale locale refresh overwrite the current app language', async () => {
  changeLocale('en');
  await synchronizeBankSmsNotificationLocale('ar');
  expect(notificationLocale).toBeUndefined();
});

it('drops presentation work when the owner changes during the session-anchor read', async () => {
  const updating = synchronizeBankSmsNotificationLocale('ar');
  mockSession = { status: 'authenticated', userId: 'other-owner' };
  await updating;
  expect(notificationLocale).toBeUndefined();
});

it('saves explicit account bindings and preserves completed setup during refresh', async () => {
  mockCompleted = true;
  mockNative.status.mockResolvedValue({
    enabled: true,
    pending: 0,
    accounts: [{ id: 'account', accountEnding: '0789', issuer: 'QA' }]
  } as Awaited<ReturnType<typeof mockNative.status>>);
  await enableBankSms({
    expenseId: 'server-category',
    links: { account: { accountEnding: ' ١٢٣٤ ', issuer: ' QABANK ' } }
  });
  expect(setup).toMatchObject({
    accounts: [{ id: 'account', accountEnding: '1234', issuer: 'QABANK' }],
    preferences: { expenseId: 'server-category' }
  });
  await refreshEnabledBankSms();
  expect(setup).toMatchObject({
    refreshOnly: true,
    accounts: [{ id: 'account', accountEnding: '0789', issuer: 'QA' }]
  });
  expect((await readBankSmsSetup()).setupCompleted).toBe(true);
});

it('serializes explicit account settings behind an in-flight background refresh', async () => {
  let finishRefresh!: () => void;
  const refreshReply = new Promise<void>(resolve => { finishRefresh = resolve; });
  let started!: () => void;
  const refreshStarted = new Promise<void>(resolve => { started = resolve; });
  const nativeEnable = jest.spyOn(mockNative, 'enable')
    .mockImplementationOnce(async () => { started(); await refreshReply; });
  try {
    const refresh = refreshEnabledBankSms();
    await refreshStarted;
    const save = enableBankSms({ links: { account: { accountEnding: '1234' } } });
    expect(nativeEnable).toHaveBeenCalledTimes(1);
    finishRefresh();
    await Promise.all([refresh, save]);
    expect(nativeEnable).toHaveBeenCalledTimes(2);
    expect(setup).toMatchObject({
      refreshOnly: false,
      accounts: [{ id: 'account', accountEnding: '1234' }]
    });
  } finally {
    finishRefresh();
    nativeEnable.mockRestore();
  }
});

it('drops queued setup writes when the user turns capture off', async () => {
  let finishRefresh!: () => void;
  const refreshReply = new Promise<void>(resolve => { finishRefresh = resolve; });
  let started!: () => void;
  const refreshStarted = new Promise<void>(resolve => { started = resolve; });
  const nativeEnable = jest.spyOn(mockNative, 'enable')
    .mockImplementationOnce(async () => { started(); await refreshReply; });
  try {
    const refresh = refreshEnabledBankSms();
    await refreshStarted;
    const save = expect(enableBankSms()).rejects.toThrow('bank_sms_disabled');
    await disableBankSms();
    finishRefresh();
    await Promise.all([refresh, save]);
    expect(nativeEnable).toHaveBeenCalledTimes(1);
  } finally {
    finishRefresh();
    nativeEnable.mockRestore();
  }
});
