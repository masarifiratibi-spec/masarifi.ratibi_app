import { SecurityService } from '../../../src/security/security.service';
import { SecurityRepository } from '../../../src/security/security.repository';

const principal = {
  userId: 'admin-requester',
  sessionId: 'session-projection',
  factorAgeSeconds: 0,
  mfaAgeSeconds: 0,
};
const scopes = [{ resource: 'account-status', actions: ['read-status'] }];
const request = {
  id: 'request-projection',
  userId: 'customer-123456',
  requester: 'admin-requester',
  assignee: 'admin-assignee',
  supportTicketId: 'ticket-projection',
  scopes,
  status: 'approved',
  customerApprovalRequired: true,
  customerApprovedAt: '2026-11-07T12:01:00.000Z',
  createdAt: '2026-11-07T12:00:00.000Z',
  purpose: 'Review account status with customer consent',
  decidedAt: '2026-11-07T12:02:00.000Z',
  requestedDurationMinutes: 30,
  expiresAt: '2026-11-07T12:30:00.000Z',
  approvedBy: 'admin-approver',
  grant: {
    id: 'grant-projection',
    scopes,
    startsAt: '2026-11-07T12:10:00.000Z',
    expiresAt: '2026-11-07T12:25:00.000Z',
    revokedAt: null,
  },
  version: 3,
};

function serviceReturning(value: unknown) {
  return new SecurityService(
    {
      consumeRateLimit: () => Promise.resolve(true),
      execute: () => Promise.resolve(value),
    } as never,
    { get: () => undefined, getRequired: () => 300 } as never,
    {} as never,
    {} as never,
    {} as never,
  );
}

describe('support-access review response projections', () => {
  it.each([
    ['listSupportAccessRequests', {}],
    ['listMySupportAccessRequests', {}],
    ['getSupportAccessRequest', {}],
    [
      'createSupportAccessRequest',
      {
        userId: 'customer-123456',
        assignee: 'admin-assignee',
        supportTicketId: 'ticket-projection',
        purpose: request.purpose,
        resourceScopes: scopes,
        durationMinutes: 30,
        customerApprovalRequired: true,
      },
    ],
    [
      'decideSupportAccessRequest',
      { decision: 'approve', reason: 'Approve limited support access', expectedVersion: 2 },
    ],
    ['decideMySupportAccessRequest', { decision: 'approve', expectedVersion: 1 }],
    ['revokeSupportAccess', { reason: 'End limited support access', expectedVersion: 3 }],
    ['endSupportAccess', { expectedVersion: 3 }],
  ])(
    'projects safe review metadata for %s without deriving active status',
    async (operation, body) => {
      const page = operation.startsWith('list');
      const response = await serviceReturning(
        page ? { items: [request], nextCursor: null } : request,
      ).execute({
        operation,
        principal,
        body,
        query: {},
        params: { requestId: request.id },
        requestId: 'response-projection',
        idempotencyKey: 'projection-operation',
      });
      const expected = {
        id: 'request-projection',
        user: { id: 'customer-123456', kind: 'customer', label: 'customer 123456' },
        requester: { id: 'admin-requester', kind: 'admin', label: 'admin uester' },
        assignee: { id: 'admin-assignee', kind: 'admin', label: 'admin signee' },
        supportTicketId: 'ticket-projection',
        scopes: [{ resource: 'account-status', actions: ['read-status'] }],
        status: 'approved',
        customerApprovalRequired: true,
        customerApprovedAt: '2026-11-07T12:01:00.000Z',
        createdAt: '2026-11-07T12:00:00.000Z',
        purpose: 'Review account status with customer consent',
        decidedAt: '2026-11-07T12:02:00.000Z',
        requestedDurationMinutes: 30,
        expiresAt: '2026-11-07T12:30:00.000Z',
        approvedBy: { id: 'admin-approver', kind: 'admin', label: 'admin prover' },
        grant: {
          id: 'grant-projection',
          scopes: [{ resource: 'account-status', actions: ['read-status'] }],
          startsAt: '2026-11-07T12:10:00.000Z',
          expiresAt: '2026-11-07T12:25:00.000Z',
          revokedAt: null,
        },
        version: 3,
      };
      expect(response).toEqual(page ? { items: [expected], nextCursor: null } : expected);
    },
  );

  it('preserves absent decisions and grants as null on pending requests', async () => {
    await expect(
      serviceReturning({
        ...request,
        status: 'pending',
        decidedAt: null,
        approvedBy: null,
        grant: null,
      }).execute({
        operation: 'getSupportAccessRequest',
        principal,
        body: {},
        query: {},
        params: { requestId: request.id },
        requestId: 'pending-projection',
      }),
    ).resolves.toMatchObject({ status: 'pending', decidedAt: null, approvedBy: null, grant: null });
  });
});

function repositoryUsing(query: jest.Mock) {
  return new SecurityRepository({
    withClient: (action: (client: { query: jest.Mock }) => unknown) => action({ query }),
  } as never);
}

describe('support-access repository authorization', () => {
  it('binds the personal list to its owner even when the owner has broad admin permissions', async () => {
    const query = jest.fn(() => Promise.resolve({ rows: [] }));
    await repositoryUsing(query).execute({
      operation: 'listMySupportAccessRequests',
      principal,
      body: {},
      query: {},
      params: {},
      requestId: 'personal-support-list',
    });
    expect(query).toHaveBeenCalledWith(expect.stringContaining('request.user_id=$4'), [
      null,
      null,
      null,
      'admin-requester',
      51,
      0,
    ]);
  });

  it('rejects ending another assignee request before any revoke write', async () => {
    const query = jest.fn((sql: string) =>
      Promise.resolve({
        rows: sql.includes('for update')
          ? [{ id: 'request-projection', assignee: 'another-admin' }]
          : [request],
      }),
    );
    await expect(
      repositoryUsing(query).execute({
        operation: 'endSupportAccess',
        permission: 'support.access.use',
        principal,
        body: { expectedVersion: 3 },
        query: {},
        params: { requestId: 'request-projection' },
        requestId: 'end-another-assignee',
      }),
    ).rejects.toMatchObject({ code: '42501' });
    expect(query.mock.calls.some(([sql]) => /^update private.support_access_/.test(sql))).toBe(
      false,
    );
  });

  const workspace = {
    requestId: 'request-projection',
    grantId: 'grant-projection',
    expiresAt: '2026-11-07T12:25:00.000Z',
    sections: [],
  };
  const access = {
    supportTicketId: 'ticket-projection',
    assignee: 'admin-requester',
    startsAt: new Date('2026-11-07T12:10:00.000Z'),
    scopes: [{ resource: 'account-status', actions: ['read-status'] }],
    version: 3,
  };
  function workspaceRepository(
    accessRows = [access],
    finalWorkspace: typeof workspace | Error = workspace,
  ) {
    let rpcCalls = 0;
    const query = jest.fn((sql: string) => {
      if (sql.includes('read_support_workspace')) {
        rpcCalls += 1;
        if (rpcCalls > 1 && finalWorkspace instanceof Error) return Promise.reject(finalWorkspace);
        return Promise.resolve({
          rows: [{ workspace: rpcCalls > 1 ? finalWorkspace : workspace }],
        });
      }
      return Promise.resolve({
        rows: sql.includes('from private.support_access_requests') ? accessRows : [],
      });
    });
    return repositoryUsing(query);
  }
  function readWorkspace(repository: SecurityRepository) {
    return repository.execute({
      operation: 'getSupportWorkspace',
      permission: 'support.access.use',
      principal,
      body: {},
      query: {},
      params: { requestId: 'request-projection' },
      requestId: 'use-workspace',
    });
  }

  it('adds only the authorized grant metadata to the workspace without review permission', async () => {
    await expect(readWorkspace(workspaceRepository())).resolves.toEqual({
      requestId: 'request-projection',
      grantId: 'grant-projection',
      expiresAt: '2026-11-07T12:25:00.000Z',
      sections: [],
      access: {
        supportTicketId: 'ticket-projection',
        assignee: 'admin-requester',
        startsAt: '2026-11-07T12:10:00.000Z',
        scopes: [{ resource: 'account-status', actions: ['read-status'] }],
        version: 3,
      },
    });
  });

  it('fails closed if the selected grant is no longer active at the metadata query', async () => {
    await expect(readWorkspace(workspaceRepository([]))).rejects.toMatchObject({ code: '42501' });
  });

  it.each([
    ['grant selection changes', { ...workspace, grantId: 'different-grant' }],
    ['owner becomes inactive', Object.assign(new Error('SUPPORT_GRANT_DENIED'), { code: '42501' })],
  ])('fails closed when %s during the final authorized RPC', async (_scenario, finalWorkspace) => {
    await expect(
      readWorkspace(workspaceRepository([access], finalWorkspace)),
    ).rejects.toMatchObject({ code: '42501' });
  });
});
