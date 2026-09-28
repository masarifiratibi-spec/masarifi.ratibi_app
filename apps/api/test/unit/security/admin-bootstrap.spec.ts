import {
  assertBootstrapIdentity,
  bootstrapAdmin,
  parseBootstrapArgs,
} from '../../../src/security/admin-bootstrap';

describe('Admin bootstrap arguments', () => {
  it('requires the intended Clerk subject, exact email, and a bounded reason', () => {
    expect(
      parseBootstrapArgs([
        '--user-id',
        'user_1',
        '--email',
        'owner@example.test',
        '--reason',
        'Approved deployment bootstrap',
      ]),
    ).toEqual({
      userId: 'user_1',
      email: 'owner@example.test',
      reason: 'Approved deployment bootstrap',
    });
  });

  it.each([
    ['--user-id', 'user_1', '--email', 'not-an-email', '--reason', 'Approved bootstrap'],
    ['--user-id', 'user_1', '--email', 'Owner@example.test', '--reason', 'Approved bootstrap'],
    ['--user-id', 'invalid', '--email', 'owner@example.test', '--reason', 'Approved bootstrap'],
    ['--user-id', 'user_1', '--email', 'owner@example.test', '--reason', "Approved\nbootstrap"],
    ['--user-id', 'user_1', '--email', 'owner@example.test', '--reason', 'short'],
    ['--user-id', 'user_1', '--reason', 'Approved bootstrap'],
  ])('rejects invalid bootstrap input', (...argv) => {
    expect(() => parseBootstrapArgs(argv)).toThrow('ADMIN_BOOTSTRAP_ARGUMENT_INVALID');
  });

  it('accepts only the exact verified primary email of an eligible Clerk user', () => {
    expect(() => {
      assertBootstrapIdentity(
        { userId: 'user_1', email: 'owner@example.test', reason: 'Approved bootstrap' },
        {
          id: 'user_1',
          primaryEmail: 'owner@example.test',
          primaryEmailVerified: true,
          banned: false,
          locked: false,
        },
      );
    }).not.toThrow();
  });

  it.each([
    [{ id: 'user_2', primaryEmail: 'owner@example.test', primaryEmailVerified: true, banned: false, locked: false }],
    [{ id: 'user_1', primaryEmail: 'other@example.test', primaryEmailVerified: true, banned: false, locked: false }],
    [{ id: 'user_1', primaryEmail: 'owner@example.test', primaryEmailVerified: false, banned: false, locked: false }],
    [{ id: 'user_1', primaryEmail: 'owner@example.test', primaryEmailVerified: true, banned: true, locked: false }],
    [{ id: 'user_1', primaryEmail: 'owner@example.test', primaryEmailVerified: true, banned: false, locked: true }],
  ])('rejects an ineligible Clerk identity', (identity) => {
    expect(() => {
      assertBootstrapIdentity(
        { userId: 'user_1', email: 'owner@example.test', reason: 'Approved bootstrap' },
        identity,
      );
    }).toThrow('ADMIN_BOOTSTRAP_IDENTITY_INELIGIBLE');
  });

  it('takes the advisory lock before consuming the singleton and emits audit/outbox evidence', async () => {
    const statements: string[] = [];
    const client = {
      query: jest.fn((text: string) => {
        statements.push(text);
        if (text.includes('as unavailable')) return Promise.resolve({ rows: [{ unavailable: false }] });
        if (text.includes('select id,primary_email')) return Promise.resolve({ rows: [{ id: 'user_1', primary_email: 'owner@example.test' }] });
        if (text.includes('returning id,role_id')) return Promise.resolve({ rows: [{ id: 'assignment_1', role_id: 'role_1' }] });
        return Promise.resolve({ rows: [] });
      }),
      release: jest.fn(),
    };
    const pool = { connect: jest.fn(() => Promise.resolve(client)) };

    await expect(bootstrapAdmin(pool as never, {
      userId: 'user_1',
      email: 'owner@example.test',
      reason: 'Approved owner bootstrap',
    })).resolves.toEqual({ assignmentId: 'assignment_1' });

    expect(statements.slice(0, 3)).toEqual([
      'begin',
      'grant masarifi_migration to current_user with set true, inherit false',
      'set local role masarifi_migration',
    ]);
    expect(statements.findIndex((sql) => sql.includes('pg_advisory_xact_lock')))
      .toBeLessThan(statements.findIndex((sql) => sql.includes('as unavailable')));
    expect(statements.slice(-3)).toEqual([
      'reset role',
      'revoke masarifi_migration from current_user granted by current_user',
      'commit',
    ]);
    expect(statements).toEqual(expect.arrayContaining([
      expect.stringContaining('owner_bootstrap_state'),
      expect.stringContaining('admin.bootstrap_completed'),
      expect.stringContaining('admin.role_assigned'),
    ]));
  });

  it('rolls back when the bootstrap was already consumed', async () => {
    const client = {
      query: jest.fn((text: string) => Promise.resolve({
        rows: text.includes('as unavailable') ? [{ unavailable: true }] : [],
      })),
      release: jest.fn(),
    };
    await expect(bootstrapAdmin({ connect: jest.fn(() => Promise.resolve(client)) } as never, {
      userId: 'user_1',
      email: 'owner@example.test',
      reason: 'Approved owner bootstrap',
    })).rejects.toThrow('ADMIN_BOOTSTRAP_ALREADY_CONSUMED');
    expect(client.query).toHaveBeenCalledWith('rollback');
    expect(client.query.mock.calls.flat().join(' ')).not.toContain('insert into public.admin_profiles');
  });
});
