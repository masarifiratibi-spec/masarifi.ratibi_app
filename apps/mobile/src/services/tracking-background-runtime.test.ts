import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { MasarifiSmsInbox } from '../../modules/masarifi-sms-inbox';
import { useAppShellStore } from '@/state/app-shell';
import {
  configureTrackingBackground,
  disableTrackingBackground
} from './tracking-background-runtime';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { invalidateTrackingConsent } from './tracking-source-preferences';

jest.mock('../../modules/masarifi-sms-inbox', () => ({
  MasarifiSmsInbox: {
    configureTrackingOwner: jest.fn(async () => undefined),
    clearTrackingOwner: jest.fn(async () => undefined)
  }
}));
jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(async () => null),
  setItemAsync: jest.fn(async () => undefined),
  deleteItemAsync: jest.fn(async () => undefined)
}));
jest.mock('expo-crypto', () => ({
  CryptoDigestAlgorithm: { SHA256: 'sha256' },
  digestStringAsync: jest.fn(
    async (_algorithm: string, value: string) => 'digest:' + value
  ),
  randomUUID: () => 'generation-test'
}));
jest.mock('expo-notifications', () => ({
  registerTaskAsync: jest.fn(async () => undefined)
}));
const rules = {
  keywords: [],
  senders: [{ normalizedSender: 'com.bank.app', trusted: true, enabled: true }]
};
beforeEach(async () => {
  Object.defineProperty(Platform, 'OS', {
    configurable: true,
    value: 'android'
  });
  await disableTrackingBackground();
  useAppShellStore.setState({
    session: {
      status: 'authenticated',
      userId: 'owner-a',
      method: 'google',
      issuedAt: 1,
      expiresAt: 2,
      restoration: 'restored'
    }
  });
  jest.clearAllMocks();
});
afterEach(() => jest.restoreAllMocks());
it('does not resurrect native capture when consent changes while storage is awaited', async () => {
  let loaded!: () => void;
  const awaiting = new Promise<void>((resolve) => {
    loaded = resolve;
  });
  let resume!: () => void;
  jest.spyOn(AsyncStorage, 'getItem').mockImplementationOnce(async () => {
    loaded();
    await new Promise<void>((resolve) => {
      resume = resolve;
    });
    return JSON.stringify({ smsEnabled: true, notificationEnabled: true });
  });
  const configuring = configureTrackingBackground(
    'owner-a',
    rules,
    'automatic_clear'
  );
  await awaiting;
  invalidateTrackingConsent();
  const disabling = disableTrackingBackground();
  resume();
  await Promise.all([configuring, disabling]);
  expect(MasarifiSmsInbox?.configureTrackingOwner).not.toHaveBeenCalled();
  expect(SecureStore.setItemAsync).not.toHaveBeenCalled();
  expect(MasarifiSmsInbox?.clearTrackingOwner).toHaveBeenCalled();
});
it('rejects a configuration belonging to the previous account', async () => {
  jest
    .spyOn(AsyncStorage, 'getItem')
    .mockResolvedValue(
      JSON.stringify({ smsEnabled: true, notificationEnabled: true })
    );
  await configureTrackingBackground('owner-b', rules, 'automatic_clear');
  expect(MasarifiSmsInbox?.configureTrackingOwner).not.toHaveBeenCalled();
});
it('configures both sources with trusted package scope for the active owner', async () => {
  jest
    .spyOn(AsyncStorage, 'getItem')
    .mockResolvedValue(
      JSON.stringify({ smsEnabled: false, notificationEnabled: true })
    );
  await configureTrackingBackground('owner-a', rules, 'automatic_clear');
  expect(MasarifiSmsInbox?.configureTrackingOwner).toHaveBeenCalledWith(
    expect.any(String),
    expect.any(String),
    false,
    true,
    ['com.bank.app']
  );
});
