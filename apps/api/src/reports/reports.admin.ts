import type { AdminReportCounts, AdminTrendPoint } from './reports.admin-types';

export function adminFreshness(counts: AdminReportCounts, activity = false, lookbackDays = 0) {
  if (!counts.observedAt) return { state: 'unavailable' };
  const partial =
    activity &&
    (!counts.collectionStartedAt ||
      !counts.periodStart ||
      Date.parse(counts.collectionStartedAt) >
        Date.parse(counts.periodStart) - lookbackDays * 86_400_000);
  return {
    state: partial ? 'partial' : 'fresh',
    asOf: counts.observedAt,
    ...(activity
      ? {
          warning: 'Mobile foreground observations only; history before collection is unavailable.',
        }
      : {}),
  };
}
export function adminObservation(counts: AdminReportCounts) {
  return {
    timezone: counts.timezone ?? 'UTC',
    start: counts.periodStart ?? null,
    end: counts.periodEnd ?? null,
    observedAt: counts.observedAt ?? null,
    collectionStartedAt: counts.collectionStartedAt ?? null,
  };
}
function trend(
  query: Record<string, unknown>,
  counts: AdminReportCounts,
  id: string,
  points: AdminTrendPoint[],
  activity = false,
) {
  return {
    id,
    label: id,
    kind: 'unique-customers',
    unit: 'customers',
    period: query.period,
    platformScope: query.platform,
    points,
    summary: activity
      ? 'Distinct customers with authenticated native foreground observations. Monthly uses 30 reporting days.'
      : 'Registered customers by reporting day.',
    freshness: adminFreshness(counts, activity, id === 'monthly-active' ? 29 : 0),
    observation: adminObservation(counts),
  };
}
export function adminOperations(query: Record<string, unknown>, counts: AdminReportCounts) {
  return (counts.operations ?? []).map((item) => ({
    ...item,
    period: query.period,
    freshness: adminFreshness(counts),
    observation: adminObservation(counts),
  }));
}
export function adminAnalytics(query: Record<string, unknown>, counts: AdminReportCounts) {
  const freshness = adminFreshness(counts);
  const devices = [
    { platform: 'ios', count: counts.iosDevices },
    { platform: 'android', count: counts.androidDevices },
  ].filter((item) => query.platform === 'all' || item.platform === query.platform);
  const totalDevices = devices.reduce((sum, item) => sum + item.count, 0);
  const operations = adminOperations(query, counts);
  return {
    query,
    customers: {
      uniqueCustomersTotal: counts.totalUsers,
      iosCustomers: counts.iosUsers,
      androidCustomers: counts.androidUsers,
      iosOnlyCustomers: counts.iosUsers - counts.bothUsers,
      androidOnlyCustomers: counts.androidUsers - counts.bothUsers,
      multiPlatformCustomers: counts.bothUsers,
      unknownPlatformCustomers:
        counts.unknownUsers ??
        counts.totalUsers - counts.iosUsers - counts.androidUsers + counts.bothUsers,
      activeCustomersTotal: counts.activity?.total ?? null,
      activeIosCustomers: counts.activity?.ios ?? null,
      activeAndroidCustomers: counts.activity?.android ?? null,
      newCustomersTotal: counts.newUsers,
      newIosCustomers: counts.newIosUsers ?? null,
      newAndroidCustomers: counts.newAndroidUsers ?? null,
      newMultiPlatformCustomers: counts.newBothUsers ?? null,
      newUnknownPlatformCustomers: counts.newUnknownUsers ?? null,
      period: query.period,
      platformScope: query.platform,
      freshness,
      activityFreshness: adminFreshness(counts, true),
      observation: adminObservation(counts),
    },
    userGrowth: trend(query, counts, 'user-growth', counts.growth ?? []),
    dailyActiveUsers: trend(query, counts, 'daily-active', counts.activity?.daily ?? [], true),
    monthlyActiveUsers: trend(
      query,
      counts,
      'monthly-active',
      counts.activity?.monthly ?? [],
      true,
    ),
    versions: counts.versions ?? [],
    capabilities: [],
    devices: devices.map((item) => ({
      platform: item.platform,
      category: 'registered',
      deviceCount: item.count,
      share: totalDevices ? item.count / totalDevices : 0,
    })),
    imports: operations.filter((item) => item.kind === 'imports'),
    support: operations.filter((item) => item.kind === 'tickets'),
    comparisonTrends: counts.importVolume
      ? [
          {
            ...trend(query, counts, 'import-volume', counts.importVolume),
            platformScope: 'global',
            kind: 'imports',
            unit: 'imports',
            summary: 'All import items by reporting day. Originating platform is not recorded.',
          },
        ]
      : [],
    errorRateTrend: {
      ...trend(query, counts, 'error-rate', []),
      kind: 'events',
      unit: 'ratio',
      freshness: { state: 'unavailable' },
      summary: 'HTTP error telemetry is not available in reports.',
    },
    regions: [
      { region: 'customers', availability: 'available', retryable: true },
      {
        region: 'adoption',
        availability: counts.versions?.length ? 'available' : 'empty',
        retryable: true,
      },
      {
        region: 'imports',
        availability: counts.importVolume ? 'available' : 'unavailable',
        retryable: true,
      },
      { region: 'support', availability: 'available', retryable: true },
    ],
  };
}
export function adminOverview(query: Record<string, unknown>, counts: AdminReportCounts) {
  const freshness = adminFreshness(counts);
  const unavailable = { state: 'unavailable' };
  const metric = (
    id: string,
    value: number | null,
    kind = 'unique-customers',
    scope = query.platform,
    measured = freshness,
  ) => ({
    id,
    label: id,
    numericValue: value,
    formattedValue: value === null ? 'Unavailable' : String(value),
    kind,
    platformScope: scope,
    period: query.period,
    freshness: measured,
    tone: 'neutral',
    observation: adminObservation(counts),
  });
  return {
    query,
    metrics: [
      metric('unique-customers', counts.totalUsers),
      metric('new-customers', counts.newUsers),
      metric(
        'active-customers',
        counts.activity?.total ?? null,
        'unique-customers',
        query.platform,
        adminFreshness(counts, true),
      ),
      metric('paid-customers', null, 'unique-customers', query.platform, unavailable),
      metric('mrr', null, 'currency', query.platform, unavailable),
      ...(counts.operations ?? []).map((item) =>
        metric(item.id, item.total, item.kind, item.platformScope),
      ),
    ],
    subscriptionRevenue: {
      paidCustomers: null,
      freeCustomers: null,
      recurringRevenue: null,
      currency: null,
      distribution: [],
      revenueTrend: {
        ...trend(query, counts, 'recurring-revenue', []),
        kind: 'currency',
        unit: 'unavailable',
        freshness: unavailable,
        summary: 'Billing data is not collected.',
      },
      freshness: unavailable,
    },
    operationalMetrics: adminOperations(query, counts),
    serviceHealth: [],
    regions: [
      { region: 'metrics', availability: 'available', retryable: true },
      {
        region: 'revenue',
        availability: 'unavailable',
        message: 'Billing data is not collected.',
        retryable: false,
      },
      {
        region: 'health',
        availability: 'unavailable',
        message: 'See system health for provider observations.',
        retryable: false,
      },
    ],
    freshness,
  };
}

export function aggregateExportRows(
  type: string,
  data: Record<string, unknown>,
): Record<string, unknown>[] {
  if (type === 'activity') return data.items as Record<string, unknown>[];
  const rows: Record<string, unknown>[] = [];
  type Measurement = { freshness?: { state?: string }; observation?: Record<string, unknown> };
  const add = (
    section: string,
    metric: string,
    value: unknown,
    scope: unknown,
    period: unknown,
    observedAt: unknown,
    timestamp: unknown = null,
    measurement: Measurement = {},
  ) =>
    rows.push({
      section,
      metric,
      value:
        value === undefined
          ? null
          : typeof value === 'number' && !Number.isInteger(value)
            ? String(value)
            : value,
      platformScope: scope,
      period,
      observedAt,
      timestamp,
      freshness: measurement.freshness?.state ?? 'unavailable',
      timezone: measurement.observation?.timezone ?? null,
      periodStart: measurement.observation?.start ?? null,
      periodEnd: measurement.observation?.end ?? null,
      collectionStartedAt: measurement.observation?.collectionStartedAt ?? null,
    });
  const query = data.query as Record<string, unknown>;
  if (type === 'overview') {
    for (const metric of data.metrics as Record<string, unknown>[])
      add(
        'overview',
        String(metric.id),
        metric.numericValue,
        metric.platformScope,
        metric.period,
        (metric.freshness as { asOf?: string }).asOf ?? null,
        null,
        metric,
      );
  } else {
    const customers = data.customers as Record<string, unknown>;
    const observed = (customers.freshness as { asOf?: string }).asOf ?? null;
    for (const [key, value] of Object.entries(customers))
      if (typeof value === 'number' || value === null)
        add('customers', key, value, query.platform, query.period, observed, null, {
          ...(customers as Measurement),
          freshness: (key.startsWith('active')
            ? customers.activityFreshness
            : customers.freshness) as Measurement['freshness'],
        });
    for (const key of ['userGrowth', 'dailyActiveUsers', 'monthlyActiveUsers']) {
      for (const point of (data[key] as { points: AdminTrendPoint[] }).points)
        add(
          key,
          key,
          point.value,
          query.platform,
          query.period,
          observed,
          point.timestamp,
          data[key] as Measurement,
        );
    }
    for (const key of ['versions', 'devices', 'imports', 'support'])
      for (const item of data[key] as Record<string, unknown>[]) {
        add(
          key,
          String(item.id ?? item.version ?? item.category),
          item.total ?? item.deviceCount,
          item.platformScope ?? item.platform,
          query.period,
          observed,
          null,
          key === 'imports' || key === 'support' ? item : customers,
        );
      }
  }
  return rows;
}
