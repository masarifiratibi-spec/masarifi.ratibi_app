import { randomUUID } from 'node:crypto';

import { PoolService } from '../../../src/platform/database/pool.service';
import { resolveReportPeriod } from '../../../src/reports/reports.period';
import type { ReportSnapshot, ReportType } from '../../../src/reports/reports.schemas';
import { ReportsRepository } from '../../../src/reports/reports.repository';
import { describeLiveDatabase } from '../../live-database';

describeLiveDatabase('immutable report generation requests', () => {
  const userId = `report_generation_${randomUUID()}`;
  const principal = { userId, sessionId: 'session', factorAgeSeconds: 0 };
  const accountId = randomUUID();
  let pool: PoolService;
  let repository: ReportsRepository;

  beforeAll(async () => {
    pool = new PoolService({
      get: (key: string) => (key === 'DATABASE_URL' ? process.env.DATABASE_URL : 4),
    } as never);
    repository = new ReportsRepository(pool);
    await pool.withClient(async (client) => {
      await client.query('begin');
      await client.query("select set_config('masarifi.ledger_command','on',true)");
      await client.query(
        "insert into public.profiles(id,status,timezone) values($1,'active','Asia/Riyadh')",
        [userId],
      );
      await client.query(
        "insert into public.accounts(id,user_id,name,type,currency_code) values($1,$2,'Main','bank','SAR')",
        [accountId, userId],
      );
      await client.query(
        'insert into public.account_balances(account_id,confirmed_minor,ledger_version) values($1,5000,2)',
        [accountId],
      );
      await client.query(
        "insert into public.transactions(id,user_id,kind,amount_minor,currency_code,title,occurred_at) values($1,$2,'income',5000,'SAR','fixture','2026-08-04T10:00:00Z')",
        [randomUUID(), userId],
      );
      await client.query('commit');
    });
  });

  afterAll(async () => pool.onModuleDestroy());

  it('captures once and replays an identical idempotent response', async () => {
    const command = {
      type: 'financial_summary' as const,
      periodStart: '2026-08-01',
      periodEnd: '2026-08-31',
      format: 'json' as const,
      delivery: 'download' as const,
      recipient: null,
    };
    const first = await repository.captureSnapshot(
      principal,
      command,
      'generation-key-1',
      'request',
    );
    const replay = await repository.captureSnapshot(
      principal,
      command,
      'generation-key-1',
      'request',
    );
    expect(replay).toEqual(first);
    expect(first).toMatchObject({ status: 'queued', ledgerVersion: 2, schemaVersion: 1 });
    const count = await pool.query<{ count: string }>(
      'select count(*) from private.report_output_attempts where user_id=$1',
      [userId],
    );
    expect(count.rows[0]?.count).toBe('1');
  });

  it('returns only owner-safe status and keeps the persisted snapshot immutable', async () => {
    const page = await repository.listAttempts(
      principal,
      { cursor: null, limit: 25, scheduleId: null, status: null },
      'list',
    );
    const attempt = (page.items as Array<{ id: string }>)[0];
    expect(attempt).toBeDefined();
    const result = await repository.getAttempt(principal, attempt?.id ?? '', 'get');
    expect(result).not.toHaveProperty('snapshot');
    expect(result).not.toHaveProperty('storageRef');
    await expect(
      pool.query("update private.report_output_attempts set snapshot='{}' where id=$1", [
        attempt?.id,
      ]),
    ).rejects.toThrow('REPORT_SNAPSHOT_IMMUTABLE');
  });

  it.each([false, true])(
    'keeps one budget limit across allocations and reports missing exchange rates (%s)',
    async (missingRate) => {
      const owner = `budget_report_${randomUUID()}`;
      const budget = randomUUID();
      const groceries = randomUUID();
      const transport = randomUUID();
      await pool.withClient(async (client) => {
        await client.query('begin');
        try {
          await client.query('set local role masarifi_migration');
          await client.query(
            "insert into public.profiles(id,status,timezone) values($1,'active','Asia/Riyadh')",
            [owner],
          );
          await client.query(
            `insert into public.categories(id,user_id,kind,label_ar,label_en)
             values ($1,$3,'expense','طعام','Groceries'), ($2,$3,'expense','نقل','Transport')`,
            [groceries, transport, owner],
          );
          await client.query(
            `insert into public.budgets(id,user_id,name,currency_code,period_start,period_end,total_minor,status)
             values ($1,$2,'Report budget','SAR','2026-07-01','2026-07-31',100000,'active'),
                    (gen_random_uuid(),$2,'Other currency','USD','2026-07-01','2026-07-31',14222,'active'),
                    (gen_random_uuid(),$3,'Other owner','SAR','2026-07-01','2026-07-31',998877,'active')`,
            [budget, owner, userId],
          );
          await client.query(
            `insert into public.budget_categories(user_id,budget_id,category_id,limit_minor)
             values ($1,$2,$3,60000), ($1,$2,$4,40000)`,
            [owner, budget, groceries, transport],
          );
          await client.query(
            `insert into public.transactions(user_id,kind,amount_minor,currency_code,category_id,title,occurred_at)
             values ($1,'expense',17000,'SAR',$2,'Groceries','2026-07-15T10:00:00Z'),
                    ($1,'expense',8000,'SAR',$3,'Transport','2026-07-15T12:00:00Z')`,
            [owner, groceries, transport],
          );
          if (missingRate) {
            await client.query(
              "insert into public.currencies(code,name,minor_unit) values('QFX','Synthetic rate fixture',2) on conflict(code) do nothing",
            );
            await client.query(
              `insert into public.transactions(user_id,kind,amount_minor,currency_code,category_id,title,occurred_at)
               values ($1,'expense',600,'QFX',$2,'Missing rate','2026-07-15T10:00:00Z')`,
              [owner, transport],
            );
          }
          await client.query('commit');
        } catch (error) {
          await client.query('rollback');
          throw error;
        }
      });

      const actor = { ...principal, userId: owner };
      const capture = async (type: ReportType) => {
        const result = await repository.captureSnapshot(
          actor,
          {
            type,
            periodStart: '2026-07-01',
            periodEnd: '2026-07-31',
            format: 'pdf',
            delivery: 'download',
            recipient: null,
          },
          `allocated-budget-${type}`,
          'request',
        );
        const { rows } = await pool.query<{ snapshot: ReportSnapshot }>(
          'select snapshot from private.report_output_attempts where id=$1',
          [result.attemptId],
        );
        const snapshot = rows[0]?.snapshot;
        if (!snapshot) throw new Error('Expected a persisted report snapshot');
        return snapshot;
      };
      const sar = {
        currency: 'SAR',
        budgetMinor: 100000,
        spentMinor: missingRate ? null : 25000,
        remainingMinor: missingRate ? null : 75000,
        ...(missingRate ? { unavailableReason: 'missing_rate' } : {}),
      };
      const state = missingRate ? 'partial' : 'complete';
      for (const type of ['budget_performance', 'financial_summary'] as const) {
        const snapshot = await capture(type);
        expect(snapshot.dataState).toBe(state);
        expect(snapshot.summary.planning).toMatchObject({ budgets: [sar] });
      }
      const home = await repository.getHome(
        actor,
        resolveReportPeriod('monthly', '2026-07-15', 'Asia/Riyadh'),
        null,
        'request',
      );
      expect(home).toMatchObject({
        metadata: { dataState: state },
        planning: {
          budgets: [
            sar,
            { currency: 'USD', budgetMinor: 14222, spentMinor: 0, remainingMinor: 14222 },
          ],
        },
      });
      if (missingRate) {
        expect((await capture('obligation_progress')).dataState).toBe('empty');
        expect((await capture('savings_progress')).dataState).toBe('empty');
        expect((await capture('category_spending')).dataState).toBe('complete');
      }
    },
  );

  it('captures bounded account activity rows inside the immutable snapshot', async () => {
    const accepted = await repository.captureSnapshot(
      principal,
      {
        type: 'account_activity',
        periodStart: '2026-08-01',
        periodEnd: '2026-08-31',
        format: 'csv',
        delivery: 'download',
        recipient: null,
      },
      'generation-key-activity',
      'request',
    );
    const snapshot = await pool.query<{
      snapshot: {
        detailedRows: unknown[];
        summary: { currencyMinorUnits: Record<string, number> };
      };
    }>('select snapshot from private.report_output_attempts where id=$1', [
      (accepted as { attemptId: string }).attemptId,
    ]);
    expect(snapshot.rows[0]?.snapshot.detailedRows).toHaveLength(1);
    expect(snapshot.rows[0]?.snapshot.summary.currencyMinorUnits).toEqual({ SAR: 2 });
  });

  it('restricts both totals and activity rows to the validated account selection', async () => {
    const account = randomUUID(),
      otherAccount = randomUUID();
    const accountOwner = `scope_capture_${randomUUID()}`;
    const transactions = [randomUUID(), randomUUID()];
    await pool.withClient(async (client) => {
      await client.query('begin');
      try {
        await client.query("select set_config('masarifi.ledger_command','on',true)");
        await client.query(
          "insert into public.profiles(id,status,timezone) values($1,'active','Asia/Dubai')",
          [accountOwner],
        );
        for (const [index, id] of [account, otherAccount].entries()) {
          await client.query(
            "insert into public.accounts(id,user_id,name,type,currency_code) values($1,$2,'Scoped','bank','SAR')",
            [id, accountOwner],
          );
          await client.query(
            "insert into public.transactions(id,user_id,kind,amount_minor,currency_code,title,occurred_at) values($1,$2,'income',$3,'SAR','Scoped','2026-08-04T10:00:00Z')",
            [transactions[index], accountOwner, index === 0 ? 500 : 9000],
          );
          await client.query(
            "insert into public.transaction_postings(transaction_id,account_id,amount_minor,posting_role,occurred_at) values($1,$2,$3,'destination','2026-08-04T10:00:00Z')",
            [transactions[index], id, index === 0 ? 500 : 9000],
          );
        }
        await client.query('commit');
      } catch (error) {
        await client.query('rollback');
        throw error;
      }
    });
    const command = {
      type: 'account_activity' as const,
      periodStart: '2026-08-01',
      periodEnd: '2026-08-31',
      format: 'json' as const,
      delivery: 'download' as const,
      recipient: null,
      accountIds: [account],
      currency: 'SAR',
      timezone: 'Asia/Dubai',
    };
    const accepted = await repository.captureSnapshot(
      { ...principal, userId: accountOwner },
      command,
      'scoped-account-capture',
      'request',
    );
    const stored = await pool.query<{
      snapshot: {
        detailedRows: Array<{ amountMinor: number }>;
        summary: { summaries: Array<{ income: { amountMinor: number } }> };
      };
    }>('select snapshot from private.report_output_attempts where id=$1', [
      (accepted as { attemptId: string }).attemptId,
    ]);
    expect(stored.rows[0]?.snapshot.detailedRows.map((row) => row.amountMinor)).toEqual([500]);
    expect(stored.rows[0]?.snapshot.summary.summaries[0]?.income.amountMinor).toBe(500);
    await expect(
      repository.captureSnapshot(principal, command, 'foreign-account-capture', 'request'),
    ).rejects.toMatchObject({ status: 409 });
    await expect(
      repository.captureSnapshot(
        { ...principal, userId: accountOwner },
        { ...command, accountIds: [randomUUID()] },
        'unknown-account-capture',
        'request',
      ),
    ).rejects.toMatchObject({ status: 404 });
  });

  it.each([0, 1, 2, 3, 4])(
    'captures the configured currency scale %s rather than assuming ISO defaults',
    async (scale) => {
      const currency = `QA${String.fromCharCode(65 + scale)}`;
      const owner = `report_pdf_scale_${randomUUID()}`;
      await pool.query(
        'insert into public.currencies(code,name,minor_unit) values($1,$2,$3) on conflict(code) do nothing',
        [currency, 'Synthetic PDF scale', scale],
      );
      await pool.query(
        "insert into public.profiles(id,status,timezone) values($1,'active','Asia/Riyadh')",
        [owner],
      );
      await pool.query(
        'insert into public.user_preferences(user_id,default_currency) values($1,$2) on conflict(user_id) do update set default_currency=excluded.default_currency',
        [owner, currency],
      );
      const result = await repository.captureSnapshot(
        { ...principal, userId: owner },
        {
          type: 'financial_summary',
          periodStart: '2026-08-01',
          periodEnd: '2026-08-31',
          format: 'pdf',
          delivery: 'download',
          recipient: null,
        },
        `pdf-scale-${String(scale)}-capture`,
        'request',
      );
      const captured = await pool.query<{
        snapshot: { summary: { currencyMinorUnits: Record<string, number> } };
      }>('select snapshot from private.report_output_attempts where id=$1', [
        (result as { attemptId: string }).attemptId,
      ]);
      expect(captured.rows[0]?.snapshot.summary.currencyMinorUnits).toEqual({ [currency]: scale });
    },
  );
});
