import { randomUUID } from 'node:crypto';
import type { PoolClient } from 'pg';

import { PlanningRepository } from '../../../src/planning/planning.repository';
import { createLivePool, describeLiveDatabase } from '../../live-database';

describeLiveDatabase('automatic salary detection with isolated ledger fixtures', () => {
  const pool = createLivePool();

  beforeAll(() => {
    const target = new URL(process.env.DATABASE_URL ?? '');
    if (!['127.0.0.1', 'localhost', '[::1]'].includes(target.hostname)) {
      throw new Error('LOCAL_SYNTHETIC_DATABASE_REQUIRED');
    }
  });
  afterAll(() => pool.onModuleDestroy());

  async function fixture(
    run: (client: PoolClient, owner: string, account: string, profile: string) => Promise<void>,
  ) {
    await pool.withClient(async (client) => {
      await client.query('begin');
      try {
        await client.query('set local role masarifi_migration');
        const owner = `salary_auto_${randomUUID()}`;
        const account = randomUUID();
        const profile = randomUUID();
        await client.query(
          "insert into public.profiles(id,status,timezone) values($1,'active','Asia/Riyadh')",
          [owner],
        );
        await client.query("select set_config('request.jwt.claims',$1,true)", [
          JSON.stringify({ role: 'authenticated', sub: owner, sid: 'salary-auto-isolated' }),
        ]);
        await client.query(
          "insert into public.accounts(id,user_id,name,type,currency_code) values($1,$2,'Salary test','bank','SAR')",
          [account, owner],
        );
        await client.query(
          `select private.save_salary_profile($1,jsonb_build_object(
          'operation','create','profileId',$2::text,'operationId',$3::text,'requestId','salary-auto-fixture',
          'name','Example Employer','amountMinor','125000','currencyCode','SAR','frequency','monthly',
          'expectedDay',extract(day from now() at time zone 'Asia/Riyadh')::integer,
          'customIntervalDays',null,'accountId',$4::text,'automaticDetectionEnabled',true))`,
          [owner, profile, randomUUID(), account],
        );
        await run(client, owner, account, profile);
      } finally {
        await client.query('rollback');
      }
    });
  }

  async function income(
    client: PoolClient,
    owner: string,
    account: string,
    overrides: Record<string, unknown> = {},
  ) {
    const response = await client.query<{ result: { transactionId: string } }>(
      'select private.post_transaction($1,$2::jsonb) result',
      [
        owner,
        JSON.stringify({
          kind: 'income',
          amountMinor: 125000,
          currency: 'SAR',
          accountId: account,
          categoryId: '04000000-0000-4000-8000-000000000017',
          title: 'Salary',
          occurredAt: new Date().toISOString(),
          ...overrides,
        }),
      ],
    );
    const transaction = response.rows[0]?.result.transactionId;
    if (!transaction) throw new Error('SALARY_FIXTURE_TRANSACTION_MISSING');
    return transaction;
  }

  async function work(client: PoolClient, profile: string) {
    await client.query('set local role masarifi_worker');
    const claims = await client.query<{ id: string; resource_id: string; lease_token: string }>(
      'select id,resource_id,lease_token from private.claim_planning_salary_cycles(null,500,60)',
    );
    for (const claim of claims.rows.filter((row) => row.resource_id === profile)) {
      await client.query('select private.execute_planning_claim($1,$2,$3,$4)', [
        claim.id,
        claim.lease_token,
        'planning.salary-cycle.generate',
        profile,
      ]);
      await client.query("select private.complete_planning_claim($1,$2,'completed','{}'::jsonb)", [
        claim.id,
        claim.lease_token,
      ]);
    }
    await client.query('set local role masarifi_migration');
  }

  async function received(client: PoolClient, profile: string) {
    return (
      await client.query<{
        transaction_id: string;
        amount_minor: string;
        automatically_detected: boolean;
        version: string;
        expected_at: Date;
      }>(
        "select transaction_id,amount_minor,coalesce((to_jsonb(r)->>'automatically_detected')::boolean,false) automatically_detected,version,expected_at from public.salary_receipts r where salary_profile_id=$1 and status='received'",
        [profile],
      )
    ).rows;
  }

  it.each(['Salary', 'إيداع راتب', 'Payroll', 'Example Employer transfer'])(
    'links clear income %s once, without changing the ledger or balance',
    async (title) => {
      await fixture(async (client, owner, account, profile) => {
        const transaction = await income(client, owner, account, { title });
        const before = await client.query(
          'select confirmed_minor,ledger_version from public.account_balances where account_id=$1',
          [account],
        );
        await work(client, profile);
        expect(await received(client, profile)).toEqual([
          expect.objectContaining({
            transaction_id: transaction,
            amount_minor: '125000',
            automatically_detected: true,
          }),
        ]);
        const once = await received(client, profile);
        await work(client, profile);
        expect(await received(client, profile)).toEqual(once);
        expect(
          (
            await client.query(
              'select confirmed_minor,ledger_version from public.account_balances where account_id=$1',
              [account],
            )
          ).rows,
        ).toEqual(before.rows);
        expect(
          (
            await client.query<{ n: number }>(
              'select count(*)::int n from public.transactions where user_id=$1',
              [owner],
            )
          ).rows[0]?.n,
        ).toBe(1);
        expect(
          (
            await client.query<{ n: number }>(
              "select count(*)::int n from private.outbox_events where aggregate_id in (select id from public.salary_receipts where salary_profile_id=$1) and event_type='planning.salary_receipt_received'",
              [profile],
            )
          ).rows[0]?.n,
        ).toBe(1);
      });
    },
  );

  it.each([
    'wrong-amount',
    'wrong-account',
    'wrong-currency',
    'ordinary-income',
    'refund',
    'expense',
    'off',
    'paused',
    'ambiguous-incomes',
    'ambiguous-profiles',
    'outside-window',
    'before-opt-in',
    'unposted',
  ])('leaves %s for manual review', async (scenario) => {
    await fixture(async (client, owner, account, profile) => {
      const changes: Record<string, unknown> = {};
      if (scenario === 'wrong-amount') changes.amountMinor = 124999;
      if (scenario === 'ordinary-income') changes.title = 'Gift';
      if (scenario === 'refund') changes.title = 'Salary refund';
      if (scenario === 'expense') {
        changes.kind = 'expense';
        changes.categoryId = '04000000-0000-4000-8000-000000000019';
      }
      if (scenario === 'outside-window')
        changes.occurredAt = new Date(Date.now() - 5 * 86400000).toISOString();
      if (scenario === 'wrong-account' || scenario === 'wrong-currency') {
        const other = randomUUID();
        await client.query(
          "insert into public.accounts(id,user_id,name,type,currency_code) values($1,$2,'Other','bank',$3)",
          [other, owner, scenario === 'wrong-currency' ? 'USD' : 'SAR'],
        );
        changes.accountId = other;
        if (scenario === 'wrong-currency') changes.currency = 'USD';
      }
      if (scenario === 'off')
        await client.query(
          'update public.salary_profiles set automatic_detection_enabled=false where id=$1',
          [profile],
        );
      if (scenario === 'paused')
        await client.query("update public.salary_profiles set status='paused' where id=$1", [
          profile,
        ]);
      if (scenario === 'ambiguous-profiles')
        await client.query(
          `insert into public.salary_profiles(user_id,name,amount_minor,currency_code,frequency,expected_day,account_id,automatic_detection_enabled)
          select user_id,'Second Employer',amount_minor,currency_code,frequency,expected_day,account_id,true from public.salary_profiles where id=$1`,
          [profile],
        );
      if (scenario === 'before-opt-in' || scenario === 'unposted') {
        const transaction = randomUUID();
        await client.query(
          `insert into public.transactions(id,user_id,kind,status,amount_minor,currency_code,title,occurred_at,created_at)
            values($1,$2,'income','confirmed',125000,'SAR','Salary',now()-interval '1 hour',now()-interval '1 hour')`,
          [transaction, owner],
        );
        if (scenario === 'before-opt-in') {
          await client.query('select private.ledger_begin($1)', [owner]);
          await client.query(
            "select private.ledger_apply_posting($1,$2,125000,'confirmed','destination',now()-interval '1 hour',1)",
            [transaction, account],
          );
        }
      } else {
        await income(client, owner, account, changes);
        if (scenario === 'ambiguous-incomes') await income(client, owner, account);
      }
      await work(client, profile);
      expect(await received(client, profile)).toEqual([]);
    });
  });

  it('does not rediscover a receipt explicitly undone by its owner', async () => {
    await fixture(async (client, owner, account, profile) => {
      await income(client, owner, account);
      await work(client, profile);
      const receipt = (
        await client.query<{ id: string; version: string }>(
          "select id,version from public.salary_receipts where salary_profile_id=$1 and status='received'",
          [profile],
        )
      ).rows[0];
      expect(receipt).toBeDefined();
      await client.query('select private.link_salary_receipt($1,$2::jsonb)', [
        owner,
        JSON.stringify({
          operation: 'unlink',
          profileId: profile,
          receiptId: receipt?.id,
          expectedVersion: Number(receipt?.version),
          operationId: randomUUID(),
          requestId: 'salary-auto-owner-undo',
        }),
      ]);
      await client.query('select private.detect_salary_receipts($1,$2,50)', [owner, profile]);
      expect(await received(client, profile)).toEqual([]);
      expect(
        (
          await client.query<{ status: string }>(
            'select status from public.salary_receipts where id=$1',
            [receipt?.id],
          )
        ).rows[0]?.status,
      ).toBe('undone');
    });
  });

  it.each([
    { offsetMinutes: -1, disabled: false, timezone: 'Asia/Riyadh', midnight: false },
    { offsetMinutes: -1440, disabled: true, timezone: 'Asia/Riyadh', midnight: false },
    { offsetMinutes: 1, disabled: false, timezone: 'Asia/Riyadh', midnight: false },
    { offsetMinutes: -2, disabled: false, timezone: 'Asia/Riyadh', midnight: true },
    { offsetMinutes: -2, disabled: false, timezone: 'America/New_York', midnight: true },
    { offsetMinutes: -4320, disabled: false, timezone: 'Asia/Riyadh', midnight: true },
  ])(
    'updates the salary anchor after a date edit: %j',
    async ({ offsetMinutes, disabled, timezone, midnight }) => {
      await fixture(async (client, owner, account, profile) => {
        await client.query('update public.profiles set timezone=$2 where id=$1', [owner, timezone]);
        await client.query(
          'update public.salary_profiles set expected_day=extract(day from now() at time zone $2)::smallint where id=$1',
          [profile, timezone],
        );
        const originalAt = midnight
          ? (
              await client.query<{ at: Date }>(
                "select ((now() at time zone $1)::date::timestamp at time zone $1)+interval '1 minute' as at",
                [timezone],
              )
            ).rows[0]?.at
          : new Date(Date.now() - 2 * 60000);
        if (!originalAt) throw new Error('ISOLATED_MIDNIGHT_REQUIRED');
        const editedAt = new Date(originalAt.getTime() + offsetMinutes * 60000);
        const transaction = await income(client, owner, account, {
          occurredAt: originalAt.toISOString(),
        });
        await work(client, profile);
        const receipt = (await received(client, profile))[0];
        expect(receipt).toBeDefined();
        if (disabled)
          await client.query(
            'update public.salary_profiles set automatic_detection_enabled=false where id=$1',
            [profile],
          );
        await client.query('select private.revise_transaction($1,$2,1,$3::jsonb,$4)', [
          owner,
          transaction,
          JSON.stringify({ occurredAt: editedAt.toISOString() }),
          'Isolated salary date correction',
        ]);
        const before = (
          await client.query(
            'select confirmed_minor,ledger_version from public.account_balances where account_id=$1',
            [account],
          )
        ).rows;
        await work(client, profile);
        const corrected = (
          await client.query<{ received_at: Date; version: string; expected_at: Date }>(
            "select received_at,version,expected_at from public.salary_receipts where salary_profile_id=$1 and status in ('received','corrected')",
            [profile],
          )
        ).rows;
        expect(corrected).toHaveLength(1);
        expect(corrected[0]?.received_at.toISOString()).toBe(editedAt.toISOString());
        expect(Number(corrected[0]?.version)).toBe(Number(receipt?.version) + 1);
        expect(corrected[0]?.expected_at).toEqual(receipt?.expected_at);
        await client.query('select private.detect_salary_receipts($1,$2,50)', [owner, profile]);
        expect(
          (
            await client.query(
              "select received_at,version,expected_at from public.salary_receipts where salary_profile_id=$1 and status in ('received','corrected')",
              [profile],
            )
          ).rows,
        ).toEqual(corrected);
        const events = (
          await client.query<{
            payload: { version: number; sync: { snapshot: { received_at: string } } };
          }>(
            "select payload from private.outbox_events where aggregate_id in (select id from public.salary_receipts where salary_profile_id=$1) and event_type='planning.salary_receipt_corrected'",
            [profile],
          )
        ).rows;
        expect(events).toHaveLength(1);
        const correctedEvent = events[0]?.payload;
        if (!correctedEvent) throw new Error('CORRECTED_SALARY_EVENT_REQUIRED');
        expect(correctedEvent.version).toBe(Number(corrected[0]?.version));
        expect(new Date(correctedEvent.sync.snapshot.received_at).toISOString()).toBe(
          editedAt.toISOString(),
        );
        const proxy = {
          query: (sql: string, values?: unknown[]) =>
            client.query(
              sql === 'begin'
                ? 'savepoint salary_summary'
                : sql === 'commit'
                  ? 'release savepoint salary_summary'
                  : sql === 'rollback'
                    ? 'rollback to savepoint salary_summary'
                    : sql,
              values,
            ),
        };
        const repository = new PlanningRepository({
          withClient: async (action: (c: typeof proxy) => Promise<unknown>) => action(proxy),
        } as never);
        const day = (
          await client.query<{ day: string }>(
            "select to_char(now() at time zone $1,'YYYY-MM-DD') as day",
            [timezone],
          )
        ).rows[0]?.day;
        if (!day) throw new Error('ISOLATED_DATE_REQUIRED');
        const summary = await repository.getPlanningSummary(
          { userId: owner, sessionId: 'salary-auto-isolated', factorAgeSeconds: 0 },
          { key: day.slice(0, 7), start: day, end: day, asOf: day },
          'salary-date-review',
        );
        expect(summary.salary).toMatchObject({
          startAt: editedAt.toISOString(),
          actualIncomeMinor: '125000',
          actualExpenseMinor: '0',
        });
        await client.query('set local role masarifi_migration');
        expect(
          (
            await client.query(
              'select confirmed_minor,ledger_version from public.account_balances where account_id=$1',
              [account],
            )
          ).rows,
        ).toEqual(before);
        expect(
          (
            await client.query<{ n: number }>(
              'select count(*)::int n from public.transactions where user_id=$1',
              [owner],
            )
          ).rows[0]?.n,
        ).toBe(1);
      });
    },
  );

  it.each(['outside-window', 'manual-link', 'owner-undo', 'amount-edit'] as const)(
    'preserves salary receipt boundaries on a date edit: %s',
    async (scenario) => {
      await fixture(async (client, owner, account, profile) => {
        const transaction = await income(client, owner, account);
        await work(client, profile);
        if (scenario === 'manual-link')
          await client.query(
            'update public.salary_receipts set automatically_detected=false where salary_profile_id=$1 and transaction_id=$2',
            [profile, transaction],
          );
        if (scenario === 'owner-undo') {
          const receipt = (
            await client.query<{ id: string; version: string }>(
              'select id,version from public.salary_receipts where salary_profile_id=$1 and transaction_id=$2',
              [profile, transaction],
            )
          ).rows[0];
          await client.query('select private.link_salary_receipt($1,$2::jsonb)', [
            owner,
            JSON.stringify({
              operation: 'unlink',
              profileId: profile,
              receiptId: receipt?.id,
              expectedVersion: Number(receipt?.version),
              operationId: randomUUID(),
              requestId: 'salary-edit-undo',
            }),
          ]);
        }
        const before = (
          await client.query<{ expected_at: Date }>(
            'select id,status,received_at,expected_at,version from public.salary_receipts where salary_profile_id=$1 and transaction_id=$2',
            [profile, transaction],
          )
        ).rows;
        const editedAt = new Date(
          Date.now() - (scenario === 'outside-window' ? 4 * 86400000 : 60000),
        );
        await client.query('select private.revise_transaction($1,$2,1,$3::jsonb,$4)', [
          owner,
          transaction,
          JSON.stringify(
            scenario === 'amount-edit'
              ? { amountMinor: 125001 }
              : { occurredAt: editedAt.toISOString() },
          ),
          'Isolated boundary edit',
        ]);
        await work(client, profile);
        const after = (
          await client.query(
            'select id,status,received_at,expected_at,version from public.salary_receipts where salary_profile_id=$1 and transaction_id=$2',
            [profile, transaction],
          )
        ).rows;
        if (scenario === 'outside-window' || scenario === 'amount-edit') {
          expect(after).toEqual([
            expect.objectContaining({
              status: 'undone',
              received_at: null,
              expected_at: before[0]?.expected_at,
            }),
          ]);
          await client.query('select private.detect_salary_receipts($1,$2,50)', [owner, profile]);
          expect(await received(client, profile)).toEqual([]);
        } else expect(after).toEqual(before);
      });
    },
  );

  it('invalidates an automatic receipt when its income is reversed, including after detection is turned off', async () => {
    await fixture(async (client, owner, account, profile) => {
      const transaction = await income(client, owner, account);
      await work(client, profile);
      expect(await received(client, profile)).toHaveLength(1);
      await client.query(
        'update public.salary_profiles set automatic_detection_enabled=false where id=$1',
        [profile],
      );
      await client.query(
        "select private.reverse_transaction($1,$2,1,clock_timestamp(),'Isolated salary reversal')",
        [owner, transaction],
      );
      const before = (
        await client.query(
          'select confirmed_minor from public.account_balances where account_id=$1',
          [account],
        )
      ).rows;
      await work(client, profile);
      expect(await received(client, profile)).toEqual([]);
      expect(
        (
          await client.query<{ confirmed_minor: string }>(
            'select confirmed_minor from public.account_balances where account_id=$1',
            [account],
          )
        ).rows,
      ).toEqual(before);
      expect(
        (
          await client.query<{ status: string }>(
            'select status from public.salary_receipts where salary_profile_id=$1 and transaction_id=$2',
            [profile, transaction],
          )
        ).rows[0]?.status,
      ).toBe('undone');
    });
  });

  it.each([-3, 0, 3])(
    'recognizes a salary %i local calendar days from its expected date',
    async (offset) => {
      await fixture(async (client, owner, account, profile) => {
        await client.query(
          "update public.salary_profiles set expected_day=extract(day from (now() at time zone 'Asia/Riyadh')::date+$2::integer)::smallint where id=$1",
          [profile, offset],
        );
        await income(client, owner, account);
        await work(client, profile);
        expect(await received(client, profile)).toHaveLength(1);
      });
    },
  );

  it('preserves historical receipts after a receiving currency change', async () => {
    await fixture(async (client, owner, account, profile) => {
      await income(client, owner, account);
      await work(client, profile);
      const old = await received(client, profile);
      expect(old).toHaveLength(1);
      const dollar = randomUUID();
      await client.query(
        "insert into public.accounts(id,user_id,name,type,currency_code) values($1,$2,'USD','bank','USD')",
        [dollar, owner],
      );
      await client.query(
        "update public.salary_profiles set account_id=$2,currency_code='USD' where id=$1",
        [profile, dollar],
      );
      await work(client, profile);
      expect(await received(client, profile)).toEqual(old);
    });
  });

  it.each(['anon', 'authenticated', 'masarifi_api', 'service_role'])(
    'does not expose the detector to %s',
    async (role) => {
      await fixture(async (client, owner, _account, profile) => {
        await client.query(`set local role ${role}`);
        await expect(
          client.query('select private.detect_salary_receipts($1,$2,50)', [owner, profile]),
        ).rejects.toThrow(/permission denied/);
      });
    },
  );

  it('detects new income after the daily generation job has already completed', async () => {
    await fixture(async (client, owner, account, profile) => {
      await work(client, profile);
      expect(await received(client, profile)).toEqual([]);
      await income(client, owner, account);
      await work(client, profile);
      expect(await received(client, profile)).toHaveLength(1);
    });
  });

  it('runs the bounded background entry point without a new ledger posting', async () => {
    await fixture(async (client, owner, account, profile) => {
      await income(client, owner, account);
      const result = await client.query<{ result: { failedCount: number } }>(
        'select private.run_salary_detection_jobs(100) result',
      );
      expect(result.rows[0]?.result.failedCount).toBe(0);
      expect(await received(client, profile)).toHaveLength(1);
      expect(
        (
          await client.query<{ confirmed_minor: string }>(
            'select confirmed_minor from public.account_balances where account_id=$1',
            [account],
          )
        ).rows[0]?.confirmed_minor,
      ).toBe('125000');
    });
  });
});
