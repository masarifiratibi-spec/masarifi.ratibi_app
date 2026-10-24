import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { hashNormalizedCommand } from '../../../src/ledger/idempotency';
import { PoolService } from '../../../src/platform/database/pool.service';
import { SecurityRepository } from '../../../src/security/security.repository';
import { ImmediateDeletionService } from '../../../src/security/immediate-deletion.service';
import { SecurityService, type SecurityOperation } from '../../../src/security/security.service';
import { ClerkProviderUnavailableError } from '../../../src/identity/clerk-client.service';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { DeletionCompletionController } from '../../../src/security/deletion-completion.controller';
import { PlatformConfigService } from '../../../src/platform/config/platform-config.service';
import { OwnerDataErasureService } from '../../../src/security/owner-data-erasure.service';

const localUrl = process.env.MASARIFI_DELETION_LOCAL_DATABASE_URL;
const describeLocal = localUrl ? describe : describe.skip;

describeLocal('immediate deletion committed receipts on the owned local database', () => {
  let pool: PoolService;
  let owner: string;
  let operationId: string;
  let token: string;
  let immediate: ImmediateDeletionService;
  let service: SecurityService;
  let repository: SecurityRepository;
  let values: Record<string, unknown>;
  const networkHash = 'a'.repeat(64);
  const clerk = { revokeUserSessions: jest.fn(), deleteIdentityUser: jest.fn() };

  beforeAll(async () => {
    if (!localUrl) throw new Error('OWNED_LOCAL_DELETION_DATABASE_REQUIRED');
    const url = new URL(localUrl);
    if (
      url.hostname !== '127.0.0.1' ||
      !(
        (url.port === '15876' && url.pathname === '/reliability_deletion_20261016') ||
        (url.port === '15918' && url.pathname === '/dev_egress_20261020') ||
        (url.port === '55442' && url.pathname === '/admin_recovery_fresh')
      )
    )
      throw new Error('OWNED_LOCAL_DELETION_DATABASE_REQUIRED');
    pool = new PoolService({
      get: (key: string) =>
        key === 'DATABASE_URL' ? localUrl : key === 'MASARIFI_DATABASE_POOL_MAX' ? 4 : undefined,
    } as never);
    if (url.port === '55442') {
      const target = await pool.query<{ data_directory: string }>('show data_directory');
      if (
        !target.rows[0]?.data_directory
          .replaceAll('\\', '/')
          .endsWith('/2026-10-23-admin-dashboard-recovery/native-db/data')
      )
        throw new Error('WRONG_LOCAL_DELETION_CLUSTER');
    }
  });
  beforeEach(async () => {
    owner = 'immediate_local_' + randomUUID();
    operationId = randomUUID();
    token = randomBytes(32).toString('hex');
    await pool.query("insert into public.profiles(id,status) values($1,'active')", [owner]);
    values = {
      MASARIFI_DELETION_COOLING_OFF_HOURS: 0,
      MASARIFI_PRIVACY_DATABASE_URL: localUrl,
      MASARIFI_DATABASE_POOL_MAX: 4,
      MASARIFI_PRIVACY_HANDLER_MANIFEST: ['ai@1', 'engagement@1', 'identity@1', 'tracking@1'],
      SUPABASE_URL: 'http://127.0.0.1:1',
      SUPABASE_SERVICE_ROLE_KEY: 'inert-local-storage-credential',
      MASARIFI_SUPPORT_SIGNED_URL_SECONDS: 300,
      NODE_ENV: 'test',
      MASARIFI_RECENT_AUTH_MAX_AGE_SECONDS: 600,
    };
    const config = { get: (key: string) => values[key], getRequired: (key: string) => values[key] };
    clerk.revokeUserSessions.mockReset().mockResolvedValue([]);
    clerk.deleteIdentityUser.mockReset().mockResolvedValue('deleted');
    immediate = new ImmediateDeletionService(config as never, clerk as never);
    repository = new SecurityRepository(pool);
    service = new SecurityService(
      repository,
      config as never,
      clerk as never,
      {} as never,
      immediate,
    );
  });
  afterEach(async () => {
    await immediate.onModuleDestroy();
    await pool.query('delete from private.account_deletion_receipts where user_id=$1', [owner]);
    await pool.query(
      'delete from private.account_erasure_resources where request_id in(select id from private.account_deletion_requests where user_id=$1)',
      [owner],
    );
    await pool.query('delete from private.account_deletion_requests where user_id=$1', [owner]);
    await pool.query('delete from private.deletion_completion_rate_buckets where network_hash=$1', [
      networkHash,
    ]);
    await pool.query(
      'delete from public.profiles p where p.id=$1 and not exists(select 1 from public.security_events e where e.user_id=p.id)',
      [owner],
    );
  });
  afterAll(async () => pool.onModuleDestroy());

  const operation = (): SecurityOperation => ({
    operation: 'createMyDeletionRequest',
    principal: { userId: owner, sessionId: 'session_local', factorAgeSeconds: 0 },
    body: { confirmation: 'DELETE_MY_ACCOUNT', completionToken: token },
    idempotencyKey: operationId,
    // The service hashes the unchanged client command before adding server policy fields.
    commandHash: hashNormalizedCommand({
      operation: 'createMyDeletionRequest',
      body: { confirmation: 'DELETE_MY_ACCOUNT', completionToken: token },
      params: {},
    }),
    requestId: randomUUID(),
    query: {},
    params: {},
  });
  const tokenHash = () => createHash('sha256').update(token).digest('hex');

  it.each([false, true])(
    'a new confirmed command makes an existing cooling request eligible immediately (prior receipt=%s)',
    async (withReceipt) => {
      const existing = (await repository.execute({
        ...operation(),
        body: {
          confirmation: 'DELETE_MY_ACCOUNT',
          coolingOffHours: 72,
          ...(withReceipt ? { completionTokenHash: tokenHash() } : {}),
        },
      })) as { id: string; coolingOffEndsAt: Date };
      expect(existing.coolingOffEndsAt.getTime()).toBeGreaterThan(Date.now());
      const immediateRequest = (await repository.execute({
        ...operation(),
        idempotencyKey: randomUUID(),
        body: {
          confirmation: 'DELETE_MY_ACCOUNT',
          coolingOffHours: 0,
          completionTokenHash: tokenHash(),
        },
      })) as { id: string; status: string; coolingOffEndsAt: Date };
      expect(immediateRequest.id).toBe(existing.id);
      expect(immediateRequest.status).toBe('verified');
      const stored = await pool.query(
        'select id,cooling_off_ends_at<=clock_timestamp() as eligible from private.account_deletion_requests where user_id=$1',
        [owner],
      );
      expect(stored.rows).toEqual([{ id: existing.id, eligible: true }]);
    },
  );

  it('erases eligible delayed financial data and completes each provider only once', async () => {
    values.MASARIFI_DELETION_COOLING_OFF_HOURS = 72;
    const account = randomUUID(),
      deletion = randomUUID();
    await pool.query(
      "insert into public.accounts(id,user_id,name,type,currency_code) values($1,$2,'Delayed deletion fixture','bank','SAR')",
      [account, owner],
    );
    await pool.query(
      `insert into private.account_deletion_requests(id,user_id,status,requested_at,verified_at,cooling_off_ends_at)
      values($1,$2,'verified',clock_timestamp()-interval '96 hours',clock_timestamp()-interval '96 hours',clock_timestamp()-interval '24 hours')`,
      [deletion, owner],
    );
    await expect(immediate.runDeletionRequestForOwner(owner, deletion)).resolves.toMatchObject({
      status: 'completed',
    });
    expect(
      (await pool.query('select id from public.accounts where user_id=$1', [owner])).rows,
    ).toEqual([]);
    expect(
      (await pool.query('select status from public.profiles where id=$1', [owner])).rows,
    ).toEqual([{ status: 'deleted' }]);
    await expect(immediate.runDeletionRequestForOwner(owner, deletion)).resolves.toMatchObject({
      status: 'completed',
    });
    expect(clerk.deleteIdentityUser).toHaveBeenCalledTimes(1);
  });

  it('retains a completion receipt until after the delayed cooling window', async () => {
    const requested = (await repository.execute({
      ...operation(),
      body: {
        confirmation: 'DELETE_MY_ACCOUNT',
        coolingOffHours: 72,
        completionTokenHash: tokenHash(),
      },
    })) as { id: string };
    const receipt = await pool.query<{ afterCooling: boolean }>(
      `select r.expires_at>d.cooling_off_ends_at+interval '23 hours' as "afterCooling" from private.account_deletion_receipts r join private.account_deletion_requests d on d.id=r.request_id where r.request_id=$1`,
      [requested.id],
    );
    expect(receipt.rows[0]?.afterCooling).toBe(true);
  });

  it('preserves an existing cooling deadline when the server still requires a cooling period', async () => {
    const input = {
      ...operation(),
      body: { confirmation: 'DELETE_MY_ACCOUNT', coolingOffHours: 72 },
    };
    const existing = (await repository.execute(input)) as { id: string; coolingOffEndsAt: Date };
    const repeated = (await repository.execute(input)) as { id: string; coolingOffEndsAt: Date };
    expect(repeated.id).toBe(existing.id);
    expect(new Date(repeated.coolingOffEndsAt).getTime()).toEqual(
      new Date(existing.coolingOffEndsAt).getTime(),
    );
    expect(new Date(repeated.coolingOffEndsAt).getTime()).toBeGreaterThan(Date.now());
  });

  it('completes the existing delayed request through the immediate service in the same POST', async () => {
    const existing = (await repository.execute({
      ...operation(),
      body: { confirmation: 'DELETE_MY_ACCOUNT', coolingOffHours: 72 },
      idempotencyKey: randomUUID(),
    })) as { id: string };
    await expect(service.execute(operation())).resolves.toMatchObject({
      id: existing.id,
      status: 'completed',
    });
    expect(clerk.deleteIdentityUser).toHaveBeenCalledWith(owner);
    expect(
      (await pool.query('select status from public.profiles where id=$1', [owner])).rows,
    ).toEqual([{ status: 'deleted' }]);
  });

  it('does not advance a newer request when replaying a cancelled receipt', async () => {
    const old = (await repository.execute({
      ...operation(),
      body: {
        confirmation: 'DELETE_MY_ACCOUNT',
        coolingOffHours: 72,
        completionTokenHash: tokenHash(),
      },
    })) as { id: string };
    await repository.execute({
      ...operation(),
      operation: 'cancelMyDeletionRequest',
      body: {},
      params: { deletionId: old.id },
    });
    const newer = (await repository.execute({
      ...operation(),
      idempotencyKey: randomUUID(),
      body: { confirmation: 'DELETE_MY_ACCOUNT', coolingOffHours: 72 },
    })) as { id: string; coolingOffEndsAt: Date };
    await expect(
      repository.execute({
        ...operation(),
        body: {
          confirmation: 'DELETE_MY_ACCOUNT',
          coolingOffHours: 0,
          completionTokenHash: tokenHash(),
        },
      }),
    ).resolves.toMatchObject({ id: old.id });
    await expect(
      repository.execute({
        ...operation(),
        operation: 'getMyDeletionRequest',
        idempotencyKey: undefined,
        commandHash: undefined,
        body: {},
        params: { deletionId: old.id },
      }),
    ).resolves.toMatchObject({ id: old.id, status: 'cancelled' });
    expect(
      (
        await pool.query(
          'select cooling_off_ends_at as deadline from private.account_deletion_requests where id=$1',
          [newer.id],
        )
      ).rows,
    ).toEqual([{ deadline: newer.coolingOffEndsAt }]);
  });

  it('finishes real handlers in the original POST and recovers the actual completion after the profile is deleted', async () => {
    const completed = (await service.execute(operation())) as {
      id: string;
      status: string;
      completedAt: string;
    };
    expect(completed.status).toBe('completed');
    expect(completed.completedAt).toBeInstanceOf(Date);
    expect(clerk.deleteIdentityUser).toHaveBeenCalledWith(owner);
    expect(
      (await pool.query('select status from public.profiles where id=$1', [owner])).rows[0]?.status,
    ).toBe('deleted');
    await expect(
      repository.execute({
        ...operation(),
        operation: 'getMyDeletionRequest',
        params: { deletionId: completed.id },
        body: {},
      }),
    ).rejects.toMatchObject({ code: '42501' });
    const recovery = await repository.getDeletionCompletion(operationId, tokenHash(), networkHash);
    expect(recovery).toMatchObject({
      rateLimited: false,
      value: { id: completed.id, status: 'completed' },
    });
    expect((recovery.value as { completedAt: Date }).completedAt).toBeInstanceOf(Date);
    expect(Object.keys(recovery.value as object).sort()).toEqual([
      'completedAt',
      'coolingOffEndsAt',
      'errorCode',
      'id',
      'status',
      'version',
    ]);
    const receipt = (
      await pool.query(
        'select token_hash from private.account_deletion_receipts where operation_id=$1',
        [operationId],
      )
    ).rows[0];
    expect(receipt?.token_hash).toBe(tokenHash());
    expect(receipt?.token_hash).not.toBe(token);
    const module = await Test.createTestingModule({
      controllers: [DeletionCompletionController],
      providers: [
        {
          provide: ImmediateDeletionService,
          useValue: { getCompletion: immediate.getCompletion.bind(immediate) },
        },
        {
          provide: PlatformConfigService,
          useValue: { getRequired: () => 'inert-test-network-secret' },
        },
      ],
    }).compile();
    const app = module.createNestApplication();
    await app.init();
    try {
      const response = await request(app.getHttpServer() as Parameters<typeof request>[0])
        .get(`/api/v1/privacy/deletion-completions/${operationId}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      expect(response.body as unknown).toMatchObject({ id: completed.id, status: 'completed' });
      expect(response.headers['cache-control']).toBe('no-store');
      await request(app.getHttpServer() as Parameters<typeof request>[0])
        .get(`/api/v1/privacy/deletion-completions/${operationId}`)
        .set('Authorization', `Bearer ${'b'.repeat(64)}`)
        .expect(404);
    } finally {
      await app.close();
    }
  });

  it('binds replay to the exact operation/token and refuses foreign operation reuse atomically', async () => {
    const input = {
      ...operation(),
      body: {
        confirmation: 'DELETE_MY_ACCOUNT',
        coolingOffHours: 0,
        completionTokenHash: tokenHash(),
      },
    };
    const first = (await repository.execute(input)) as { id: string };
    await expect(repository.execute(input)).resolves.toMatchObject({ id: first.id });
    await expect(
      repository.execute({
        ...input,
        body: { ...input.body, completionTokenHash: 'b'.repeat(64) },
        commandHash: hashNormalizedCommand({
          operation: 'createMyDeletionRequest',
          body: { confirmation: 'DELETE_MY_ACCOUNT', completionToken: 'b'.repeat(64) },
          params: {},
        }),
      }),
    ).rejects.toMatchObject({ code: 'IDEMPOTENCY_KEY_REUSED' });
    const foreign = 'immediate_foreign_' + randomUUID();
    await pool.query("insert into public.profiles(id,status) values($1,'active')", [foreign]);
    try {
      await expect(
        repository.execute({ ...input, principal: { ...input.principal, userId: foreign } }),
      ).rejects.toMatchObject({ code: '23505' });
      expect(
        (
          await pool.query('select id from private.account_deletion_requests where user_id=$1', [
            foreign,
          ])
        ).rows,
      ).toEqual([]);
    } finally {
      await pool.query('delete from public.profiles where id=$1', [foreign]);
    }
    await expect(
      repository.getDeletionCompletion(operationId, 'b'.repeat(64), networkHash),
    ).resolves.toEqual({ rateLimited: false, value: null });
    await pool.query(
      "update private.account_deletion_receipts set expires_at=clock_timestamp()-interval '1 second' where operation_id=$1",
      [operationId],
    );
    await expect(
      repository.getDeletionCompletion(operationId, tokenHash(), networkHash),
    ).resolves.toEqual({ rateLimited: false, value: null });
  });

  it('commits receipt access rate limits even when credentials do not match', async () => {
    await pool.query(
      `insert into private.deletion_completion_rate_buckets(network_hash,bucket_at,attempts) values($1,date_trunc('minute',clock_timestamp()),60)`,
      [networkHash],
    );
    await expect(
      repository.getDeletionCompletion(operationId, tokenHash(), networkHash),
    ).resolves.toEqual({ rateLimited: true, value: null });
    expect(
      (
        await pool.query(
          'select attempts from private.deletion_completion_rate_buckets where network_hash=$1',
          [networkHash],
        )
      ).rows[0]?.attempts,
    ).toBe(61);
  });

  it('keeps provider failure honest and retryable after local erasure and session revocation', async () => {
    clerk.deleteIdentityUser.mockRejectedValueOnce(new ClerkProviderUnavailableError());
    const pending = (await service.execute(operation())) as { id: string };
    expect(pending).toMatchObject({
      status: 'processing',
      completedAt: null,
    });
    expect(pending).not.toHaveProperty('errorCode');
    expect(
      (await pool.query('select status from public.profiles where id=$1', [owner])).rows[0]?.status,
    ).toBe('deleted');
    await expect(
      repository.getDeletionCompletion(operationId, tokenHash(), networkHash),
    ).resolves.toMatchObject({
      value: {
        status: 'processing',
        completedAt: null,
        errorCode: 'DELETION_PROVIDER_UNAVAILABLE',
      },
    });
  });

  it('refuses another owner request id and leaves a fresh competing worker claim alone', async () => {
    const input = {
      ...operation(),
      body: {
        confirmation: 'DELETE_MY_ACCOUNT',
        coolingOffHours: 0,
        completionTokenHash: tokenHash(),
      },
    };
    const requested = (await repository.execute(input)) as { id: string };
    const foreign = 'immediate_foreign_' + randomUUID();
    await pool.query("insert into public.profiles(id,status) values($1,'active')", [foreign]);
    try {
      await expect(
        immediate.runDeletionRequestForOwner(foreign, requested.id),
      ).rejects.toMatchObject({ code: 'P0002' });
      expect(
        (
          await pool.query('select status from private.account_deletion_requests where id=$1', [
            requested.id,
          ])
        ).rows[0]?.status,
      ).toBe('verified');
      await pool.query(
        "update private.account_deletion_requests set status='processing' where id=$1",
        [requested.id],
      );
      await expect(
        immediate.runDeletionRequestForOwner(owner, requested.id),
      ).resolves.toMatchObject({ status: 'processing', completedAt: null });
      expect(
        (await pool.query('select status from public.profiles where id=$1', [owner])).rows[0]
          ?.status,
      ).toBe('active');
      expect(clerk.revokeUserSessions).not.toHaveBeenCalled();
    } finally {
      await pool.query('delete from public.profiles where id=$1', [foreign]);
    }
  });

  it('recovers a stale processing request whose Clerk identity and local profile are already deleted', async () => {
    const deletionId = randomUUID();
    await pool.query(
      `insert into private.account_deletion_requests(id,user_id,status,requested_at,verified_at,cooling_off_ends_at,updated_at,error_code)
       values($1,$2,'processing',clock_timestamp()-interval '20 minutes',clock_timestamp()-interval '20 minutes',
         clock_timestamp()-interval '20 minutes',clock_timestamp()-interval '16 minutes','DELETION_PROVIDER_UNAVAILABLE')`,
      [deletionId, owner],
    );
    await pool.query(
      `insert into private.account_deletion_receipts(user_id,operation_id,request_id,token_hash,expires_at)
       values($1,$2,$3,$4,clock_timestamp()+interval '24 hours')`,
      [owner, operationId, deletionId, tokenHash()],
    );
    await pool.query(
      "update public.profiles set status='deleted',deleted_at=clock_timestamp() where id=$1",
      [owner],
    );
    clerk.deleteIdentityUser.mockResolvedValueOnce('not_found');
    await expect(immediate.runDeletionRequestForOwner(owner, deletionId)).resolves.toMatchObject({
      status: 'completed',
    });
    await expect(
      repository.getDeletionCompletion(operationId, tokenHash(), networkHash),
    ).resolves.toMatchObject({ value: { status: 'completed' } });
    expect(clerk.revokeUserSessions).not.toHaveBeenCalled();
  });

  it('stops completion when an identity hold appears after payload erasure', async () => {
    const admin = 'immediate_hold_admin_' + randomUUID();
    await pool.query("insert into public.profiles(id,status) values($1,'active')", [admin]);
    await pool.query("insert into public.admin_profiles(user_id,status) values($1,'active')", [
      admin,
    ]);
    const insertedPolicy = await pool.query(
      `insert into private.retention_policies(resource_type,retention_days,deletion_mode,legal_basis)
       values('identity',0,'delete','Synthetic local late hold test') on conflict(resource_type) do nothing returning id`,
    );
    const erase = Reflect.get(OwnerDataErasureService.prototype, 'erase');
    // Pause at the actual erasure boundary to reproduce a hold committed before the identity check.
    jest.spyOn(OwnerDataErasureService.prototype, 'erase').mockImplementation(async function (
      this: OwnerDataErasureService,
      evidence,
    ) {
      const outcome = await erase.call(this, evidence);
      await pool.query(
        `insert into private.retention_holds(resource_type,resource_id,reason,created_by)
         values('identity',$1,'Synthetic late identity hold',$2)`,
        [owner, admin],
      );
      return outcome;
    });
    try {
      const pending = (await service.execute(operation())) as { id: string };
      expect(pending).toMatchObject({ status: 'processing', completedAt: null });
      expect(clerk.revokeUserSessions).not.toHaveBeenCalled();
      expect(clerk.deleteIdentityUser).not.toHaveBeenCalled();
      expect(
        (await pool.query('select status from public.profiles where id=$1', [owner])).rows[0]
          ?.status,
      ).toBe('deletion_pending');
      await expect(
        repository.getDeletionCompletion(operationId, tokenHash(), networkHash),
      ).resolves.toMatchObject({ value: { status: 'processing', completedAt: null } });
      expect(
        (
          await pool.query(
            "select id from private.outbox_events where aggregate_id=$1 and event_type='privacy.deletion_completed'",
            [pending.id],
          )
        ).rows,
      ).toEqual([]);
    } finally {
      await pool.query(
        'delete from private.retention_holds where resource_id=$1 and created_by=$2',
        [owner, admin],
      );
      if (insertedPolicy.rows.length)
        await pool.query("delete from private.retention_policies where resource_type='identity'");
      await pool.query('delete from public.admin_profiles where user_id=$1', [admin]);
      await pool.query('delete from public.profiles where id=$1', [admin]);
    }
  });

  it('does not emit completion evidence after losing its processing status before the completion commit', async () => {
    clerk.deleteIdentityUser.mockImplementationOnce(async () => {
      await pool.query(
        "update private.account_deletion_requests set status='cancelled' where user_id=$1 and status='processing'",
        [owner],
      );
      return 'deleted';
    });
    const cancelled = (await service.execute(operation())) as { id: string };
    expect(cancelled).toMatchObject({ status: 'cancelled', completedAt: null });
    expect(
      (
        await pool.query(
          "select id from private.outbox_events where aggregate_id=$1 and event_type='privacy.deletion_completed'",
          [cancelled.id],
        )
      ).rows,
    ).toEqual([]);
  });
});
