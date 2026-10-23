import { randomUUID } from 'node:crypto';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { CustomerAdminController } from '../../../src/identity/customer-admin.controller';
import { CustomerAdminService } from '../../../src/identity/customer-admin.service';
import { AdminAuthGuard } from '../../../src/security/admin-auth.guard';
import type { PlatformConfigService } from '../../../src/platform/config/platform-config.service';
import { PoolService } from '../../../src/platform/database/pool.service';
import { createLivePool, describeLiveDatabase } from '../../live-database';
import { CustomerAdminRepository } from '../../../src/identity/customer-admin.repository';
import { CustomerSessionRevoker } from '../../../src/identity/customer-session-revoker';
import { IdentityPrivacyHandler } from '../../../src/identity/identity-privacy.handler';
import {
  ClerkProviderUnavailableError,
  type ClerkClientService,
} from '../../../src/identity/clerk-client.service';

describeLiveDatabase('customer admin recovery', () => {
  let pool: PoolService;
  const actor = `user_admin_${randomUUID()}`;
  const customer = `user_customer_${randomUUID()}`;
  beforeAll(async () => {
    pool = createLivePool();
    await pool.query('insert into public.profiles(id,primary_email) values($1,null),($2,$3)', [
      actor,
      customer,
      `${randomUUID()}@gmail.com`,
    ]);
    await pool.query("insert into public.admin_profiles(user_id,status) values($1,'active')", [
      actor,
    ]);
    await pool.query(
      "insert into public.admin_role_assignments(user_id,role_id,assigned_by,reason) select $1,id,$1,'Customer recovery regression' from public.roles where key='super-admin'",
      [actor],
    );
  });
  afterAll(async () => pool.onModuleDestroy());
  async function call(subject: string, operation: string, body: Record<string, unknown>) {
    return pool.withClient(async (client) => {
      await client.query('begin');
      try {
        await client.query("select set_config('request.jwt.claims',$1,true)", [
          JSON.stringify({ sub: subject, sid: 'session', role: 'authenticated' }),
        ]);
        await client.query('set local role masarifi_api');
        const result = await client.query<{ value: Record<string, unknown> }>(
          'select private.customer_admin($1,$2::jsonb) value',
          [operation, JSON.stringify(body)],
        );
        await client.query('commit');
        const value = result.rows[0]?.value;
        if (!value) throw new Error('CUSTOMER_RESULT_MISSING');
        return value;
      } catch (error) {
        await client.query('rollback');
        throw error;
      }
    });
  }
  it('returns masked real customer identity with no fabricated diagnostics or devices', async () => {
    const result = await call(actor, 'list', { query: customer, page: 1, pageSize: 25 });
    const items = result.items as Array<Record<string, unknown>>;
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      id: customer,
      country: null,
      primaryPlatform: null,
      totalDeviceCount: 0,
      registeredPlatforms: [],
      risk: 'unknown',
    });
    expect(items[0]?.maskedEmail).toMatch(/^.\*{3}@gmail.com$/);
    expect(JSON.stringify(result)).not.toContain('clerk_session_id');
    await expect(call(customer, 'list', {})).rejects.toThrow('ADMIN_PERMISSION_DENIED');
  });
  it('reaches customers beyond the first page using server filters', async () => {
    const prefix = `user_page_${randomUUID()}_`;
    await pool.query(
      "insert into public.profiles(id,locale) select $1||n::text,case when n=26 then 'en' else 'ar' end from generate_series(1,26) n",
      [prefix],
    );
    const first = await call(actor, 'list', { query: prefix, page: 1, pageSize: 25 });
    const second = await call(actor, 'list', { query: prefix, page: 2, pageSize: 25 });
    const ids = [
      ...(first.items as Array<{ id: string }>),
      ...(second.items as Array<{ id: string }>),
    ].map((item) => item.id);
    expect(first.pagination).toMatchObject({ totalItems: 26, totalPages: 2 });
    expect(first.items).toHaveLength(25);
    expect(second.items).toHaveLength(1);
    expect(new Set(ids).size).toBe(26);
    const filtered = await call(actor, 'list', { query: prefix, language: 'en' });
    expect(filtered.items).toHaveLength(1);
  });
  it('does not invent a primary platform for multi-platform customers', async () => {
    const user = `user_multi_${randomUUID()}`;
    await pool.query('insert into public.profiles(id) values($1)', [user]);
    for (const platform of ['ios', 'android'])
      await pool.query(
        'insert into public.user_devices(user_id,device_fingerprint,platform,app_version) values($1,$2,$3,$4)',
        [user, `h1:${randomUUID().replaceAll('-', '').repeat(2)}`, platform, '1.0'],
      );
    const result = await call(actor, 'list', { query: user });
    expect((result.items as Array<Record<string, unknown>>)[0]).toMatchObject({
      primaryPlatform: null,
      totalDeviceCount: 2,
    });
  });
  it('atomically suspends and queues revocation, replays the command, and protects admin accounts', async () => {
    const command = { userId: customer, reason: 'Security recovery regression', key: randomUUID() };
    const first = await call(actor, 'suspend', command);
    expect(first).toMatchObject({ currentState: 'suspended', outcome: 'partial' });
    expect(await call(actor, 'suspend', command)).toEqual(first);
    await expect(
      call(actor, 'suspend', { ...command, reason: 'Changed semantic command' }),
    ).rejects.toThrow('IDEMPOTENCY_CONFLICT');
    expect(
      (await pool.query('select status from public.profiles where id=$1', [customer])).rows[0],
    ).toEqual({ status: 'suspended' });
    await pool.withClient(async (client) => {
      await client.query('begin');
      try {
        await client.query("select set_config('request.jwt.claims',$1,true)", [
          JSON.stringify({ sub: customer, role: 'authenticated' }),
        ]);
        await client.query('set local role masarifi_api');
        await expect(
          client.query('select private.assert_active_profile($1)', [customer]),
        ).rejects.toThrow('PROFILE_INACTIVE');
      } finally {
        await client.query('rollback');
      }
    });
    expect(
      (
        await pool.query(
          'select count(*)::int n from private.customer_session_commands where user_id=$1',
          [customer],
        )
      ).rows[0]?.n,
    ).toBe(1);
    await expect(
      call(actor, 'suspend', { ...command, userId: actor, key: randomUUID() }),
    ).rejects.toThrow('ADMIN_CUSTOMER_LIFECYCLE_DENIED');
    expect(await call(actor, 'reactivate', { ...command, key: randomUUID() })).toMatchObject({
      currentState: 'active',
    });
  });
  it('retains failed provider work and retries only the original session snapshot', async () => {
    const result = await call(actor, 'revoke-sessions', {
      userId: customer,
      reason: 'Revoke original sessions',
      key: randomUUID(),
      scope: 'all',
      sessionIds: [],
    });
    const revokeSession = jest
      .fn<Promise<'revoked'>, [string]>()
      .mockRejectedValueOnce(new ClerkProviderUnavailableError())
      .mockResolvedValue('revoked');
    const cutoff = (
      await pool.query<{ requested_at: Date }>(
        'select requested_at from private.customer_session_commands where id=$1',
        [result.auditReference],
      )
    ).rows[0]?.requested_at;
    const listCustomerSessions = jest.fn().mockResolvedValue([
      { id: 'sess_original', createdAt: new Date(1000) },
      { id: 'sess_after_command', createdAt: new Date(Date.now() + 60000) },
      { id: 'sess_uncertain_same_millisecond', createdAt: cutoff },
    ]);
    const worker = new CustomerSessionRevoker(new CustomerAdminRepository(pool), {
      revokeSession,
      listCustomerSessions,
    } as unknown as ClerkClientService);
    await worker.process(String(result.auditReference));
    expect(
      (
        await pool.query(
          'select status,session_ids from private.customer_session_commands where id=$1',
          [result.auditReference],
        )
      ).rows[0],
    ).toEqual({ status: 'failed', session_ids: ['sess_original'] });
    await pool.query(
      "update private.customer_session_commands set retry_at=clock_timestamp()-interval '1 second' where id=$1",
      [result.auditReference],
    );
    await worker.process(String(result.auditReference));
    expect(listCustomerSessions).toHaveBeenCalledTimes(1);
    expect(revokeSession.mock.calls).toEqual([['sess_original'], ['sess_original']]);
    expect(
      (
        await pool.query('select status from private.customer_session_commands where id=$1', [
          result.auditReference,
        ])
      ).rows[0],
    ).toEqual({ status: 'completed' });
  });
  it('denies raw API access and never reactivates deleted customers', async () => {
    await pool.withClient(async (client) => {
      await client.query('begin');
      try {
        await client.query('set local role masarifi_api');
        await expect(
          client.query('select * from private.customer_session_commands'),
        ).rejects.toThrow('permission denied');
      } finally {
        await client.query('rollback');
      }
    });
    const deleted = `user_deleted_${randomUUID()}`;
    await pool.query('insert into public.profiles(id) values($1)', [deleted]);
    await pool.query(
      "update public.profiles set status='deleted',deleted_at=clock_timestamp() where id=$1",
      [deleted],
    );
    await expect(
      call(actor, 'reactivate', {
        userId: deleted,
        reason: 'Deleted cannot reactivate',
        key: randomUUID(),
      }),
    ).rejects.toThrow('CUSTOMER_STATE_CONFLICT');
  });
  it('revokes only an owned web device and its push token without leaking its session', async () => {
    const device = randomUUID();
    const fingerprint = `h1:${randomUUID().replaceAll('-', '').repeat(2)}`;
    await pool.query(
      "insert into public.user_devices(id,user_id,device_fingerprint,platform,app_version,clerk_session_id) values($1,$2,$3,'web','1.0','sess_device_private')",
      [device, customer, fingerprint],
    );
    await pool.query(
      "insert into public.push_tokens(user_id,device_id,token_hash,token_ciphertext,provider) values($1,$2,$3,$4,'expo')",
      [customer, device, fingerprint, `v1.test.${'a'.repeat(16)}.${'b'.repeat(22)}.cc`],
    );
    const list = await call(actor, 'list', { query: customer });
    expect((list.items as Array<Record<string, unknown>>)[0]).toMatchObject({
      webDeviceCount: 1,
      totalDeviceCount: 1,
      registeredPlatforms: ['web'],
    });
    const devices = await call(actor, 'devices', { userId: customer });
    expect(JSON.stringify(devices)).not.toContain('sess_device_private');
    await expect(
      call(actor, 'revoke-device', {
        userId: actor,
        deviceId: device,
        reason: 'Wrong customer device revoke',
        key: randomUUID(),
      }),
    ).rejects.toThrow('ADMIN_CUSTOMER_LIFECYCLE_DENIED');
    const other = `user_other_${randomUUID()}`;
    await pool.query('insert into public.profiles(id) values($1)', [other]);
    await expect(
      call(actor, 'revoke-device', {
        userId: other,
        deviceId: device,
        reason: 'Cross customer device revoke',
        key: randomUUID(),
      }),
    ).rejects.toThrow('CUSTOMER_DEVICE_NOT_FOUND');
    const result = await call(actor, 'revoke-device', {
      userId: customer,
      deviceId: device,
      reason: 'Revoke owned device safely',
      key: randomUUID(),
    });
    expect(result).toMatchObject({ action: 'revoke-device', providerStatus: 'pending' });
    expect(
      (await pool.query('select revoked_at from public.push_tokens where device_id=$1', [device]))
        .rows[0]?.revoked_at,
    ).not.toBeNull();
    await pool.query(
      "update public.user_devices set revoked_at=null,clerk_session_id='sess_later_registration' where id=$1",
      [device],
    );
    const revokeSession = jest.fn<Promise<'revoked'>, [string]>().mockResolvedValue('revoked');
    await new CustomerSessionRevoker(new CustomerAdminRepository(pool), {
      revokeSession,
    } as unknown as ClerkClientService).process(String(result.auditReference));
    expect(revokeSession).toHaveBeenCalledWith('sess_device_private');
    expect(
      (await pool.query('select clerk_session_id from public.user_devices where id=$1', [device]))
        .rows[0]?.clerk_session_id,
    ).toBe('sess_later_registration');
  });
  it('removes private customer command payloads after account deletion', async () => {
    const owner = `user_erasure_${randomUUID()}`;
    await pool.query('insert into public.profiles(id) values($1)', [owner]);
    await call(actor, 'revoke-sessions', {
      userId: owner,
      reason: 'Command before account erasure',
      key: randomUUID(),
      scope: 'all',
      sessionIds: [],
    });
    const clerk = {
      revokeUserSessions: jest.fn().mockResolvedValue([]),
      deleteIdentityUser: jest.fn().mockResolvedValue('deleted'),
    } as unknown as ClerkClientService;
    await new IdentityPrivacyHandler(pool, clerk).deleteAccount({
      userId: owner,
      requestId: randomUUID(),
      evidenceAt: new Date(),
      correlationId: randomUUID(),
    });
    expect(
      (
        await pool.query(
          'select count(*)::int n from private.customer_session_commands where user_id=$1',
          [owner],
        )
      ).rows[0]?.n,
    ).toBe(0);
  });
  it('serves actual SQL projections over HTTP and rejects stale-login and unsupported commands', async () => {
    const repository = new CustomerAdminRepository(pool);
    const clerk = {
      getIdentityUser: jest.fn().mockResolvedValue({ id: customer, primaryEmailVerified: true }),
      listCustomerSessions: jest.fn().mockResolvedValue([]),
    } as unknown as ClerkClientService;
    const service = new CustomerAdminService(repository, clerk, {
      get: () => 600,
    } as unknown as PlatformConfigService);
    const module = await Test.createTestingModule({
      controllers: [CustomerAdminController],
      providers: [{ provide: CustomerAdminService, useValue: service }],
    })
      .overrideGuard(AdminAuthGuard)
      .useValue({
        canActivate: (context: {
          switchToHttp: () => {
            getRequest: () => { headers: Record<string, string>; clerkPrincipal: unknown };
          };
        }) => {
          const req = context.switchToHttp().getRequest();
          req.clerkPrincipal = {
            userId: req.headers['x-test-actor'] ?? actor,
            sessionId: 'test',
            factorAgeSeconds: Number(req.headers['x-test-age'] ?? 0),
          };
          return true;
        },
      })
      .compile();
    const app = module.createNestApplication();
    await app.init();
    const server = app.getHttpServer() as Parameters<typeof request>[0];
    try {
      const list = await request(server)
        .get('/api/v1/admin/users')
        .query({ query: customer })
        .expect(200);
      expect(list.body as unknown).toMatchObject({
        items: [expect.objectContaining({ id: customer })],
      });
      await request(server)
        .get('/api/v1/admin/users')
        .query({ registeredFrom: '2026-02-31' })
        .expect(400);
      const detail = await request(server).get(`/api/v1/admin/users/${customer}`).expect(200);
      expect(detail.body as unknown).toMatchObject({
        verification: 'verified',
        aggregates: { accountsCount: null },
      });
      await request(server).get('/api/v1/admin/users').set('x-test-actor', customer).expect(403);
      await request(server)
        .post(`/api/v1/admin/users/${customer}/suspend`)
        .set('Idempotency-Key', randomUUID())
        .set('x-test-age', '601')
        .send({ reason: 'HTTP security regression' })
        .expect(403);
      await request(server)
        .post(`/api/v1/admin/users/${customer}/suspend`)
        .set('Idempotency-Key', randomUUID())
        .send({ reason: 'HTTP security regression', notifyUser: true })
        .expect(400);
    } finally {
      await app.close();
    }
  });
  it('queues provider work using an API-only database session without assuming the worker role', async () => {
    const apiPool = new PoolService({
      get: (key: string) =>
        key === 'DATABASE_URL'
          ? process.env.DATABASE_URL
          : key === 'MASARIFI_DATABASE_POOL_MAX'
            ? 1
            : undefined,
    } as unknown as PlatformConfigService);
    try {
      await apiPool.query('set session authorization masarifi_api');
      expect(
        (await apiPool.query<{ role: string }>('select session_user as role')).rows[0]?.role,
      ).toBe('masarifi_api');
      const repository = new CustomerAdminRepository(apiPool);
      const clerk = {} as ClerkClientService;
      const service = new CustomerAdminService(repository, clerk, {
        get: () => 600,
      } as unknown as PlatformConfigService);
      await expect(
        service.mutate(
          { userId: actor, sessionId: 'test', factorAgeSeconds: 0 },
          'revoke-sessions',
          { reason: 'API queues worker effects', scope: 'all', sessionIds: [] },
          customer,
          randomUUID(),
        ),
      ).resolves.toMatchObject({ providerStatus: 'pending', outcome: 'partial' });
    } finally {
      await apiPool.onModuleDestroy();
    }
  });
});
