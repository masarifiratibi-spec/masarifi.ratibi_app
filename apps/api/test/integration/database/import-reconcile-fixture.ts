// The upgraded disposable database can retain queue work from earlier suites.
// Move only marks generated for these fixtures ahead of it, preserving their FIFO order.
export async function prioritizeImportFixtureMarks(
  client: {
    query(sql: string, values: string[][]): Promise<{ rowCount: number | null }>;
  },
  ids: string[],
) {
  const result = await client.query(
    `with fixture_marks as (
       delete from private.import_reconcile_changes where session_id=any($1::uuid[])
       returning id,session_id,writer
     )
     insert into private.import_reconcile_changes(id,session_id,writer) overriding system value
     select id - 9223372036854775807::bigint, session_id, writer from fixture_marks`,
    [ids],
  );
  expect(result.rowCount).toBeGreaterThanOrEqual(ids.length);
}
