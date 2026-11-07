import { randomUUID } from 'node:crypto';
import { SecurityRepository } from '../../../src/security/security.repository';
import { SecurityService } from '../../../src/security/security.service';
import { createLivePool, describeLiveDatabase } from '../../live-database';

interface SupportRequest {
  id: string;
  version: number;
  status: string;
  createdAt: Date;
  purpose: string;
  decidedAt: Date | null;
  requestedDurationMinutes: number;
  expiresAt: Date;
  supportTicketId: string;
  customerApprovedAt: Date | null;
  approvedBy: { id: string; kind: string; label: string } | null;
  grant: {
    id: string;
    scopes: Array<{ resource: string; actions: string[] }>;
    startsAt: string;
    expiresAt: string;
    revokedAt: string | null;
  } | null;
}

describeLiveDatabase('support-access review projections', () => {
  const pool = createLivePool();
  const requester = `projection_requester_${randomUUID()}`;
  const approver = `projection_approver_${randomUUID()}`;
  const customer = `projection_customer_${randomUUID()}`;
  const unrelated = `projection_unrelated_${randomUUID()}`;
  const operator = `projection_operator_${randomUUID()}`;
  const otherOperator = `projection_other_operator_${randomUUID()}`;
  const service = new SecurityService(
    new SecurityRepository(pool),
    { get: () => undefined, getRequired: () => 300 } as never,
    {} as never,
    {} as never,
    {} as never,
  );
  const scopes = [
    { resource: 'account-status', actions: ['read-status'] },
    { resource: 'device-diagnostics', actions: ['read-masked'] },
  ];
  const purpose = 'Review account status with customer consent';

  async function call<T = SupportRequest>(
    userId: string,
    operation: string,
    body: Record<string, unknown> = {},
    requestId?: string,
    query: Record<string, string> = {},
  ): Promise<T> {
    const permission =
      operation.startsWith('listMy') || operation.startsWith('decideMy')
        ? undefined
        : operation === 'createSupportAccessRequest'
          ? 'support.access.request'
          : operation === 'decideSupportAccessRequest'
            ? 'support.access.approve'
            : operation === 'revokeSupportAccess'
              ? 'support.access.revoke'
              : operation === 'endSupportAccess' || operation === 'getSupportWorkspace'
                ? 'support.access.use'
                : 'support.access.read';
    return (await service.execute({
      operation,
      permission,
      principal: { userId, sessionId: 'support-projection', factorAgeSeconds: 0, mfaAgeSeconds: 0 },
      body,
      query,
      params: requestId ? { requestId } : {},
      requestId: randomUUID(),
      idempotencyKey: /^(list|get)/.test(operation) ? undefined : randomUUID(),
    })) as T;
  }

  async function create(customerApprovalRequired = true) {
    return call(requester, 'createSupportAccessRequest', {
      userId: customer,
      assignee: requester,
      supportTicketId: randomUUID(),
      purpose,
      resourceScopes: scopes,
      durationMinutes: 45,
      customerApprovalRequired,
    });
  }

  beforeAll(async () => {
    await pool.query('insert into public.profiles(id) values($1),($2),($3),($4),($5),($6)', [
      requester,
      approver,
      customer,
      unrelated,
      operator,
      otherOperator,
    ]);
    for (const admin of [requester, approver]) {
      await pool.query("insert into public.admin_profiles(user_id,status) values($1,'active')", [
        admin,
      ]);
      await pool.query(
        "insert into public.admin_role_assignments(user_id,role_id,assigned_by,reason) select $1,id,$1,'Support projection regression' from public.roles where key='super-admin'",
        [admin],
      );
    }
    const useRole = randomUUID();
    await pool.query('insert into public.roles(id,key,name) values($1,$2,$3)', [
      useRole,
      `support-use-${randomUUID()}`,
      'Use-only support regression',
    ]);
    await pool.query(
      "insert into public.role_permissions(role_id,permission_id) select $1,id from public.permissions where key='support.access.use'",
      [useRole],
    );
    for (const admin of [operator, otherOperator]) {
      await pool.query("insert into public.admin_profiles(user_id,status) values($1,'active')", [
        admin,
      ]);
      await pool.query(
        "insert into public.admin_role_assignments(user_id,role_id,assigned_by,reason) values($1,$2,$3,'Use-only support regression')",
        [admin, useRole, requester],
      );
    }
  });
  afterAll(async () => pool.onModuleDestroy());

  it('returns actual review timestamps and grant scope across creation, consent, list, detail, approval and revocation', async () => {
    const created = await create();
    const stored = (
      await pool.query<{ createdAt: Date; expiresAt: Date }>(
        'select created_at as "createdAt",expires_at as "expiresAt" from private.support_access_requests where id=$1',
        [created.id],
      )
    ).rows[0];
    expect(created).toMatchObject({
      status: 'pending',
      createdAt: stored?.createdAt,
      purpose,
      decidedAt: null,
      requestedDurationMinutes: 45,
      expiresAt: stored?.expiresAt,
      approvedBy: null,
      grant: null,
    });
    const listed = await call<{ items: SupportRequest[] }>(
      requester,
      'listSupportAccessRequests',
      {},
      undefined,
      { status: 'pending', assignee: requester, search: created.id },
    );
    // Search is ticket/owner based; an unrelated request ID must not broaden it.
    expect(listed.items).toEqual([]);
    const ownerPage = await call<{ items: SupportRequest[] }>(
      customer,
      'listMySupportAccessRequests',
    );
    expect(ownerPage.items).toContainEqual(
      expect.objectContaining({
        id: created.id,
        createdAt: stored?.createdAt,
        purpose,
        requestedDurationMinutes: 45,
        grant: null,
      }),
    );
    await expect(call(unrelated, 'listMySupportAccessRequests')).resolves.toMatchObject({
      items: [],
    });
    const consent = await call(
      customer,
      'decideMySupportAccessRequest',
      {
        decision: 'approve',
        expectedVersion: created.version,
      },
      created.id,
    );
    expect(consent).toMatchObject({ purpose, decidedAt: null, approvedBy: null, grant: null });
    expect(consent.customerApprovedAt).toBeInstanceOf(Date);
    const startsAt = new Date(Date.now() + 60_000).toISOString();
    const approved = await call(
      approver,
      'decideSupportAccessRequest',
      {
        decision: 'approve',
        expectedVersion: consent.version,
        reason: 'Approve limited account status review',
        approvedScope: [{ resource: 'account-status', actions: ['read-status'] }],
        durationMinutes: 10,
        startsAt,
      },
      created.id,
    );
    expect(approved).toMatchObject({
      status: 'approved',
      purpose,
      createdAt: stored?.createdAt,
      requestedDurationMinutes: 45,
      expiresAt: stored?.expiresAt,
      approvedBy: { id: approver, kind: 'admin', label: `admin ${approver.slice(-6)}` },
      grant: {
        scopes: [{ resource: 'account-status', actions: ['read-status'] }],
        revokedAt: null,
      },
    });
    expect(approved.decidedAt).toBeInstanceOf(Date);
    expect(new Date(approved.grant?.startsAt ?? '').toISOString()).toBe(startsAt);
    expect(Date.parse(approved.grant?.expiresAt ?? '') - Date.parse(startsAt)).toBe(600_000);
    expect(Date.parse(approved.grant?.expiresAt ?? '')).toBeLessThan(created.expiresAt.getTime());

    await pool.query(
      `insert into private.support_access_grants(request_id,admin_id,scope,starts_at,ends_at,created_at,revoked_at)
       select r.id,r.assignee,r.scope,$2::timestamptz,$3::timestamptz,r.created_at,clock_timestamp()
       from private.support_access_requests r where r.id=$1`,
      [created.id, startsAt, approved.grant?.expiresAt],
    );
    const detail = await call(requester, 'getSupportAccessRequest', {}, created.id);
    expect(detail.grant?.id).toBe(approved.grant?.id);
    const approvedPage = await call<{ items: SupportRequest[] }>(
      requester,
      'listSupportAccessRequests',
      {},
      undefined,
      { status: 'approved', assignee: requester },
    );
    expect(approvedPage.items.filter(({ id }) => id === created.id)).toEqual([detail]);
    const customerPage = await call<{ items: SupportRequest[] }>(
      customer,
      'listMySupportAccessRequests',
    );
    expect(customerPage.items.find(({ id }) => id === created.id)?.grant).toBeNull();

    const revoked = await call(
      requester,
      'revokeSupportAccess',
      {
        expectedVersion: approved.version,
        reason: 'End approved account status review',
      },
      created.id,
    );
    expect(revoked).toMatchObject({
      status: 'revoked',
      purpose,
      createdAt: stored?.createdAt,
      requestedDurationMinutes: 45,
      approvedBy: approved.approvedBy,
      grant: {
        id: approved.grant?.id,
        scopes: [{ resource: 'account-status', actions: ['read-status'] }],
      },
    });
    expect(Number.isFinite(Date.parse(revoked.grant?.revokedAt ?? ''))).toBe(true);
  });

  it.each(['deny', 'end'] as const)('returns the same review metadata after %s', async (action) => {
    const created = await create(false);
    const decision = await call(
      approver,
      'decideSupportAccessRequest',
      {
        decision: action === 'deny' ? 'deny' : 'approve',
        expectedVersion: created.version,
        reason: 'Review limited support access',
        durationMinutes: 10,
      },
      created.id,
    );
    const completed =
      action === 'deny'
        ? decision
        : await call(
            requester,
            'endSupportAccess',
            {
              expectedVersion: decision.version,
            },
            created.id,
          );
    expect(completed).toMatchObject({
      status: action === 'deny' ? 'denied' : 'revoked',
      purpose,
      createdAt: created.createdAt,
      requestedDurationMinutes: 45,
      expiresAt: created.expiresAt,
      approvedBy: { id: approver, kind: 'admin' },
    });
    expect(completed.decidedAt).toBeInstanceOf(Date);
    if (action === 'deny') expect(completed.grant).toBeNull();
    else expect(Number.isFinite(Date.parse(completed.grant?.revokedAt ?? ''))).toBe(true);
  });

  async function assignedRequest() {
    const created = await call(requester, 'createSupportAccessRequest', {
      userId: customer,
      assignee: operator,
      supportTicketId: randomUUID(),
      purpose,
      resourceScopes: [{ resource: 'account-status', actions: ['read-status'] }],
      durationMinutes: 45,
      customerApprovalRequired: false,
    });
    return call(
      approver,
      'decideSupportAccessRequest',
      {
        decision: 'approve',
        expectedVersion: created.version,
        reason: 'Approve assigned support workspace',
        durationMinutes: 10,
      },
      created.id,
    );
  }

  it('limits a dual-role administrator personal list to requests where that administrator is the customer', async () => {
    const otherCustomerRequest = await create(false);
    const own = await call(requester, 'createSupportAccessRequest', {
      userId: requester,
      assignee: requester,
      supportTicketId: randomUUID(),
      purpose,
      resourceScopes: scopes,
      durationMinutes: 45,
      customerApprovalRequired: false,
    });
    const personal = await call<{ items: SupportRequest[] }>(
      requester,
      'listMySupportAccessRequests',
    );
    expect(personal.items.map(({ id }) => id)).toEqual([own.id]);
    const administrative = await call<{ items: SupportRequest[] }>(
      requester,
      'listSupportAccessRequests',
      {},
      undefined,
      { search: otherCustomerRequest.supportTicketId },
    );
    expect(administrative.items.map(({ id }) => id)).toEqual([otherCustomerRequest.id]);
  });

  it('rejects another use-only assignee end without changing the request, grants or durable receipt', async () => {
    const assigned = await assignedRequest();
    const snapshot = async () =>
      (
        await pool.query<{ state: unknown }>(
          `select jsonb_build_object('status',r.status,'version',r.version,
        'grants',(select jsonb_agg(jsonb_build_object('id',g.id,'revokedAt',g.revoked_at) order by g.id)
          from private.support_access_grants g where g.request_id=r.id),
        'receipts',(select count(*) from private.idempotency_keys where actor_id=$2 and scope='security.endsupportaccess')) as state
       from private.support_access_requests r where r.id=$1`,
          [assigned.id, otherOperator],
        )
      ).rows[0]?.state;
    const before = await snapshot();
    await expect(
      call(
        otherOperator,
        'endSupportAccess',
        {
          expectedVersion: assigned.version,
        },
        assigned.id,
      ),
    ).rejects.toMatchObject({ status: 403 });
    expect(await snapshot()).toEqual(before);
    await expect(
      call(
        approver,
        'revokeSupportAccess',
        {
          expectedVersion: assigned.version,
          reason: 'Global reviewer revokes support access',
        },
        assigned.id,
      ),
    ).resolves.toMatchObject({ status: 'revoked' });
  });

  it('serves exact active-grant metadata to a use-only assignee without exposing review details', async () => {
    const assigned = await assignedRequest();
    await expect(call(operator, 'getSupportAccessRequest', {}, assigned.id)).rejects.toMatchObject({
      status: 403,
    });
    const workspace = await call<{ grantId: string; access: unknown }>(
      operator,
      'getSupportWorkspace',
      {},
      assigned.id,
    );
    expect(workspace.grantId).toBe(assigned.grant?.id);
    expect(workspace.access).toEqual({
      supportTicketId: assigned.supportTicketId,
      assignee: operator,
      startsAt: new Date(assigned.grant?.startsAt ?? '').toISOString(),
      scopes: [{ resource: 'account-status', actions: ['read-status'] }],
      version: assigned.version,
    });
    await expect(call(otherOperator, 'getSupportWorkspace', {}, assigned.id)).rejects.toMatchObject(
      { status: 403 },
    );
    await call(operator, 'endSupportAccess', { expectedVersion: assigned.version }, assigned.id);
    await expect(call(operator, 'getSupportWorkspace', {}, assigned.id)).rejects.toMatchObject({
      status: 403,
    });
  });

  it('rejects use-only workspace access after the customer becomes inactive', async () => {
    const assigned = await assignedRequest();
    await pool.query("update public.profiles set status='suspended' where id=$1", [customer]);
    try {
      await expect(call(operator, 'getSupportWorkspace', {}, assigned.id)).rejects.toMatchObject({
        status: 403,
      });
    } finally {
      await pool.query("update public.profiles set status='active' where id=$1", [customer]);
    }
  });

  it.each(['owner', 'admin'] as const)(
    'allows an awaiting-consent request to be denied by its %s without inventing consent',
    async (actor) => {
      const created = await create(true);
      const denied = await call(
        actor === 'owner' ? customer : approver,
        actor === 'owner' ? 'decideMySupportAccessRequest' : 'decideSupportAccessRequest',
        {
          decision: 'deny',
          expectedVersion: created.version,
          ...(actor === 'admin' ? { reason: 'Deny unapproved support access' } : {}),
        },
        created.id,
      );
      expect(denied).toMatchObject({ status: 'denied', customerApprovedAt: null, grant: null });
    },
  );

  it('still rejects approving an awaiting-consent request without creating a grant', async () => {
    const created = await create(true);
    await expect(
      call(
        approver,
        'decideSupportAccessRequest',
        {
          decision: 'approve',
          expectedVersion: created.version,
          reason: 'Attempt support before consent',
        },
        created.id,
      ),
    ).rejects.toMatchObject({ status: 400 });
    expect((await call(requester, 'getSupportAccessRequest', {}, created.id)).status).toBe(
      'pending',
    );
    expect(
      (
        await pool.query<{ total: number }>(
          'select count(*)::int as total from private.support_access_grants where request_id=$1',
          [created.id],
        )
      ).rows[0]?.total,
    ).toBe(0);
  });
});
