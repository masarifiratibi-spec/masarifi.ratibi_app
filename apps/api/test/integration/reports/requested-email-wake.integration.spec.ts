import { randomUUID } from 'node:crypto';
import { Client, type Notification } from 'pg';
import { describeLiveDatabase } from '../../live-database';

describeLiveDatabase('requested PDF email database wakeups', () => {
  it('signals committed work and retries without exposing an owner or attempt ID', async () => {
    const writer = new Client({ connectionString: process.env.DATABASE_URL });
    const listener = new Client({ connectionString: process.env.DATABASE_URL });
    const owner = 'report_wake_' + randomUUID();
    const channel = 'masarifi_requested_pdf_email';
    const barrier = 'report_wake_test_' + randomUUID().replaceAll('-', '');
    const attempt = randomUUID();
    await writer.connect();
    await listener.connect();
    try {
      const writerPid = (await writer.query<{ pid: number }>('select pg_backend_pid() pid')).rows[0]
        ?.pid;
      if (writerPid === undefined) throw new Error('Expected a writer connection');
      const signals: string[] = [];
      let finishBarrier: (() => void) | undefined;
      listener.on('notification', (n: Notification) => {
        if (n.processId !== writerPid) return;
        if (n.channel === channel) signals.push(n.payload ?? '');
        if (n.channel === barrier) finishBarrier?.();
      });
      await listener.query(`LISTEN ${channel}; LISTEN ${barrier}`);
      // The marker comes from the same backend, after preceding commits/rollbacks.
      const readSignals = async () => {
        const received = new Promise<void>((done) => {
          finishBarrier = done;
        });
        await writer.query("select pg_notify($1,'')", [barrier]);
        await received;
        return signals.splice(0);
      };
      await writer.query('set role masarifi_migration');
      await writer.query("insert into public.profiles(id,status) values($1,'active')", [owner]);
      const insert = (id: string, delivery: string) =>
        writer.query(
          `insert into private.report_output_attempts(id,user_id,report_type,period_start,period_end,
          ledger_version,snapshot,expires_at) values ($1,$2,'financial_summary','2026-01-01',
          '2026-01-31',0,jsonb_build_object('format','pdf','delivery',$3::text),now()+interval '1 day')`,
          [id, owner, delivery],
        );
      await writer.query('begin');
      await insert(attempt, 'email');
      await writer.query('rollback');
      await insert(randomUUID(), 'download');
      expect(await readSignals()).toEqual([]);

      await insert(attempt, 'email');
      expect(await readSignals()).toEqual(['']);
      await writer.query(
        "update private.report_output_attempts set delivery_status='failed',error_code='REPORT_STORAGE_UNAVAILABLE' where id=$1",
        [attempt],
      );
      expect(await readSignals()).toEqual(['']);
      await writer.query("update public.profiles set status='suspended' where id=$1", [owner]);
      expect(await readSignals()).toEqual([]);
      await writer.query("update public.profiles set status='active' where id=$1", [owner]);
      expect(await readSignals()).toEqual(['']);
    } finally {
      try {
        await writer.query('rollback');
        await writer.query('delete from private.report_output_attempts where user_id=$1', [owner]);
        await writer.query('delete from public.profiles where id=$1', [owner]);
      } finally {
        await Promise.all([writer.end(), listener.end()]);
      }
    }
  });
});
