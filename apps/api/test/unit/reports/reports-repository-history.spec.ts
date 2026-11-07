import { ReportsRepository } from '../../../src/reports/reports.repository';

const principal = { userId: 'history-owner', sessionId: 'history-session' } as never;
const scope = { scheduleId: 'schedule-one', status: 'ready' };

function historyDatabase(count: number) {
  const rows = Array.from({ length: count }, (_, index) => ({
    id: `00000000-0000-4000-8000-${String(count - index).padStart(12, '0')}`,
    schedule_id: scope.scheduleId,
    report_type: 'financial_summary',
    format: 'pdf',
    delivery: 'download',
    status: scope.status,
    metadata: {},
    requested_at: new Date('2026-10-30T12:00:00Z'),
    expires_at: new Date('2026-10-31T12:00:00Z'),
    error_code: null,
  }));
  const query = jest.fn((sql: string, values: unknown[] = []) => {
    if (!sql.includes('private.list_report_outputs')) return Promise.resolve({ rows: [] });
    const [owner, createdAt, id, limit, schedule, status] = values;
    if (owner !== 'history-owner' || Number(limit) < 1 || Number(limit) > 100)
      throw Object.assign(new Error('REPORT_OWNER_FORBIDDEN'), { code: '42501' });
    expect(schedule).toBe(scope.scheduleId);
    expect(status).toBe(scope.status);
    const start = id === null ? 0 : rows.findIndex((row) => row.id === id) + 1;
    if (id !== null) expect(createdAt).toBe(rows[start - 1]?.requested_at.toISOString());
    return Promise.resolve({ rows: rows.slice(start, start + Number(limit)) });
  });
  const repository = new ReportsRepository({
    withClient: (action: (client: { query: typeof query }) => unknown) => action({ query }),
  } as never);
  return { rows, query, repository };
}

describe('ReportsRepository history pagination at the RPC ceiling', () => {
  it.each([0, 99, 100, 101, 205])(
    'reads %i rows without gaps or a request over 100',
    async (count) => {
      const { rows, query, repository } = historyDatabase(count);
      const actual: unknown[] = [];
      let cursor: string | null = null;
      let pages = 0;
      do {
        const page = await repository.listAttempts(
          principal,
          { ...scope, cursor, limit: 100 },
          'history-request',
        );
        const items = page.items as Array<{ id: string; storageRef?: string }>;
        expect(items.length).toBeLessThanOrEqual(100);
        expect(items.every((row) => row.storageRef === undefined)).toBe(true);
        actual.push(...items.map((row) => row.id));
        cursor = page.nextCursor as string | null;
        expect(++pages).toBeLessThanOrEqual(3);
      } while (cursor);
      expect(actual).toEqual(rows.map((row) => row.id));
      expect(query).toHaveBeenCalledWith('begin isolation level repeatable read read only');
      expect(query).toHaveBeenCalledWith('set local role masarifi_api');
      expect(query).toHaveBeenLastCalledWith('commit');
    },
  );

  it('keeps ordinary page lookahead within the same read transaction', async () => {
    const { repository, query, rows } = historyDatabase(51);
    const page = await repository.listAttempts(
      principal,
      { ...scope, cursor: null, limit: 50 },
      'history-request',
    );
    expect((page.items as Array<{ id: string }>).map((row) => row.id)).toEqual(
      rows.slice(0, 50).map((row) => row.id),
    );
    expect(page.nextCursor).toEqual(expect.any(String));
    expect(
      query.mock.calls.filter(([sql]) => sql.includes('private.list_report_outputs')),
    ).toHaveLength(1);
  });
});
