import { randomUUID } from 'node:crypto';

import { createLivePool, describeLiveDatabase } from '../../live-database';
import { planningOwnerQuery, withPlanningOwner } from './planning.integration-harness';

describeLiveDatabase('obligation payment live invariants', () => {
  const pool = createLivePool();
  const owner = `payment_live_${randomUUID()}`;
  const other = `payment_other_${randomUUID()}`;
  const obligationId = randomUUID();
  const itemA = randomUUID();
  const itemB = randomUUID();
  let transactionExcess = '';
  const paymentId = randomUUID();
  const accountId = randomUUID();
  async function command(userId: string, body: Record<string, unknown>) {
    return planningOwnerQuery<{ result: Record<string, unknown> }>(
      pool,
      userId,
      'select private.allocate_obligation_payment($1,$2::jsonb) result',
      [userId, JSON.stringify(body)],
    );
  }
  async function postExpense(title: string, amountMinor: string) {
    const created = await planningOwnerQuery<{ result: { transactionId: string } }>(
      pool,
      owner,
      'select private.post_transaction($1,$2::jsonb) result',
      [
        owner,
        JSON.stringify({
          kind: 'expense',
          amountMinor,
          currency: 'SAR',
          accountId,
          categoryId: null,
          title,
          merchant: null,
          paymentMethod: null,
          note: null,
          occurredAt: new Date().toISOString(),
          source: 'manual',
          externalRef: null,
        }),
      ],
    );
    const transactionId = created.rows[0]?.result.transactionId;
    if (!transactionId) throw new Error('POSTED_PAYMENT_TRANSACTION_REQUIRED');
    return transactionId;
  }

  async function seedLinkedPayment(
    label: string,
    options: { transactionAmount?: string; allocationIntent?: 'current' | 'prepayment' } = {},
  ) {
    const transactionAmount = options.transactionAmount ?? '100';
    const allocationIntent = options.allocationIntent ?? 'current';
    const linkedObligationId = randomUUID();
    const linkedScheduleItemId = randomUUID();
    const linkedPaymentId = randomUUID();
    const linkedTransactionId = await postExpense(`Lifecycle ${label}`, transactionAmount);

    await pool.withClient(async (client) => {
      await client.query('begin');
      await client.query('set local role masarifi_migration');
      await client.query(
        `insert into public.obligations(id,user_id,name,direction,type,schedule_kind,currency_code,principal_minor,installment_amount_minor,installment_count,frequency,expected_day,start_date)
         values($1,$2,'Lifecycle loan','payable','installment','fixed_term','SAR',100,100,1,'monthly',1,current_date)`,
        [linkedObligationId, owner],
      );
      await client.query(
        `insert into public.obligation_schedule_items(id,user_id,obligation_id,due_at,amount_minor,sequence_no)
         values($1,$2,$3,current_date+interval '1 month',100,1)`,
        [linkedScheduleItemId, owner, linkedObligationId],
      );
      await client.query('commit');
    });
    await command(owner, {
      operation: 'record',
      obligationId: linkedObligationId,
      paymentId: linkedPaymentId,
      transactionId: linkedTransactionId,
      expectedVersion: 1,
      paymentMethod: null,
      paymentCase: transactionAmount === '100' ? 'full' : 'over',
      allocationIntent,
      source: 'manual',
      allocations: [{ scheduleItemId: linkedScheduleItemId, amountMinor: transactionAmount }],
      operationId: randomUUID(),
      requestId: `payment-ledger-${label}`,
    });

    return { linkedObligationId, linkedScheduleItemId, linkedPaymentId, linkedTransactionId };
  }
  beforeAll(async () => {
    await pool.withClient(async (client) => {
      await client.query('begin');
      await client.query('set local role masarifi_migration');
      await client.query(
        "insert into public.profiles(id,status) values($1,'active'),($2,'active')",
        [owner, other],
      );
      await client.query(
        `insert into public.obligations(id,user_id,name,direction,type,schedule_kind,currency_code,principal_minor,installment_amount_minor,installment_count,frequency,expected_day,start_date)
      values($1,$2,'Loan','payable','installment','fixed_term','SAR',600,300,2,'monthly',1,current_date)`,
        [obligationId, owner],
      );
      await client.query(
        "insert into public.accounts(id,user_id,name,type,currency_code) values($1,$2,'Payment lifecycle','cash','SAR')",
        [accountId, owner],
      );
      await client.query(
        `insert into public.obligation_schedule_items(id,user_id,obligation_id,due_at,amount_minor,sequence_no) values
      ($1,$3,$4,current_date,300,1),($2,$3,$4,current_date+interval '1 month',300,2)`,
        [itemA, itemB, owner, obligationId],
      );
      await client.query('commit');
    });
    record.transactionId = await postExpense('Payment', '300');
    transactionExcess = await postExpense('Excess', '400');
  });
  afterAll(() => pool.onModuleDestroy());
  const record = {
    operation: 'record',
    obligationId,
    paymentId,
    transactionId: '',
    expectedVersion: 1,
    paymentMethod: null,
    paymentCase: 'partial',
    allocationIntent: 'later_installments',
    source: 'manual',
    allocations: [
      { scheduleItemId: itemA, amountMinor: '200' },
      { scheduleItemId: itemB, amountMinor: '100' },
    ],
    operationId: randomUUID(),
    requestId: 'payment-live-record',
  };

  it('commits one payment, allocations, projections, and event atomically', async () => {
    const result = await command(owner, record);
    expect(result.rows[0]?.result).toMatchObject({ id: paymentId, amountMinor: '300', version: 1 });
    const state = await pool.query<{ allocated: string; paid: string; events: string }>(
      `select
      (select sum(amount_minor)::text from public.obligation_payment_allocations where payment_id=$1) allocated,
      (select sum(paid_minor)::text from public.obligation_schedule_items where obligation_id=$2) paid,
      (select count(*)::text from private.outbox_events where aggregate_id=$1) events`,
      [paymentId, obligationId],
    );
    expect(state.rows[0]).toEqual({ allocated: '300', paid: '300', events: '1' });
  });

  it('retains authorized prepayment excess without overfilling and reverses its schedule projection', async () => {
    const prepaymentObligationId = randomUUID();
    const prepaymentScheduleItemId = randomUUID();
    const prepaymentPaymentId = randomUUID();
    await pool.withClient(async (client) => {
      await client.query('begin');
      await client.query('set local role masarifi_migration');
      await client.query(
        `insert into public.obligations(id,user_id,name,direction,type,schedule_kind,currency_code,principal_minor,installment_amount_minor,installment_count,frequency,expected_day,start_date)
         values($1,$2,'Prepayment loan','payable','installment','fixed_term','SAR',100,100,1,'monthly',1,current_date)`,
        [prepaymentObligationId, owner],
      );
      await client.query(
        `insert into public.obligation_schedule_items(id,user_id,obligation_id,due_at,amount_minor,sequence_no)
         values($1,$2,$3,current_date+interval '1 month',100,1)`,
        [prepaymentScheduleItemId, owner, prepaymentObligationId],
      );
      await client.query('commit');
    });
    const prepaymentTransactionId = await postExpense('Authorized prepayment', '150');

    await command(owner, {
      operation: 'record',
      obligationId: prepaymentObligationId,
      paymentId: prepaymentPaymentId,
      transactionId: prepaymentTransactionId,
      expectedVersion: 1,
      paymentMethod: null,
      paymentCase: 'over',
      allocationIntent: 'prepayment',
      source: 'manual',
      allocations: [{ scheduleItemId: prepaymentScheduleItemId, amountMinor: '150' }],
      operationId: randomUUID(),
      requestId: 'payment-live-explicit-prepayment',
    });

    const state = await pool.query<{
      payment_amount: string;
      principal_reduction: string;
      settlement_adjustment: string;
      allocated: string;
      paid: string;
      schedule_status: string;
    }>(
      `select p.amount_minor::text payment_amount,
         p.principal_reduction_minor::text principal_reduction,
         p.settlement_adjustment_minor::text settlement_adjustment,
         (select sum(a.amount_minor)::text from public.obligation_payment_allocations a where a.payment_id=p.id) allocated,
         i.paid_minor::text paid,i.status schedule_status
       from public.obligation_payments p
       join public.obligation_schedule_items i on i.obligation_id=p.obligation_id
       where p.id=$1`,
      [prepaymentPaymentId],
    );
    expect(state.rows[0]).toEqual({
      payment_amount: '150',
      principal_reduction: '50',
      settlement_adjustment: '0',
      allocated: '150',
      paid: '100',
      schedule_status: 'paid',
    });

    const reversed = await command(owner, {
      operation: 'reverse',
      obligationId: prepaymentObligationId,
      paymentId: prepaymentPaymentId,
      expectedVersion: 1,
      operationId: randomUUID(),
      requestId: 'payment-live-explicit-prepayment-reverse',
    });
    expect(reversed.rows[0]?.result).toMatchObject({ status: 'reversed' });
    const reversedState = await pool.query<{
      paid: string;
      schedule_status: string;
    }>(
      `select paid_minor::text paid,status schedule_status
       from public.obligation_schedule_items
       where id=$1`,
      [prepaymentScheduleItemId],
    );
    expect(reversedState.rows[0]).toEqual({ paid: '0', schedule_status: 'due' });
  });

  it('rejects duplicate, foreign, currency, stale, and implicit excess attempts without partial effects', async () => {
    const countBefore = await pool.query<{ count: string }>(
      'select count(*)::text count from public.obligation_payments where user_id=$1',
      [owner],
    );
    await expect(
      command(other, {
        ...record,
        paymentId: randomUUID(),
        operationId: randomUUID(),
        expectedVersion: 2,
      }),
    ).rejects.toThrow(/OBLIGATION_NOT_FOUND/);
    await expect(
      command(owner, {
        ...record,
        paymentId: randomUUID(),
        operationId: randomUUID(),
        expectedVersion: 2,
      }),
    ).rejects.toThrow(/PAYMENT_TRANSACTION_USED/);
    await expect(
      command(owner, {
        ...record,
        paymentId: randomUUID(),
        transactionId: transactionExcess,
        operationId: randomUUID(),
        expectedVersion: 2,
        allocations: [{ scheduleItemId: itemB, amountMinor: '400' }],
      }),
    ).rejects.toThrow(/PAYMENT_ALLOCATION_EXCEEDS_REMAINDER/);
    const count = await pool.query<{ count: string }>(
      'select count(*)::text count from public.obligation_payments where user_id=$1',
      [owner],
    );
    expect(count.rows[0]?.count).toBe(countBefore.rows[0]?.count);
  });

  it.each(['reversed', 'deleted'] as const)(
    'invalidates the linked payment and its schedule projection when the ledger transaction is %s',
    async (transactionStatus) => {
      const { linkedTransactionId } = await seedLinkedPayment(transactionStatus);

      if (transactionStatus === 'reversed') {
        await planningOwnerQuery(
          pool,
          owner,
          'select private.reverse_transaction($1,$2::uuid,1,clock_timestamp(),$3)',
          [owner, linkedTransactionId, 'Linked payment reversal'],
        );
      } else {
        await planningOwnerQuery(
          pool,
          owner,
          'select private.soft_delete_transaction($1,$2::uuid,1,$3)',
          [owner, linkedTransactionId, 'Linked payment deletion'],
        );
      }

      const state = await pool.query<{
        transaction_status: string;
        payment_status: string;
        paid_minor: string;
        schedule_status: string;
        allocated_minor: string;
        obligation_paid_minor: string;
        remaining_minor: string;
        allocation_count: string;
      }>(
        `select t.status transaction_status,p.status payment_status,i.paid_minor::text,
           i.status schedule_status,s.allocated_minor::text,
           s.paid_minor::text obligation_paid_minor,s.remaining_minor::text,
           (select count(*)::text from public.obligation_payment_allocations a where a.payment_id=p.id) allocation_count
         from public.transactions t
         join public.obligation_payments p on p.transaction_id=t.id
         join public.obligation_schedule_items i on i.obligation_id=p.obligation_id
         join public.v_obligation_status s on s.obligation_id=p.obligation_id
         where t.id=$1`,
        [linkedTransactionId],
      );
      expect(state.rows[0]).toEqual({
        transaction_status: transactionStatus,
        payment_status: 'reversed',
        paid_minor: '0',
        schedule_status: 'due',
        allocated_minor: '0',
        obligation_paid_minor: '0',
        remaining_minor: '100',
        allocation_count: '1',
      });

      if (transactionStatus === 'deleted') {
        await planningOwnerQuery(pool, owner, 'select private.restore_transaction($1,$2::uuid,2)', [
          owner,
          linkedTransactionId,
        ]);
        const restored = await pool.query<{
          transaction_status: string;
          payment_status: string;
          paid_minor: string;
          schedule_status: string;
          remaining_minor: string;
          restored_outbox_events: string;
          restored_audit_events: string;
          restored_sync_operation: string;
          restored_snapshot_status: string;
          restored_audit_marker: string;
        }>(
          `select t.status transaction_status,p.status payment_status,i.paid_minor::text,
             i.status schedule_status,s.remaining_minor::text,
             (select count(*)::text from private.outbox_events o
              where o.aggregate_id=p.id and o.event_type='planning.obligation_payment_recorded'
                and o.payload->>'requestId'='ledger-transaction-restored') restored_outbox_events,
             (select count(*)::text from audit.audit_events e
              where e.resource_id=p.id::text and e.action='planning.obligation-payment-recorded'
                and e.request_id='ledger-transaction-restored') restored_audit_events,
             (select o.payload#>>'{sync,operation}' from private.outbox_events o
              where o.aggregate_id=p.id and o.event_type='planning.obligation_payment_recorded'
                and o.payload->>'requestId'='ledger-transaction-restored') restored_sync_operation,
             (select o.payload#>>'{sync,snapshot,status}' from private.outbox_events o
              where o.aggregate_id=p.id and o.event_type='planning.obligation_payment_recorded'
                and o.payload->>'requestId'='ledger-transaction-restored') restored_snapshot_status,
             (select e.metadata->>'restoredFromTransactionDeletion' from audit.audit_events e
              where e.resource_id=p.id::text and e.action='planning.obligation-payment-recorded'
                and e.request_id='ledger-transaction-restored') restored_audit_marker
           from public.transactions t
           join public.obligation_payments p on p.transaction_id=t.id
           join public.obligation_schedule_items i on i.obligation_id=p.obligation_id
           join public.v_obligation_status s on s.obligation_id=p.obligation_id
           where t.id=$1`,
          [linkedTransactionId],
        );
        expect(restored.rows[0]).toEqual({
          transaction_status: 'confirmed',
          payment_status: 'confirmed',
          paid_minor: '100',
          schedule_status: 'paid',
          remaining_minor: '0',
          restored_outbox_events: '1',
          restored_audit_events: '1',
          restored_sync_operation: 'upsert',
          restored_snapshot_status: 'confirmed',
          restored_audit_marker: 'true',
        });
      }
    },
  );

  it('restores a deleted linked prepayment within its persisted authorized excess', async () => {
    const { linkedPaymentId, linkedTransactionId } = await seedLinkedPayment(
      'authorized-prepayment-restore',
      { transactionAmount: '150', allocationIntent: 'prepayment' },
    );
    await planningOwnerQuery(
      pool,
      owner,
      'select private.soft_delete_transaction($1,$2::uuid,1,$3)',
      [owner, linkedTransactionId, 'Delete authorized prepayment'],
    );
    await planningOwnerQuery(pool, owner, 'select private.restore_transaction($1,$2::uuid,2)', [
      owner,
      linkedTransactionId,
    ]);

    const state = await pool.query<{
      transaction_status: string;
      payment_status: string;
      principal_reduction_minor: string;
      paid_minor: string;
    }>(
      `select t.status transaction_status,p.status payment_status,
         p.principal_reduction_minor::text,i.paid_minor::text
       from public.transactions t
       join public.obligation_payments p on p.transaction_id=t.id
       join public.obligation_schedule_items i on i.obligation_id=p.obligation_id
       where p.id=$1`,
      [linkedPaymentId],
    );
    expect(state.rows[0]).toEqual({
      transaction_status: 'confirmed',
      payment_status: 'confirmed',
      principal_reduction_minor: '50',
      paid_minor: '100',
    });
  });

  it('does not resurrect a manually reversed payment through stale deletion or transaction undo', async () => {
    const { linkedObligationId, linkedPaymentId, linkedTransactionId } = await seedLinkedPayment(
      'manual-reversal-before-undo',
    );
    await command(owner, {
      operation: 'reverse',
      obligationId: linkedObligationId,
      paymentId: linkedPaymentId,
      expectedVersion: 1,
      operationId: randomUUID(),
      requestId: 'payment-manual-before-transaction-undo',
    });
    const balanceBefore = (
      await pool.query(
        'select confirmed_minor,ledger_version from public.account_balances where account_id=$1',
        [accountId],
      )
    ).rows;
    await expect(
      planningOwnerQuery(pool, owner, 'select private.soft_delete_transaction($1,$2::uuid,1,$3)', [
        owner,
        linkedTransactionId,
        'Delete after manual payment reversal',
      ]),
    ).rejects.toThrow(/VERSION_CONFLICT/);
    await expect(
      planningOwnerQuery(pool, owner, 'select private.soft_delete_transaction($1,$2::uuid,2,$3)', [
        owner,
        linkedTransactionId,
        'Delete compensated payment',
      ]),
    ).rejects.toThrow(/TRANSACTION_HAS_DEPENDENTS/);
    await expect(
      planningOwnerQuery(pool, owner, 'select private.restore_transaction($1,$2::uuid,2)', [
        owner,
        linkedTransactionId,
      ]),
    ).rejects.toThrow(/TRANSACTION_INELIGIBLE/);

    const state = await pool.query<{
      transaction_status: string;
      payment_status: string;
      ledger_invalidation_status: string | null;
      compensations: string;
      paid_minor: string;
    }>(
      `select t.status transaction_status,p.status payment_status,p.ledger_invalidation_status,
         (select count(*)::text from public.transactions r where r.reverses_transaction_id=t.id
           and r.kind='reversal' and r.status='confirmed') compensations,
         (select sum(i.paid_minor)::text from public.obligation_schedule_items i where i.obligation_id=p.obligation_id) paid_minor
       from public.transactions t
       join public.obligation_payments p on p.transaction_id=t.id
       where t.id=$1`,
      [linkedTransactionId],
    );
    expect(state.rows[0]).toEqual({
      transaction_status: 'reversed',
      payment_status: 'reversed',
      ledger_invalidation_status: null,
      compensations: '1',
      paid_minor: '0',
    });
    expect(
      (
        await pool.query(
          'select confirmed_minor,ledger_version from public.account_balances where account_id=$1',
          [accountId],
        )
      ).rows,
    ).toEqual(balanceBefore);
  });

  it('rejects transaction undo atomically when another payment consumed the released schedule', async () => {
    const { linkedObligationId, linkedScheduleItemId, linkedTransactionId } =
      await seedLinkedPayment('restore-conflict');
    await planningOwnerQuery(
      pool,
      owner,
      'select private.soft_delete_transaction($1,$2::uuid,1,$3)',
      [owner, linkedTransactionId, 'Delete before replacement payment'],
    );
    const replacementTransactionId = await postExpense('Replacement obligation payment', '100');
    const replacementPaymentId = randomUUID();
    const obligationVersion = await pool.query<{ version: string }>(
      'select version::text from public.obligations where id=$1',
      [linkedObligationId],
    );
    await command(owner, {
      operation: 'record',
      obligationId: linkedObligationId,
      paymentId: replacementPaymentId,
      transactionId: replacementTransactionId,
      expectedVersion: Number(obligationVersion.rows[0]?.version),
      paymentMethod: null,
      paymentCase: 'full',
      allocationIntent: 'current',
      source: 'manual',
      allocations: [{ scheduleItemId: linkedScheduleItemId, amountMinor: '100' }],
      operationId: randomUUID(),
      requestId: 'payment-ledger-restore-conflict-replacement',
    });

    await expect(
      planningOwnerQuery(pool, owner, 'select private.restore_transaction($1,$2::uuid,2)', [
        owner,
        linkedTransactionId,
      ]),
    ).rejects.toThrow(/TRANSACTION_INELIGIBLE/);
    const state = await pool.query<{
      transaction_status: string;
      original_payment_status: string;
      replacement_payment_status: string;
      paid_minor: string;
    }>(
      `select t.status transaction_status,original.status original_payment_status,
         replacement.status replacement_payment_status,i.paid_minor::text
       from public.transactions t
       join public.obligation_payments original on original.transaction_id=t.id
       join public.obligation_payments replacement on replacement.id=$2
       join public.obligation_schedule_items i on i.id=$3
       where t.id=$1`,
      [linkedTransactionId, replacementPaymentId, linkedScheduleItemId],
    );
    expect(state.rows[0]).toEqual({
      transaction_status: 'deleted',
      original_payment_status: 'reversed',
      replacement_payment_status: 'confirmed',
      paid_minor: '100',
    });
  });

  it('uses one lock order for concurrent ledger and manual payment reversal', async () => {
    const { linkedObligationId, linkedPaymentId, linkedTransactionId } =
      await seedLinkedPayment('concurrent-reversal');

    async function waitForOwnerLock(pid: number) {
      for (let attempt = 0; attempt < 100; attempt += 1) {
        const locks = await pool.query<{ waiting: boolean }>(
          "select exists(select 1 from pg_locks where pid=$1 and locktype='advisory' and not granted) as waiting",
          [pid],
        );
        if (locks.rows[0]?.waiting) return;
        await new Promise((resolve) => setTimeout(resolve, 10));
      }
      throw new Error('REVERSAL_DID_NOT_WAIT_FOR_OWNER_LOCK');
    }
    function queueReversal(sql: string, values: unknown[]) {
      let publishPid!: (pid: number) => void;
      const pid = new Promise<number>((resolve) => {
        publishPid = resolve;
      });
      const operation = withPlanningOwner(pool, owner, async (client) => {
        const backend = (await client.query<{ pid: number }>('select pg_backend_pid() as pid'))
          .rows[0]?.pid;
        if (backend === undefined) throw new Error('REVERSAL_BACKEND_PID_MISSING');
        publishPid(backend);
        return client.query(sql, values);
      });
      return {
        pid: Promise.race([
          pid,
          operation.then(() => {
            throw new Error('REVERSAL_COMPLETED_WITHOUT_WAITING');
          }),
        ]),
        operation,
        settled: Promise.allSettled([operation]),
      };
    }
    await pool.withClient(async (barrier) => {
      await barrier.query('begin');
      const pending: Promise<unknown>[] = [];
      try {
        // Queue both commands at the same owner lock, without inverting production lock order.
        await barrier.query('select pg_advisory_xact_lock(hashtextextended($1,0))', [owner]);

        const ledgerReversal = queueReversal(
          'select private.reverse_transaction($1,$2::uuid,1,clock_timestamp(),$3)',
          [owner, linkedTransactionId, 'Concurrent linked payment reversal'],
        );
        pending.push(ledgerReversal.settled);
        await waitForOwnerLock(await ledgerReversal.pid);
        const manualReversal = queueReversal(
          'select private.allocate_obligation_payment($1,$2::jsonb)',
          [
            owner,
            JSON.stringify({
              operation: 'reverse',
              obligationId: linkedObligationId,
              paymentId: linkedPaymentId,
              expectedVersion: 1,
              operationId: randomUUID(),
              requestId: 'payment-manual-concurrent-reversal',
            }),
          ],
        );
        pending.push(manualReversal.settled);
        await waitForOwnerLock(await manualReversal.pid);
        const results = Promise.allSettled([ledgerReversal.operation, manualReversal.operation]);
        await barrier.query('commit');
        const [ledger, manual] = await results;
        expect(ledger.status).toBe('fulfilled');
        expect(manual.status).toBe('rejected');
        if (manual.status === 'rejected') expect(String(manual.reason)).toMatch(/VERSION_CONFLICT/);
      } catch (error) {
        await barrier.query('rollback');
        await Promise.all(pending);
        throw error;
      }
    });

    const state = await pool.query<{
      transaction_status: string;
      payment_status: string;
      compensations: string;
      paid_minor: string;
      net_effect: string;
    }>(
      `select t.status transaction_status,p.status payment_status,
         (select count(*)::text from public.transactions r where r.reverses_transaction_id=t.id
           and r.kind='reversal' and r.status='confirmed') compensations,
         (select sum(i.paid_minor)::text from public.obligation_schedule_items i where i.obligation_id=p.obligation_id) paid_minor,
         (select sum(posting.amount_minor)::text from public.transaction_postings posting
           join public.transactions affected on affected.id=posting.transaction_id
           where affected.id=t.id or affected.reverses_transaction_id=t.id) net_effect
       from public.transactions t
       join public.obligation_payments p on p.transaction_id=t.id
       where t.id=$1`,
      [linkedTransactionId],
    );
    expect(state.rows[0]).toEqual({
      transaction_status: 'reversed',
      payment_status: 'reversed',
      compensations: '1',
      paid_minor: '0',
      net_effect: '0',
    });
  });

  it('serializes reversal and reconstruction with one terminal winner', async () => {
    const reverse = {
      operation: 'reverse',
      obligationId,
      paymentId,
      expectedVersion: 1,
      operationId: randomUUID(),
      requestId: 'payment-live-reverse',
    };
    const calls = await Promise.allSettled([
      command(owner, reverse),
      command(owner, { ...reverse, operationId: randomUUID() }),
    ]);
    expect(calls.filter(({ status }) => status === 'fulfilled')).toHaveLength(1);
    const state = await pool.query<{ status: string; paid: string; events: string }>(
      `select
      (select status from public.obligation_payments where id=$1) status,
      (select sum(paid_minor)::text from public.obligation_schedule_items where obligation_id=$2) paid,
      (select count(*)::text from private.outbox_events where aggregate_id=$1) events`,
      [paymentId, obligationId],
    );
    expect(state.rows[0]).toEqual({ status: 'reversed', paid: '0', events: '2' });
  });
});
