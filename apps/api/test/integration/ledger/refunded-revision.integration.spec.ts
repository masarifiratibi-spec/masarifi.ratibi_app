import { randomUUID } from 'node:crypto';
import { LedgerRepository } from '../../../src/ledger/ledger.repository';
import { createLivePool, describeLiveDatabase } from '../../live-database';

type Receipt = { transaction: { transaction: { id: string; version: number } } };

describeLiveDatabase('refund floor on expense revision', () => {
  const pool = createLivePool();
  const ledger = new LedgerRepository(pool);
  afterAll(() => pool.onModuleDestroy());

  async function fixture() {
    const principal = {
      userId: `refund_floor_${randomUUID()}`,
      sessionId: 'synthetic',
      factorAgeSeconds: 0,
    };
    const accountId = randomUUID();
    await pool.query("insert into public.profiles(id,status) values($1,'active')", [
      principal.userId,
    ]);
    await pool.query(
      "insert into public.accounts(id,user_id,name,type,currency_code) values($1,$2,'Synthetic refund floor','cash','SAR')",
      [accountId, principal.userId],
    );
    const scopes = {
      createTransaction: 'ledger.transaction.create',
      refundTransaction: 'ledger.transaction.refund',
      reviseTransaction: 'ledger.transaction.revise',
    } as const;
    const mutate = (operation: keyof typeof scopes, command: Record<string, unknown>) =>
      ledger.mutate({
        operation,
        command,
        principal,
        scope: scopes[operation],
        idempotencyKey: randomUUID(),
        requestId: randomUUID(),
        status: 200,
      }) as Promise<Receipt>;
    const expense = await mutate('createTransaction', {
      kind: 'expense',
      amountMinor: 10000,
      currency: 'SAR',
      accountId,
      categoryId: null,
      title: 'Synthetic expense',
      merchant: null,
      paymentMethod: null,
      note: null,
      occurredAt: new Date().toISOString(),
      source: 'manual',
      externalRef: null,
    });
    const id = expense.transaction.transaction.id;
    await mutate('refundTransaction', {
      transactionId: id,
      expectedVersion: 1,
      amountMinor: 4000,
      accountId,
      occurredAt: new Date().toISOString(),
      reason: 'Synthetic first refund',
    });
    await mutate('refundTransaction', {
      transactionId: id,
      expectedVersion: 2,
      amountMinor: 2000,
      accountId,
      occurredAt: new Date().toISOString(),
      reason: 'Synthetic second refund',
    });
    const snapshot = async () =>
      (
        await pool.query(
          `select t.amount_minor::text amount,t.version::text version,
      (select count(*)::text from public.transaction_postings p join public.transactions pt on pt.id=p.transaction_id where pt.user_id=t.user_id) postings,
      (select count(*)::text from audit.transaction_revisions r where r.transaction_id=t.id) revisions,
      (select confirmed_minor::text from public.account_balances where account_id=$2) balance
      from public.transactions t where t.id=$1`,
          [id, accountId],
        )
      ).rows[0];
    return { id, mutate, snapshot };
  }

  it('rejects an edit below cumulative confirmed refunds without any financial or revision effect', async () => {
    const { id, mutate, snapshot } = await fixture();
    const before = await snapshot();
    await expect(
      mutate('reviseTransaction', {
        transactionId: id,
        expectedVersion: 3,
        reason: 'Synthetic edit',
        patch: { amountMinor: 3000 },
      }),
    ).rejects.toMatchObject({ response: { code: 'AMOUNT_BELOW_REFUNDED' } });
    expect(await snapshot()).toEqual(before);
  });

  it.each([
    [6000, '0'],
    [8000, '-2000'],
  ])('accepts an amount %s at or above the refund floor', async (amountMinor, balance) => {
    const { id, mutate, snapshot } = await fixture();
    await mutate('reviseTransaction', {
      transactionId: id,
      expectedVersion: 3,
      reason: 'Synthetic valid edit',
      patch: { amountMinor },
    });
    expect(await snapshot()).toMatchObject({ amount: String(amountMinor), balance, version: '4' });
  });

  it('preserves metadata edits and the original amount after a refund', async () => {
    const { id, mutate, snapshot } = await fixture();
    await mutate('reviseTransaction', {
      transactionId: id,
      expectedVersion: 3,
      reason: 'Synthetic title edit',
      patch: { title: 'Corrected title' },
    });
    expect(await snapshot()).toMatchObject({ amount: '10000', balance: '-4000', version: '4' });
  });

  it('serializes concurrent refund and revision without exceeding the final expense', async () => {
    const { id, mutate } = await fixture();
    const settled = await Promise.allSettled([
      mutate('reviseTransaction', {
        transactionId: id,
        expectedVersion: 3,
        reason: 'Synthetic concurrent edit',
        patch: { amountMinor: 8000 },
      }),
      mutate('refundTransaction', {
        transactionId: id,
        expectedVersion: 3,
        amountMinor: 3000,
        occurredAt: new Date().toISOString(),
        reason: 'Synthetic concurrent refund',
      }),
    ]);
    expect(settled.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    const rejected = settled.find(
      (result) => result.status === 'rejected',
    ) as PromiseRejectedResult;
    expect(rejected.reason).toMatchObject({ response: { code: 'VERSION_CONFLICT' } });
    const result = await pool.query(
      `select t.amount_minor::bigint amount,
      (select sum(r.amount_minor)::bigint from public.transactions r where r.reverses_transaction_id=t.id and r.kind='refund' and r.status='confirmed') refunded
      from public.transactions t where t.id=$1`,
      [id],
    );
    expect(result.rows).toHaveLength(1);
    expect(Number(result.rows[0]?.refunded)).toBeLessThanOrEqual(Number(result.rows[0]?.amount));
  });
});
