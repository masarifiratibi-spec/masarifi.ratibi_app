import { createHash } from 'node:crypto';
import { canonicalJson } from '@masarifi/transaction-parser';
import { TrackingRepository } from '../../../src/tracking/tracking.repository';
import { TrackingService } from '../../../src/tracking/tracking.service';

const principal = {
  userId: 'production-consent-owner',
  sessionId: 'production-sdk-session',
  factorAgeSeconds: 0,
};
const device = 'aaaaaaaa-1111-4111-8111-111111111111';
const registered = 'bbbbbbbb-2222-4222-8222-222222222222';
const input = () => ({
  expectedVersion: 0,
  deviceRegistration: {
    deviceFingerprint: 'synthetic-production-device',
    platform: 'android',
    appVersion: '1.0.0',
  },
  sources: {
    smsEnabled: true,
    notificationEnabled: false,
    smsActivatedAt: '2026-11-04T16:00:00.000Z',
    smsActivationId: '42',
    notificationActivatedAt: null,
  },
});
function fixture() {
  const snapshot = {
    installation: { version: 1, generation: 'cccccccc-3333-4333-8333-333333333333' },
    keywords: [],
    senders: [],
  };
  const statements: { sql: string; values: unknown[] }[] = [];
  const query = jest.fn((sql: string, values: unknown[] = []) => {
    statements.push({ sql, values });
    return Promise.resolve({ rows: sql.includes(' result') ? [{ result: snapshot }] : [] });
  });
  const repository = new TrackingRepository({
    withClient: async (run: (client: unknown) => Promise<unknown>) => run({ query }),
  } as never);
  const registerDevice = jest.fn(() => Promise.resolve({ device: { id: registered } }));
  const service = new TrackingService(
    repository,
    {} as never,
    {} as never,
    { registerDevice } as never,
    { get: () => false } as never,
  );
  return { service, statements, registerDevice, snapshot };
}

describe('production Tracking consent service', () => {
  it('uses the current registered device and principal while development automation is disabled', async () => {
    const { service, statements, registerDevice, snapshot } = fixture();
    expect(await service.updateInstallationConsent(principal, device, input())).toEqual({
      ...snapshot,
      configurationHash: createHash('sha256').update(canonicalJson(snapshot)).digest('hex'),
    });
    expect(registerDevice).toHaveBeenCalledWith(principal, input().deviceRegistration);
    expect(statements).toContainEqual({
      sql: "select set_config('request.jwt.claims',$1,true)",
      values: [
        JSON.stringify({ role: 'authenticated', sub: principal.userId, sid: principal.sessionId }),
      ],
    });
    expect(statements).toContainEqual({ sql: 'set local role masarifi_api', values: [] });
    const command = statements.find((statement) =>
      statement.sql.includes('private.configure_tracking_installation('),
    );
    expect(command?.values).toEqual([
      principal.userId,
      device,
      registered,
      0,
      JSON.stringify(input().sources),
    ]);
    expect(statements.at(-1)?.sql).toBe('commit');
  });
  it('rejects authority-bearing JSON before registering a device or opening a database transaction', async () => {
    const { service, statements, registerDevice } = fixture();
    await expect(
      service.updateInstallationConsent(principal, device, { ...input(), ownerId: 'other-owner' }),
    ).rejects.toMatchObject({ status: 400 });
    expect(registerDevice).not.toHaveBeenCalled();
    expect(statements).toEqual([]);
  });
  it('keeps ordinary configuration reads free of registration and enrollment', async () => {
    const { service, statements, registerDevice } = fixture();
    await service.ruleSnapshot(principal, device);
    expect(registerDevice).not.toHaveBeenCalled();
    expect(
      statements.some((statement) => statement.sql.includes('configure_tracking_installation')),
    ).toBe(false);
    expect(
      statements.some((statement) => statement.sql.includes('get_tracking_device_rule_snapshot')),
    ).toBe(true);
  });
  it('retains the independent development enrollment gate', async () => {
    const { service, statements, registerDevice } = fixture();
    await expect(service.deviceRuleSnapshot(principal, {})).rejects.toMatchObject({ status: 404 });
    expect(registerDevice).not.toHaveBeenCalled();
    expect(statements).toEqual([]);
  });
  it('requires a fresh device session when a revoked registration cannot be refreshed', async () => {
    const { service, statements, registerDevice } = fixture();
    registerDevice.mockRejectedValueOnce(new Error('PUSH_TOKEN_CONFLICT'));
    await expect(
      service.updateInstallationConsent(principal, device, input()),
    ).rejects.toMatchObject({ status: 409 });
    expect(statements).toEqual([]);
  });
});
