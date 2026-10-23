import { ReportsService } from '../../../src/reports/reports.service';
import { renderReport } from '../../../src/reports/reports.renderer';
import { buildReportPdfSections } from '../../../src/reports/reports.pdf-content';

const principal = { userId: 'admin', sessionId: 'session', factorAgeSeconds: 0 };
const counts = {
  totalUsers: 12,
  newUsers: 2,
  iosUsers: 7,
  androidUsers: 6,
  bothUsers: 3,
  iosDevices: 8,
  androidDevices: 6,
  unknownUsers: 2,
  newIosUsers: 1,
  newAndroidUsers: 1,
  newBothUsers: 1,
  newUnknownUsers: 1,
  observedAt: '2026-10-23T09:00:00.000Z',
  timezone: 'Asia/Riyadh',
  periodStart: '2026-09-23T21:00:00.000Z',
  periodEnd: '2026-10-23T09:00:00.000Z',
  collectionStartedAt: '2026-10-22T09:00:00.000Z',
  activity: {
    total: 2,
    ios: 2,
    android: 1,
    daily: [{ timestamp: '2026-10-22T21:00:00.000Z', value: 2 }],
    monthly: [{ timestamp: '2026-10-22T21:00:00.000Z', value: 2 }],
  },
  importVolume: [{ timestamp: '2026-10-22T21:00:00.000Z', value: 1234 }],
  growth: [{ timestamp: '2026-10-22T21:00:00.000Z', value: 2 }],
  versions: [
    {
      platform: 'ios',
      version: '1.2',
      deviceCount: 8,
      share: 1,
      supportState: 'unknown',
      unattributed: false,
    },
  ],
  operations: [
    {
      id: 'imports',
      kind: 'imports',
      total: 1234,
      successful: 1200,
      failed: 12,
      platformScope: 'global',
    },
  ],
};
const make = () => {
  const repository = {
    getAdminReportCounts: jest.fn().mockResolvedValue(counts),
    getAdminOverviewActivity: jest.fn().mockResolvedValue({
      items: [
        {
          id: 'audit',
          eventType: 'account-deletion-cancelled',
          summary: 'Deletion cancelled.',
          occurredAt: counts.observedAt,
          platformScope: 'global',
          permission: 'admin.overview.read',
        },
      ],
      totalItems: 1,
    }),
    getSupportedFinancialReport: jest.fn().mockResolvedValue({
      ledgerVersion: 7,
      currencyCode: 'USD',
      timezone: 'Asia/Dubai',
      currencyMinorUnits: { USD: 2 },
      summaries: [{ currency_code: 'USD', income_minor: 1234, expense_minor: 0 }],
    }),
    captureAdminExport: jest
      .fn()
      .mockImplementation((_p, _c, snapshot) => Promise.resolve(snapshot)),
  };
  return { repository, service: new ReportsService(repository as never) };
};

describe('measured admin reports', () => {
  it('uses registered customers including unknown devices and actual collected activity', async () => {
    const result = await make().service.getAdminPlatformAnalytics(principal, {});
    expect(result).toMatchObject({
      customers: {
        uniqueCustomersTotal: 12,
        unknownPlatformCustomers: 2,
        activeCustomersTotal: 2,
        newCustomersTotal: 2,
      },
      versions: counts.versions,
      dailyActiveUsers: { points: counts.activity.daily },
      errorRateTrend: { points: [], freshness: { state: 'unavailable' } },
    });
    expect(result).toHaveProperty('customers.freshness.asOf', counts.observedAt);
    expect(result.comparisonTrends).toEqual([
      expect.objectContaining({
        id: 'import-volume',
        platformScope: 'global',
        points: counts.importVolume,
      }),
    ]);
  });
  it('marks monthly windows partial until all 30 reporting days have been collected', async () => {
    const { service, repository } = make();
    repository.getAdminReportCounts.mockResolvedValue({
      ...counts,
      periodStart: '2026-10-16T21:00:00.000Z',
      collectionStartedAt: '2026-10-10T09:00:00.000Z',
    });
    const result = await service.getAdminPlatformAnalytics(principal, { period: '7d' });
    expect(result).toHaveProperty('monthlyActiveUsers.freshness.state', 'partial');
  });
  it('preserves missing revenue as unknown and measured imports as 1234', async () => {
    const result = await make().service.getAdminOverview(principal, {});
    expect(result).toHaveProperty('subscriptionRevenue.recurringRevenue', null);
    expect(result.metrics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'imports', numericValue: 1234 }),
        expect.objectContaining({ id: 'mrr', numericValue: null }),
      ]),
    );
  });
  it.each(['overview', 'platform_analytics', 'activity'])(
    'exports actual %s rows and dataset columns',
    async (exportType) => {
      const snapshot = await make().service.createAdminExport(
        principal,
        { exportType, period: '7d', format: 'csv' },
        'export-key',
        'request',
      );
      const rendered = renderReport(snapshot as never, 'csv', 1_000_000);
      let csv = '';
      for await (const chunk of rendered.body) csv += String(chunk);
      await rendered.byteCounter;
      expect(csv).toContain(exportType === 'activity' ? 'eventType' : 'metric');
      expect(csv).toContain(exportType === 'activity' ? 'Deletion cancelled.' : '12');
    },
  );
  it('keeps the supported report currency and scale in PDF content', async () => {
    const snapshot = await make().service.createAdminExport(
      principal,
      {
        exportType: 'user_report',
        period: '7d',
        format: 'pdf',
        userId: 'customer',
        supportReason: 'Customer asked for help',
      },
      'export-key',
      'request',
    );
    expect(snapshot.currencyCode).toBe('USD');
    expect(JSON.stringify(buildReportPdfSections(snapshot as never))).toContain('12.34 USD');
    expect(JSON.stringify(buildReportPdfSections(snapshot as never))).not.toContain('SAR');
  });
});
