import { AppRegistry } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { MasarifiSmsInbox } from '../../modules/masarifi-sms-inbox';
import { registerLiveClerkBridge } from './live/auth-service';
import { registerTrackingHeadlessTask } from './tracking-background-runtime';
import { resetRuntimeIdentityData } from '@/storage/runtime-user-data-reset';

const mockSync = jest.fn(async () => ({ status: 'idle' }));
let mockInitializations = 0;
jest.mock('./automatic-tracking-coordinator', () => {
  mockInitializations++;
  return { syncAutomaticTracking: mockSync };
});
jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn()
}));
jest.mock('expo-crypto', () => ({
  CryptoDigestAlgorithm: { SHA256: 'sha256' },
  digestStringAsync: async (_algorithm: string, value: string) =>
    `digest:${value}`
}));
jest.mock('expo-notifications', () => ({ registerTaskAsync: jest.fn() }));
jest.mock('../../modules/masarifi-sms-inbox', () => ({
  MasarifiSmsInbox: {
    finishTrackingWork: jest.fn(),
    restoreTrackingOwner: async () => 'PRESERVED',
    clearTrackingOwner: jest.fn(),
    suspendTrackingOwner: jest.fn()
  }
}));
jest.mock('@/config/client-runtime', () => ({
  ...jest.requireActual('@/config/client-runtime'),
  resolveClientMode: () => 'live',
  resolveClientRuntime: () => ({
    mode: 'live',
    apiUrl: 'https://api.staging.masarifiratibi.com',
    clerkPublishableKey: 'pk_test_isolated_fixture_only',
    billingAvailable: false
  })
}));

const owner = 'user_headless_fixture';
const context = JSON.stringify({
  ownerId: owner,
  generation: 'retained-generation'
});
const input = {
  ownerDigest: `digest:${owner}`,
  generation: 'retained-generation',
  workId: 'isolated-native-work'
};
const getToken = jest.fn(async () => 'isolated-token');
let taskFactory!: () => (value: typeof input) => Promise<void>;
const interactive = async (): Promise<never> => {
  throw new Error('interactive auth disabled');
};
beforeEach(async () => {
  jest.clearAllMocks();
  jest.mocked(SecureStore.getItemAsync).mockResolvedValue(context);
  await resetRuntimeIdentityData({ restoringOwnerId: owner });
  mockSync.mockResolvedValue({ status: 'idle' });
  getToken.mockResolvedValue('isolated-token');
  registerLiveClerkBridge({
    getSession: async () => ({
      id: 'headless-session',
      userId: owner,
      method: 'google',
      issuedAt: 1,
      expiresAt: 9999999999999
    }),
    getToken,
    startPhone: interactive,
    verifyPhone: interactive,
    resendPhone: interactive,
    signInWithGoogle: interactive,
    reverifyConflict: interactive,
    signOut: interactive
  });
  jest
    .spyOn(AppRegistry, 'registerHeadlessTask')
    .mockImplementation((_name, factory) => {
      taskFactory = factory as typeof taskFactory;
    });
});
afterEach(() => {
  jest.restoreAllMocks();
});

it('registers without loading the financial coordinator and completes authorized headless work through the shared instance', async () => {
  const before = mockInitializations;
  registerTrackingHeadlessTask();
  expect(mockInitializations).toBe(before);
  await taskFactory()(input);
  expect(MasarifiSmsInbox?.finishTrackingWork).toHaveBeenCalledWith(
    input.workId,
    true
  );
  expect(mockSync).toHaveBeenCalledTimes(1);
});

it.each([
  { generation: 'stale-generation' },
  { ownerDigest: 'digest:another-owner' }
])(
  'ignores stale native work %j without starting financial synchronization',
  async (patch) => {
    registerTrackingHeadlessTask();
    await taskFactory()({ ...input, ...patch });
    expect(mockSync).not.toHaveBeenCalled();
    expect(getToken).not.toHaveBeenCalled();
    expect(MasarifiSmsInbox?.finishTrackingWork).toHaveBeenCalledWith(
      input.workId,
      true
    );
  }
);

it.each(['queued', 'processing', 'error'])(
  'reports %s to the native retry mechanism without replaying inline',
  async (status) => {
    mockSync.mockResolvedValue({ status });
    registerTrackingHeadlessTask();
    await taskFactory()(input);
    expect(mockSync).toHaveBeenCalledTimes(1);
    expect(MasarifiSmsInbox?.finishTrackingWork).toHaveBeenCalledWith(
      input.workId,
      false
    );
  }
);

it('rechecks retained consent after authentication before entering the coordinator', async () => {
  getToken.mockImplementationOnce(async () => {
    jest
      .mocked(SecureStore.getItemAsync)
      .mockResolvedValue(
        JSON.stringify({ ownerId: owner, generation: 'replaced-generation' })
      );
    return 'isolated-token';
  });
  registerTrackingHeadlessTask();
  await taskFactory()(input);
  expect(mockSync).not.toHaveBeenCalled();
  expect(MasarifiSmsInbox?.finishTrackingWork).toHaveBeenCalledWith(
    input.workId,
    true
  );
});
