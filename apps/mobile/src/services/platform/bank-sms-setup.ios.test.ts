import { changeLocale } from '@/localization/i18n';
import { enableBankSms } from './bank-sms-setup.ios';
import { synchronizeBankSmsNotificationLocale } from './bank-sms-notice-locale.ios';

let setup: Record<string, unknown>;
let notificationLocale: string | undefined;
const mockNative = {
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
      { id: 'account', name: 'QA Bank', status: 'active', currencyCode: 'KWD' }
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
  changeLocale('ar');
  notificationLocale = undefined;
  mockSession = { status: 'authenticated', userId: 'owner' };
});

it('publishes the app locale, both category labels and the currency scale for native save notices', async () => {
  await enableBankSms();
  expect(setup).toMatchObject({
    notificationLocale: 'ar',
    accounts: [
      { id: 'account', name: 'QA Bank', currency: 'KWD', minorUnitScale: 3 }
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
