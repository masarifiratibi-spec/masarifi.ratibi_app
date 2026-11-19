import { randomUUID } from 'node:crypto';

import type { PoolClient } from 'pg';

import { PlanningRepository } from '../../../src/planning/planning.repository';
import { createLivePool, describeLiveDatabase } from '../../live-database';

const period = { key: '2026-01', start: '2026-01-01', end: '2026-01-31' };

describeLiveDatabase('planning summary completeness', () => {
  const pool = createLivePool();
  const repository = new PlanningRepository(pool);

  async function seed(action: (client: PoolClient) => Promise<void>) {
    return pool.withClient(async (client) => {
      await client.query('begin');
      try {
        await client.query('set local role masarifi_migration');
        await action(client);
        await client.query('commit');
      } catch (error) {
        await client.query('rollback');
        throw error;
      }
    });
  }

  afterAll(() => pool.onModuleDestroy());

  it('carries unpaid installments into the salary cycle and reserves each balance once before the next receipt', async () => {
    const owner = `planning_summary_${randomUUID()}`;
    const profileId = randomUUID();
    const receivedTransactionId = randomUUID();
    const payableId = randomUUID();
    const receivableId = randomUUID();
    const closedPayableId = randomUUID();

    await seed(async (client) => {
      await client.query("insert into public.profiles(id,status) values($1,'active')", [owner]);
      await client.query(
        `insert into public.salary_profiles(id,user_id,name,amount_minor,currency_code,frequency,expected_day)
         values($1,$2,'Salary',1000,'SAR','monthly',20)`,
        [profileId, owner],
      );
      await client.query(
        `insert into public.transactions(id,user_id,kind,status,amount_minor,currency_code,title,occurred_at)
         values($1,$2,'income','confirmed',1000,'SAR','Received salary','2026-01-02T00:00:00Z')`,
        [receivedTransactionId, owner],
      );
      await client.query(
        `insert into public.salary_receipts(user_id,salary_profile_id,transaction_id,expected_at,received_at,amount_minor,status)
         values($1,$2,$3,'2026-01-02T00:00:00Z','2026-01-02T00:00:00Z',1000,'received'),
               ($1,$2,null,'2026-01-20T00:00:00Z',null,1000,'expected')`,
        [owner, profileId, receivedTransactionId],
      );
      await client.query(
        `insert into public.obligations(id,user_id,name,direction,type,schedule_kind,currency_code,principal_minor,
         installment_amount_minor,installment_count,frequency,expected_day,start_date,status)
         values($1,$4,'Payable','payable','bill','fixed_term','SAR',690,150,6,'monthly',10,'2025-10-01','active'),
               ($2,$4,'Receivable','receivable','debt','fixed_term','SAR',700,700,1,'monthly',10,'2026-01-01','active'),
               ($3,$4,'Closed payable','payable','bill','fixed_term','SAR',900,900,1,'monthly',10,'2026-01-01','closed')`,
        [payableId, receivableId, closedPayableId, owner],
      );
      await client.query(
        `insert into public.obligation_schedule_items(user_id,obligation_id,due_at,amount_minor,paid_minor,status,sequence_no)
         values($1,$2,'2025-10-10T00:00:00Z',150,150,'paid',1),
               ($1,$2,'2025-11-10T00:00:00Z',100,0,'cancelled',2),
               ($1,$2,'2025-12-10T00:00:00Z',150,40,'partial',3),
               ($1,$2,'2026-01-10T00:00:00Z',90,0,'due',4),
               ($1,$2,'2026-01-15T00:00:00Z',100,0,'skipped',5),
               ($1,$2,'2026-01-20T00:00:00Z',100,0,'due',6),
               ($1,$3,'2026-01-10T00:00:00Z',700,0,'due',1),
               ($1,$4,'2026-01-10T00:00:00Z',900,0,'due',1)`,
        [owner, payableId, receivableId, closedPayableId],
      );
    });

    const summary = await repository.getPlanningSummary(
      { userId: owner, sessionId: 'session', factorAgeSeconds: 0 },
      { ...period, asOf: '2026-01-07' },
      'planning-summary-lifecycle',
    );

    expect(summary).toMatchObject({
      dataState: 'ready',
      salary: {
        reservedObligationMinor: '200',
        nextExpectedAt: '2026-01-20T00:00:00.000Z',
      },
      obligations: {
        payables: [{ id: payableId, nextDueAmountMinor: '110' }],
        receivables: [{ id: receivableId }],
      },
    });

    const beforeFirstReceipt = await repository.getPlanningSummary(
      { userId: owner, sessionId: 'session', factorAgeSeconds: 0 },
      { key: '2025-12', start: '2025-12-01', end: '2025-12-31' },
      'planning-summary-before-first-receipt',
    );
    expect(beforeFirstReceipt.salary).toMatchObject({
      startReceiptId: null,
      reservedObligationMinor: '0',
    });
  });

  it('marks a bounded summary partial instead of reporting silently truncated children as ready', async () => {
    const owner = `planning_children_${randomUUID()}`;
    await seed(async (client) => {
      await client.query("insert into public.profiles(id,status) values($1,'active')", [owner]);
      await client.query(
        `insert into public.savings_goals(user_id,name,currency_code,target_minor,status)
         select $1,'Goal '||value,'SAR',1000,'active' from generate_series(1,101) value`,
        [owner],
      );
    });

    const summary = await repository.getPlanningSummary(
      { userId: owner, sessionId: 'session', factorAgeSeconds: 0 },
      period,
      'planning-summary-completeness',
    );

    expect(summary.dataState).toBe('partial');
    expect(summary.savings).toHaveLength(100);
  });
});
