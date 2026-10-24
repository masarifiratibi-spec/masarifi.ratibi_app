import { randomUUID } from 'node:crypto';
import type { Server } from 'node:http';
import { Test } from '@nestjs/testing';
import type { ExecutionContext } from '@nestjs/common';
import request from 'supertest';
import {
  EngagementController,
  EngagementAdminController,
} from '../../../src/engagement/engagement.controller';
import { ClerkAuthGuard } from '../../../src/identity/clerk-auth.guard';
import { AdminAuthGuard } from '../../../src/security/admin-auth.guard';
import { EngagementRepository } from '../../../src/engagement/engagement.repository';
import { EngagementService } from '../../../src/engagement/engagement.service';
import { validateEngagementCommand } from '../../../src/engagement/engagement.dto';
import { ENGAGEMENT_ADMIN_ROUTES } from '../../../src/engagement/engagement.routes';
import type { PlatformConfigService } from '../../../src/platform/config/platform-config.service';
import type { SecurityRepository } from '../../../src/security/security.repository';
import type { SupportStorage } from '../../../src/engagement/support.storage';
import { createLivePool, describeLiveDatabase } from '../../live-database';

interface TestTicket {
  id: string;
  version: number;
  status: string;
  customerReference: string;
  assignedAdminId: string | null;
  messages: Array<{ id: string; body: string }>;
  internalNotes: Array<{ body: string }>;
  nextCursor: string | null;
}
interface TestPage {
  items: Array<{ id: string }>;
  totalItems: number;
  nextCursor: string | null;
}
interface TestWorkload {
  total: number;
  unassigned: number;
  byStatus: Record<string, number>;
}

test('support recovery exposes an exact-permission download route and validates server filters', () => {
  expect(ENGAGEMENT_ADMIN_ROUTES).toContainEqual(
    expect.objectContaining({
      operation: 'adminDownloadSupportAttachment',
      path: 'admin/support/tickets/:ticketId/attachments/:attachmentId/download',
      permission: 'support.tickets.detail.read',
    }),
  );
  const command = {
    operation: 'adminListSupportTickets',
    requestId: 'test',
    query: {
      query: 'Need help',
      priority: 'high',
      assignee: 'unassigned',
      categoryId: randomUUID(),
      from: '2026-01-01',
      to: '2026-10-23',
      limit: 25,
    },
  };
  expect(() => validateEngagementCommand(command)).not.toThrow();
  for (const query of [
    { priority: 'fake' },
    { from: '2026-02-30' },
    { assignee: [] },
    { platform: 'ios' },
  ])
    expect(() => validateEngagementCommand({ ...command, query })).toThrow();
});

describeLiveDatabase('support recovery', () => {
  const pool = createLivePool();
  const actor = `support_admin_${randomUUID()}`;
  const customer = `support_owner_${randomUUID()}`;
  const category = randomUUID();
  const signDownload = jest.fn().mockResolvedValue({
    url: 'https://storage.test/signed',
    expiresAt: new Date(Date.now() + 60000).toISOString(),
  });
  const repository = new EngagementRepository(pool, {
    getRequired: (key: string) =>
      key === 'MASARIFI_MOBILE_AUTOMATION_ENABLED'
        ? false
        : key === 'MASARIFI_SUPPORT_REOPEN_HOURS'
          ? 48
          : 100,
  } as unknown as PlatformConfigService);
  const service = new EngagementService(
    repository,
    { signDownload } as unknown as SupportStorage,
    { consumeRateLimit: () => Promise.resolve(true) } as unknown as SecurityRepository,
  );
  async function call<T = TestTicket>(
    userId: string,
    operation: string,
    body?: Record<string, unknown>,
    params?: Record<string, string>,
    query?: Record<string, unknown>,
  ) {
    return (await service.execute(
      { userId, sessionId: 'test', factorAgeSeconds: 10 },
      {
        operation,
        body,
        params: params ?? {},
        query,
        requestId: randomUUID(),
        idempotencyKey: body ? randomUUID() : undefined,
      },
    )) as T;
  }
  beforeAll(async () => {
    await pool.query('insert into public.profiles(id) values($1),($2)', [actor, customer]);
    await pool.query("insert into public.admin_profiles(user_id,status) values($1,'active')", [
      actor,
    ]);
    await pool.query(
      "insert into public.admin_role_assignments(user_id,role_id,assigned_by,reason) select $1,id,$1,'Support recovery regression' from public.roles where key='super-admin'",
      [actor],
    );
    await pool.query('insert into public.support_categories(id,key,name) values($1,$2,$3)', [
      category,
      `recovery-${randomUUID()}`,
      'Recovery',
    ]);
  });
  afterAll(async () => pool.onModuleDestroy());

  it('runs the customer/admin conversation, assignments, private notes and lifecycle with conflicts', async () => {
    const created = await call(customer, 'createSupportTicket', {
      categoryId: category,
      subject: 'Need help',
      message: 'Please help with my ticket',
    });
    const params = { ticketId: created.id };
    let detail = await call(actor, 'adminGetSupportTicket', undefined, params);
    expect(detail.customerReference).toMatch(/^CUS-[a-f0-9]{16}$/);
    expect(detail.assignedAdminId).toBeNull();
    const act = async (action: string, extra = {}) => {
      await call(
        actor,
        'adminActOnSupportTicket',
        {
          action,
          expectedVersion: detail.version,
          reason: 'Support recovery regression',
          ...extra,
        },
        params,
      );
      detail = await call(actor, 'adminGetSupportTicket', undefined, params);
    };
    await act('assign', { assigneeId: actor });
    expect(detail.assignedAdminId).toBe(actor);
    await act('priority', { priority: 'high' });
    await call(
      actor,
      'adminAddSupportInternalNote',
      {
        body: 'Private investigation note',
        expectedVersion: detail.version,
        reason: 'Support recovery regression',
      },
      params,
    );
    await act('reply', { message: 'We are looking into this' });
    const ownerDetail = await call(customer, 'getSupportTicket', undefined, params);
    expect(ownerDetail.messages.map((message: { body: string }) => message.body)).toContain(
      'We are looking into this',
    );
    expect(JSON.stringify(ownerDetail)).not.toContain('Private investigation');
    expect(ownerDetail).not.toHaveProperty('assignedAdminId');
    await expect(
      call(
        customer,
        'addSupportMessage',
        { body: 'Stale draft stays on client', expectedVersion: created.version },
        params,
      ),
    ).rejects.toMatchObject({ status: 409 });
    await call(
      customer,
      'addSupportMessage',
      { body: 'Thanks, here is more context', expectedVersion: ownerDetail.version },
      params,
    );
    detail = await call(actor, 'adminGetSupportTicket', undefined, params);
    expect(detail.status).toBe('waiting_support');
    expect(detail.internalNotes).toHaveLength(1);
    await act('resolve');
    await act('close');
    await act('reopen');
    expect(detail.status).toBe('waiting_support');
  });

  it('filters beyond 25 rows and returns bounded cursor pages and actual workload counts', async () => {
    const listCategory = randomUUID();
    await pool.query('insert into public.support_categories(id,key,name) values($1,$2,$3)', [
      listCategory,
      `list-${randomUUID()}`,
      'Paged support',
    ]);
    await pool.query(
      "insert into public.support_tickets(user_id,category_id,subject,priority) select $1,$2,'recovery page '||n,case when n=26 then 'urgent' else 'normal' end from generate_series(1,26) n",
      [customer, listCategory],
    );
    const query = { categoryId: listCategory, query: 'recovery page', limit: 25 };
    const first = await call<TestPage>(
      actor,
      'adminListSupportTickets',
      undefined,
      undefined,
      query,
    );
    expect(first.items).toHaveLength(25);
    expect(first.totalItems).toBe(26);
    const second = await call<TestPage>(actor, 'adminListSupportTickets', undefined, undefined, {
      ...query,
      cursor: first.nextCursor,
    });
    expect(second.items).toHaveLength(1);
    expect(
      new Set([...first.items, ...second.items].map((item: { id: string }) => item.id)).size,
    ).toBe(26);
    const filtered = await call<TestPage>(actor, 'adminListSupportTickets', undefined, undefined, {
      ...query,
      priority: 'urgent',
      assignee: 'unassigned',
    });
    expect(filtered.items).toHaveLength(1);
    const overview = await call<TestWorkload>(actor, 'adminSupportOverview', undefined, undefined, {
      categoryId: listCategory,
    });
    expect(overview.total).toBe(26);
    expect(overview.byStatus.open).toBe(26);
    expect(overview.unassigned).toBe(26);
  });

  it('downloads only a clean linked attachment with detail permission and audits access before signing', async () => {
    const ticket = await call(customer, 'createSupportTicket', {
      categoryId: category,
      subject: 'Attachment ticket',
      message: 'Attached evidence',
    });
    const attachmentId = randomUUID();
    await pool.query(
      "insert into private.support_attachments(id,ticket_id,message_id,storage_ref,filename_safe,content_type,size_bytes,sha256,scan_status,scanned_at) values($1,$2,$3,$4,'evidence.pdf','application/pdf',10,$5,'clean',now())",
      [
        attachmentId,
        ticket.id,
        ticket.messages[0]?.id,
        `support/${ticket.id}/${attachmentId}`,
        'a'.repeat(64),
      ],
    );
    const params = { ticketId: ticket.id, attachmentId };
    expect(await call(actor, 'adminDownloadSupportAttachment', undefined, params)).toMatchObject({
      url: 'https://storage.test/signed',
    });
    expect(signDownload).toHaveBeenCalledWith(`support/${ticket.id}/${attachmentId}`);
    expect(
      (
        await pool.query(
          "select count(*)::int n from audit.audit_events where actor_id=$1 and action='support.attachment.download' and resource_id=$2",
          [actor, attachmentId],
        )
      ).rows[0]?.n,
    ).toBe(1);
    signDownload.mockClear();
    await expect(
      call(customer, 'adminDownloadSupportAttachment', undefined, params),
    ).rejects.toMatchObject({ status: 403 });
    await expect(
      call(actor, 'adminDownloadSupportAttachment', undefined, {
        ...params,
        ticketId: randomUUID(),
      }),
    ).rejects.toMatchObject({ status: 404 });
    await pool.query("update private.support_attachments set scan_status='rejected' where id=$1", [
      attachmentId,
    ]);
    await expect(
      call(actor, 'adminDownloadSupportAttachment', undefined, params),
    ).rejects.toMatchObject({ status: 404 });
    expect(signDownload).not.toHaveBeenCalled();
  });

  it('replays engagement receipts without granting financial or internal function access to Admins', async () => {
    const body = {
      categoryId: category,
      subject: 'Replay one ticket',
      message: 'Do not create this ticket twice',
    };
    const command = {
      operation: 'createSupportTicket',
      body,
      params: {},
      requestId: randomUUID(),
      idempotencyKey: randomUUID(),
    };
    const principal = { userId: customer, sessionId: 'test', factorAgeSeconds: 10 };
    const first = (await service.execute(principal, command)) as { id: string };
    expect(await service.execute(principal, command)).toMatchObject({ id: first.id });
    await expect(
      service.execute(principal, { ...command, body: { ...body, message: 'Changed payload' } }),
    ).rejects.toMatchObject({ status: 409 });
    await pool.withClient(async (client) => {
      await client.query('begin');
      try {
        await client.query("select set_config('request.jwt.claims',$1,true)", [
          JSON.stringify({ sub: actor, role: 'authenticated' }),
        ]);
        await client.query('set local role masarifi_api');
        expect(
          (
            await client.query<{ allowed: boolean }>(
              "select has_function_privilege('masarifi_api','private.execute_engagement_command_phase11(text,text,uuid,jsonb,integer,text,integer,integer)','EXECUTE') allowed",
            )
          ).rows[0]?.allowed,
        ).toBe(false);
        await expect(
          client.query(
            "select * from private.claim_idempotency_key($1,'ledger.test',$2,$3,interval '2 minutes')",
            [actor, 'sha256:' + 'a'.repeat(64), 'sha256:' + 'b'.repeat(64)],
          ),
        ).rejects.toThrow('FINANCIAL_ACCESS_DENIED');
      } finally {
        await client.query('rollback');
      }
    });
  });

  it('paginates message timestamps without dropping sub-millisecond rows', async () => {
    const created = await call(customer, 'createSupportTicket', {
      categoryId: category,
      subject: 'Paged messages',
      message: 'First question',
    });
    await pool.query(
      "insert into public.support_messages(ticket_id,sender_id,sender_type,body,created_at) select $1,$2,'customer','page message '||n,'2026-10-23T00:00:00.123456Z'::timestamptz from generate_series(1,26) n",
      [created.id, customer],
    );
    const first = await call(
      actor,
      'adminGetSupportTicket',
      undefined,
      { ticketId: created.id },
      { limit: 25 },
    );
    const second = await call(
      actor,
      'adminGetSupportTicket',
      undefined,
      { ticketId: created.id },
      { limit: 25, cursor: first.nextCursor },
    );
    expect(first.messages).toHaveLength(25);
    expect(second.messages).toHaveLength(2);
    expect(
      new Set([...first.messages, ...second.messages].map((message: { id: string }) => message.id))
        .size,
    ).toBe(27);
  });

  it('serves the live customer-to-Admin workflow through the actual HTTP controller', async () => {
    const guard = {
      canActivate(context: ExecutionContext) {
        const incoming = context.switchToHttp().getRequest<{
          headers: Record<string, string>;
          clerkPrincipal?: { userId: string; sessionId: string; factorAgeSeconds: number };
        }>();
        const userId = incoming.headers['x-test-actor'];
        if (!userId) return false;
        incoming.clerkPrincipal = {
          userId,
          sessionId: 'http-test',
          factorAgeSeconds: 10,
        };
        return true;
      },
    };
    const module = await Test.createTestingModule({
      controllers: [EngagementController, EngagementAdminController],
      providers: [{ provide: EngagementService, useValue: service }],
    })
      .overrideGuard(ClerkAuthGuard)
      .useValue(guard)
      .overrideGuard(AdminAuthGuard)
      .useValue(guard)
      .compile();
    const app = module.createNestApplication();
    await app.init();
    try {
      const created = await request(app.getHttpServer() as Server)
        .post('/api/v1/support/tickets')
        .set('x-test-actor', customer)
        .set('idempotency-key', randomUUID())
        .send({
          categoryId: category,
          subject: 'HTTP customer request',
          message: 'Help me through the real controller',
        })
        .expect(201);
      const ticket = created.body as TestTicket;
      await request(app.getHttpServer() as Server)
        .post(`/api/v1/admin/support/tickets/${ticket.id}/actions`)
        .set('x-test-actor', actor)
        .set('idempotency-key', randomUUID())
        .send({
          action: 'reply',
          message: 'HTTP support reply',
          reason: 'Support recovery HTTP test',
          expectedVersion: ticket.version,
        })
        .expect(200);
      const ownerRead = await request(app.getHttpServer() as Server)
        .get(`/api/v1/support/tickets/${ticket.id}`)
        .set('x-test-actor', customer)
        .expect(200);
      expect((ownerRead.body as TestTicket).messages.map((message) => message.body)).toContain(
        'HTTP support reply',
      );
      expect(ownerRead.headers['cache-control']).toBe('private, no-store');
    } finally {
      await app.close();
    }
  });

  it('uses UTC calendar boundaries for support aggregates independently of database timezone', async () => {
    const dayCategory = randomUUID();
    await pool.query('insert into public.support_categories(id,key,name) values($1,$2,$3)', [
      dayCategory,
      `utc-${randomUUID()}`,
      'UTC support',
    ]);
    await pool.query(
      "insert into public.support_tickets(user_id,category_id,subject,created_at) values($1,$2,'UTC before','2026-10-22T23:30:00Z'),($1,$2,'UTC late','2026-10-23T23:30:00Z')",
      [customer, dayCategory],
    );
    const result = await pool.withClient(async (client) => {
      await client.query('begin');
      try {
        await client.query("set local timezone='Asia/Riyadh'");
        await client.query("select set_config('request.jwt.claims',$1,true)", [
          JSON.stringify({ sub: actor, role: 'authenticated' }),
        ]);
        await client.query('set local role masarifi_api');
        return (
          await client.query<{ value: TestWorkload }>(
            'select private.support_admin_workload($1::jsonb) value',
            [
              JSON.stringify({
                categoryId: dayCategory,
                query: 'UTC late',
                from: '2026-10-23',
                to: '2026-10-23',
              }),
            ],
          )
        ).rows[0]?.value;
      } finally {
        await client.query('rollback');
      }
    });
    expect(result?.total).toBe(1);
  });

  it('allows overview-only staff to see counts while denying ticket bodies', async () => {
    const subject = `Scoped support ${randomUUID()}`;
    await call(customer, 'createSupportTicket', {
      categoryId: category,
      subject,
      message: 'Private ticket body for scope regression',
    });
    const overviewActor = `support_overview_${randomUUID()}`;
    await pool.query('insert into public.profiles(id) values($1)', [overviewActor]);
    await pool.query("insert into public.admin_profiles(user_id,status) values($1,'active')", [
      overviewActor,
    ]);
    await pool.query(
      "insert into public.admin_role_assignments(user_id,role_id,assigned_by,reason) select $1,id,$2,'Overview scope regression' from public.roles where key='content-manager'",
      [overviewActor, actor],
    );
    const overview = await call<TestWorkload>(
      overviewActor,
      'adminSupportOverview',
      undefined,
      undefined,
      { categoryId: category, query: subject },
    );
    expect(overview.total).toBe(1);
    expect(overview).not.toHaveProperty('items');
    await expect(call(overviewActor, 'adminListSupportTickets')).rejects.toMatchObject({
      status: 403,
    });
    await expect(
      call(overviewActor, 'adminGetSupportTicket', undefined, { ticketId: randomUUID() }),
    ).rejects.toMatchObject({ status: 403 });
  });
});
