import { randomUUID } from 'node:crypto';
import { hashNormalizedCommand } from '../../../src/ledger/idempotency';
import type { PoolService } from '../../../src/platform/database/pool.service';
import { SecurityService } from '../../../src/security/security.service';
import { SecurityRepository } from '../../../src/security/security.repository';
import { createLivePool, describeLiveDatabase } from '../../live-database';

describeLiveDatabase('security durable mutation replay', () => {
  let pool: PoolService;
  let repository: SecurityRepository;
  const actor = `security_replay_${randomUUID()}`;
  const customer = `security_customer_${randomUUID()}`;
  beforeAll(async () => {
    pool = createLivePool();
    repository = new SecurityRepository(pool);
    await pool.query(`insert into public.profiles(id,status) values ($1,'active'),($2,'active')`, [
      actor,
      customer,
    ]);
    await pool.query(`insert into public.admin_profiles(user_id,status) values ($1,'active')`, [
      actor,
    ]);
    await pool.query(
      `insert into public.admin_role_assignments(user_id,role_id,assigned_by,reason)
      select $1,id,$1,'Security replay regression' from public.roles where key='super-admin'`,
      [actor],
    );
  });
  afterAll(async () => pool.onModuleDestroy());
  function command(
    operation: string,
    permission: string,
    body: Record<string, unknown>,
    key: string,
  ) {
    return {
      operation,
      permission,
      body,
      idempotencyKey: key,
      params: {},
      query: {},
      principal: { userId: actor, sessionId: 'replay_session', factorAgeSeconds: 0 },
      requestId: randomUUID(),
    };
  }
  it.each([
    ['createSecurityIncident', 'security.incidents.manage'],
    ['createSupportAccessRequest', 'support.access.request'],
    ['createRole', 'access.roles.write'],
  ])(
    'replays concurrent %s with one durable record and rejects changed command',
    async (operation, permission) => {
      const suffix = randomUUID();
      const body =
        operation === 'createSecurityIncident'
          ? { title: `Replay ${suffix}`, severity: 'low', detectedAt: '2026-10-23T00:00:00Z' }
          : operation === 'createRole'
            ? {
                key: `replay-${suffix}`,
                name: 'Replay reviewer',
                permissionKeys: ['audit.read'],
                reason: 'Replay regression request',
              }
            : {
                userId: customer,
                assignee: actor,
                supportTicketId: `replay-${suffix}`,
                purpose: 'Replay regression request',
                resourceScopes: [{ resource: 'account-status', actions: ['read-status'] }],
                customerApprovalRequired: true,
                durationMinutes: 30,
              };
      const input = command(operation, permission, body, suffix);
      const [first, second] = await Promise.all([
        repository.execute(input),
        repository.execute({ ...input, requestId: randomUUID() }),
      ]);
      expect(JSON.parse(JSON.stringify(second))).toEqual(JSON.parse(JSON.stringify(first)));
      await expect(
        repository.execute({
          ...input,
          body: {
            ...body,
            ...(operation === 'createSecurityIncident'
              ? { title: 'Changed incident' }
              : operation === 'createRole'
                ? { name: 'Changed role' }
                : { purpose: 'Changed support purpose' }),
          },
        }),
      ).rejects.toMatchObject({ code: 'IDEMPOTENCY_KEY_REUSED' });
    },
  );
  it('checks permissions before serving a completed replay', async () => {
    const input = command(
      'createSecurityIncident',
      'security.incidents.manage',
      { title: 'Permission replay', severity: 'low', detectedAt: '2026-10-23T00:00:00Z' },
      randomUUID(),
    );
    await repository.execute(input);
    await expect(
      repository.execute({ ...input, principal: { ...input.principal, userId: customer } }),
    ).rejects.toMatchObject({ code: '42501' });
  });
  it.each([
    ['listPrivacyExports', 'privacy.exports.read'],
    ['listDeletionRequests', 'privacy.deletions.read'],
    ['listRetentionPolicies', 'retention.read'],
  ])('bounds %s detail lookup by server-side id', async (operation, permission) => {
    const service = new SecurityService(
      repository,
      { get: () => undefined, getRequired: () => 300 } as never,
      {} as never,
      {} as never,
      {} as never,
    );
    const input = command(operation, permission, {}, randomUUID());
    await expect(
      service.execute({
        ...input,
        idempotencyKey: undefined,
        query: { id: randomUUID(), limit: '1' },
      }),
    ).resolves.toEqual({ items: [], nextCursor: null });
  });
  it('replays a delivered invitation without generating a second external delivery', async () => {
    const role = (
      await pool.query<{ id: string }>("select id from public.roles where key='support-agent'")
    ).rows[0];
    const clerk = { deliverAdminInvitation: jest.fn(() => Promise.resolve(undefined)) };
    const service = new SecurityService(
      repository,
      { get: () => undefined, getRequired: () => 300 } as never,
      clerk as never,
      {} as never,
      {} as never,
    );
    const input = command(
      'createAdminInvitation',
      'access.invites.write',
      {
        email: `replay-${randomUUID()}@example.test`,
        name: 'Replay reviewer',
        roleId: role?.id,
        department: 'Support',
        expiresInHours: 24,
      },
      randomUUID(),
    );
    const first = await service.execute({ ...input, body: { ...input.body } });
    await expect(
      service.execute({ ...input, body: { ...input.body }, requestId: randomUUID() }),
    ).resolves.toEqual(JSON.parse(JSON.stringify(first)));
    expect(clerk.deliverAdminInvitation).toHaveBeenCalledTimes(1);
  });
  it('replays a failed invitation as unavailable without redelivering a different token', async () => {
    const role = (
      await pool.query<{ id: string }>("select id from public.roles where key='support-agent'")
    ).rows[0];
    const clerk = {
      deliverAdminInvitation: jest.fn(() => Promise.reject(new Error('network timeout'))),
    };
    const service = new SecurityService(
      repository,
      { get: () => undefined, getRequired: () => 300 } as never,
      clerk as never,
      {} as never,
      {} as never,
    );
    const input = command(
      'createAdminInvitation',
      'access.invites.write',
      {
        email: `replay-${randomUUID()}@example.test`,
        name: 'Replay reviewer',
        roleId: role?.id,
        department: 'Support',
        expiresInHours: 24,
      },
      randomUUID(),
    );
    await expect(service.execute({ ...input, body: { ...input.body } })).rejects.toMatchObject({
      response: { code: 'PROVIDER_UNAVAILABLE' },
    });
    await expect(service.execute({ ...input, body: { ...input.body } })).rejects.toMatchObject({
      response: { code: 'PROVIDER_UNAVAILABLE' },
    });
    expect(clerk.deliverAdminInvitation).toHaveBeenCalledTimes(1);
  });

  it('does not repeat revoke-all against sessions created after a completed command', async () => {
    const clerk = { revokeUserSessions: jest.fn(() => Promise.resolve(['original-session'])) };
    const service = new SecurityService(
      repository,
      { get: () => undefined, getRequired: () => 300 } as never,
      clerk as never,
      {} as never,
      {} as never,
    );
    const input = {
      ...command(
        'revokeAdminSessions',
        'admin-team.sessions.revoke',
        {
          revokeAllEligible: true,
          expectedVersion: 1,
          reason: 'Revoke compromised sessions',
        },
        randomUUID(),
      ),
      params: { userId: actor },
    };
    const first = await service.execute(input);
    clerk.revokeUserSessions.mockResolvedValue(['later-session']);
    await expect(service.execute(input)).resolves.toEqual(JSON.parse(JSON.stringify(first)));
    expect(clerk.revokeUserSessions).toHaveBeenCalledTimes(1);
    await expect(
      service.execute({ ...input, body: { ...input.body, reason: 'Different security command' } }),
    ).rejects.toMatchObject({ response: { code: 'IDEMPOTENCY_KEY_REUSED' } });
  });
  it('reports ambiguous pending provider outcomes without a second external effect', async () => {
    const clerk = { revokeUserSessions: jest.fn(() => Promise.resolve(['later-session'])) };
    const service = new SecurityService(
      repository,
      { get: () => undefined, getRequired: () => 300 } as never,
      clerk as never,
      {} as never,
      {} as never,
    );
    const input = {
      ...command(
        'revokeAdminSessions',
        'admin-team.sessions.revoke',
        {
          revokeAllEligible: true,
          expectedVersion: 1,
          reason: 'Revoke compromised sessions',
        },
        randomUUID(),
      ),
      params: { userId: actor },
    };
    await repository.executeProviderMutation(
      {
        ...input,
        commandHash: hashNormalizedCommand({
          operation: input.operation,
          body: input.body,
          params: input.params,
        }),
      },
      () => input.body,
    );
    await expect(service.execute(input)).rejects.toMatchObject({
      response: { code: 'PROVIDER_UNAVAILABLE' },
    });
    expect(clerk.revokeUserSessions).not.toHaveBeenCalled();
  });
  it('keeps local disable authoritative while reporting failed revocation on equal retries', async () => {
    const target = `disable_target_${randomUUID()}`;
    await pool.query("insert into public.profiles(id,status) values($1,'active')", [target]);
    await pool.query("insert into public.admin_profiles(user_id,status) values($1,'active')", [
      target,
    ]);
    const clerk = {
      revokeUserSessions: jest.fn(() => Promise.reject(new Error('uncertain timeout'))),
    };
    const service = new SecurityService(
      repository,
      { get: () => undefined, getRequired: () => 300 } as never,
      clerk as never,
      {} as never,
      {} as never,
    );
    const input = {
      ...command(
        'disableAdmin',
        'admin-team.disable',
        {
          revokeEligibleSessions: true,
          expectedVersion: 1,
          reason: 'Disable compromised account',
        },
        randomUUID(),
      ),
      params: { userId: target },
    };
    await expect(service.execute(input)).rejects.toMatchObject({
      response: { code: 'PROVIDER_UNAVAILABLE' },
    });
    await expect(service.execute(input)).rejects.toMatchObject({
      response: { code: 'PROVIDER_UNAVAILABLE' },
    });
    expect(
      (await pool.query('select status from public.admin_profiles where user_id=$1', [target]))
        .rows[0]?.status,
    ).toBe('suspended');
    expect(clerk.revokeUserSessions).toHaveBeenCalledTimes(1);
  });
  it('denies unknown operations, forged principals and raw replay/provider-table access', async () => {
    const keyHash = `sha256:${'a'.repeat(64)}`;
    const principal = { userId: actor, sessionId: 'test', factorAgeSeconds: 0 };
    await expect(
      repository.withPrincipalTransaction(principal, async (client) => {
        await client.query(
          "select * from private.claim_security_idempotency($1,'security.unknown',$2,$2,'2 minutes')",
          [actor, keyHash],
        );
      }),
    ).rejects.toMatchObject({ code: '42501' });
    await expect(
      repository.withPrincipalTransaction(principal, async (client) => {
        await client.query(
          "select * from private.claim_security_idempotency($1,'security.createrole',$2,$2,'2 minutes')",
          [customer, keyHash],
        );
      }),
    ).rejects.toMatchObject({ code: '42501' });
    for (const table of ['idempotency_keys', 'security_provider_outcomes']) {
      await expect(
        repository.withPrincipalTransaction(principal, async (client) => {
          await client.query(`select * from private.${table}`);
        }),
      ).rejects.toMatchObject({ code: '42501' });
    }
  });
  it('preserves failed audit outcomes in list and detail projections', async () => {
    const event = (
      await pool.query<{ id: string }>(
        `select audit.append_event($1,'admin','recovery.failed','recovery',null,null,null,'Audit result regression',$2,'{"result":"failure"}') id`,
        [actor, randomUUID()],
      )
    ).rows[0];
    const service = new SecurityService(
      repository,
      { get: () => undefined, getRequired: () => 300 } as never,
      {} as never,
      {} as never,
      {} as never,
    );
    if (!event) throw new Error('Audit fixture missing');
    const input = {
      ...command('getAuditEvent', 'audit.read', {}, randomUUID()),
      idempotencyKey: undefined,
      params: { eventId: event.id },
    };
    await expect(service.execute(input)).resolves.toMatchObject({ result: 'failure' });
    const page = (await service.execute({
      ...input,
      operation: 'listAuditEvents',
      params: {},
      query: { actor, result: 'failure' },
    })) as { items: Array<{ id: string; result: string }> };
    expect(page.items).toContainEqual(expect.objectContaining({ id: event.id, result: 'failure' }));
  });
  it('requires separate approval and customer consent and denies expired or revoked workspace access', async () => {
    const approver = `approver_${randomUUID()}`;
    await pool.query("insert into public.profiles(id,status) values($1,'active')", [approver]);
    await pool.query("insert into public.admin_profiles(user_id,status) values($1,'active')", [
      approver,
    ]);
    await pool.query(
      "insert into public.admin_role_assignments(user_id,role_id,assigned_by,reason) select $1,id,$1,'Support access regression' from public.roles where key='super-admin'",
      [approver],
    );
    const created = (await repository.execute(
      command(
        'createSupportAccessRequest',
        'support.access.request',
        {
          userId: customer,
          assignee: actor,
          supportTicketId: randomUUID(),
          purpose: 'Read account status with consent',
          resourceScopes: [{ resource: 'account-status', actions: ['read-status'] }],
          customerApprovalRequired: true,
          durationMinutes: 30,
        },
        randomUUID(),
      ),
    )) as { id: string; version: number };
    const workspace = {
      ...command('getSupportWorkspace', 'support.access.use', {}, randomUUID()),
      idempotencyKey: undefined,
      params: { requestId: created.id },
    };
    await expect(repository.execute(workspace)).rejects.toMatchObject({ code: '42501' });
    const approve = {
      ...command(
        'decideSupportAccessRequest',
        'support.access.approve',
        {
          decision: 'approve',
          expectedVersion: created.version,
          reason: 'Approve limited status support',
        },
        randomUUID(),
      ),
      params: { requestId: created.id },
    };
    await expect(repository.execute(approve)).rejects.toMatchObject({ code: 'P0002' });
    await expect(
      repository.execute({ ...approve, principal: { ...approve.principal, userId: approver } }),
    ).rejects.toMatchObject({ code: '23514' });
    const consent = (await repository.execute({
      ...command(
        'decideMySupportAccessRequest',
        '',
        { decision: 'approve', expectedVersion: created.version },
        randomUUID(),
      ),
      permission: undefined,
      principal: { ...workspace.principal, userId: customer },
      params: { requestId: created.id },
    })) as { version: number };
    const approved = (await repository.execute({
      ...approve,
      principal: { ...approve.principal, userId: approver },
      body: { ...approve.body, expectedVersion: consent.version },
    })) as { version: number };
    await expect(repository.execute(workspace)).resolves.toMatchObject({
      sections: [{ resource: 'account-status', status: 'active' }],
    });
    await pool.query(
      "update private.support_access_grants set ends_at=clock_timestamp()+interval '20 milliseconds' where request_id=$1",
      [created.id],
    );
    await new Promise((resolve) => setTimeout(resolve, 50));
    await expect(repository.execute(workspace)).rejects.toMatchObject({ code: '42501' });
    const service = new SecurityService(
      repository,
      { get: () => undefined, getRequired: () => 300 } as never,
      {} as never,
      {} as never,
      {} as never,
    );
    const revoked = await service.execute({
      ...command(
        'revokeSupportAccess',
        'support.access.revoke',
        { expectedVersion: approved.version, reason: 'End limited support access' },
        randomUUID(),
      ),
      params: { requestId: created.id },
    });
    expect(revoked).toMatchObject({
      status: 'revoked',
      user: { id: customer, kind: 'customer' },
      assignee: { id: actor, kind: 'admin' },
    });
    await expect(repository.execute(workspace)).rejects.toMatchObject({ code: '42501' });
  });
});
