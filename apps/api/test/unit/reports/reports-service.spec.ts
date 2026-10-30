import { ReportsService } from '../../../src/reports/reports.service';
import type { ReportPeriodRange } from '../../../src/reports/reports.period';

describe('ReportsService summaries', () => {
  const principal = { userId: 'owner', sessionId: 'session', factorAgeSeconds: 0 };
  const response = {
    metadata: { schemaVersion: 1, generatedAt: '2026-09-04T00:00:00.000Z', ledgerVersion: 4 },
    summaries: [],
    breakdowns: [],
  };

  it('validates input, resolves the owner timezone, and caches by current ledger version', async () => {
    const repository = {
      getContext: jest.fn().mockResolvedValue({ timezone: 'Asia/Riyadh', ledgerVersion: 4 }),
      getSummary: jest.fn().mockResolvedValue(response),
      getHome: jest.fn(),
    };
    const service = new ReportsService(repository as never);
    const first = await service.getReportSummary(
      principal,
      { type: 'financial_summary', period: 'monthly', currency: 'SAR' },
      'r1',
      new Date('2026-09-04T00:00:00Z'),
    );
    const second = await service.getReportSummary(
      principal,
      { type: 'financial_summary', period: 'monthly', currency: 'SAR' },
      'r2',
      new Date('2026-09-04T00:00:00Z'),
    );
    expect(first).toEqual(response);
    expect(second).toEqual(response);
    expect(repository.getSummary).toHaveBeenCalledTimes(1);
    const calls = repository.getSummary.mock.calls as unknown[][];
    expect(calls[0]?.[2]).toMatchObject({
      startDate: '2026-09-01',
      endDate: '2026-09-30',
      timezone: 'Asia/Riyadh',
    });
  });

  it('keeps dashboard and report namespaces separate and maps validation errors safely', async () => {
    const repository = {
      getContext: jest.fn().mockResolvedValue({ timezone: 'UTC', ledgerVersion: 0 }),
      getSummary: jest.fn().mockResolvedValue(response),
      getHome: jest
        .fn()
        .mockResolvedValue({ ...response, balances: [], planning: {}, recentItems: [] }),
    };
    const service = new ReportsService(repository as never);
    await service.getReportSummary(
      principal,
      { type: 'financial_summary', period: 'annual' },
      'a',
      new Date('2026-09-04T00:00:00Z'),
    );
    await service.getDashboardHome(
      principal,
      { period: 'annual' },
      'b',
      new Date('2026-09-04T00:00:00Z'),
    );
    expect(repository.getSummary).toHaveBeenCalledTimes(1);
    expect(repository.getHome).toHaveBeenCalledTimes(1);
    await expect(
      service.getReportSummary(
        principal,
        { type: 'financial_summary', period: 'monthly', currency: 'sar' },
        'bad',
      ),
    ).rejects.toMatchObject({ status: 400 });
  });

  it('isolates cached account summaries, including accounts sharing a currency', async () => {
    const first = '99000000-0000-4000-8000-000000000001';
    const second = '99000000-0000-4000-8000-000000000002';
    const repository = {
      getContext: jest.fn().mockResolvedValue({ timezone: 'Asia/Riyadh', ledgerVersion: 4 }),
      getSummary: jest.fn((...args: unknown[]) =>
        Promise.resolve({
          ...response,
          summaries: [{ accountIds: args[5] ?? [], incomeMinor: args[5] ? 100 : 300 }],
        }),
      ),
    };
    const service = new ReportsService(repository as never);
    const query = { type: 'financial_summary', period: 'monthly', currency: 'SAR' };
    const all = await service.getReportSummary(principal, query, 'all');
    const a = await service.getReportSummary(principal, { ...query, accountIds: first }, 'a');
    const b = await service.getReportSummary(principal, { ...query, accountIds: second }, 'b');
    expect(a).toMatchObject({ summaries: [{ accountIds: [first], incomeMinor: 100 }] });
    expect(b).toMatchObject({ summaries: [{ accountIds: [second], incomeMinor: 100 }] });
    expect(all).toMatchObject({ summaries: [{ accountIds: [], incomeMinor: 300 }] });
    expect(
      await service.getReportSummary(principal, { ...query, accountIds: first }, 'cached'),
    ).toEqual(a);
    expect(repository.getSummary).toHaveBeenCalledTimes(3);
  });

  it('uses an explicit report anchor date instead of the request clock', async () => {
    const repository = {
      getContext: jest.fn().mockResolvedValue({ timezone: 'Asia/Riyadh', ledgerVersion: 4 }),
      getSummary: jest.fn().mockResolvedValue(response),
      getHome: jest.fn(),
    };
    const service = new ReportsService(repository as never);

    await service.getReportSummary(
      principal,
      {
        type: 'financial_summary',
        period: 'monthly',
        anchorDate: '2026-08-17',
        currency: 'SAR',
      },
      'anchored',
      new Date('2026-09-04T00:00:00Z'),
    );

    expect(repository.getSummary).toHaveBeenCalledWith(
      principal,
      'financial_summary',
      expect.objectContaining({
        startDate: '2026-08-01',
        endDate: '2026-08-31',
        timezone: 'Asia/Riyadh',
      }),
      'SAR',
      'anchored',
    );
  });
});


describe('resolved report cache identity', () => {
  const principal = { userId: 'cache-owner', sessionId: 'cache-session', factorAgeSeconds: 0 };
  function fixture(namespace: 'report' | 'dashboard') {
    let timezone = 'Asia/Riyadh';
    const reply = (period: { timezone: string; startDate: string; endDate: string }) => ({
      metadata: { ledgerVersion: 4 },
      range: { timezone: period.timezone, startDate: period.startDate, endDate: period.endDate }
    });
    const repository = {
      getContext: jest.fn(() => Promise.resolve({ timezone, ledgerVersion: 4 })),
      getSummary: jest.fn((_principal: unknown, _type: unknown, period: ReportPeriodRange) => Promise.resolve(reply(period))),
      getHome: jest.fn((_principal: unknown, period: ReportPeriodRange) => Promise.resolve(reply(period)))
    };
    const service = new ReportsService(repository as never);
    return {
      repository,
      setTimezone: (next: string) => { timezone = next; },
      read: (query: Record<string, unknown>, now: Date) => namespace === 'report'
        ? service.getReportSummary(principal, { type: 'financial_summary', ...query }, 'cache-read', now)
        : service.getDashboardHome(principal, query, 'cache-read', now)
    };
  }
  it.each(['report', 'dashboard'] as const)('does not reuse %s data after a timezone change with the same ledger version', async namespace => {
    const f = fixture(namespace);
    const query = { period: 'monthly', anchorDate: '2026-09-04', currency: 'SAR' };
    await expect(f.read(query, new Date('2026-09-04T00:00:00Z'))).resolves.toMatchObject({ range: { timezone: 'Asia/Riyadh' } });
    f.setTimezone('UTC');
    await expect(f.read(query, new Date('2026-09-04T00:00:01Z'))).resolves.toMatchObject({ range: { timezone: 'UTC', startDate: '2026-09-01', endDate: '2026-09-30' } });
    await f.read(query, new Date('2026-09-04T00:00:02Z'));
    expect(namespace === 'report' ? f.repository.getSummary : f.repository.getHome).toHaveBeenCalledTimes(2);
  });
  it.each(['report', 'dashboard'] as const)('does not reuse %s data across an unanchored month rollover inside the TTL', async namespace => {
    const f = fixture(namespace);
    const query = { period: 'monthly', currency: 'SAR' };
    await expect(f.read(query, new Date('2026-09-30T20:59:59Z'))).resolves.toMatchObject({ range: { startDate: '2026-09-01', endDate: '2026-09-30' } });
    await expect(f.read(query, new Date('2026-09-30T21:00:00Z'))).resolves.toMatchObject({ range: { startDate: '2026-10-01', endDate: '2026-10-31' } });
  });
  it('does not reuse the previous 25-day report cycle after local midnight', async () => {
    const f = fixture('report');
    const query = { period: 'monthly', monthStartDay: '25', currency: 'SAR' };
    await expect(f.read(query, new Date('2026-10-24T20:59:59Z'))).resolves.toMatchObject({ range: { startDate: '2026-09-25', endDate: '2026-10-24' } });
    await expect(f.read(query, new Date('2026-10-24T21:00:00Z'))).resolves.toMatchObject({ range: { startDate: '2026-10-25', endDate: '2026-11-24' } });
  });
});
