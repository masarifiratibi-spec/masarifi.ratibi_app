import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { PoolClient } from 'pg';
import { PlanningRepository } from '../../../src/planning/planning.repository';
import { LedgerRepository } from '../../../src/ledger/ledger.repository';
import { PlatformConfigService } from '../../../src/platform/config/platform-config.service';
import { ConfigService } from '@nestjs/config';
import { createLivePool, describeLiveDatabase } from '../../live-database';

function requiredFixtureRow<T>(rows: readonly T[]): T {
  const row = rows[0];
  if (!row) throw new Error('DEV_PLANNING_FIXTURE_ROW_MISSING');
  return row;
}

describeLiveDatabase('isolated DEV planning compatibility', () => {
  const pool = createLivePool();
  beforeAll(() => {
    if (!['127.0.0.1', 'localhost'].includes(new URL(process.env.DATABASE_URL ?? '').hostname))
      throw new Error('LOCAL_SYNTHETIC_DATABASE_REQUIRED');
  });
  afterAll(() => pool.onModuleDestroy());

  it('keeps DEV entry points private and the financial core unavailable to API callers', async () => {
    const checks = await pool.query<{
      api: boolean;
      worker: boolean;
      anonymous: boolean;
      service: boolean;
    }>(
      `select has_function_privilege('masarifi_api',p.oid,'EXECUTE') api,
        has_function_privilege('masarifi_worker',p.oid,'EXECUTE') worker,
        has_function_privilege('anon',p.oid,'EXECUTE') anonymous,
        has_function_privilege('service_role',p.oid,'EXECUTE') service
       from pg_proc p join pg_namespace n on n.oid=p.pronamespace
       where n.nspname='private' and p.proname in ('staging_dev_create_obligation_payment','staging_dev_allocate_obligation_payment','staging_dev_reconcile_salary_receipts')`,
    );
    expect(checks.rows).toHaveLength(3);
    expect(checks.rows).toEqual(
      Array(3).fill({ api: true, worker: false, anonymous: false, service: false }),
    );
    expect(
      (
        await pool.query<{ allowed: boolean }>(
          "select has_function_privilege('masarifi_api','private.staging_dev_allocate_obligation_payment_core(text,jsonb,text)','EXECUTE') allowed",
        )
      ).rows[0]?.allowed,
    ).toBe(false);
  });

  async function fixture(
    run: (client: PoolClient, owner: string, account: string) => Promise<void>,
  ) {
    await pool.withClient(async (client) => {
      await client.query('begin');
      try {
        await client.query('set local role masarifi_migration');
        const owner = `user_DevPlanning${randomUUID().replaceAll('-', '')}`,
          account = randomUUID();
        await client.query(
          "insert into public.profiles(id,status,timezone) values($1,'active','Asia/Riyadh')",
          [owner],
        );
        await client.query(
          "insert into public.accounts(id,user_id,name,type,currency_code) values($1,$2,'Fixture','bank','SAR')",
          [account, owner],
        );
        await client.query(
          "select set_config('request.jwt.claims',$1,true),set_config('masarifi.staging_planning_owner',$2,true)",
          [
            JSON.stringify({ sub: owner, role: 'authenticated', sid: 'dev-planning-fixture' }),
            owner,
          ],
        );
        await run(client, owner, account);
      } finally {
        await client.query('rollback');
      }
    });
  }

  function apiFixture(
    client: PoolClient,
    owner: string,
    overrides: Record<string, string | undefined> = {},
  ) {
    const proxy = {
      query: (sql: string, values?: unknown[]) =>
        client.query(
          sql === 'begin'
            ? 'savepoint dev_api'
            : sql === 'commit'
              ? 'release savepoint dev_api'
              : sql === 'rollback'
                ? 'rollback to savepoint dev_api'
                : sql,
          values,
        ),
    };
    const pool = {
      withClient: async (action: (c: typeof proxy) => Promise<unknown>) => action(proxy),
    };
    const values: Record<string, string | undefined> = {
      MASARIFI_STAGING_PLANNING_REPAIR_OWNER_ID: owner,
      SUPABASE_URL: 'https://qcffvfbpzvpwcwxwjyro.supabase.co',
      MASARIFI_PROCESS_KIND: 'api',
      ...overrides,
    };
    const config = new PlatformConfigService(new ConfigService(values) as never);
    return { pool, config };
  }

  it.each(['enabled', 'different-owner', 'non-staging', 'worker', 'disabled'] as const)(
    'routes %s payment context without changing the shared function',
    async (scenario) => {
      await fixture(async (client, owner, account) => {
        const body = await payment(client, owner, account);
        const legacy = readFileSync(
          resolve(
            __dirname,
            '../../../../../supabase/migrations/20261017144514_atomic_obligation_payment_create.sql',
          ),
          'utf8',
        );
        const start = legacy.indexOf('create function private.create_obligation_payment'),
          end = legacy.indexOf('end $$;', start) + 7;
        await client.query(
          legacy.slice(start, end).replace('create function', 'create or replace function'),
        );
        const before = (
          await client.query(
            "select md5(pg_get_functiondef('private.create_obligation_payment(text,jsonb)'::regprocedure)) hash",
          )
        ).rows;
        await client.query("select set_config('masarifi.staging_planning_owner','',true)");
        const overrides: Record<string, string | undefined> =
          scenario === 'different-owner'
            ? { MASARIFI_STAGING_PLANNING_REPAIR_OWNER_ID: 'user_Another' }
            : scenario === 'non-staging'
              ? { SUPABASE_URL: 'https://other.supabase.co' }
              : scenario === 'worker'
                ? { MASARIFI_PROCESS_KIND: 'worker' }
                : scenario === 'disabled'
                  ? { MASARIFI_STAGING_PLANNING_REPAIR_OWNER_ID: undefined }
                  : {};
        const api = apiFixture(client, owner, overrides);
        const repository = new PlanningRepository(api.pool as never, api.config);
        const input = {
          operation: 'allocateObligationPayment',
          scope: 'planning.obligation-payment.record',
          status: 201,
          principal: { userId: owner, sessionId: 'dev-fixture', factorAgeSeconds: 0 },
          idempotencyKey: randomUUID(),
          requestId: 'dev-payment',
          command: {
            obligationId: body.obligationId,
            expectedVersion: 1,
            paymentMethod: null,
            paymentCase: body.paymentCase,
            allocationIntent: body.allocationIntent,
            source: body.source,
            allocations: body.allocations,
            transaction: body.transaction,
          },
        } as const;
        const saved = await repository.mutate(input);
        expect(await repository.mutate(input)).toEqual(saved);
        await client.query('set local role masarifi_migration');
        const resource = saved.resource as { id: string; version: number; transactionId: string };
        const row = requiredFixtureRow(
          (
            await client.query<{ version: string }>(
              'select version from public.obligation_payments where id=$1',
              [resource.id],
            )
          ).rows,
        );
        if (scenario === 'enabled') expect(resource.version).toBe(Number(row.version));
        else {
          // The rollback-only legacy fixture retains the existing shared-path response.
          expect(resource.version).toBe(1);
          expect(Number(row.version)).toBe(2);
          expect(
            (
              await client.query<{ scope: string | null }>(
                "select nullif(current_setting('masarifi.staging_planning_owner',true),'') scope",
              )
            ).rows[0]?.scope,
          ).toBeNull();
        }
        expect(
          (
            await client.query(
              'select id from public.transaction_postings where transaction_id=$1',
              [resource.transactionId],
            )
          ).rowCount,
        ).toBe(1);
        expect(
          (
            await client.query(
              "select md5(pg_get_functiondef('private.create_obligation_payment(text,jsonb)'::regprocedure)) hash",
            )
          ).rows,
        ).toEqual(before);
        if (scenario === 'enabled') {
          const undo = {
            operation: 'reverseObligationPayment',
            scope: 'planning.obligation-payment.reverse',
            status: 200,
            principal: input.principal,
            idempotencyKey: randomUUID(),
            requestId: 'dev-payment-undo',
            command: {
              obligationId: body.obligationId,
              paymentId: resource.id,
              expectedVersion: resource.version,
            },
          };
          const reversed = await repository.mutate(undo);
          expect(await repository.mutate(undo)).toEqual(reversed);
          await client.query('set local role masarifi_migration');
          const stored = requiredFixtureRow(
            (
              await client.query<{ version: string; status: string }>(
                'select version,status from public.obligation_payments where id=$1',
                [resource.id],
              )
            ).rows,
          );
          expect(reversed.resource).toMatchObject({
            version: Number(stored.version),
            status: 'reversed',
            transactionOwnership: 'created',
          });
          expect(stored.status).toBe('reversed');
          expect(
            (
              await client.query(
                'select id from public.transactions where reverses_transaction_id=$1',
                [resource.transactionId],
              )
            ).rowCount,
          ).toBe(1);
          expect(
            requiredFixtureRow(
              (
                await client.query<{ confirmed_minor: string }>(
                  'select confirmed_minor from public.account_balances where account_id=$1',
                  [account],
                )
              ).rows,
            ).confirmed_minor,
          ).toBe('0');
        }
      });
    },
  );

  it('links an existing expense without another posting and returns its ownership', async () => {
    await fixture(async (client, owner, account) => {
      const body = await payment(client, owner, account);
      const tx = requiredFixtureRow(
        (
          await client.query<{ result: { transactionId: string } }>(
            'select private.post_transaction($1,$2::jsonb) result',
            [owner, JSON.stringify(body.transaction)],
          )
        ).rows,
      ).result.transactionId;
      const api = apiFixture(client, owner),
        repository = new PlanningRepository(api.pool as never, api.config);
      const input = {
        operation: 'allocateObligationPayment',
        scope: 'planning.obligation-payment.record',
        status: 201,
        principal: { userId: owner, sessionId: 'dev-fixture', factorAgeSeconds: 0 },
        idempotencyKey: randomUUID(),
        requestId: 'dev-link-payment',
        command: {
          obligationId: body.obligationId,
          transactionId: tx,
          expectedVersion: 1,
          paymentMethod: null,
          paymentCase: body.paymentCase,
          allocationIntent: body.allocationIntent,
          source: body.source,
          allocations: body.allocations,
        },
      };
      const linked = await repository.mutate(input);
      expect(await repository.mutate(input)).toEqual(linked);
      expect(linked.resource).toMatchObject({
        transactionId: tx,
        transactionOwnership: 'linked_existing',
      });
      await client.query('set local role masarifi_migration');
      expect(
        (await client.query('select id from public.transactions where user_id=$1', [owner]))
          .rowCount,
      ).toBe(1);
      expect(
        (
          await client.query('select id from public.transaction_postings where transaction_id=$1', [
            tx,
          ])
        ).rowCount,
      ).toBe(1);
    });
  });

  it('the DEV ledger revision atomically refreshes its automatic salary date and replays without another effect', async () => {
    await fixture(async (client, owner, account) => {
      const profile = randomUUID(),
        receipt = randomUUID();
      await client.query(
        "insert into public.salary_profiles(id,user_id,name,amount_minor,currency_code,frequency,expected_day,account_id) values($1,$2,'Employer',125000,'SAR','monthly',19,$3)",
        [profile, owner, account],
      );
      const tx = requiredFixtureRow(
        (
          await client.query<{ result: { transactionId: string } }>(
            'select private.post_transaction($1,$2::jsonb) result',
            [
              owner,
              JSON.stringify({
                kind: 'income',
                amountMinor: '125000',
                currency: 'SAR',
                accountId: account,
                title: 'Salary fixture',
                occurredAt: '2026-10-18T21:00:00Z',
                source: 'manual',
              }),
            ],
          )
        ).rows,
      ).result.transactionId;
      await client.query(
        "insert into public.salary_receipts(id,user_id,salary_profile_id,transaction_id,expected_at,received_at,amount_minor,status,automatically_detected,operation_id) values($1,$2,$3,$4,'2026-10-18T21:00:00Z','2026-10-18T21:00:00Z',125000,'received',true,$5)",
        [receipt, owner, profile, tx, randomUUID()],
      );
      await client.query("select set_config('masarifi.staging_planning_owner','',true)");
      const api = apiFixture(client, owner),
        repository = new LedgerRepository(api.pool as never, api.config);
      const input = {
        operation: 'reviseTransaction',
        scope: 'ledger.transaction.revise',
        principal: { userId: owner, sessionId: 'dev-fixture', factorAgeSeconds: 0 },
        idempotencyKey: randomUUID(),
        requestId: 'dev-salary-date',
        status: 200,
        command: {
          transactionId: tx,
          expectedVersion: 1,
          reason: 'Fixture correction',
          patch: { occurredAt: '2026-10-18T22:30:00Z' },
        },
      } as const;
      const result = await repository.mutate(input);
      expect(await repository.mutate(input)).toEqual(result);
      await client.query('set local role masarifi_migration');
      expect(
        (
          await client.query<{ received_at: Date }>(
            'select received_at from public.salary_receipts where id=$1',
            [receipt],
          )
        ).rows[0]?.received_at.toISOString(),
      ).toBe('2026-10-18T22:30:00.000Z');
      expect(
        (
          await client.query(
            "select id from private.outbox_events where aggregate_id=$1 and event_type='planning.salary_receipt_corrected'",
            [receipt],
          )
        ).rowCount,
      ).toBe(1);
      expect(
        (
          await client.query('select id from public.transaction_postings where transaction_id=$1', [
            tx,
          ])
        ).rowCount,
      ).toBe(1);
    });
  });

  async function payment(client: PoolClient, owner: string, account: string) {
    const obligation = randomUUID(),
      item = randomUUID(),
      id = randomUUID();
    await client.query(
      `insert into public.obligations(id,user_id,name,direction,type,schedule_kind,currency_code,principal_minor,installment_amount_minor,installment_count,frequency,expected_day,start_date)
      values($1,$2,'Fixture','payable','installment','fixed_term','SAR',10000,5000,2,'monthly',8,'2026-10-08')`,
      [obligation, owner],
    );
    await client.query(
      `insert into public.obligation_schedule_items(id,user_id,obligation_id,due_at,amount_minor,sequence_no)
      values($1,$2,$3,'2026-10-07T21:00:00Z',5000,1)`,
      [item, owner, obligation],
    );
    return {
      operation: 'record',
      obligationId: obligation,
      paymentId: id,
      expectedVersion: 1,
      paymentMethod: null,
      paymentCase: 'partial',
      allocationIntent: 'current',
      source: 'manual',
      allocations: [{ scheduleItemId: item, amountMinor: '5000' }],
      operationId: randomUUID(),
      requestId: 'dev-payment-fixture',
      transaction: {
        kind: 'expense',
        amountMinor: '5000',
        currency: 'SAR',
        accountId: account,
        title: 'Fixture payment',
        occurredAt: '2026-10-08T10:00:00Z',
        source: 'manual',
      },
    };
  }

  it.each(['same-key', 'competing-keys'] as const)(
    'concurrent DEV payments with %s produce one transaction and one posting',
    async (scenario) => {
      const owner = `user_DevConcurrent${randomUUID().replaceAll('-', '')}`;
      const account = randomUUID();
      const body = await pool.withClient(async (client) => {
        await client.query('begin');
        try {
          await client.query('set local role masarifi_migration');
          await client.query(
            "insert into public.profiles(id,status,timezone) values($1,'active','Asia/Riyadh')",
            [owner],
          );
          await client.query(
            "insert into public.accounts(id,user_id,name,type,currency_code) values($1,$2,'Concurrent fixture','bank','SAR')",
            [account, owner],
          );
          const command = await payment(client, owner, account);
          await client.query('commit');
          return command;
        } catch (error) {
          await client.query('rollback');
          throw error;
        }
      });
      const config = new PlatformConfigService(
        new ConfigService({
          MASARIFI_STAGING_PLANNING_REPAIR_OWNER_ID: owner,
          SUPABASE_URL: 'https://qcffvfbpzvpwcwxwjyro.supabase.co',
          MASARIFI_PROCESS_KIND: 'api',
        }) as never,
      );
      const repository = new PlanningRepository(pool, config);
      const input = {
        operation: 'allocateObligationPayment',
        scope: 'planning.obligation-payment.record',
        status: 201,
        principal: { userId: owner, sessionId: 'concurrent-dev-fixture', factorAgeSeconds: 0 },
        idempotencyKey: randomUUID(),
        requestId: 'dev-concurrent-payment',
        command: {
          obligationId: body.obligationId,
          expectedVersion: 1,
          paymentMethod: null,
          paymentCase: body.paymentCase,
          allocationIntent: body.allocationIntent,
          source: body.source,
          allocations: body.allocations,
          transaction: body.transaction,
        },
      };
      const results = await Promise.allSettled([
        repository.mutate(input),
        repository.mutate({
          ...input,
          idempotencyKey: scenario === 'same-key' ? input.idempotencyKey : randomUUID(),
        }),
      ]);
      const successes = results.filter((r) => r.status === 'fulfilled');
      expect(successes.length).toBeGreaterThanOrEqual(1);
      if (scenario === 'competing-keys') expect(successes).toHaveLength(1);
      for (const result of results) {
        if (result.status === 'rejected') {
          const error: unknown = result.reason;
          expect(error).toMatchObject({ status: 409 });
        }
      }
      if (scenario === 'same-key')
        expect(await repository.mutate(input)).toEqual(requiredFixtureRow(successes).value);
      const state = await pool.query<{
        transactions: string;
        postings: string;
        balance: string;
        payments: string;
      }>(
        `select (select count(*)::text from public.transactions where user_id=$1) transactions,
          (select count(*)::text from public.transaction_postings where account_id=$2) postings,
          (select confirmed_minor::text from public.account_balances where account_id=$2) balance,
          (select count(*)::text from public.obligation_payments where user_id=$1) payments`,
        [owner, account],
      );
      expect(state.rows).toEqual([
        { transactions: '1', postings: '1', balance: '-5000', payments: '1' },
      ]);
      expect(
        requiredFixtureRow(
          (
            await pool.query<{ scope: string | null }>(
              "select nullif(current_setting('masarifi.staging_planning_owner',true),'') scope",
            )
          ).rows,
        ).scope,
      ).toBeNull();
    },
  );

  it('returns the persisted payment version and ownership before producing its event', async () => {
    await fixture(async (client, owner, account) => {
      const body = await payment(client, owner, account);
      await client.query('set local role masarifi_api');
      const result = requiredFixtureRow(
        (
          await client.query<{ result: Record<string, unknown> }>(
            'select private.staging_dev_create_obligation_payment($1,$2::jsonb) result',
            [owner, JSON.stringify(body)],
          )
        ).rows,
      ).result;
      await client.query('set local role masarifi_migration');
      const saved = requiredFixtureRow(
        (
          await client.query<{ version: string; transaction_ownership: string }>(
            'select version,transaction_ownership from public.obligation_payments where id=$1',
            [body.paymentId],
          )
        ).rows,
      );
      expect(result).toMatchObject({
        id: body.paymentId,
        version: Number(saved.version),
        transactionOwnership: 'created',
      });
      expect(saved.transaction_ownership).toBe('created');
      const event = (
        await client.query<{ payload: { aggregateVersion: number } }>(
          "select payload from private.outbox_events where aggregate_id=$1 and event_type='planning.obligation_payment_recorded'",
          [body.paymentId],
        )
      ).rows;
      expect(event).toHaveLength(1);
      expect(event[0]?.payload.aggregateVersion).toBe(Number(saved.version));
      expect(
        (
          await client.query('select id from public.transaction_postings where transaction_id=$1', [
            result.transactionId,
          ])
        ).rowCount,
      ).toBe(1);
    });
  });

  it.each(['unset', 'different-owner', 'different-jwt', 'frozen'] as const)(
    'rejects %s DEV context without a financial effect',
    async (scenario) => {
      await fixture(async (client, owner, account) => {
        const body = await payment(client, owner, account);
        if (scenario === 'unset')
          await client.query("select set_config('masarifi.staging_planning_owner','',true)");
        if (scenario === 'different-owner')
          await client.query(
            "select set_config('masarifi.staging_planning_owner','another-owner',true)",
          );
        if (scenario === 'different-jwt')
          await client.query(
            'select set_config(\'request.jwt.claims\',\'{"sub":"another-owner"}\',true)',
          );
        if (scenario === 'frozen')
          await client.query("update public.profiles set status='suspended' where id=$1", [owner]);
        await client.query('set local role masarifi_api');
        await client.query('savepoint rejected_dev_payment');
        await expect(
          client.query('select private.staging_dev_create_obligation_payment($1,$2::jsonb)', [
            owner,
            JSON.stringify(body),
          ]),
        ).rejects.toMatchObject({ code: scenario === 'different-jwt' ? '28000' : '42501' });
        await client.query('rollback to savepoint rejected_dev_payment');
        await client.query('set local role masarifi_migration');
        expect(
          (await client.query('select id from public.transactions where user_id=$1', [owner]))
            .rowCount,
        ).toBe(0);
      });
    },
  );

  it.each([
    { date: '2026-10-18T22:30:00Z', automatic: true, amount: '125000', status: 'corrected' },
    { date: '2026-10-19T00:30:00Z', automatic: true, amount: '125000', status: 'corrected' },
    { date: '2026-10-17T21:00:00Z', automatic: true, amount: '125000', status: 'corrected' },
    { date: '2026-10-10T21:00:00Z', automatic: true, amount: '125000', status: 'undone' },
    { date: '2026-10-18T22:30:00Z', automatic: true, amount: '124999', status: 'undone' },
    { date: '2026-10-18T22:30:00Z', automatic: false, amount: '125000', status: 'received' },
  ])(
    'reconciles date $date amount $amount automatic $automatic as $status without touching another receipt',
    async ({ date, automatic, amount, status }) => {
      await fixture(async (client, owner, account) => {
        const profile = randomUUID(),
          receipt = randomUUID();
        await client.query(
          `insert into public.salary_profiles(id,user_id,name,amount_minor,currency_code,frequency,expected_day,account_id)
        values($1,$2,'Employer',125000,'SAR','monthly',19,$3)`,
          [profile, owner, account],
        );
        const tx = requiredFixtureRow(
          (
            await client.query<{ result: { transactionId: string } }>(
              'select private.post_transaction($1,$2::jsonb) result',
              [
                owner,
                JSON.stringify({
                  kind: 'income',
                  amountMinor: '125000',
                  currency: 'SAR',
                  accountId: account,
                  title: 'Salary fixture',
                  occurredAt: '2026-10-18T21:00:00Z',
                  source: 'manual',
                }),
              ],
            )
          ).rows,
        ).result.transactionId;
        await client.query(
          `insert into public.salary_receipts(id,user_id,salary_profile_id,transaction_id,expected_at,received_at,amount_minor,status,automatically_detected,operation_id)
        values($1,$2,$3,$4,'2026-10-18T21:00:00Z','2026-10-18T21:00:00Z',125000,'received',$6,$5)`,
          [receipt, owner, profile, tx, randomUUID(), automatic],
        );
        const unrelated = randomUUID();
        const otherTx = requiredFixtureRow(
          (
            await client.query<{ result: { transactionId: string } }>(
              'select private.post_transaction($1,$2::jsonb) result',
              [
                owner,
                JSON.stringify({
                  kind: 'income',
                  amountMinor: '125000',
                  currency: 'SAR',
                  accountId: account,
                  title: 'Other salary fixture',
                  occurredAt: '2026-10-18T21:00:00Z',
                  source: 'manual',
                }),
              ],
            )
          ).rows,
        ).result.transactionId;
        await client.query(
          `insert into public.salary_receipts(id,user_id,salary_profile_id,transaction_id,expected_at,received_at,amount_minor,status,automatically_detected,operation_id)
           values($1,$2,$3,$4,'2026-11-18T21:00:00Z','2026-10-18T22:00:00Z',125000,'received',true,$5)`,
          [unrelated, owner, profile, otherTx, randomUUID()],
        );
        const untouched = (
          await client.query('select * from public.salary_receipts where id=$1', [unrelated])
        ).rows;
        await client.query('set local role masarifi_api');
        await client.query(
          "select private.revise_transaction($1,$2,1,$3::jsonb,'Fixture date edit')",
          [owner, tx, JSON.stringify({ occurredAt: date, amountMinor: amount })],
        );
        await client.query('set local role masarifi_migration');
        const before = (
          await client.query(
            'select confirmed_minor,ledger_version from public.account_balances where account_id=$1',
            [account],
          )
        ).rows;
        await client.query('set local role masarifi_api');
        await client.query('select private.staging_dev_reconcile_salary_receipts($1,$2)', [
          owner,
          tx,
        ]);
        await client.query('select private.staging_dev_reconcile_salary_receipts($1,$2)', [
          owner,
          tx,
        ]);
        await client.query('set local role masarifi_migration');
        const saved = requiredFixtureRow(
          (
            await client.query<{ received_at: Date | null; status: string; version: string }>(
              'select received_at,status,version from public.salary_receipts where id=$1',
              [receipt],
            )
          ).rows,
        );
        expect(saved.received_at?.toISOString() ?? null).toBe(
          status === 'undone'
            ? null
            : new Date(automatic ? date : '2026-10-18T21:00:00Z').toISOString(),
        );
        expect(saved.status).toBe(status);
        expect(saved.version).toBe(automatic ? '2' : '1');
        expect(
          (
            await client.query(
              'select id from private.outbox_events where aggregate_id=$1 and event_type=$2',
              [receipt, `planning.salary_receipt_${status}`],
            )
          ).rowCount,
        ).toBe(automatic ? 1 : 0);
        expect(
          (await client.query('select * from public.salary_receipts where id=$1', [unrelated]))
            .rows,
        ).toEqual(untouched);
        expect(
          (
            await client.query(
              'select confirmed_minor,ledger_version from public.account_balances where account_id=$1',
              [account],
            )
          ).rows,
        ).toEqual(before);
      });
    },
  );
});
