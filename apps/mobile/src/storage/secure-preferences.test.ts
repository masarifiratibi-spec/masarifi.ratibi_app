import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

import {
  clearPersistedPreferences,
  loadPreferences,
  savePreferences
} from './secure-preferences';
import { buildPreferences } from '@/domain/foundation';
import { installBenchmarkEnvironment } from '@/test-utils/benchmark-runtime';

jest.mock('expo', () =>
  jest.requireActual('@/test-utils/benchmark-runtime').benchmarkExpoMock()
);

jest.mock('expo-secure-store', () => ({
  deleteItemAsync: jest.fn(),
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn()
}));
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  removeItem: jest.fn(),
  setItem: jest.fn()
}));

const getItemAsync = jest.mocked(SecureStore.getItemAsync);
const getAsyncStorageItem = jest.mocked(AsyncStorage.getItem);
const deleteSecureItem = jest.mocked(SecureStore.deleteItemAsync);
const removeAsyncStorageItem = jest.mocked(AsyncStorage.removeItem);
beforeEach(() => {
  jest.clearAllMocks();
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('loadPreferences', () => {
  it('restores reminder consent only with its persisted owner association', async () => {
    getItemAsync.mockResolvedValue(
      JSON.stringify({
        returnRemindersEnabled: true,
        returnRemindersOwnerId: 'owner-a'
      })
    );
    await expect(loadPreferences()).resolves.toMatchObject({
      returnRemindersEnabled: true,
      returnRemindersOwnerId: 'owner-a'
    });
  });
  it('clears native persisted preferences', async () => {
    await clearPersistedPreferences();

    expect(deleteSecureItem).toHaveBeenCalledWith('masarifi.preferences');
  });

  it('clears web persisted preferences from AsyncStorage', async () => {
    const originalPlatform = Platform.OS;
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'web' });

    try {
      await clearPersistedPreferences();
    } finally {
      Object.defineProperty(Platform, 'OS', {
        configurable: true,
        value: originalPlatform
      });
    }

    expect(removeAsyncStorageItem).toHaveBeenCalledWith('masarifi.preferences');
    expect(deleteSecureItem).not.toHaveBeenCalled();
  });

  it.each([
    ['empty object', '{}'],
    ['unsupported locale', '{"locale":"fr"}'],
    ['invalid field types', '{"hideBalances":"yes","baseCurrencyCode":"RIYAL"}']
  ])('falls back to complete defaults for %s', async (_case, stored) => {
    getItemAsync.mockResolvedValue(stored);

    await expect(loadPreferences()).resolves.toEqual(
      buildPreferences({
        locale: 'ar',
        direction: 'rtl',
        theme: 'system',
        hideBalances: false,
        baseCurrencyCode: 'SAR',
        timeZone: 'Asia/Riyadh',
        reducedMotion: false
      })
    );
  });

  it('loads a complete valid preference record', async () => {
    getItemAsync.mockResolvedValue(
      JSON.stringify({
        locale: 'en',
        theme: 'dark',
        hideBalances: true,
        baseCurrencyCode: 'USD',
        firstLaunchOnboardingCompleted: true,
        reducedMotion: true
      })
    );

    await expect(loadPreferences()).resolves.toMatchObject({
      locale: 'en',
      direction: 'ltr',
      theme: 'dark',
      hideBalances: true,
      baseCurrencyCode: 'USD',
      firstLaunchOnboardingCompleted: true,
      reducedMotion: true
    });
  });

  it('defaults first-launch onboarding to incomplete', async () => {
    getItemAsync.mockResolvedValue(null);

    await expect(loadPreferences()).resolves.toMatchObject({
      firstLaunchOnboardingCompleted: false
    });
  });

  it('defaults first-use balances to visible when no choice was stored', async () => {
    getItemAsync.mockResolvedValue(
      JSON.stringify({
        locale: 'en',
        theme: 'dark',
        baseCurrencyCode: 'USD',
        reducedMotion: true
      })
    );

    await expect(loadPreferences()).resolves.toMatchObject({
      locale: 'en',
      direction: 'ltr',
      theme: 'dark',
      hideBalances: false,
      baseCurrencyCode: 'USD',
      reducedMotion: true
    });
  });

  it.each([true, false])(
    'preserves an explicitly persisted hide-balances choice of %s',
    async (hideBalances) => {
      getItemAsync.mockResolvedValue(JSON.stringify({ hideBalances }));

      await expect(loadPreferences()).resolves.toMatchObject({ hideBalances });
    }
  );

  it('uses AsyncStorage on web where SecureStore is unavailable', async () => {
    const originalPlatform = Platform.OS;
    Object.defineProperty(Platform, 'OS', {
      configurable: true,
      value: 'web'
    });
    getAsyncStorageItem.mockResolvedValue(null);

    try {
      await loadPreferences();
    } finally {
      Object.defineProperty(Platform, 'OS', {
        configurable: true,
        value: originalPlatform
      });
    }

    expect(getAsyncStorageItem).toHaveBeenCalledWith('masarifi.preferences');
    expect(getItemAsync).not.toHaveBeenCalled();
  });
});

describe('benchmark preference storage diagnostics', () => {
  let log: jest.SpyInstance;
  let restore: () => void;
  const events = () =>
    log.mock.calls
      .filter(([prefix]) => prefix === 'BENCHMARK_METRIC')
      .map(([, value]) => JSON.parse(value));
  beforeEach(() => {
    log = jest.spyOn(console, 'info').mockImplementation(() => undefined);
    restore = installBenchmarkEnvironment();
  });
  afterEach(() => restore());

  it('reports native write success without exposing the serialized preferences', async () => {
    jest.mocked(SecureStore.setItemAsync).mockResolvedValue(undefined);
    await savePreferences(buildPreferences({ timeZone: 'PRIVATE_VALUE' }));
    expect(events()).toEqual([
      {
        kind: 'preferences',
        operation: 'write',
        outcome: 'success',
        errorClass: 'none',
        atMs: expect.any(Number)
      }
    ]);
    expect(jest.mocked(SecureStore.setItemAsync).mock.calls[0]).toEqual([
      'masarifi.preferences',
      expect.stringContaining('PRIVATE_VALUE')
    ]);
    expect(JSON.stringify(events())).not.toMatch(
      /PRIVATE_VALUE|masarifi.preferences/
    );
  });

  it.each(['read', 'write'] as const)(
    'reports %s failure and rethrows the identical rejection',
    async (operation) => {
      const error = Object.assign(new Error('PRIVATE_MESSAGE'), {
        code: 'ERR_ENCRYPT',
        name: 'PRIVATE_NAME',
        stack: 'PRIVATE_STACK'
      });
      if (operation === 'read') getItemAsync.mockRejectedValueOnce(error);
      else jest.mocked(SecureStore.setItemAsync).mockRejectedValueOnce(error);
      const result =
        operation === 'read'
          ? loadPreferences()
          : savePreferences(buildPreferences({}));
      await expect(result).rejects.toBe(error);
      expect(events()).toEqual([
        {
          kind: 'preferences',
          operation,
          outcome: 'failure',
          errorClass: 'encrypt',
          atMs: expect.any(Number)
        }
      ]);
      expect(JSON.stringify(events())).not.toMatch(
        /PRIVATE|ERR_ENCRYPT|masarifi.preferences/
      );
    }
  );

  it('reports a missing native function through its known code without changing rejection', async () => {
    const error = { code: 'ERR_METHOD_NOT_FOUND', message: 'PRIVATE' };
    jest.mocked(SecureStore.setItemAsync).mockRejectedValueOnce(error);
    await expect(savePreferences(buildPreferences({}))).rejects.toBe(error);
    expect(events()[0]).toMatchObject({
      errorClass: 'native_function_missing'
    });
  });

  it('keeps normal profiles silent while preserving storage failures', async () => {
    restore();
    const error = new TypeError('PRIVATE');
    jest.mocked(SecureStore.setItemAsync).mockRejectedValueOnce(error);
    await expect(savePreferences(buildPreferences({}))).rejects.toBe(error);
    expect(events()).toEqual([]);
  });

  it('does not let a failed diagnostic sink replace the storage rejection', async () => {
    log.mockImplementation(() => {
      throw Error('PRIVATE_SINK');
    });
    const error = { code: 'ERR_WRITE', message: 'PRIVATE_STORAGE' };
    getItemAsync.mockRejectedValueOnce(error);
    await expect(loadPreferences()).rejects.toBe(error);
  });
});
