import { TrackingSourcePreferences } from './tracking-source-preferences';
import { registerLiveClerkBridge } from './live/auth-service';
import { admitTrackingOwner } from '@/state/tracking-admission';
import { clearTrackingIsolation } from '@/test-utils/tracking-admission';
import { disableTrackingBackground } from './tracking-background-runtime';

jest.mock('./tracking-background-runtime', () => ({
  disableTrackingBackground: jest.fn(async () => undefined)
}));
const ownerId = 'synthetic-source-consent-owner';
const digest = 'a'.repeat(64);
const key = `masarifi.tracking.sources.v3.${digest}`;
const commandId = 'aaaaaaaa-1111-4111-8111-111111111111';
function fixture() {
  const values = new Map<string, string>();
  values.set('masarifi.tracking.sources.v1', 'retained-legacy-bytes');
  const storage = {
    getItem: async (name: string) => values.get(name) ?? null,
    setItem: async (name: string, value: string) => {
      values.set(name, value);
    },
    removeItem: async (name: string) => {
      values.delete(name);
    }
  };
  const consent = {
    apply: jest.fn(
      async (sources: {
        smsEnabled: boolean;
        notificationEnabled: boolean;
      }) => ({
        commandId,
        sources: {
          ...sources,
          ...(sources.smsEnabled
            ? { smsActivatedAt: 2000, smsActivationId: '42' }
            : {})
        }
      })
    ),
    retry: jest.fn(
      async () =>
        null as {
          commandId: string;
          sources: { smsEnabled: boolean; notificationEnabled: boolean };
        } | null
    ),
    acknowledge: jest.fn(async (_id: string) => undefined)
  };
  const preferences = new TrackingSourcePreferences(
    storage,
    async () => ({ activatedAt: 1000, afterId: '42' }),
    consent
  );
  return { values, consent, preferences };
}
beforeEach(() => {
  registerLiveClerkBridge({
    getSession: async () => ({
      userId: ownerId,
      id: 'synthetic-source-session'
    })
  } as never);
  admitTrackingOwner(
    ownerId,
    { ownerDigest: digest, generation: 'aaaaaaaa-1111-4111-8111-111111111111' },
    'synthetic-source-session'
  );
});
afterEach(() => clearTrackingIsolation());

it('keeps enable off when the server approval fails after local quiescence', async () => {
  const f = fixture();
  f.consent.apply.mockRejectedValueOnce(new Error('offline'));
  await expect(f.preferences.set('sms', true)).rejects.toThrow('offline');
  expect(disableTrackingBackground).toHaveBeenCalledWith(true);
  expect(await f.preferences.load()).toEqual({
    smsEnabled: false,
    notificationEnabled: false
  });
  expect(f.values.get('masarifi.tracking.sources.v1')).toBe(
    'retained-legacy-bytes'
  );
});
it('saves the accepted source boundary before acknowledging local application', async () => {
  const f = fixture();
  f.consent.acknowledge.mockImplementation(async () => {
    expect(JSON.parse(f.values.get(key) ?? 'null')).toMatchObject({
      sources: { smsEnabled: true, smsActivatedAt: 2000 }
    });
  });
  expect(await f.preferences.set('sms', true)).toMatchObject({
    smsEnabled: true,
    smsActivatedAt: 2000,
    smsActivationId: '42'
  });
  expect(f.consent.acknowledge).toHaveBeenCalledWith(commandId);
});
it('persists disable before network I/O and retains it when server revocation is offline', async () => {
  const f = fixture();
  await f.preferences.set('sms', true);
  f.consent.apply.mockImplementationOnce(async () => {
    expect(JSON.parse(f.values.get(key) ?? 'null')).toMatchObject({
      sources: { smsEnabled: false }
    });
    throw new Error('offline_revocation');
  });
  await expect(f.preferences.set('sms', false)).rejects.toThrow(
    'offline_revocation'
  );
  expect((await f.preferences.load()).smsEnabled).toBe(false);
});
it('applies a recovered explicit pending command without observing or issuing a new approval', async () => {
  const f = fixture();
  f.consent.retry.mockResolvedValueOnce({
    commandId,
    sources: { smsEnabled: false, notificationEnabled: false }
  });
  await f.preferences.retryPendingConsent();
  expect(await f.preferences.load()).toEqual({
    smsEnabled: false,
    notificationEnabled: false
  });
  expect(f.consent.apply).not.toHaveBeenCalled();
  expect(f.consent.acknowledge).toHaveBeenCalledWith(commandId);
});
