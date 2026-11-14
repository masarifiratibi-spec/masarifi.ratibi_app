import { randomUUID } from 'node:crypto';

import type { PoolClient } from 'pg';

import { LedgerRepository } from '../../../src/ledger/ledger.repository';
import { SYSTEM_ROLES } from '../../../src/security/permission-manifest';
import { createLivePool, describeLiveDatabase } from '../../live-database';

type Principal = { userId: string; sessionId: string; factorAgeSeconds: number };
type OwnerReadRepository = LedgerRepository & {
  getTransaction(
    principal: Principal,
    transactionId: string,
  ): Promise<{ transaction: { id: string } }>;
};

describeLiveDatabase('ledger ownership boundary', () => {
  const owner = {
    userId: `ledger_owner_${randomUUID()}`,
    sessionId: 'owner-session',
    factorAgeSeconds: 0,
  };
  const nonowner = {
    userId: `ledger_nonowner_${randomUUID()}`,
    sessionId: 'other-session',
    factorAgeSeconds: 0,
  };
  const promotedAdmin = {
    userId: `ledger_promoted_admin_${randomUUID()}`,
    sessionId: 'promoted-session',
    factorAgeSeconds: 0,
  };
  const accountId = randomUUID();
  const promotedAccountId = randomUUID();
  const adminIds = SYSTEM_ROLES.map((role) => ({
    role,
    userId: `ledger_admin_${role}_${randomUUID()}`,
  }));
  const pool = createLivePool();
  const reads = new LedgerRepository(pool) as OwnerReadRepository;
  let transactionId = '';
  let promotedTransactionId = '';

  // Reuse the exact recorded commands when exercising owner-isolated replay.
  const mutation = (
    principal: Principal,
    account: string,
    title: string,
    key: string,
  ): Parameters<LedgerRepository['mutate']>[0] => ({
    operation: 'createTransaction',
    scope: 'ledger.transaction.create',
    principal,
    command: {
      kind: 'expense',
      amountMinor: 100,
      currency: 'SAR',
      accountId: account,
      categoryId: null,
      title,
      merchant: null,
      paymentMethod: null,
      note: null,
      occurredAt: '2026-08-30T08:00:00.000Z',
      source: 'manual',
      externalRef: null,
    },
    idempotencyKey: key,
    requestId: key,
    status: 201,
  });
  const ownMutation = mutation(owner, accountId, 'Owner-only row', 'ledger-owner-read-key');
  const promotedMutation = mutation(
    promotedAdmin,
    promotedAccountId,
    'Pre-admin row',
    'ledger-promoted-read-key',
  );

  async function asRole<T>(
    role: 'anon' | 'authenticated' | 'masarifi_api' | 'masarifi_migration' | 'masarifi_worker',
    action: (client: PoolClient) => Promise<T>,
  ): Promise<T> {
    return pool.withClient(async (client) => {
      await client.query('begin');
      try {
        await client.query(`set local role ${role}`);
        const result = await action(client);
        await client.query('commit');
        return result;
      } catch (error) {
        await client.query('rollback');
        throw error;
      }
    });
  }

  beforeAll(async () => {
    await asRole('masarifi_migration', async (client) => {
      await client.query(
        "insert into public.profiles(id,status) values($1,'active'),($2,'active')",
        [owner.userId, nonowner.userId],
      );
      await client.query(
        "insert into public.accounts(id,user_id,name,type,currency_code) values($1,$2,'Cash','cash','SAR')",
        [accountId, owner.userId],
      );
      for (const { role, userId } of adminIds) {
        await client.query("insert into public.profiles(id,status) values($1,'active')", [userId]);
        await client.query(
          "insert into public.admin_profiles(user_id,status) values($1,'active')",
          [userId],
        );
        await client.query(
          "insert into public.admin_role_assignments(user_id,role_id,assigned_by,reason) select $1,id,$1,'Ledger boundary matrix' from public.roles where key=$2",
          [userId, role],
        );
      }
    });
    const created = (await reads.mutate(ownMutation)) as {
      transaction: { transaction: { id: string } };
    };
    transactionId = created.transaction.transaction.id;
    await asRole('masarifi_migration', async (client) => {
      await client.query("insert into public.profiles(id,status) values($1,'active')", [
        promotedAdmin.userId,
      ]);
      await client.query(
        "insert into public.accounts(id,user_id,name,type,currency_code) values($1,$2,'Former customer','cash','SAR')",
        [promotedAccountId, promotedAdmin.userId],
      );
    });
    const promotedCreated = (await reads.mutate(promotedMutation)) as {
      transaction: { transaction: { id: string } };
    };
    promotedTransactionId = promotedCreated.transaction.transaction.id;
    await asRole('masarifi_migration', async (client) => {
      await client.query("insert into public.admin_profiles(user_id,status) values($1,'active')", [
        promotedAdmin.userId,
      ]);
      const granted = await client.query(
        "insert into public.admin_role_assignments(user_id,role_id,assigned_by,reason) select $1,id,$1,'Synthetic ownership boundary' from public.roles where key='support-agent'",
        [promotedAdmin.userId],
      );
      expect(granted.rowCount).toBe(1);
    });
  });

  afterAll(() => pool.onModuleDestroy());

  it('returns the financial row only to its customer owner and makes another customer see owner-safe not found', async () => {
    await expect(reads.getTransaction(owner, transactionId)).resolves.toMatchObject({
      transaction: { id: transactionId },
    });
    await expect(reads.getTransaction(nonowner, transactionId)).rejects.toMatchObject({
      response: { code: 'NOT_FOUND' },
    });
  });

  it('denies anonymous, direct authenticated-client, and worker SQL reads independently of the API', async () => {
    for (const role of ['anon', 'authenticated', 'masarifi_worker'] as const) {
      await expect(
        asRole(role, (client) =>
          client.query('select id from public.transactions where id=$1', [transactionId]),
        ),
      ).rejects.toMatchObject({ code: '42501' });
    }
  });

  it('makes every assigned Admin role see owner-safe not found instead of a raw ledger row', async () => {
    for (const { userId } of adminIds) {
      await expect(
        reads.getTransaction(
          { userId, sessionId: 'admin-session', factorAgeSeconds: 0 },
          transactionId,
        ),
      ).rejects.toMatchObject({ response: { code: 'NOT_FOUND' } });
    }
  });

  it('retains personal ownership after promotion without exposing another customer’s ledger', async () => {
    await expect(reads.getTransaction(promotedAdmin, promotedTransactionId)).resolves.toMatchObject(
      {
        transaction: { id: promotedTransactionId },
      },
    );
    await expect(reads.getTransaction(promotedAdmin, transactionId)).rejects.toMatchObject({
      response: { code: 'NOT_FOUND' },
    });
    const replay = (principal: Principal) =>
      reads.replayCompleted({
        ...promotedMutation,
        principal,
        requestId: 'ledger-promoted-replay',
      });
    await expect(
      reads.replayCompleted({ ...ownMutation, principal: promotedAdmin }),
    ).resolves.toBeUndefined();
    await expect(replay(promotedAdmin)).resolves.toMatchObject({
      transaction: { transaction: { id: promotedTransactionId } },
    });
    await expect(replay(nonowner)).resolves.toBeUndefined();
  });
});
