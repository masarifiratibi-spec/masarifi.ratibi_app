import { randomUUID } from 'node:crypto';

import { IdentityPrivacyHandler } from '../../../src/identity/identity-privacy.handler';
import { ClerkProviderUnavailableError } from '../../../src/identity/clerk-client.service';
import { SecurityWorkerService } from '../../../src/security/security.worker';
import { SecurityRepository } from '../../../src/security/security.repository';
import { AiPrivacyHandler } from '../../../src/ai/ai-privacy.handler';
import { EngagementPrivacyHandler } from '../../../src/engagement/engagement-privacy.handler';
import { TrackingPrivacyHandler } from '../../../src/tracking/tracking-privacy.handler';
import { IdentityRepository } from '../../../src/identity/identity.repository';
import { PoolService } from '../../../src/platform/database/pool.service';

const localUrl = process.env.MASARIFI_DELETION_LOCAL_DATABASE_URL;
const describeLocal = localUrl ? describe : describe.skip;

describeLocal('identity deletion with the real local worker role', () => {
  let pool: PoolService;
  let subject: string;
  const clerk = {
    revokeSession: jest.fn(),
    revokeUserSessions: jest.fn(),
    deleteIdentityUser: jest.fn(),
  };

  beforeAll(() => {
    if (!localUrl) throw new Error('DISPOSABLE_LOCAL_DELETION_DATABASE_REQUIRED');
    const url = new URL(localUrl);
    if (
      !['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname) ||
      url.pathname !== '/reliability_deletion_20261016'
    )
      throw new Error('DISPOSABLE_LOCAL_DELETION_DATABASE_REQUIRED');
    pool = new PoolService({
      get: (key: string) => {
        if (key === 'DATABASE_URL') return localUrl;
        if (key === 'MASARIFI_DATABASE_POOL_MAX') return 2;
        return undefined;
      },
    } as never);
  });
  beforeEach(async () => {
    clerk.revokeUserSessions.mockReset();
    clerk.deleteIdentityUser.mockReset();
    subject = `privacy_local_${randomUUID()}`;
    await pool.query(
      "insert into public.profiles(id,status,primary_email,display_name) values($1,'active','disposable@example.test','Disposable')",
      [subject],
    );
    clerk.revokeUserSessions.mockResolvedValue(['session-1', 'session-2']);
    clerk.deleteIdentityUser.mockResolvedValue('deleted');
  });
  afterEach(async () => {
    await pool.query('delete from private.account_deletion_requests where user_id=$1', [subject]);
    await pool.query('delete from public.profiles where id=$1', [subject]);
  });
  afterAll(async () => pool.onModuleDestroy());

  it('claims only the explicit disposable owner and leaves another due request untouched', async () => {
    const foreignOwner = 'privacy_foreign_' + randomUUID();
    await pool.query("insert into public.profiles(id,status) values($1,'active')", [foreignOwner]);
    try {
      await pool.query(
        `insert into private.account_deletion_requests(user_id,status,requested_at,verified_at,cooling_off_ends_at)
        values($1,'verified',clock_timestamp()-interval '3 days',clock_timestamp()-interval '3 days',clock_timestamp()-interval '2 days'),
        ($2,'verified',clock_timestamp()-interval '2 days',clock_timestamp()-interval '2 days',clock_timestamp()-interval '1 day')`,
        [foreignOwner, subject],
      );
      const storage = { delete: jest.fn().mockResolvedValue(undefined) };
      const worker = new SecurityWorkerService(
        new SecurityRepository(pool),
        storage as never,
        new IdentityPrivacyHandler(pool, clerk as never),
        new TrackingPrivacyHandler(pool, storage as never),
        new AiPrivacyHandler(pool, storage as never),
        new EngagementPrivacyHandler(pool, storage as never),
        { get: () => ['ai@1', 'engagement@1', 'identity@1', 'tracking@1'] } as never,
        {} as never,
      );
      await (
        worker as SecurityWorkerService & { runDeletionForOwner(owner: string): Promise<void> }
      ).runDeletionForOwner(subject);
      const requests = await pool.query(
        'select user_id,status from private.account_deletion_requests where user_id=any($1) order by user_id',
        [[subject, foreignOwner]],
      );
      expect(requests.rows).toEqual(
        expect.arrayContaining([
          { user_id: subject, status: 'completed' },
          { user_id: foreignOwner, status: 'verified' },
        ]),
      );
      expect(
        (await pool.query('select status from public.profiles where id=$1', [foreignOwner])).rows[0]
          ?.status,
      ).toBe('active');
      expect(clerk.revokeUserSessions).toHaveBeenCalledWith(subject);
      expect(clerk.deleteIdentityUser).toHaveBeenCalledWith(subject);
      expect(clerk.revokeUserSessions).not.toHaveBeenCalledWith(foreignOwner);
      await (
        worker as SecurityWorkerService & { runDeletionForOwner(owner: string): Promise<void> }
      ).runDeletionForOwner(subject);
      expect(
        (
          await pool.query(
            'select status from private.account_deletion_requests where user_id=$1',
            [foreignOwner],
          )
        ).rows[0]?.status,
      ).toBe('verified');
    } finally {
      await pool.query('delete from private.account_deletion_requests where user_id=$1', [
        foreignOwner,
      ]);
      await pool.query('delete from public.profiles where id=$1', [foreignOwner]);
    }
  });

  it('does not revoke sessions or tombstone identity when tracking cleanup fails', async () => {
    const sessionId = randomUUID();
    await pool.query(
      `insert into public.import_sessions(id,user_id,source_type,request_hash) values($1,$2,'file',$3)`,
      [sessionId, subject, 'a'.repeat(64)],
    );
    await pool.query(
      `insert into private.raw_ingestion_payloads(session_id,storage_ref,payload_hash,content_type,size_bytes,expires_at)
      values($1,$2,$3,'text/csv',1,clock_timestamp()+interval '1 day')`,
      [sessionId, 'tracking/' + sessionId + '/' + randomUUID(), 'b'.repeat(64)],
    );
    await pool.query(
      `insert into private.account_deletion_requests(user_id,status,requested_at,verified_at,cooling_off_ends_at)
      values($1,'verified',clock_timestamp()-interval '2 days',clock_timestamp()-interval '2 days',clock_timestamp()-interval '1 day')`,
      [subject],
    );
    const storage = {
      delete: jest.fn().mockRejectedValue(new Error('OBJECT_STORAGE_UNAVAILABLE')),
    };
    const worker = new SecurityWorkerService(
      new SecurityRepository(pool),
      storage as never,
      new IdentityPrivacyHandler(pool, clerk as never),
      new TrackingPrivacyHandler(pool, storage as never),
      new AiPrivacyHandler(pool, storage as never),
      new EngagementPrivacyHandler(pool, storage as never),
      { get: () => ['ai@1', 'engagement@1', 'identity@1', 'tracking@1'] } as never,
      {} as never,
    );
    await worker.runDeletionForOwner(subject);
    expect(
      (
        await pool.query('select status from private.account_deletion_requests where user_id=$1', [
          subject,
        ])
      ).rows[0]?.status,
    ).toBe('failed');
    expect(
      (await pool.query('select status from public.profiles where id=$1', [subject])).rows[0]
        ?.status,
    ).toBe('active');
    expect(clerk.revokeUserSessions).not.toHaveBeenCalled();
  });

  it('keeps provider deletion failure retryable after tombstoning and completes a stale replay without reactivation', async () => {
    const requestId = randomUUID();
    await pool.query(
      `insert into private.account_deletion_requests(id,user_id,status,requested_at,verified_at,cooling_off_ends_at)
      values($1,$2,'verified',clock_timestamp()-interval '2 days',clock_timestamp()-interval '2 days',clock_timestamp()-interval '1 day')`,
      [requestId, subject],
    );
    const storage = { delete: jest.fn().mockResolvedValue(undefined) };
    const worker = new SecurityWorkerService(
      new SecurityRepository(pool),
      storage as never,
      new IdentityPrivacyHandler(pool, clerk as never),
      new TrackingPrivacyHandler(pool, storage as never),
      new AiPrivacyHandler(pool, storage as never),
      new EngagementPrivacyHandler(pool, storage as never),
      { get: () => ['ai@1', 'engagement@1', 'identity@1', 'tracking@1'] } as never,
      {} as never,
    );
    clerk.deleteIdentityUser.mockRejectedValueOnce(new ClerkProviderUnavailableError());
    await worker.runDeletionForOwner(subject);
    expect(
      (
        await pool.query(
          'select status,error_code,completed_at from private.account_deletion_requests where id=$1',
          [requestId],
        )
      ).rows[0],
    ).toEqual({
      status: 'processing',
      error_code: 'DELETION_PROVIDER_UNAVAILABLE',
      completed_at: null,
    });
    const tombstone = (
      await pool.query<{ status: string; deleted_at: Date }>(
        'select status,deleted_at from public.profiles where id=$1',
        [subject],
      )
    ).rows[0];
    expect(tombstone?.status).toBe('deleted');
    expect(tombstone?.deleted_at).toBeInstanceOf(Date);
    // Recreate only this disposable request with an expired lease to avoid waiting 15 minutes.
    await pool.query('delete from private.account_deletion_requests where id=$1', [requestId]);
    await pool.query(
      `insert into private.account_deletion_requests(id,user_id,status,requested_at,verified_at,cooling_off_ends_at,updated_at,error_code)
      values($1,$2,'processing',clock_timestamp()-interval '2 days',clock_timestamp()-interval '2 days',clock_timestamp()-interval '1 day',clock_timestamp()-interval '16 minutes','DELETION_PROVIDER_UNAVAILABLE')`,
      [requestId, subject],
    );
    clerk.revokeUserSessions.mockClear();
    clerk.deleteIdentityUser.mockResolvedValueOnce('not_found');
    await worker.runDeletionForOwner(subject);
    expect(
      (
        await pool.query('select status from private.account_deletion_requests where id=$1', [
          requestId,
        ])
      ).rows[0]?.status,
    ).toBe('completed');
    expect(
      (await pool.query('select status,deleted_at from public.profiles where id=$1', [subject]))
        .rows[0],
    ).toEqual(tombstone);
    expect(clerk.revokeUserSessions).not.toHaveBeenCalled();
  });

  it('atomically anonymizes the profile with a timestamp and revokes sessions absent from local devices', async () => {
    const handler = new IdentityPrivacyHandler(pool, clerk as never);
    const outcome = await handler.deleteAccount({
      userId: subject,
      requestId: randomUUID(),
      evidenceAt: new Date(),
      correlationId: randomUUID(),
    });
    expect(outcome.anonymizedCount).toBe(1);
    const profile = await pool.query<{
      status: string;
      deleted_at: Date;
      primary_email: null;
      phone_e164: null;
      display_name: null;
    }>(
      'select status,deleted_at,primary_email,phone_e164,display_name from public.profiles where id=$1',
      [subject],
    );
    expect(profile.rows[0]?.deleted_at).toBeInstanceOf(Date);
    expect(profile.rows[0]).toEqual({
      status: 'deleted',
      deleted_at: profile.rows[0]?.deleted_at,
      primary_email: null,
      phone_e164: null,
      display_name: null,
    });
    expect(clerk.revokeUserSessions).toHaveBeenCalledWith(subject);
    await expect(
      handler.deleteAccount({
        userId: subject,
        requestId: randomUUID(),
        evidenceAt: new Date(),
        correlationId: randomUUID(),
      }),
    ).resolves.toMatchObject({ anonymizedCount: 0 });
    const deletedAt = (
      await pool.query<{ deleted_at: Date }>('select deleted_at from public.profiles where id=$1', [
        subject,
      ])
    ).rows[0]?.deleted_at;
    expect(deletedAt).toEqual(profile.rows[0]?.deleted_at);
    await new IdentityRepository(pool, {} as never).synchronizeClerkIdentity(
      {
        id: subject,
        primaryEmail: 'resurrection@example.test',
        primaryPhone: null,
        displayName: 'Restored',
      },
      subject,
    );
    const reconciled = await pool.query(
      'select status,primary_email,display_name from public.profiles where id=$1',
      [subject],
    );
    expect(reconciled.rows[0]).toEqual({
      status: 'deleted',
      primary_email: null,
      display_name: null,
    });
  });

  it('keeps the profile active when provider-wide revocation cannot be confirmed', async () => {
    clerk.revokeUserSessions.mockRejectedValueOnce(new Error('CLERK_PROVIDER_UNAVAILABLE'));
    const handler = new IdentityPrivacyHandler(pool, clerk as never);
    await expect(
      handler.deleteAccount({
        userId: subject,
        requestId: randomUUID(),
        evidenceAt: new Date(),
        correlationId: randomUUID(),
      }),
    ).rejects.toThrow('CLERK_PROVIDER_UNAVAILABLE');
    expect(
      (await pool.query('select status from public.profiles where id=$1', [subject])).rows[0]
        ?.status,
    ).toBe('active');
  });
});
