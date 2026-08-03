import type {
  CapabilityAdoptionMetric,
  CustomerPlatformBreakdown,
  DataFreshness,
  DeviceDistributionItem,
  OverviewActivityItem,
  OverviewMetric,
  PlatformAnalyticsResponse,
  PlatformOperationalMetric,
  PlatformScope,
  ReportingPeriod,
  ServiceHealthSummary,
  SubscriptionRevenueSummary,
  TrendPoint,
  TrendSeries,
} from "@/features/overview/contracts";

const NOW = "2026-07-27T10:00:00+03:00";
const H = (offset: string, hours: number) => {
  const base = Date.parse(`2026-07-27T10:00:00+03:00`) - hours * 3_600_000;
  const d = new Date(base);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}T${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:00+00:00`;
};

export const dataFreshness = (hours = 1): DataFreshness => ({
  state: "fresh",
  asOf: H(NOW, hours),
});

const staleFreshness: DataFreshness = {
  state: "stale",
  asOf: H(NOW, 26),
  warning: "آخر تحديث ناجح يعود لليوم السابق.",
};

const periodTimestamps: Record<ReportingPeriod, string[]> = {
  "7d": [6, 5, 4, 3, 2, 1, 0].map((h) => H(NOW, h * 24)),
  "30d": [29, 24, 19, 14, 9, 4, 0].map((h) => H(NOW, h * 24)),
  "90d": [89, 74, 59, 44, 29, 14, 0].map((h) => H(NOW, h * 24)),
};

const periodLabel: Record<ReportingPeriod, string> = {
  "7d": "آخر 7 أيام",
  "30d": "آخر 30 يوماً",
  "90d": "آخر 90 يوماً",
};

function makeTrend(
  input: Pick<TrendSeries, "id" | "label" | "kind" | "unit" | "platformScope" | "summary"> & {
    period: ReportingPeriod;
    values: number[];
    comparison?: number[];
  },
): TrendSeries {
  const timestamps = periodTimestamps[input.period];
  const points: TrendPoint[] = input.values.map((value, index) => ({
    timestamp: timestamps[index],
    value,
    comparisonValue: input.comparison?.[index],
  }));
  return {
    id: input.id,
    label: input.label,
    kind: input.kind,
    unit: input.unit,
    period: input.period,
    platformScope: input.platformScope,
    points,
    summary: input.summary,
  };
}

type BreakdownSeed = {
  unique: number;
  iosOnly: number;
  androidOnly: number;
  multi: number;
  activeIos: number;
  activeAndroid: number;
  activeTotal: number;
  newIos: number;
  newAndroid: number;
};

function breakdown(seed: BreakdownSeed, period: ReportingPeriod): CustomerPlatformBreakdown {
  return {
    uniqueCustomersTotal: seed.unique,
    iosCustomers: seed.iosOnly + seed.multi,
    androidCustomers: seed.androidOnly + seed.multi,
    iosOnlyCustomers: seed.iosOnly,
    androidOnlyCustomers: seed.androidOnly,
    multiPlatformCustomers: seed.multi,
    activeCustomersTotal: seed.activeTotal,
    activeIosCustomers: seed.activeIos,
    activeAndroidCustomers: seed.activeAndroid,
    newCustomersTotal: seed.newIos + seed.newAndroid,
    newIosCustomers: seed.newIos,
    newAndroidCustomers: seed.newAndroid,
    period,
    freshness: dataFreshness(),
  };
}

const seeds: Record<PlatformFilter, BreakdownSeed> = {
  all: {
    unique: 128450, iosOnly: 66200, androidOnly: 57300, multi: 4950,
    activeIos: 46800, activeAndroid: 41200, activeTotal: 84210,
    newIos: 1680, newAndroid: 1440,
  },
  ios: {
    unique: 71150, iosOnly: 71150, androidOnly: 0, multi: 0,
    activeIos: 46800, activeAndroid: 0, activeTotal: 46800,
    newIos: 1680, newAndroid: 0,
  },
  android: {
    unique: 62250, iosOnly: 0, androidOnly: 62250, multi: 0,
    activeIos: 0, activeAndroid: 41200, activeTotal: 41200,
    newIos: 0, newAndroid: 1440,
  },
};

type PlatformFilter = "all" | "ios" | "android";

function scopeFor(platform: PlatformFilter): PlatformScope {
  return platform === "all" ? "all" : platform;
}

const growthByPeriod: Record<ReportingPeriod, number[]> = {
  "7d": [125800, 126200, 126900, 127400, 127900, 128200, 128450],
  "30d": [120100, 122400, 124200, 125800, 126900, 127800, 128450],
  "90d": [110200, 115600, 119400, 122800, 125100, 127200, 128450],
};
const dauByPeriod: Record<ReportingPeriod, number[]> = {
  "7d": [38200, 39100, 40600, 41800, 42900, 43500, 44100],
  "30d": [36400, 38900, 40200, 41800, 42900, 43600, 44100],
  "90d": [32100, 35200, 38400, 40600, 42200, 43400, 44100],
};
const mauByPeriod: Record<ReportingPeriod, number[]> = {
  "7d": [79800, 80600, 81400, 82200, 83000, 83700, 84210],
  "30d": [76400, 78200, 79800, 81200, 82400, 83400, 84210],
  "90d": [68200, 72400, 75800, 78900, 81200, 82900, 84210],
};
const errorRateByPeriod: Record<ReportingPeriod, number[]> = {
  "7d": [0.012, 0.01, 0.018, 0.014, 0.009, 0.011, 0.01],
  "30d": [0.016, 0.014, 0.012, 0.018, 0.013, 0.011, 0.01],
  "90d": [0.022, 0.018, 0.015, 0.013, 0.012, 0.011, 0.01],
};

function capabilitiesFor(platform: PlatformFilter, period: ReportingPeriod): CapabilityAdoptionMetric[] {
  if (platform === "ios") {
    return [
      { platform: "ios", capability: "shortcut", eligiblePopulation: 71150, enabledPopulation: 39132, rate: 0.55, period, caveat: "يقيس اعتماد اختصارات iOS المجمّعة فقط." },
      { platform: "ios", capability: "share-extension", eligiblePopulation: 71150, enabledPopulation: 25614, rate: 0.36, period, caveat: "اعتماد تجميعي لامتداد المشاركة." },
    ];
  }
  if (platform === "android") {
    return [
      { platform: "android", capability: "sms-tracking", eligiblePopulation: 62250, enabledPopulation: 34237, rate: 0.55, period, caveat: "تتبّع تجميعي لرسائل Android." },
      { platform: "android", capability: "notification-listener", eligiblePopulation: 62250, enabledPopulation: 18675, rate: 0.3, period, caveat: "اعتماد تجميعي لمستمع إشعارات Android." },
    ];
  }
  return [];
}

export function buildPlatformAnalytics(platform: PlatformFilter, period: ReportingPeriod): PlatformAnalyticsResponse {
  const scope = scopeFor(platform);
  return {
    query: { platform, period, locale: "ar" },
    customers: breakdown(seeds[platform], period),
    userGrowth: makeTrend({
      id: "user-growth", label: "نمو المستخدمين", kind: "unique-customers", unit: "عميل",
      period, platformScope: scope, values: growthByPeriod[period],
      comparison: period === "30d" ? [112400, 114900, 117800, 120600, 123100, 125400, 127200] : undefined,
      summary: `ارتفع العملاء إلى ${growthByPeriod[period].at(-1)} خلال ${periodLabel[period]}.`,
    }),
    dailyActiveUsers: makeTrend({
      id: "dau", label: "المستخدمون النشطون يومياً", kind: "unique-customers", unit: "عميل",
      period, platformScope: scope, values: dauByPeriod[period],
      summary: `ذروة النشاط اليومي ${dauByPeriod[period].at(-1)}.`,
    }),
    monthlyActiveUsers: makeTrend({
      id: "mau", label: "المستخدمون النشطون شهرياً", kind: "unique-customers", unit: "عميل",
      period, platformScope: scope, values: mauByPeriod[period],
      summary: `النشاط الشهري المجمع ${mauByPeriod[period].at(-1)}.`,
    }),
    versions: versionsFor(platform),
    capabilities: capabilitiesFor(platform, period),
    devices: devicesFor(platform),
    imports: [operationalMetric("imports", scope, period, 1920400, 1898400)],
    support: [operationalMetric("tickets", scope, period, 184, 184, 0)],
    comparisonTrends: comparisonFor(platform, period),
    errorRateTrend: makeTrend({
      id: "error-rate", label: "معدل الأخطاء", kind: "events", unit: "نسبة",
      period, platformScope: scope, values: errorRateByPeriod[period],
      summary: `معدل الأخطاء المجمع ${errorRateByPeriod[period].at(-1)}.`,
    }),
    regions: [{
      region: "customers", availability: "available", retryable: true,
    }],
  };
}

function versionsFor(platform: PlatformFilter): import("@/features/overview/contracts").AppVersionDistributionItem[] {
  if (platform === "ios") {
    return [
      { platform: "ios", version: "4.2.0", supportState: "current", customerCount: 58340, deviceCount: 61200, share: 0.82, unattributed: false },
      { platform: "ios", version: "4.1.2", supportState: "supported-older", customerCount: 10200, deviceCount: 10800, share: 0.14, unattributed: false },
      { platform: "ios", version: "3.9.1", supportState: "unsupported", customerCount: 2610, deviceCount: 2900, share: 0.04, unattributed: false },
    ];
  }
  if (platform === "android") {
    return [
      { platform: "android", version: "4.2.0", supportState: "current", customerCount: 50200, deviceCount: 53800, share: 0.8, unattributed: false },
      { platform: "android", version: "4.0.5", supportState: "supported-older", customerCount: 9300, deviceCount: 10100, share: 0.15, unattributed: false },
      { platform: "android", version: "غير معروف", supportState: "unknown", customerCount: 2750, deviceCount: 3100, share: 0.05, unattributed: true },
    ];
  }
  return [];
}

function devicesFor(platform: PlatformFilter): DeviceDistributionItem[] {
  if (platform === "ios") {
    return [
      { platform: "ios", category: "iPhone", deviceCount: 68400, share: 0.9 },
      { platform: "ios", category: "iPad", deviceCount: 7500, share: 0.1 },
    ];
  }
  if (platform === "android") {
    return [
      { platform: "android", category: "هاتف", deviceCount: 62100, share: 0.96 },
      { platform: "android", category: "لوحي", deviceCount: 2600, share: 0.04 },
    ];
  }
  return [];
}

function operationalMetric(
  kind: "imports" | "events" | "requests" | "tickets",
  scope: PlatformScope,
  period: ReportingPeriod,
  total: number,
  successful: number,
  failed?: number,
): PlatformOperationalMetric {
  return {
    id: `operational-${kind}-${scope}`,
    kind,
    platformScope: scope,
    total,
    successful,
    failed,
    rate: successful / total,
    period,
    freshness: dataFreshness(),
  };
}

function comparisonFor(platform: PlatformFilter, period: ReportingPeriod): TrendSeries[] {
  const timestamps = periodTimestamps[period];
  const importValues = [168000, 174000, 180000, 186000, 190000, 196000, 192040];
  const importSecondary = [28000, 30000, 32000, 30000, 26000, 24000, 22000];
  const series: TrendSeries[] = [];
  if (platform === "all") {
    series.push(
      {
        id: "comparison-ios", label: "iOS", kind: "unique-customers", unit: "عميل",
        period, platformScope: "ios", summary: "مقارنة مجمعة لجمهور iOS.",
        points: growthByPeriod[period].map((value, index) => ({
          timestamp: timestamps[index], value: Math.round(value * 0.55),
        })),
      },
      {
        id: "comparison-android", label: "Android", kind: "unique-customers", unit: "عميل",
        period, platformScope: "android", summary: "مقارنة مجمعة لجمهور Android.",
        points: growthByPeriod[period].map((value, index) => ({
          timestamp: timestamps[index], value: Math.round(value * 0.48),
        })),
      },
    );
  }
  series.push({
    id: "import-volume", label: "حجم الاستيراد", kind: "imports", unit: "معاملة",
    period, platformScope: scopeFor(platform), summary: "حجم الاستيراد اليومي المجمع مقابل الإشعارات.",
    points: importValues.map((value, index) => ({
      timestamp: timestamps[index],
      value,
      comparisonValue: importSecondary[index],
    })),
  });
  return series;
}

export const summaryMetrics = (platform: PlatformFilter, period: ReportingPeriod): OverviewMetric[] => {
  const scope = scopeFor(platform);
  const customers = breakdown(seeds[platform], period);
  const base: OverviewMetric[] = [
    { id: "unique-customers", label: "إجمالي العملاء", numericValue: customers.uniqueCustomersTotal, formattedValue: formatNumber(customers.uniqueCustomersTotal), kind: "unique-customers", platformScope: scope, period, freshness: dataFreshness(), change: 8.4, tone: "neutral", note: "مقابل الفترة السابقة" },
    { id: "active-customers", label: "العملاء النشطون", numericValue: customers.activeCustomersTotal, formattedValue: formatNumber(customers.activeCustomersTotal), kind: "unique-customers", platformScope: scope, period, freshness: dataFreshness(), change: 5.2, tone: "positive", note: "جلسة أو استخدام ميزة" },
    { id: "new-customers", label: "العملاء الجدد", numericValue: customers.newCustomersTotal, formattedValue: formatNumber(customers.newCustomersTotal), kind: "unique-customers", platformScope: scope, period, freshness: dataFreshness(), change: 3.1, tone: "positive", note: "إكمال التسجيل" },
    { id: "paid-customers", label: "العملاء المدفوعون", numericValue: 31870, formattedValue: "31,870", kind: "unique-customers", platformScope: scope, period, freshness: dataFreshness(), change: 3.8, tone: "premium", note: "24.8% من الإجمالي" },
    { id: "mrr", label: "الإيراد الشهري المتكرر", numericValue: 2480000, formattedValue: "2.48 مليون ر.س", kind: "currency", platformScope: scope, period, freshness: dataFreshness(), change: 6.1, tone: "positive", note: "تقدير تشغيلي" },
    { id: "imports", label: "المعاملات المستوردة", numericValue: 1920400, formattedValue: "1.92 مليون", kind: "imports", platformScope: scope, period, freshness: dataFreshness(), change: 11.6, tone: "neutral" },
    { id: "ai-usage", label: "عمليات الذكاء الاصطناعي", numericValue: 184200, formattedValue: "184,200", kind: "requests", platformScope: scope, period, freshness: dataFreshness(), change: 9.4, tone: "neutral" },
    { id: "support-tickets", label: "تذاكر الدعم المفتوحة", numericValue: 184, formattedValue: "184", kind: "tickets", platformScope: scope, period, freshness: dataFreshness(), change: -4.3, tone: "negative" },
    { id: "critical-incidents", label: "الحوادث الحرجة", numericValue: 2, formattedValue: "2", kind: "events", platformScope: scope, period, freshness: dataFreshness(), tone: "warning", note: "تحتاج مراجعة" },
    { id: "failed-jobs", label: "المهام الفاشلة", numericValue: 37, formattedValue: "37", kind: "events", platformScope: scope, period, freshness: dataFreshness(), tone: "warning", note: "خلال 24 ساعة" },
  ];
  return base;
};

export const subscriptionRevenue = (platform: PlatformFilter, period: ReportingPeriod): SubscriptionRevenueSummary => ({
  paidCustomers: 31870,
  freeCustomers: 96580,
  recurringRevenue: 2480000,
  currency: "SAR",
  distribution: [
    { plan: "مجاني", customers: 96580, share: 0.58 },
    { plan: "أساسي", customers: 44630, share: 0.27 },
    { plan: "Premium", customers: 24240, share: 0.15 },
  ],
  revenueTrend: makeTrend({
    id: "revenue", label: "الإيراد", kind: "currency", unit: "ر.س",
    period, platformScope: scopeFor(platform), values: [2280000, 2340000, 2390000, 2430000, 2450000, 2470000, 2480000],
    summary: "إيراد مجمّع موحّد بالريال السعودي.",
  }),
  freshness: dataFreshness(),
});

export const operationalSummaryMetrics = (platform: PlatformFilter, period: ReportingPeriod): PlatformOperationalMetric[] => {
  const scope = scopeFor(platform);
  return [
    operationalMetric("imports", scope, period, 1920400, 1898400, 22000),
    operationalMetric("requests", scope, period, 184200, 182100),
    operationalMetric("tickets", scope, period, 184, 184, 0),
  ];
};

export const serviceHealthSummary: ServiceHealthSummary[] = [
  { service: "api", status: "operational", platformScope: "global", uptime: 0.9999, latencyMs: 118, errorRate: 0.0008, lastCheckedAt: H(NOW, 0), freshness: dataFreshness() },
  { service: "database", status: "operational", platformScope: "global", uptime: 0.9998, latencyMs: 24, errorRate: 0.0002, lastCheckedAt: H(NOW, 0), freshness: dataFreshness() },
  { service: "cache", status: "operational", platformScope: "global", uptime: 0.9999, latencyMs: 6, errorRate: 0.0001, lastCheckedAt: H(NOW, 0), freshness: dataFreshness() },
  { service: "worker", status: "degraded", platformScope: "global", uptime: 0.9981, latencyMs: 420, errorRate: 0.0114, lastCheckedAt: H(NOW, 0), freshness: dataFreshness() },
  { service: "storage", status: "operational", platformScope: "global", uptime: 0.9999, latencyMs: 38, errorRate: 0.0003, lastCheckedAt: H(NOW, 0), freshness: dataFreshness() },
  { service: "payment-webhook", status: "operational", platformScope: "global", uptime: 0.9997, latencyMs: 92, errorRate: 0.0005, lastCheckedAt: H(NOW, 0), freshness: dataFreshness() },
  { service: "ai-provider", status: "partial-outage", platformScope: "global", uptime: 0.9872, latencyMs: 2400, errorRate: 0.0482, lastCheckedAt: H(NOW, 0), freshness: dataFreshness() },
  { service: "push-notification", status: "operational", platformScope: "global", uptime: 0.9998, latencyMs: 54, errorRate: 0.0004, lastCheckedAt: H(NOW, 0), freshness: dataFreshness() },
];

function formatNumber(value: number): string {
  return value.toLocaleString("en-US");
}

export function buildOverviewSummary(platform: PlatformFilter, period: ReportingPeriod) {
  return {
    query: { platform, period, locale: "ar" },
    metrics: summaryMetrics(platform, period),
    subscriptionRevenue: subscriptionRevenue(platform, period),
    operationalMetrics: operationalSummaryMetrics(platform, period),
    serviceHealth: serviceHealthSummary,
    regions: [{ region: "metrics" as const, availability: "available" as const, retryable: true }],
    freshness: dataFreshness(),
  };
}

export const overviewActivityFixture: OverviewActivityItem[] = [
  { id: "ACT-DEMO-001", eventType: "subscription-upgrade", summary: "ترقية اشتراك تجريبي إلى Premium.", occurredAt: H(NOW, 0), platformScope: "ios", permission: "admin.overview.read" },
  { id: "ACT-DEMO-002", eventType: "customer-registration", summary: "تسجيل عميل تجريبي جديد.", occurredAt: H(NOW, 1), platformScope: "android", permission: "admin.overview.read" },
  { id: "ACT-DEMO-003", eventType: "webhook-failure", summary: "فشل إشعار دفع تجريبي.", occurredAt: H(NOW, 2), platformScope: "global", permission: "admin.overview.read" },
  { id: "ACT-DEMO-004", eventType: "parser-rule-update", summary: "تحديث قاعدة محلّل تجريبي.", occurredAt: H(NOW, 3), platformScope: "android", permission: "imports.read", destination: "/admin/imports" },
  { id: "ACT-DEMO-005", eventType: "admin-role-change", summary: "تغيير دور تجريبي.", occurredAt: H(NOW, 5), platformScope: "global", permission: "users.read", destination: "/admin/users" },
  { id: "ACT-DEMO-006", eventType: "support-access-approval", summary: "اعتماد وصول دعم تجريبي.", occurredAt: H(NOW, 7), platformScope: "ios", permission: "users.read", destination: "/admin/users" },
  { id: "ACT-DEMO-007", eventType: "account-deletion-completed", summary: "اكتمال حذف حساب تجريبي.", occurredAt: H(NOW, 9), platformScope: "global", permission: "admin.overview.read" },
  { id: "ACT-DEMO-008", eventType: "customer-registration", summary: "تسجيل عميل تجريبي إضافي.", occurredAt: H(NOW, 11), platformScope: "ios", permission: "admin.overview.read" },
  { id: "ACT-DEMO-009", eventType: "subscription-upgrade", summary: "ترقية اشتراك تجريبية أخرى.", occurredAt: H(NOW, 13), platformScope: "android", permission: "admin.overview.read" },
  { id: "ACT-DEMO-010", eventType: "webhook-failure", summary: "فشل إشعار دفع تجريبي إضافي.", occurredAt: H(NOW, 15), platformScope: "global", permission: "admin.overview.read" },
  { id: "ACT-DEMO-011", eventType: "parser-rule-update", summary: "تحديث قاعدة محلّل إضافي.", occurredAt: H(NOW, 17), platformScope: "android", permission: "imports.read", destination: "/admin/imports" },
  { id: "ACT-DEMO-012", eventType: "customer-registration", summary: "تسجيل عميل تجريبي ثالث.", occurredAt: H(NOW, 19), platformScope: "ios", permission: "admin.overview.read" },
];

export const multiPlatformOverlapNote = "جمهورا iOS و Android يتداخلان عبر العملاء متعددي المنصات ولا يجمعان في عدد العملاء الفريدين.";

export { staleFreshness, periodLabel };
