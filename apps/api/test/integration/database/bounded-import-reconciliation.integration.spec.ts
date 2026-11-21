import { randomUUID } from 'node:crypto';
import { createLivePool, describeLiveDatabase } from '../../live-database';

describeLiveDatabase('bounded import reconciliation', () => {
  const pool = createLivePool();
  const owner = `import_reconcile_${randomUUID()}`;
  const sessionSql = `insert into public.import_sessions(id,user_id,source_type,request_hash,status,item_count)
    values($1,$2,'manual',md5($1::uuid::text)||md5($1::uuid::text),$3,$4)`;
  const itemSql = `insert into public.import_items(id,user_id,session_id,source_item_key,normalized_hash,source_hash,status)
    values($1,$2,$3,'item',repeat('a',64),repeat('b',64),'review')`;

  beforeAll(async () => {
    await pool.query("insert into public.profiles(id,status) values($1,'active')", [owner]);
  });
  afterAll(async () => {
    try {
      await pool.query('delete from public.profiles where id=$1', [owner]);
    } finally {
      await pool.onModuleDestroy();
    }
  });

  it('repairs legacy drift across bounded keyset pages and resumes after the due time', async () => {
    await pool.withClient(async (client) => {
      await client.query('begin');
      try {
        const prefix = randomUUID().slice(0, 24);
        const id = (n: number) => prefix + n.toString().padStart(12, '0');
        for (const n of [1, 2, 3]) await client.query(sessionSql, [id(n), owner, 'review', 7]);
        const ids = [id(1), id(2), id(3)];
        await client.query(
          'delete from private.import_reconcile_changes where session_id=any($1)',
          [ids],
        );
        await client.query(
          "update private.import_reconcile_scan set last_id=$1,next_page_at='-infinity'",
          [id(0)],
        );
        await client.query('select private.queue_import_recovery_page(2)');
        await client.query('select private.queue_import_recovery_page(2)');
        expect(
          (
            await client.query(
              'select session_id from private.import_reconcile_changes where session_id=any($1) order by session_id',
              [ids],
            )
          ).rows,
        ).toEqual([{ session_id: id(1) }, { session_id: id(2) }]);
        await client.query('select private.reconcile_import_sessions(1000)');
        expect(
          (
            await client.query(
              'select item_count from public.import_sessions where id=any($1) order by id',
              [ids],
            )
          ).rows,
        ).toEqual([{ item_count: 0 }, { item_count: 0 }, { item_count: 7 }]);
        await client.query("update private.import_reconcile_scan set next_page_at='-infinity'");
        await client.query('select private.reconcile_import_sessions(1000)');
        expect(
          (
            await client.query('select status,item_count from public.import_sessions where id=$1', [
              id(3),
            ])
          ).rows,
        ).toEqual([{ status: 'complete', item_count: 0 }]);
        expect(
          (
            await client.query(
              "select aggregate_id from private.outbox_events where aggregate_id=any($1) and payload->>'status'='complete'",
              [ids],
            )
          ).rows,
        ).toHaveLength(3);
      } finally {
        await client.query('rollback');
      }
    });
  });

  it('tracks both sides of an item move and a deletion and rolls back the mark with the write', async () => {
    await pool.withClient(async (client) => {
      await client.query('begin');
      try {
        const first = randomUUID(),
          second = randomUUID(),
          item = randomUUID();
        for (const id of [first, second])
          await client.query(sessionSql, [id, owner, 'received', 0]);
        await client.query(itemSql, [item, owner, first]);
        await client.query('select private.reconcile_import_sessions(1000)');
        await client.query('savepoint before_move');
        await client.query('update public.import_items set session_id=$1 where id=$2', [
          second,
          item,
        ]);
        const marks = () =>
          client.query(
            'select session_id from private.import_reconcile_changes where session_id=any($1) order by session_id',
            [[first, second]],
          );
        expect((await marks()).rows).toHaveLength(2);
        await client.query('rollback to before_move');
        expect((await marks()).rows).toHaveLength(0);
        await client.query('update public.import_items set session_id=$1 where id=$2', [
          second,
          item,
        ]);
        await client.query('select private.reconcile_import_sessions(1000)');
        const count = (id: string) =>
          client.query('select item_count from public.import_sessions where id=$1', [id]);
        expect((await count(first)).rows).toEqual([{ item_count: 0 }]);
        expect((await count(second)).rows).toEqual([{ item_count: 1 }]);
        await client.query('delete from public.import_items where id=$1', [item]);
        await client.query('select private.reconcile_import_sessions(1000)');
        expect((await count(second)).rows).toEqual([{ item_count: 0 }]);
      } finally {
        await client.query('rollback');
      }
    });
  });

  it('moves a locked queue prefix behind unrelated work and visits it after release', async () => {
    const ids = [randomUUID(), randomUUID(), randomUUID()];
    try {
      for (const id of ids) await pool.query(sessionSql, [id, owner, 'received', 7]);
      await pool.withClient(async (locker) => {
        await locker.query('begin');
        try {
          await locker.query(
            'select id from public.import_sessions where id=any($1::uuid[]) for update',
            [ids.slice(0, 2)],
          );
          // A limit of one inspects two marks. Both may belong to locked parents.
          await pool.query('select private.reconcile_import_sessions(1)');
          await pool.query('select private.reconcile_import_sessions(1)');
          expect(
            (
              await pool.query('select item_count from public.import_sessions where id=$1', [
                ids[2],
              ])
            ).rows,
          ).toEqual([{ item_count: 0 }]);
          expect(
            (
              await locker.query(
                'select item_count from public.import_sessions where id=any($1::uuid[])',
                [ids.slice(0, 2)],
              )
            ).rows,
          ).toEqual([{ item_count: 7 }, { item_count: 7 }]);
        } finally {
          await locker.query('rollback');
        }
      });
      await pool.query('select private.reconcile_import_sessions(1000)');
      expect(
        (
          await pool.query(
            'select item_count from public.import_sessions where id=any($1::uuid[])',
            [ids],
          )
        ).rows,
      ).toEqual([{ item_count: 0 }, { item_count: 0 }, { item_count: 0 }]);
    } finally {
      await pool.query('delete from public.import_sessions where id=any($1::uuid[])', [ids]);
      await pool.query(
        'delete from private.import_reconcile_changes where session_id=any($1::uuid[])',
        [ids],
      );
    }
  });

  it('retains an uncommitted acceptance while workers claim different sessions and emits one completion', async () => {
    const session = randomUUID(),
      item = randomUUID(),
      transaction = randomUUID(),
      other = randomUUID();
    try {
      await pool.query(sessionSql, [session, owner, 'review', 9]);
      await pool.query(itemSql, [item, owner, session]);
      await pool.query(
        `insert into public.transactions(id,user_id,kind,status,amount_minor,currency_code,title,occurred_at)
        values($1,$2,'expense','confirmed',100,'SAR','Reconciliation fixture',now())`,
        [transaction, owner],
      );
      await pool.withClient(async (writer) => {
        await writer.query('begin');
        try {
          await writer.query("set local lock_timeout='2s'");
          await writer.query(
            "update public.import_items set status='accepted',transaction_id=$1 where id=$2",
            [transaction, item],
          );
          await pool.withClient(async (worker) => {
            await worker.query('begin');
            try {
              await worker.query("set local lock_timeout='2s'");
              await worker.query('select private.reconcile_import_sessions(1000)');
              expect(
                (
                  await worker.query(
                    'select status,item_count,accepted_count from public.import_sessions where id=$1',
                    [session],
                  )
                ).rows,
              ).toEqual([{ status: 'review', item_count: 1, accepted_count: 0 }]);
              await pool.query(sessionSql, [other, owner, 'received', 4]);
              await pool.query('select private.reconcile_import_sessions(1000)');
              expect(
                (
                  await pool.query('select item_count from public.import_sessions where id=$1', [
                    other,
                  ])
                ).rows,
              ).toEqual([{ item_count: 0 }]);
              await worker.query('commit');
            } finally {
              await worker.query('rollback');
            }
          });
          await writer.query('commit');
        } finally {
          await writer.query('rollback');
        }
      });
      await Promise.all([
        pool.query('select private.reconcile_import_sessions(1000)'),
        pool.query('select private.reconcile_import_sessions(1000)'),
      ]);
      expect(
        (
          await pool.query(
            `select s.item_count,s.accepted_count,s.rejected_count,
        o.payload->>'version'=s.version::text current_version from public.import_sessions s
        join private.outbox_events o on o.aggregate_id=s.id and o.event_type='import.session.changed.v1'
        where s.id=$1 and s.status='complete' and o.payload->>'status'='complete'`,
            [session],
          )
        ).rows,
      ).toEqual([{ item_count: 1, accepted_count: 1, rejected_count: 0, current_version: true }]);
    } finally {
      await pool.query('delete from public.import_sessions where id=any($1::uuid[])', [
        [session, other],
      ]);
      await pool.query('delete from public.transactions where id=$1', [transaction]);
      await pool.query('delete from private.import_reconcile_changes where session_id=any($1)', [
        [session, other],
      ]);
      await pool.query('delete from private.outbox_events where aggregate_id=$1', [session]);
    }
  });
});
