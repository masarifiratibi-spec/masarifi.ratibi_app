import { randomUUID } from 'node:crypto';
import { LedgerRepository } from '../../../src/ledger/ledger.repository';
import { createLivePool, describeLiveDatabase } from '../../live-database';

describeLiveDatabase('optional multiline ledger notes', () => {
  const pool = createLivePool();
  const repository = new LedgerRepository(pool);
  const userId = `ledger_note_${randomUUID()}`;
  const accountId = randomUUID();
  const destinationAccountId = randomUUID();
  beforeAll(async () => {
    await pool.query("insert into public.profiles(id,status) values($1,'active')", [userId]);
    for (const id of [accountId, destinationAccountId])
      await pool.query(
        "insert into public.accounts(id,user_id,name,type,currency_code) values($1,$2,'Cash','cash','SAR')",
        [id, userId],
      );
  });
  afterAll(() => pool.onModuleDestroy());
  const create = (note: string | null) =>
    repository.mutate({
      operation: 'createTransaction',
      scope: 'ledger.transaction.create',
      principal: { userId, sessionId: 'session', factorAgeSeconds: 0 },
      command: {
        kind: 'expense',
        amountMinor: 50,
        currency: 'SAR',
        accountId,
        categoryId: null,
        title: 'Note fixture',
        note,
        occurredAt: new Date().toISOString(),
        source: 'manual',
      },
      idempotencyKey: randomUUID(),
      requestId: randomUUID(),
      status: 201,
    });
  it('persists normalized LF notes through the real ledger command and table constraint', async () => {
    const result = (await create('first\r\nsecond\rthird')) as {
      transaction: { transaction: { id: string } };
    };
    const row = await pool.query<{ note: string }>(
      'select note from public.transactions where id=$1',
      [result.transaction.transaction.id],
    );
    expect(row.rows[0]?.note).toBe('first\nsecond\nthird');
  });
  it.each(['', '  \n  ', '\u00a0\u2003\ufeff'])('stores empty note %# as null', async (note) => {
    const result = (await create(note)) as { transaction: { transaction: { id: string } } };
    const row = await pool.query<{ note: string | null }>(
      'select note from public.transactions where id=$1',
      [result.transaction.transaction.id],
    );
    expect(row.rows[0]?.note).toBeNull();
  });
  it.each(['a\tb', 'a\u202eb', 'x'.repeat(501)])(
    'rejects prohibited note %# atomically',
    async (note) => {
      await expect(create(note)).rejects.toBeDefined();
    },
  );
  it.each([
    ['reviseTransaction', 'ledger.transaction.revise'],
    ['deleteTransaction', 'ledger.transaction.delete'],
    ['refundTransaction', 'ledger.transaction.refund'],
    ['reverseTransaction', 'ledger.transaction.reverse'],
  ])('preserves a historical bidi note during %s', async (operation, scope) => {
    const result = (await create(null)) as { transaction: { transaction: { id: string } } };
    const transactionId = result.transaction.transaction.id;
    // Simulate a row accepted by the historical validator. The table lock and
    // trigger restoration are in one disposable-database transaction.
    await pool.withClient(async (client) => {
      await client.query('begin');
      try {
        await client.query("select set_config('masarifi.ledger_command','on',true)");
        await client.query(
          'alter table public.transactions disable trigger transactions_changed_note_check',
        );
        await client.query('update public.transactions set note=$1 where id=$2', [
          'legacy\u202enote',
          transactionId,
        ]);
        await client.query(
          'alter table public.transactions enable trigger transactions_changed_note_check',
        );
        await client.query('commit');
      } catch (error) {
        await client.query('rollback');
        throw error;
      }
    });
    await repository.mutate({
      operation,
      scope,
      principal: { userId, sessionId: 'session', factorAgeSeconds: 0 },
      command: {
        transactionId,
        expectedVersion: 2,
        reason: 'Fixture correction',
        patch: { title: 'Revised title' },
        amountMinor: 10,
        accountId,
        occurredAt: new Date().toISOString(),
      },
      idempotencyKey: randomUUID(),
      requestId: randomUUID(),
      status: 200,
    });
    const row = await pool.query<{ note: string }>(
      'select note from public.transactions where id=$1',
      [transactionId],
    );
    expect(row.rows[0]?.note).toBe('legacy\u202enote');
  });
});
