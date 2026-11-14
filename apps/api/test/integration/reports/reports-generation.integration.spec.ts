import { randomUUID } from 'node:crypto';

import { PoolService } from '../../../src/platform/database/pool.service';
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
