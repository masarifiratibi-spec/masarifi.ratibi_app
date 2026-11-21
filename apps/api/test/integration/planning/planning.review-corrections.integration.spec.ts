import { randomUUID } from 'node:crypto';
import type { PoolClient } from 'pg';
import { PlanningRepository } from '../../../src/planning/planning.repository';
import { createLivePool, describeLiveDatabase } from '../../live-database';

describeLiveDatabase('salary and payment review corrections on rollback-only fixtures', () => {
  const pool = createLivePool();
  beforeAll(() => {
    if (!['127.0.0.1', 'localhost'].includes(new URL(process.env.DATABASE_URL ?? '').hostname))
      throw new Error('LOCAL_SYNTHETIC_DATABASE_REQUIRED');
  });
  afterAll(() => pool.onModuleDestroy());

  async function fixture(
    run: (
      client: PoolClient,
      repository: PlanningRepository,
      owner: string,
      account: string,
    ) => Promise<void>,
  ) {
    await pool.withClient(async (client) => {
      await client.query('begin');
      try {
        await client.query('set local role masarifi_migration');
        const owner = `planning_review_${randomUUID()}`,
          account = randomUUID();
        await client.query(
          "insert into public.profiles(id,status,timezone) values($1,'active','Asia/Riyadh')",
          [owner],
        );
        await client.query(
          "insert into public.accounts(id,user_id,name,type,currency_code) values($1,$2,'Isolated','bank','SAR')",
          [account, owner],
        );
        const proxy = {
          query: (sql: string, values?: unknown[]) =>
            client.query(
              sql === 'begin'
                ? 'savepoint review_api'
                : sql === 'commit'
                  ? 'release savepoint review_api'
                  : sql === 'rollback'
                    ? 'rollback to savepoint review_api'
                    : sql,
              values,
            ),
        };
        const repository = new PlanningRepository({
          withClient: async (action: (c: typeof proxy) => Promise<unknown>) => action(proxy),
        } as never);
        await run(client, repository, owner, account);
      } finally {
        await client.query('rollback');
      }
    });
  }

  it.each(['cross-month', 'overdue', 'undone', 'reversed'] as const)(
    'anchors %s salary totals to a valid primary receipt',
    async (scenario) => {
      await fixture(async (client, repository, owner, account) => {
        const profile = randomUUID(),
          receipt = randomUUID();
        await client.query("select set_config('request.jwt.claims',$1,true)", [
          JSON.stringify({ role: 'authenticated', sub: owner, sid: 'isolated' }),
        ]);
        await client.query(
          `insert into public.salary_profiles(id,user_id,name,amount_minor,currency_code,frequency,expected_day,account_id)
        values($1,$2,'Employer',125000,'SAR','monthly',25,$3)`,
          [profile, owner, account],
        );
        const post = async (kind: string, amount: number, at: string) =>
          (
            await client.query<{ result: { transactionId: string } }>(
              'select private.post_transaction($1,$2::jsonb) result',
              [
                owner,
                JSON.stringify({
                  kind,
                  amountMinor: amount,
                  currency: 'SAR',
                  accountId: account,
                  categoryId:
                    kind === 'income'
                      ? '04000000-0000-4000-8000-000000000017'
                      : '04000000-0000-4000-8000-000000000019',
                  title: 'Isolated',
                  occurredAt: at,
                }),
              ],
            )
          ).rows[0]?.result.transactionId;
        const income = await post('income', 125000, '2026-09-24T21:00:00.000Z');
        await post('expense', 10000, '2026-09-28T10:00:00.000Z');
        await post('expense', 20000, '2026-10-05T10:00:00.000Z');
        await post('expense', 5000, '2026-09-20T10:00:00.000Z');
        await client.query(
          `insert into public.salary_receipts(id,user_id,salary_profile_id,transaction_id,expected_at,received_at,amount_minor,status,operation_id)
        values($1,$2,$3,$4,'2026-09-24T21:00:00Z','2026-09-24T21:00:00Z',125000,'received',$5)`,
          [receipt, owner, profile, income, randomUUID()],
        );
        await client.query(
          `insert into public.salary_receipts(user_id,salary_profile_id,expected_at,amount_minor,status)
        values($1,$2,'2026-10-24T21:00:00Z',125000,'expected')`,
          [owner, profile],
        );
        if (scenario === 'undone')
          await client.query(
            "update public.salary_receipts set status='undone',received_at=null where id=$1",
            [receipt],
          );
        if (scenario === 'reversed')
          await client.query(
            "select private.reverse_transaction($1,$2,1,clock_timestamp(),'Isolated review')",
            [owner, income],
          );
        const summary = await repository.getPlanningSummary(
          { userId: owner, sessionId: 'isolated', factorAgeSeconds: 0 },
          {
            key: '2026-10',
            start: '2026-10-01',
            end: '2026-10-31',
            asOf: scenario === 'overdue' ? '2026-10-30' : '2026-10-17',
          },
          'review-cycle',
        );
        expect(summary.salary).toMatchObject(
          scenario === 'undone' || scenario === 'reversed'
            ? { startReceiptId: null }
            : {
                startReceiptId: receipt,
                startAt: '2026-09-24T21:00:00.000Z',
                actualIncomeMinor: '125000',
                actualExpenseMinor: '30000',
                nextExpectedAt: '2026-10-24T21:00:00.000Z',
              },
        );
      });
    },
  );

  it.each(['success', 'success-undo', 'version-conflict', 'bad-allocation'] as const)(
    'keeps the ledger and payment atomic on %s',
    async (scenario) => {
      await fixture(async (client, repository, owner, account) => {
        const obligation = randomUUID(),
          schedule = randomUUID();
        await client.query(
          `insert into public.obligations(id,user_id,name,direction,type,schedule_kind,currency_code,
        principal_minor,installment_amount_minor,installment_count,frequency,expected_day,start_date)
        values($1,$2,'Isolated loan','payable','installment','fixed_term','SAR',10000,5000,2,'monthly',8,'2026-10-08')`,
          [obligation, owner],
        );
        await client.query(
          `insert into public.obligation_schedule_items(id,user_id,obligation_id,due_at,amount_minor,sequence_no)
        values($1,$2,$3,'2026-10-07T21:00:00Z',5000,1) on conflict(obligation_id,sequence_no) do nothing`,
          [schedule, owner, obligation],
        );
        const item = (
          await client.query<{ id: string }>(
            'select id from public.obligation_schedule_items where obligation_id=$1 order by sequence_no limit 1',
            [obligation],
          )
        ).rows[0]?.id;
        if (!item) throw new Error('ISOLATED_SCHEDULE_REQUIRED');
        const input = {
          operation: 'allocateObligationPayment',
          scope: 'planning.obligation-payment.record',
          status: 201,
          principal: { userId: owner, sessionId: 'isolated', factorAgeSeconds: 0 },
          idempotencyKey: 'review-atomic-' + randomUUID(),
          requestId: 'review-atomic',
          command: {
            obligationId: obligation,
            expectedVersion: scenario === 'version-conflict' ? 99 : 1,
            transaction: {
              kind: 'expense',
              amountMinor: 5000,
              currency: 'SAR',
              accountId: account,
              title: 'Isolated loan',
              source: 'manual',
              categoryId: '04000000-0000-4000-8000-000000000019',
              occurredAt: '2026-10-08T00:00:00.000Z',
            },
            paymentMethod: null,
            paymentCase: 'partial',
            allocationIntent: 'current',
            source: 'manual',
            allocations: [
              {
                scheduleItemId: item,
                amountMinor: scenario === 'bad-allocation' ? '4000' : '5000',
              },
            ],
          },
        };
        if (scenario === 'success' || scenario === 'success-undo') {
          const payment = await repository.mutate(input);
          const resource = payment.resource as { id: string; version: number };
          expect(payment.resource).toMatchObject({
            amountMinor: '5000',
            transactionOwnership: 'created',
          });
          expect(await repository.mutate(input)).toEqual(payment);
          await client.query('set local role masarifi_migration');
          const stored = (
            await client.query<{ version: string; transaction_ownership: string }>(
              'select version,transaction_ownership from public.obligation_payments where id=$1',
              [resource.id],
            )
          ).rows[0];
          expect(stored).toEqual({
            version: String(resource.version),
            transaction_ownership: 'created',
          });
          const events = (
            await client.query<{
              payload: {
                aggregateVersion: number;
                sync: {
                  version: number;
                  snapshot: { version: number; transaction_ownership: string };
                };
              };
            }>(
              `select payload from private.outbox_events where aggregate_id=$1
               and event_type='planning.obligation_payment_recorded'`,
              [resource.id],
            )
          ).rows;
          expect(events).toHaveLength(1);
          expect(events[0]?.payload.aggregateVersion).toBe(resource.version);
          expect(events[0]?.payload.sync.version).toBe(resource.version);
          expect(events[0]?.payload.sync.snapshot).toMatchObject({
            version: resource.version,
            transaction_ownership: 'created',
          });
          if (scenario === 'success-undo') {
            const reverseInput = {
              ...input,
              operation: 'reverseObligationPayment',
              scope: 'planning.obligation-payment.reverse',
              status: 200,
              idempotencyKey: 'review-undo-' + randomUUID(),
              command: {
                obligationId: obligation,
                paymentId: resource.id,
                expectedVersion: resource.version,
              },
            };
            const reversed = await repository.mutate(reverseInput);
            expect(reversed.resource).toMatchObject({ status: 'reversed' });
            expect(await repository.mutate(reverseInput)).toEqual(reversed);
          }
        } else await expect(repository.mutate(input)).rejects.toThrow();
        await client.query('set local role masarifi_migration');
        const proof = (
          await client.query<{ transactions: string; payments: string; balance: string }>(
            `select
        (select count(*) from public.transactions where user_id=$1)::text transactions,
        (select count(*) from public.obligation_payments where user_id=$1)::text payments,
        coalesce((select confirmed_minor from public.account_balances where account_id=$2),0)::text balance`,
            [owner, account],
          )
        ).rows[0];
        expect(proof).toEqual(
          scenario === 'success-undo'
            ? { transactions: '2', payments: '1', balance: '0' }
            : scenario === 'success'
              ? { transactions: '1', payments: '1', balance: '-5000' }
              : { transactions: '0', payments: '0', balance: '0' },
        );
      });
    },
  );

  it('keeps linked payments unprivileged and rejects client ownership overrides', async () => {
    await fixture(async (client, _repository, owner, account) => {
      await client.query("select set_config('request.jwt.claims',$1,true)", [
        JSON.stringify({ role: 'authenticated', sub: owner, sid: 'isolated' }),
      ]);
      const obligation = randomUUID();
      await client.query(
        `insert into public.obligations(id,user_id,name,direction,type,schedule_kind,currency_code,principal_minor,installment_amount_minor,installment_count,frequency,expected_day,start_date)
        values($1,$2,'Linked test','payable','installment','fixed_term','SAR',10000,5000,2,'monthly',8,'2026-10-08')`,
        [obligation, owner],
      );
      await client.query(
        `insert into public.obligation_schedule_items(user_id,obligation_id,due_at,amount_minor,sequence_no)
        values($1,$2,'2026-10-07T21:00:00Z',5000,1)`,
        [owner, obligation],
      );
      const item = (
        await client.query<{ id: string }>(
          'select id from public.obligation_schedule_items where obligation_id=$1 order by sequence_no limit 1',
          [obligation],
        )
      ).rows[0]?.id;
      expect(item).toBeDefined();
      const transaction = (
        await client.query<{ result: { transactionId: string } }>(
          'select private.post_transaction($1,$2::jsonb) result',
          [
            owner,
            JSON.stringify({
              kind: 'expense',
              amountMinor: 5000,
              currency: 'SAR',
              accountId: account,
              title: 'Linked expense',
              source: 'manual',
              categoryId: '04000000-0000-4000-8000-000000000019',
              occurredAt: '2026-10-08T00:00:00.000Z',
            }),
          ],
        )
      ).rows[0]?.result.transactionId;
      const command = {
        operation: 'record',
        obligationId: obligation,
        paymentId: randomUUID(),
        transactionId: transaction,
        expectedVersion: 1,
        paymentMethod: null,
        paymentCase: 'partial',
        allocationIntent: 'current',
        source: 'manual',
        allocations: [{ scheduleItemId: item, amountMinor: '5000' }],
        operationId: randomUUID(),
        requestId: 'linked-ownership',
      };
      await client.query('savepoint ownership_override');
      await client.query('set local role masarifi_api');
      await expect(
        client.query('select private.allocate_obligation_payment($1,$2::jsonb)', [
          owner,
          JSON.stringify({ ...command, transactionOwnership: 'created' }),
        ]),
      ).rejects.toThrow(/OBLIGATION_INELIGIBLE/);
      await client.query('rollback to savepoint ownership_override');
      await client.query('set local role masarifi_api');
      const result = (
        await client.query<{
          result: { id: string; version: number; transactionOwnership: string };
        }>('select private.allocate_obligation_payment($1,$2::jsonb) result', [
          owner,
          JSON.stringify(command),
        ])
      ).rows[0]?.result;
      expect(result).toMatchObject({ transactionOwnership: 'linked_existing', version: 1 });
      await client.query('set local role masarifi_migration');
      expect(
        (
          await client.query(
            'select transaction_ownership from public.obligation_payments where id=$1',
            [result?.id],
          )
        ).rows,
      ).toEqual([{ transaction_ownership: 'linked_existing' }]);
    });
  });

  it.each(['anon', 'authenticated', 'service_role', 'masarifi_api', 'masarifi_worker'])(
    'denies direct trusted-ownership allocator access to %s',
    async (role) => {
      await fixture(async (client, _repository, owner) => {
        await client.query(`set local role ${role}`);
        await expect(
          client.query(
            "select private.allocate_obligation_payment_core($1,'{}'::jsonb,'created')",
            [owner],
          ),
        ).rejects.toThrow(/permission denied/);
      });
    },
  );
});
