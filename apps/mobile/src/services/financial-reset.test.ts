import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ExpoCrypto from 'expo-crypto';
import * as auth from '@/services/live/auth-service';
import * as http from '@/services/live/http-client';
import { useAppShellStore } from '@/state/app-shell';
import { resetAsyncStorageForTest } from '@/test-utils/async-storage';
import { readRecoveryNetwork } from './platform/read-recovery-network';
import {
  acknowledgeFinancialReset,
  loadFinancialResetOperation,
  readFinancialReset,
  submitFinancialReset
} from './financial-reset';

const id = '00000000-0000-4000-8000-000000000001';
const owner = 'user_a';
const open = () => true;
const setOwner = (userId: string) =>
  useAppShellStore.setState({
    session: { userId, status: 'authenticated' } as never
  });
const state = {
  generation: 0,
  status: 'ready',
  resetAt: null,
  requestId: null
};
const receipt = { id, status: 'completed', generation: 1 };
beforeEach(async () => {
  await resetAsyncStorageForTest();
  setOwner(owner);
  jest.spyOn(ExpoCrypto, 'randomUUID').mockReturnValue(id);
  jest.spyOn(auth, 'captureLiveClerkIdentity').mockResolvedValue({
    userId: owner,
    token: 'owner-token',
    assertCurrent: async () => {}
  });
  jest
    .spyOn(http, 'requestRecentAuthentication')
    .mockResolvedValue('verified-token');
});
afterEach(() => jest.restoreAllMocks());

it('persists the operation before dispatch, restores it after a lost response, and retries the same identity', async () => {
  const post = jest
    .fn(async () => {
      expect(await loadFinancialResetOperation(owner)).toEqual({
        id,
        generation: 0
      });
      return receipt;
    })
    .mockRejectedValueOnce(new Error('disconnect'));
  jest
    .spyOn(http, 'requestJson')
    .mockImplementation(async (path, schema, options) => {
      if (path.endsWith('/state')) return schema.parse(state);
      if (options?.method === 'POST') {
        expect(options).toMatchObject({
          token: 'verified-token',
          body: { operationId: id },
          recentAuth: 'manual'
        });
        return schema.parse(await post());
      }
      throw new http.HttpError('not_found', 404);
    });
  await expect(submitFinancialReset(owner, 0, open)).rejects.toThrow(
    'disconnect'
  );
  await expect(loadFinancialResetOperation(owner)).resolves.toEqual({
    id,
    generation: 0
  });
  await expect(readFinancialReset(owner, id)).resolves.toBeNull();
  setOwner('user_b');
  await expect(loadFinancialResetOperation('user_b')).resolves.toBeNull();
  setOwner(owner);
  await expect(submitFinancialReset(owner, 0, open)).resolves.toEqual(receipt);
  expect(post).toHaveBeenCalledTimes(2);
  expect(ExpoCrypto.randomUUID).toHaveBeenCalledTimes(1);
  await acknowledgeFinancialReset(owner, id);
  await expect(loadFinancialResetOperation(owner)).resolves.toBeNull();
});

it.each(['cancel', 'switch', 'unmount'])(
  'does not submit after %s during verification',
  async (reason) => {
    const request = jest.spyOn(http, 'requestJson').mockResolvedValue(state);
    jest
      .spyOn(http, 'requestRecentAuthentication')
      .mockImplementation(async () => {
        if (reason === 'switch') setOwner('user_b');
        return reason === 'cancel' ? null : 'verified-token';
      });
    const submission = submitFinancialReset(
      owner,
      0,
      () => reason !== 'unmount'
    );
    if (reason === 'switch')
      await expect(submission).rejects.toMatchObject({
        code: 'session_expired'
      });
    else await expect(submission).resolves.toBeNull();
    expect(
      request.mock.calls.every(([, , options]) => options?.method !== 'POST')
    ).toBe(true);
    setOwner(owner);
    await expect(loadFinancialResetOperation(owner)).resolves.toBeNull();
  }
);

it('rejects offline submission before prompting or preparing an operation', async () => {
  const previous = readRecoveryNetwork.available;
  readRecoveryNetwork.available = true;
  jest.spyOn(readRecoveryNetwork, 'isOnline').mockResolvedValue(false);
  try {
    await expect(submitFinancialReset(owner, 0, open)).rejects.toMatchObject({
      failureSource: 'network'
    });
    expect(http.requestRecentAuthentication).not.toHaveBeenCalled();
    await expect(loadFinancialResetOperation(owner)).resolves.toBeNull();
  } finally {
    readRecoveryNetwork.available = previous;
  }
});

it('sends the generation that the user reviewed for consecutive resets', async () => {
  let generation = 0;
  const ids = [id, '00000000-0000-4000-8000-000000000002'] as const;
  jest
    .spyOn(ExpoCrypto, 'randomUUID')
    .mockImplementation(() => ids[generation]);
  jest
    .spyOn(http, 'requestJson')
    .mockImplementation(async (path, schema, options) => {
      if (path.endsWith('/state'))
        return schema.parse({ ...state, generation });
      expect(options?.headers).toMatchObject({
        'X-Financial-Generation': String(generation)
      });
      return schema.parse({
        id: ids[generation++],
        generation,
        status: 'completed'
      });
    });
  for (const [reviewed, operationId] of ids.entries()) {
    const receipt = await submitFinancialReset(owner, reviewed, open);
    expect(receipt).toMatchObject({
      id: operationId,
      generation: reviewed + 1
    });
    await acknowledgeFinancialReset(owner, operationId);
  }
});

it.each([id, JSON.stringify({ id, generation: 0 })])(
  'reads the original receipt and refuses to apply an unbound or stale intent',
  async (saved) => {
    await AsyncStorage.setItem(
      'masarifi.financialReset.operation.' + owner,
      saved
    );
    const request = jest
      .spyOn(http, 'requestJson')
      .mockImplementation(async (path, schema) => {
        if (path.endsWith('/state'))
          return schema.parse({ ...state, generation: 1 });
        throw new http.HttpError('not_found', 404);
      });
    await expect(submitFinancialReset(owner, 1, open)).rejects.toMatchObject({
      domainCode: 'FINANCIAL_GENERATION_CHANGED'
    });
    expect(request.mock.calls.map(([path]) => path)).toEqual([
      '/api/v1/me/financial-reset/state',
      '/api/v1/me/financial-reset/' + id
    ]);
    expect(http.requestRecentAuthentication).not.toHaveBeenCalled();
  }
);
