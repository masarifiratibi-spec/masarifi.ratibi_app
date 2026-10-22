import { randomUUID } from 'node:crypto';
import type { PoolClient } from 'pg';
import { PlanningRepository } from '../../../src/planning/planning.repository';
import { LedgerRepository } from '../../../src/ledger/ledger.repository';
import { createLivePool, describeLiveDatabase } from '../../live-database';

function fixtureValue<T>(value: T | undefined): T {
  if (value === undefined) throw new Error('SHARED_PLANNING_FIXTURE_VALUE_MISSING');
  return value;
}

const cases = [
  [0, 'SAR'],
  [0, 'EGP'],
  [1, 'SAR'],
  [1, 'EGP'],
] as const;

describeLiveDatabase('shared planning repairs for ordinary owners', () => {
  const pool = createLivePool();
  beforeAll(() => {
    const target = new URL(process.env.DATABASE_URL ?? '');
    if (target.hostname !== '127.0.0.1' || target.pathname !== '/planning_shared_20261022')
      throw new Error('ISOLATED_SHARED_PLANNING_DATABASE_REQUIRED');
  });
  afterAll(() => pool.onModuleDestroy());

  async function fixture(
    run: (context: {
      client: PoolClient;
      owners: string[];
      accounts: string[][];
      planning: PlanningRepository;
      ledger: LedgerRepository;
    }) => Promise<void>,
  ) {
    await pool.withClient(async (client) => {
      await client.query('begin');
      try {
        await client.query('set local role masarifi_migration');
        const owners = [0, 1].map(() => `user_SharedPlanning${randomUUID().replaceAll('-', '')}`);
        const accounts = owners.map(() => [randomUUID(), randomUUID()]);
        for (const [index, owner] of owners.entries()) {
          await client.query(
            "insert into public.profiles(id,status,timezone) values($1,'active',$2)",
            [owner, index ? 'Africa/Cairo' : 'Asia/Riyadh'],
          );
          for (const [currencyIndex, currency] of ['SAR', 'EGP'].entries())
            await client.query(
              "insert into public.accounts(id,user_id,name,type,currency_code) values($1,$2,'Shared test','bank',$3)",
              [fixtureValue(fixtureValue(accounts[index])[currencyIndex]), owner, currency],
            );
        }
        const proxy = {
          query: (sql: string, values?: unknown[]) =>
            client.query(
              sql === 'begin'
                ? 'savepoint shared_api'
                : sql === 'commit'
                  ? 'release savepoint shared_api'
                  : sql === 'rollback'
                    ? 'rollback to savepoint shared_api'
                    : sql,
              values,
            ),
        };
        const connection = {
          withClient: async (action: (c: typeof proxy) => Promise<unknown>) => action(proxy),
        };
        await run({
          client,
          owners,
          accounts,
          planning: new PlanningRepository(connection as never),
          ledger: new LedgerRepository(connection as never),
        });
      } finally {
        await client.query('rollback');
      }
    });
  }

  function principal(owner: string) {
    return { userId: owner, sessionId: 'shared-test', factorAgeSeconds: 0 };
  }

  it.each(
    cases.flatMap(([index, currency]) => [
      [index, currency, true] as const,
      [index, currency, false] as const,
    ]),
  )(
    'owner %i / %s saves a final payment version (created=%s) and reverses once',
    async (index, currency, created) => {
      await fixture(async ({ client, owners, accounts, planning }) => {
        const owner = fixtureValue(owners[index]);
        const account = fixtureValue(fixtureValue(accounts[index])[currency === 'SAR' ? 0 : 1]);
        const obligation = randomUUID(),
          item = randomUUID();
        await client.query(
          `insert into public.obligations(id,user_id,name,direction,type,schedule_kind,currency_code,
        principal_minor,installment_amount_minor,installment_count,frequency,expected_day,start_date)
        values($1,$2,'Shared obligation','payable','installment','fixed_term',$3,10000,5000,2,'monthly',22,'2026-10-22')`,
          [obligation, owner, currency],
        );
        await client.query(
          `insert into public.obligation_schedule_items(id,user_id,obligation_id,due_at,amount_minor,sequence_no)
        values($1,$2,$3,'2026-10-22T10:00:00Z',5000,1)`,
          [item, owner, obligation],
        );
        const transactionCommand = {
          kind: 'expense',
          amountMinor: '5000',
          currency,
          accountId: account,
          title: 'Shared payment',
          occurredAt: '2026-10-22T10:00:00Z',
          source: 'manual',
        };
        await client.query("select set_config('request.jwt.claims',$1,true)", [
          JSON.stringify({ sub: owner, role: 'authenticated', sid: 'shared-test' }),
        ]);
        const existingTransaction = created
          ? null
          : fixtureValue(
              (
                await client.query<{ result: { transactionId: string } }>(
                  'select private.post_transaction($1,$2::jsonb) result',
                  [owner, JSON.stringify(transactionCommand)],
                )
              ).rows[0],
            ).result.transactionId;
        const input = {
          operation: 'allocateObligationPayment',
          scope: 'planning.obligation-payment.record',
          status: 201,
          principal: principal(owner),
          idempotencyKey: randomUUID(),
          requestId: 'shared-payment',
          command: {
            obligationId: obligation,
            expectedVersion: 1,
            paymentMethod: null,
            paymentCase: 'partial',
            allocationIntent: 'current',
            source: 'manual',
            allocations: [{ scheduleItemId: item, amountMinor: '5000' }],
            ...(created
              ? { transaction: transactionCommand }
              : { transactionId: existingTransaction }),
          },
        } as const;
        const result = await planning.mutate(input);
        expect(await planning.mutate(input)).toEqual(result);
        await client.query('set local role masarifi_migration');
        const payment = result.resource as {
          id: string;
          version: number;
          transactionId: string;
          transactionOwnership: string;
        };
        const stored = fixtureValue(
          (
            await client.query<{ version: string; transaction_ownership: string }>(
              'select version,transaction_ownership from public.obligation_payments where id=$1',
              [payment.id],
            )
          ).rows[0],
        );
        expect(payment.version).toBe(Number(stored.version));
        expect(payment.transactionOwnership).toBe(created ? 'created' : 'linked_existing');
        expect(stored.transaction_ownership).toBe(created ? 'created' : 'linked_existing');
        expect(
          (
            await client.query(
              'select id from public.transaction_postings where transaction_id=$1',
              [payment.transactionId],
            )
          ).rowCount,
        ).toBe(1);
        const undo = {
          operation: 'reverseObligationPayment',
          scope: 'planning.obligation-payment.reverse',
          status: 200,
          principal: principal(owner),
          idempotencyKey: randomUUID(),
          requestId: 'shared-payment-undo',
          command: {
            obligationId: obligation,
            paymentId: payment.id,
            expectedVersion: payment.version,
          },
        };
        const reversed = await planning.mutate(undo);
        expect(await planning.mutate(undo)).toEqual(reversed);
        expect(reversed.resource).toMatchObject({
          status: 'reversed',
          transactionOwnership: created ? 'created' : 'linked_existing',
        });
        expect(
          fixtureValue(
            (
              await client.query<{ confirmed_minor: string }>(
                'select confirmed_minor from public.account_balances where account_id=$1',
                [account],
              )
            ).rows[0],
          ).confirmed_minor,
        ).toBe('0');
        expect(
          (
            await client.query(
              'select id from public.transactions where reverses_transaction_id=$1',
              [payment.transactionId],
            )
          ).rowCount,
        ).toBe(1);
        expect(
          fixtureValue(
            (
              await client.query<{ paid_minor: string }>(
                'select paid_minor from public.obligation_schedule_items where id=$1',
                [item],
              )
            ).rows[0],
          ).paid_minor,
        ).toBe('0');
        await expect(
          planning.mutate({
            ...undo,
            principal: principal(fixtureValue(owners[1 - index])),
            idempotencyKey: randomUUID(),
          }),
        ).rejects.toThrow();
      });
    },
  );

  it('keeps the shared financial core and reconciliation helper unavailable to direct runtime callers', async () => {
    const result = await pool.query(`select p.proname,
      has_function_privilege('masarifi_api',p.oid,'EXECUTE') api,
      has_function_privilege('masarifi_worker',p.oid,'EXECUTE') worker,
      has_function_privilege('anon',p.oid,'EXECUTE') anonymous,
      has_function_privilege('service_role',p.oid,'EXECUTE') service
      from pg_proc p join pg_namespace n on n.oid=p.pronamespace
      where n.nspname='private' and p.proname in ('allocate_obligation_payment_core','reconcile_salary_receipts')`);
    expect(result.rows).toHaveLength(2);
    for (const row of result.rows)
      expect(row).toMatchObject({ api: false, worker: false, anonymous: false, service: false });
  });

  it.each(
    cases.flatMap(([index, currency]) => [
      [index, currency, true] as const,
      [index, currency, false] as const,
    ]),
  )(
    'owner %i / %s reconciles automatic=%s salary links and replays once',
    async (index, currency, auto) => {
      await fixture(async ({ client, owners, accounts, ledger }) => {
        const owner = fixtureValue(owners[index]),
          account = fixtureValue(fixtureValue(accounts[index])[currency === 'SAR' ? 0 : 1]);
        const profile = randomUUID(),
          automatic = randomUUID();
        await client.query("select set_config('request.jwt.claims',$1,true)", [
          JSON.stringify({ sub: owner, role: 'authenticated', sid: 'shared-test' }),
        ]);
        await client.query(
          `insert into public.salary_profiles(id,user_id,name,amount_minor,currency_code,frequency,expected_day,account_id)
        values($1,$2,'Shared salary',10000,$3,'monthly',22,$4)`,
          [profile, owner, currency, account],
        );
        const transaction = fixtureValue(
          (
            await client.query<{ result: { transactionId: string } }>(
              'select private.post_transaction($1,$2::jsonb) result',
              [
                owner,
                JSON.stringify({
                  kind: 'income',
                  amountMinor: '10000',
                  currency,
                  accountId: account,
                  title: 'Shared salary',
                  occurredAt: '2026-10-22T10:00:00Z',
                  source: 'manual',
                }),
              ],
            )
          ).rows[0],
        ).result.transactionId;
        await client.query(
          `insert into public.salary_receipts(id,user_id,salary_profile_id,transaction_id,expected_at,
          received_at,amount_minor,status,automatically_detected,operation_id)
          values($1,$2,$3,$4,$5,'2026-10-22T10:00:00Z',10000,'received',$6,$7)`,
          [automatic, owner, profile, transaction, '2026-10-22T10:00:00Z', auto, randomUUID()],
        );
        const input = {
          operation: 'reviseTransaction',
          scope: 'ledger.transaction.revise',
          status: 200,
          principal: principal(owner),
          idempotencyKey: randomUUID(),
          requestId: 'shared-salary-date',
          command: {
            transactionId: transaction,
            expectedVersion: 1,
            reason: 'Shared fixture date',
            patch: { occurredAt: '2026-10-22T11:30:00Z' },
          },
        } as const;
        const result = await ledger.mutate(input);
        expect(await ledger.mutate(input)).toEqual(result);
        await client.query('set local role masarifi_migration');
        const receipt = fixtureValue(
          (
            await client.query<{ status: string; received_at: Date }>(
              'select status,received_at from public.salary_receipts where id=$1',
              [automatic],
            )
          ).rows[0],
        );
        expect(receipt.status).toBe(auto ? 'corrected' : 'received');
        expect(receipt.received_at.toISOString()).toBe(
          auto ? '2026-10-22T11:30:00.000Z' : '2026-10-22T10:00:00.000Z',
        );
        expect(
          (
            await client.query(
              "select id from private.outbox_events where aggregate_id=$1 and event_type='planning.salary_receipt_corrected'",
              [automatic],
            )
          ).rowCount,
        ).toBe(auto ? 1 : 0);
        expect(
          (
            await client.query(
              'select id from public.transaction_postings where transaction_id=$1',
              [transaction],
            )
          ).rowCount,
        ).toBe(1);
        await expect(
          ledger.mutate({
            ...input,
            principal: principal(fixtureValue(owners[1 - index])),
            idempotencyKey: randomUUID(),
          }),
        ).rejects.toThrow();
        const invalidated = {
          ...input,
          idempotencyKey: randomUUID(),
          requestId: 'shared-salary-amount',
          command: { ...input.command, expectedVersion: 2, patch: { amountMinor: '20000' } },
        };
        const changed = await ledger.mutate(invalidated);
        expect(await ledger.mutate(invalidated)).toEqual(changed);
        expect(
          (
            await client.query(
              'select status,received_at from public.salary_receipts where id=$1',
              [automatic],
            )
          ).rows[0],
        ).toMatchObject(auto ? { status: 'undone', received_at: null } : { status: 'received' });
      });
    },
  );
});
