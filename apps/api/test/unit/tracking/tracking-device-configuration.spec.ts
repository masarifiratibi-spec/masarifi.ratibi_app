import { TrackingService } from '../../../src/tracking/tracking.service';
import { TrackingRepository } from '../../../src/tracking/tracking.repository';
const principal = {
  userId: 'device-policy-owner',
  sessionId: 'device-session',
  factorAgeSeconds: 0,
};
const device = 'aaaaaaaa-1111-4111-8111-111111111111';
describe('device-scoped Tracking configuration', () => {
  it('rejects malformed device selectors before accessing configuration', async () => {
    const service = new TrackingService(
      { ruleSnapshot: () => Promise.resolve({}) } as never,
      {} as never,
      {} as never,
    );
    await expect(
      (service.ruleSnapshot as (...args: unknown[]) => Promise<unknown>)(
        principal,
        '../other-device',
      ),
    ).rejects.toMatchObject({ status: 400 });
  });
  it('selects authenticated device policy in the repository without trusting a caller owner', async () => {
    let selected: { sql: string; values: unknown[] } | undefined;
    const repo = new TrackingRepository({
      withClient: async (body: (c: unknown) => Promise<unknown>) =>
        body({
          query: (sql: string, values: unknown[]) => {
            if (sql.includes(' result')) selected = { sql, values };
            return Promise.resolve({
              rows: [{ result: { sourceAdmissionPolicy: 'financial_content_v1' } }],
            });
          },
        }),
    } as never);
    await (repo.ruleSnapshot as (...args: unknown[]) => Promise<unknown>)(principal, device);
    expect(selected?.sql).toContain('get_tracking_device_rule_snapshot');
    expect(selected?.values).toEqual([principal.userId, device]);
  });
});
