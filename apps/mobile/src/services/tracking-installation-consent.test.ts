import { defaultSnapshot } from '@masarifi/transaction-parser';
import {
  TrackingInstallationConsentJournal,
  createLiveTrackingConsentPorts,
  type TrackingConsentPorts
} from './tracking-installation-consent';
import { registerLiveClerkBridge } from './live/auth-service';
import { admitTrackingOwner } from '@/state/tracking-admission';
import { clearTrackingIsolation } from '@/test-utils/tracking-admission';
import { canonicalJson } from '@masarifi/transaction-parser';

jest.mock('./platform/phone-notification-service', () => ({
  getDeviceRegistration: async () => ({
    deviceFingerprint: 'synthetic-consent-device',
    platform: 'android',
    appVersion: '1.0.0'
  })
}));
jest.mock('./tracking-device', () => ({
  getTrackingDeviceId: async () => 'aaaaaaaa-1111-4111-8111-111111111111'
}));

jest.mock('expo-crypto', () => ({
  CryptoDigestAlgorithm: { SHA256: 'SHA-256' },
  digestStringAsync: async (_algorithm: string, value: string) =>
    jest
      .requireActual<typeof import('node:crypto')>('node:crypto')
      .createHash('sha256')
      .update(value)
      .digest('hex'),
  randomUUID: () => jest.requireActual('node:crypto').randomUUID()
}));
const ownerId = 'synthetic-consent-owner';
const ownerDigest = 'a'.repeat(64);
const binding = 'b'.repeat(64);
const deviceId = 'aaaaaaaa-1111-4111-8111-111111111111';
const generation = 'bbbbbbbb-2222-4222-8222-222222222222';
const key = `masarifi.tracking.installation-consent.v1.${ownerDigest}`;
const sms = {
  smsEnabled: true,
  notificationEnabled: false,
  smsActivatedAt: 1000,
  smsActivationId: '42'
};
const off = { smsEnabled: false, notificationEnabled: false };
const sources = {
  smsEnabled: true,
  notificationEnabled: false,
  smsActivatedAt: '2026-11-04T18:00:00.000Z',
  smsActivationId: '42',
  notificationActivatedAt: null
};
const receipt = (enabled = true) => ({
  deviceId,
  version: 1,
  generation,
  sessionBinding: binding,
  captureAllowed: enabled,
  sources: enabled
    ? { ...sources }
    : {
        smsEnabled: false,
        notificationEnabled: false,
        smsActivatedAt: null,
        smsActivationId: null,
        notificationActivatedAt: null
      }
});
function response(installation = receipt(), available = true) {
  return {
    installation,
    configurationAvailable: available,
    ...(available
      ? {
          snapshot: defaultSnapshot,
          contentHash: 'c'.repeat(64),
          channelVersion: 1,
          rolloutMode: 'automatic',
          keywords: [],
          senders: [],
          bindings: [],
          accountingPolicy: 'default_account_nominal_v1'
        }
      : {})
  };
}
function fixture() {
  const values = new Map<string, string>();
  let sessionBinding = binding;
  let current = true;
  let writesFail = false;
  let serverResult = response();
  const requests: { method: string; body?: unknown }[] = [];
  const ports: TrackingConsentPorts = {
    storage: {
      getItem: async (name) => values.get(name) ?? null,
      setItem: async (name, value) => {
        if (writesFail) throw new Error('synthetic_storage_failure');
        values.set(name, value);
      }
    },
    scope: async () => ({
      ownerId,
      ownerDigest,
      deviceId,
      sessionBinding,
      assertCurrent: async () => {
        if (!current) throw new Error('tracking_owner_changed');
      }
    }),
    registerDevice: async () => {
      requests.push({ method: 'REGISTER' });
      return {
        deviceFingerprint: 'synthetic-consent-device',
        platform: 'android',
        appVersion: '1.0.0'
      };
    },
    readConfiguration: async () => {
      requests.push({ method: 'GET' });
      return null;
    },
    putConsent: async (_scope, body) => {
      requests.push({ method: 'PUT', body });
      const stored = JSON.parse(values.get(key) ?? 'null') as {
        pending?: { body: unknown };
      };
      expect(stored.pending?.body).toEqual(body);
      return serverResult;
    }
  };
  return {
    values,
    requests,
    ports,
    journal: new TrackingInstallationConsentJournal(ports),
    changeSession: () => {
      sessionBinding = 'd'.repeat(64);
    },
    changeOwner: () => {
      current = false;
    },
    failWrites: (value: boolean) => {
      writesFail = value;
    },
    server: (value: ReturnType<typeof response>) => {
      serverResult = value;
    }
  };
}

describe('durable production Tracking consent', () => {
  it.each(['wrong-version', 'lower-sms-id', 'unavailable-rules'] as const)(
    'rejects a mismatched server acceptance receipt: %s', async (kind) => {
      const f = fixture();
      const value = response();
      if (kind === 'wrong-version') value.installation.version = 7;
      if (kind === 'lower-sms-id') value.installation.sources.smsActivationId = '41';
      if (kind === 'unavailable-rules') value.configurationAvailable = false;
      f.server(value);
      await expect(f.journal.apply(sms)).rejects.toThrow('tracking_consent_response_invalid');
      expect(await f.journal.permits(receipt(), sms)).toBe(false);
    }
  );
  it('exposes only a retained explicit command as pending and clears it after local acknowledgment', async () => {
    const f = fixture();
    expect(await f.journal.hasPending()).toBe(false);
    const applied = await f.journal.apply(sms);
    expect(await f.journal.hasPending()).toBe(true);
    await f.journal.acknowledge(applied.commandId);
    expect(await f.journal.hasPending()).toBe(false);
  });
  it('registers before reading the current version and persists the explicit request before sending it', async () => {
    const f = fixture();
    const result = await f.journal.apply(sms);
    expect(f.requests.map((request) => request.method)).toEqual([
      'REGISTER',
      'GET',
      'PUT'
    ]);
    expect(result.sources).toEqual({
      ...sms,
      smsActivatedAt: Date.parse(sources.smsActivatedAt)
    });
    expect(f.requests.at(-1)?.body).toMatchObject({
      expectedVersion: 0,
      sources: {
        smsEnabled: true,
        notificationEnabled: false,
        smsActivationId: '42'
      }
    });
    expect(await f.journal.permits(receipt(), result.sources)).toBe(false);
    await f.journal.acknowledge(result.commandId);
    expect(await f.journal.permits(receipt(), result.sources)).toBe(true);
  });
  it('retries the identical durable command after an ambiguous network result and restart', async () => {
    const f = fixture();
    const put = f.ports.putConsent;
    let lost = true;
    f.ports.putConsent = async (...args) => {
      const result = await put(...args);
      if (lost) {
        lost = false;
        throw new Error('response_lost');
      }
      return result;
    };
    await expect(f.journal.apply(sms)).rejects.toThrow('response_lost');
    const before = f.values.get(key);
    const result = await new TrackingInstallationConsentJournal(
      f.ports
    ).retry();
    expect(result?.sources.smsEnabled).toBe(true);
    const puts = f.requests.filter((request) => request.method === 'PUT');
    expect(puts).toHaveLength(2);
    expect(puts[1]?.body).toEqual(puts[0]?.body);
    expect(before).toContain('pending');
    if (!result) throw new Error('Expected recovered command');
    expect(await f.journal.permits(receipt(), result.sources)).toBe(false);
  });
  it('keeps the pending command when accepting its receipt cannot be persisted', async () => {
    const f = fixture();
    const put = f.ports.putConsent;
    f.ports.putConsent = async (...args) => {
      const result = await put(...args);
      f.failWrites(true);
      return result;
    };
    await expect(f.journal.apply(sms)).rejects.toThrow(
      'synthetic_storage_failure'
    );
    f.failWrites(false);
    f.ports.putConsent = put;
    const result = await new TrackingInstallationConsentJournal(
      f.ports
    ).retry();
    expect(result?.sources.smsEnabled).toBe(true);
    expect(
      f.requests.filter((request) => request.method === 'PUT')
    ).toHaveLength(2);
  });
  it('recovers an accepted receipt without another PUT before local acknowledgment', async () => {
    const f = fixture();
    const accepted = await f.journal.apply(sms);
    const recovered = await new TrackingInstallationConsentJournal(
      f.ports
    ).retry();
    expect(recovered).toEqual(accepted);
    expect(
      f.requests.filter((request) => request.method === 'PUT')
    ).toHaveLength(1);
  });
  it('does not replay a pending approval or admit its receipt in a new SDK session', async () => {
    const f = fixture();
    const accepted = await f.journal.apply(sms);
    f.changeSession();
    const before = f.values.get(key);
    await expect(f.journal.retry()).rejects.toThrow(
      'tracking_consent_session_changed'
    );
    expect(await f.journal.permits(receipt(), accepted.sources)).toBe(false);
    expect(f.values.get(key)).toBe(before);
    expect(
      f.requests.filter((request) => request.method === 'PUT')
    ).toHaveLength(1);
  });
  it('shows sources disabled after an SDK change while retaining the earlier acknowledged consent', async () => {
    const f = fixture();
    const applied = await f.journal.apply(sms);
    await f.journal.acknowledge(applied.commandId);
    const before = f.values.get(key);
    f.changeSession();
    expect(await f.journal.effectiveSources(applied.sources)).toMatchObject({
      smsEnabled: false,
      notificationEnabled: false
    });
    expect(f.values.get(key)).toBe(before);
  });
  it('never creates consent while evaluating a server snapshot or opening a fresh owner namespace', async () => {
    const f = fixture();
    expect(await f.journal.permits(receipt(), sms)).toBe(false);
    expect(await f.journal.retry()).toBeNull();
    expect(f.requests).toEqual([]);
    expect(f.values.size).toBe(0);
  });
  it('accepts a durable metadata-only disable when rule configuration is unavailable', async () => {
    const f = fixture();
    f.server(response(receipt(false), false));
    const result = await f.journal.apply(off);
    expect(result.sources).toEqual(off);
    await f.journal.acknowledge(result.commandId);
    expect(await f.journal.permits(receipt(false), off)).toBe(false);
  });
  it('keeps malformed or foreign retained journal bytes untouched', async () => {
    const f = fixture();
    f.values.set(key, '{bad-retained-data');
    await expect(f.journal.apply(sms)).rejects.toThrow(
      'tracking_consent_storage_invalid'
    );
    expect(f.values.get(key)).toBe('{bad-retained-data');
    expect(f.requests).toEqual([]);
  });
  it('rejects a foreign SDK-bound server response before saving or enabling its sources', async () => {
    const f = fixture();
    f.server(response({ ...receipt(), sessionBinding: 'e'.repeat(64) }));
    await expect(f.journal.apply(sms)).rejects.toThrow(
      'tracking_consent_response_invalid'
    );
    expect(await f.journal.permits(receipt(), sms)).toBe(false);
  });
  it('retains a superseded unresolved request and never replays its enable when the user disables', async () => {
    const f = fixture();
    const put = f.ports.putConsent;
    f.ports.putConsent = async (...args) => {
      await put(...args);
      throw new Error('offline');
    };
    await expect(f.journal.apply(sms)).rejects.toThrow('offline');
    f.ports.putConsent = put;
    f.server(response(receipt(false), false));
    const result = await f.journal.apply(off);
    expect(result.sources).toEqual(off);
    const stored = JSON.parse(f.values.get(key) ?? 'null') as {
      superseded: unknown[];
    };
    expect(stored.superseded).toHaveLength(1);
    expect(
      f.requests.filter((request) => request.method === 'PUT')
    ).toHaveLength(2);
    expect(f.requests.at(-1)?.body).toMatchObject({
      sources: { smsEnabled: false, notificationEnabled: false }
    });
  });
});

describe('ordinary consent SDK and HTTP boundaries', () => {
  const hash = (value: string) =>
    jest
      .requireActual<typeof import('node:crypto')>('node:crypto')
      .createHash('sha256')
      .update(value)
      .digest('hex');
  afterEach(() => clearTrackingIsolation());
  it('reads local consent metadata with exact SDK identity without needing a network token', async () => {
    const getToken = jest.fn(async () => {
      throw new Error('token_offline');
    });
    registerLiveClerkBridge({
      getSession: async () => ({
        userId: ownerId,
        id: 'local-consent-session'
      }),
      getToken
    } as never);
    admitTrackingOwner(
      ownerId,
      { ownerDigest: hash(ownerId), generation },
      'local-consent-session'
    );
    const f = fixture();
    const journal = new TrackingInstallationConsentJournal(
      createLiveTrackingConsentPorts({ storage: f.ports.storage })
    );
    expect(await journal.hasPending()).toBe(false);
    expect(getToken).not.toHaveBeenCalled();
  });
  it('uses the admitted SDK session and ordinary Bearer APIs, verifying the response hash', async () => {
    const f = fixture();
    const digest = hash(ownerId);
    const sessionId = 'synthetic-live-consent-session';
    registerLiveClerkBridge({
      getSession: async () => ({ userId: ownerId, id: sessionId }),
      getToken: async () => 'synthetic-live-token'
    } as never);
    admitTrackingOwner(ownerId, { ownerDigest: digest, generation }, sessionId);
    const actualReceipt = {
      ...receipt(),
      sessionBinding: hash(
        `masarifi:tracking:session:v1:${ownerId}:${sessionId}`
      )
    };
    const paths: string[] = [];
    const request: typeof fetch = async (url, init) => {
      const path = String(url);
      paths.push(`${init?.method}:${new URL(path).pathname}`);
      expect(init?.credentials).toBe('omit');
      expect((init?.headers as Record<string, string>).Authorization).toBe(
        'Bearer synthetic-live-token'
      );
      const content = path.endsWith('/register')
        ? {
            deviceId: 'cccccccc-3333-4333-8333-333333333333',
            registeredAt: new Date().toISOString(),
            version: 1
          }
        : init?.method === 'PUT'
          ? response(actualReceipt)
          : { snapshot: defaultSnapshot, keywords: [], senders: [] };
      const value = path.endsWith('/register')
        ? content
        : { ...content, configurationHash: hash(canonicalJson(content)) };
      return new Response(JSON.stringify(value), {
        status: 200,
        headers: { 'content-type': 'application/json' }
      });
    };
    const journal = new TrackingInstallationConsentJournal(
      createLiveTrackingConsentPorts({
        storage: f.ports.storage,
        request,
        baseUrl: 'https://inert.invalid'
      })
    );
    const result = await journal.apply(sms);
    await journal.acknowledge(result.commandId);
    expect(paths).toEqual([
      'POST:/api/v1/me/devices/register',
      'GET:/api/v1/tracking/rule-snapshot',
      `PUT:/api/v1/tracking/installations/${deviceId}`
    ]);
    expect(await journal.permits(actualReceipt, result.sources)).toBe(true);
  });
  it('rejects stale SDK identity after the port scope was captured', async () => {
    let sdk = 'synthetic-consent-session';
    registerLiveClerkBridge({
      getSession: async () => ({ userId: ownerId, id: sdk }),
      getToken: async () => 'synthetic-live-token'
    } as never);
    admitTrackingOwner(
      ownerId,
      { ownerDigest: hash(ownerId), generation },
      sdk
    );
    const scope = await createLiveTrackingConsentPorts().scope();
    sdk = 'different-sdk-session';
    await expect(scope.assertCurrent()).rejects.toThrow();
  });
});
