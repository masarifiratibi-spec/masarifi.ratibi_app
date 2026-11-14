import {
  audienceHash,
  parseAudience,
  transitionCampaign,
} from '../../../src/engagement/campaign.service';
import { validateEngagementCommand } from '../../../src/engagement/engagement.dto';
import { EngagementService } from '../../../src/engagement/engagement.service';
import type { EngagementRepository } from '../../../src/engagement/engagement.repository';
import type { SupportStorage } from '../../../src/engagement/support.storage';
import type { SecurityRepository } from '../../../src/security/security.repository';

describe('campaign governance', () => {
  it('binds an Android-only update audience to an exact release identity', () => {
    expect(
      parseAudience({ platforms: ['android'], appUpdate: { version: '1.0.1', versionCode: 140 } }),
    ).toEqual({
      platforms: ['android'],
      appUpdate: { version: '1.0.1', versionCode: 140 },
    });
  });

  it('admits an Android update audience through the actual preview command boundary', () => {
    const command = {
      operation: 'adminPreviewNotificationAudience',
      body: {
        platforms: ['android'],
        appUpdate: { version: '1.0.1', versionCode: 140 },
      },
      requestId: 'update-preview',
      idempotencyKey: 'update-preview-1',
    };
    expect(validateEngagementCommand(command)).toMatchObject(command);
  });

  it('returns a client validation error for malformed update input before any campaign write', async () => {
    const service = new EngagementService(
      {} as EngagementRepository,
      {} as SupportStorage,
      {} as SecurityRepository,
    );
    await expect(
      service.execute(
        { userId: 'admin', sessionId: 's', factorAgeSeconds: 0 },
        {
          operation: 'adminPreviewNotificationAudience',
          body: { platforms: ['android'], appUpdate: { version: '1.0.1', versionCode: '140' } },
          idempotencyKey: 'update-preview-invalid',
          requestId: 'update-preview',
        },
      ),
    ).rejects.toMatchObject({ status: 400, response: { code: 'ENGAGEMENT_INPUT_INVALID' } });
  });

  it.each([
    { appUpdate: { version: '1.0.1', versionCode: 140 } },
    { platforms: ['ios'], appUpdate: { version: '1.0.1', versionCode: 140 } },
    { platforms: ['android', 'ios'], appUpdate: { version: '1.0.1', versionCode: 140 } },
    ...[
      null,
      [],
      { version: '1.0.1' },
      { version: '1.0.1', versionCode: '140' },
      { version: '1.0.1', versionCode: 0 },
      { version: '1.0.1', versionCode: 140, url: 'https://example.test' },
      { version: '1.0.1-beta', versionCode: 140 },
    ].map((appUpdate) => ({ platforms: ['android'], appUpdate })),
  ])('rejects malformed or non-Android update audience %j', (input) => {
    expect(() => parseAudience(input)).toThrow('CAMPAIGN_AUDIENCE_INVALID');
  });

  it('normalizes a bounded server-known audience and creates a stable hash', () => {
    const audience = parseAudience({
      platforms: ['web', 'ios'],
      locales: ['en', 'ar'],
      activity: 'active',
      segmentKeys: ['salary_users'],
    });
    expect(audience).toEqual({
      platforms: ['ios', 'web'],
      locales: ['ar', 'en'],
      activity: 'active',
      segmentKeys: ['salary_users'],
    });
    expect(audienceHash(audience)).toMatch(/^sha256:[a-f0-9]{64}$/);
    expect(
      audienceHash(
        parseAudience({
          segmentKeys: ['salary_users'],
          activity: 'active',
          locales: ['ar', 'en'],
          platforms: ['ios', 'web'],
        }),
      ),
    ).toBe(audienceHash(audience));
  });

  it.each([
    { sql: 'select * from profiles' },
    { platforms: ['ios'], url: 'https://example.test' },
    {
      platforms: ['ios'],
      segmentKeys: Array.from({ length: 11 }, (_, index) => `s${String(index)}`),
    },
    { platforms: ['unknown'] },
  ])('rejects arbitrary or unbounded audience input', (input) => {
    expect(() => parseAudience(input)).toThrow('CAMPAIGN_AUDIENCE_INVALID');
  });

  it('enforces one-time lifecycle and creator/approver separation above threshold', () => {
    expect(() =>
      transitionCampaign(
        { status: 'draft', creatorId: 'a', audienceCount: 10_001 },
        'approve',
        'a',
        10_000,
      ),
    ).toThrow('CAMPAIGN_APPROVER_SEPARATION_REQUIRED');
    expect(
      transitionCampaign(
        { status: 'draft', creatorId: 'a', audienceCount: 10_001 },
        'approve',
        'b',
        10_000,
      ).status,
    ).toBe('approved');
    expect(() =>
      transitionCampaign(
        { status: 'approved', creatorId: 'a', audienceCount: 1 },
        'schedule',
        'b',
        10_000,
        new Date('2026-09-05T00:00:00Z'),
        new Date('2026-09-04T00:00:00Z'),
      ),
    ).toThrow('CAMPAIGN_SCHEDULE_INVALID');
  });
});
