import { describe, expect, test } from "vitest";
import {
  appVersionDistributionItemSchema,
  capabilityAdoptionMetricSchema,
  customerPlatformBreakdownSchema,
  dataFreshnessSchema,
  deviceDistributionItemSchema,
  metricKindSchema,
  overviewActivityItemSchema,
  overviewActivityQuerySchema,
  overviewMetricSchema,
  overviewQuerySchema,
  overviewRegionStateSchema,
  overviewSummaryResponseSchema,
  paginatedResponseSchema,
  platformAnalyticsResponseSchema,
  platformFilterSchema,
  platformOperationalMetricSchema,
  platformScopeSchema,
  reportingPeriodSchema,
  serviceHealthSummarySchema,
  subscriptionRevenueSummarySchema,
  trendPointSchema,
  trendSeriesSchema,
} from "./contracts";

const validFreshness = { state: "fresh", asOf: "2026-07-27T09:00:00+03:00" } as const;

describe("shared overview primitives", () => {
  test("platform filter, period, scope, and metric kind reject unknown values", () => {
    expect(platformFilterSchema.parse("all")).toBe("all");
    expect(() => platformFilterSchema.parse("windows")).toThrow();
    expect(reportingPeriodSchema.parse("30d")).toBe("30d");
    expect(() => reportingPeriodSchema.parse("365d")).toThrow();
    expect(platformScopeSchema.parse("global")).toBe("global");
    expect(() => platformScopeSchema.parse("kaios")).toThrow();
    expect(metricKindSchema.parse("currency")).toBe("currency");
    expect(() => metricKindSchema.parse("messages")).toThrow();
  });

  test("overview query defaults platform=all, period=30d, locale=ar and rejects unsafe scenarios", () => {
    expect(overviewQuerySchema.parse({})).toEqual({
      platform: "all",
      period: "30d",
      locale: "ar",
    });
    expect(overviewQuerySchema.parse({ platform: "ios", period: "90d", locale: "en" })).toEqual({
      platform: "ios",
      period: "90d",
      locale: "en",
    });
    expect(() => overviewQuerySchema.parse({ platform: "blackberry" })).toThrow();
    expect(() => overviewQuerySchema.parse({ scenario: "" })).toThrow();
    expect(() => overviewQuerySchema.parse({ scenario: "x".repeat(51) })).toThrow();
  });

  test("data freshness requires asOf unless unavailable and forbids it when unavailable", () => {
    expect(dataFreshnessSchema.parse(validFreshness).state).toBe("fresh");
    expect(() => dataFreshnessSchema.parse({ state: "fresh" })).toThrow();
    expect(dataFreshnessSchema.parse({ state: "unavailable" }).state).toBe("unavailable");
    expect(() => dataFreshnessSchema.parse({ state: "unavailable", asOf: "2026-07-27T09:00:00+03:00" })).toThrow();
    expect(() => dataFreshnessSchema.parse({ state: "fresh", asOf: "not-a-timestamp" })).toThrow();
    expect(() => dataFreshnessSchema.parse({ state: "fresh", asOf: "2026-07-27T09:00:00+03:00", extra: true })).toThrow();
  });

  test("overview region state requires lastSuccessfulAt for stale and rejects unsafe text", () => {
    expect(
      overviewRegionStateSchema.parse({
        region: "metrics",
        availability: "available",
        retryable: false,
      }),
    ).toMatchObject({ availability: "available" });
    expect(() =>
      overviewRegionStateSchema.parse({ region: "metrics", availability: "stale", retryable: true }),
    ).toThrow();
    expect(
      overviewRegionStateSchema.parse({
        region: "metrics",
        availability: "stale",
        lastSuccessfulAt: "2026-07-26T09:00:00+03:00",
        retryable: true,
      }),
    ).toMatchObject({ availability: "stale" });
    expect(() =>
      overviewRegionStateSchema.parse({ region: "unknown-region", availability: "available", retryable: false }),
    ).toThrow();
  });

  test("paginated response envelope bounds page size and totals", () => {
    const itemSchema = overviewActivityItemSchema;
    const parsed = paginatedResponseSchema(itemSchema).parse({
      items: [],
      page: 1,
      pageSize: 10,
      totalItems: 0,
      totalPages: 0,
      region: { region: "activity", availability: "empty", retryable: false },
    });
    expect(parsed.totalPages).toBe(0);
    expect(() =>
      paginatedResponseSchema(itemSchema).parse({
        items: [],
        page: 0,
        pageSize: 10,
        totalItems: 0,
        totalPages: 0,
        region: { region: "activity", availability: "empty", retryable: false },
      }),
    ).toThrow();
  });
});

const validMetric = {
  id: "unique-customers",
  label: "إجمالي العملاء",
  numericValue: 128450,
  formattedValue: "128,450",
  kind: "unique-customers",
  platformScope: "all",
  period: "30d",
  freshness: validFreshness,
  tone: "neutral",
} as const;

describe("overview metric schema (US1)", () => {
  test("accepts a complete metric and separates numeric source from formatted display", () => {
    const parsed = overviewMetricSchema.parse(validMetric);
    expect(parsed.numericValue).toBe(128450);
    expect(parsed.formattedValue).toBe("128,450");
  });

  test("rejects invalid rate-style change, mixed metric tone, and overlong note", () => {
    expect(() => overviewMetricSchema.parse({ ...validMetric, change: Number.NaN })).toThrow();
    expect(() => overviewMetricSchema.parse({ ...validMetric, tone: "bronze" })).toThrow();
    expect(() => overviewMetricSchema.parse({ ...validMetric, note: "z".repeat(241) })).toThrow();
  });
});

describe("subscription revenue summary (US1)", () => {
  const base = {
    paidCustomers: 31870,
    freeCustomers: 96580,
    recurringRevenue: 2480000,
    currency: "SAR" as const,
    distribution: [
      { plan: "مجاني", customers: 96580, share: 0.752 },
      { plan: "Premium", customers: 31870, share: 0.248 },
    ],
    revenueTrend: {
      id: "revenue",
      label: "الإيراد المتكرر",
      kind: "currency" as const,
      unit: "SAR",
      period: "30d" as const,
      platformScope: "all" as const,
      points: [
        { timestamp: "2026-06-27T00:00:00+03:00", value: 2400000 },
        { timestamp: "2026-07-27T00:00:00+03:00", value: 2480000 },
      ],
      summary: "ارتفع الإيراد المتكرر بمقدار 80 ألف ريال.",
    },
    freshness: validFreshness,
  };

  test("accepts aggregated currency revenue", () => {
    expect(subscriptionRevenueSummarySchema.parse(base).recurringRevenue).toBe(2480000);
  });

  test("rejects mixed currency and non-currency revenue trend", () => {
    expect(() =>
      subscriptionRevenueSummarySchema.parse({ ...base, currency: "AED", revenueTrend: { ...base.revenueTrend, unit: "AED" } }),
    ).not.toThrow();
    expect(() =>
      subscriptionRevenueSummarySchema.parse({ ...base, revenueTrend: { ...base.revenueTrend, kind: "devices" } }),
    ).toThrow();
  });
});

describe("platform operational metric (US1)", () => {
  const base = {
    id: "imports-30d",
    kind: "imports" as const,
    platformScope: "all" as const,
    total: 1920000,
    successful: 1900000,
    failed: 20000,
    rate: 0.989,
    period: "30d" as const,
    freshness: validFreshness,
  };

  test("rejects successful or failed exceeding total", () => {
    expect(() => platformOperationalMetricSchema.parse({ ...base, successful: 1900000 })).not.toThrow();
    expect(() => platformOperationalMetricSchema.parse({ ...base, successful: 3000000 })).toThrow();
    expect(() => platformOperationalMetricSchema.parse({ ...base, failed: 3000000 })).toThrow();
    expect(() => platformOperationalMetricSchema.parse({ ...base, rate: 1.4 })).toThrow();
  });
});

describe("service health summary (US1)", () => {
  const base = {
    service: "api" as const,
    status: "operational" as const,
    platformScope: "global" as const,
    uptime: 0.9999,
    latencyMs: 118,
    errorRate: 0.0008,
    lastCheckedAt: "2026-07-27T09:00:00+03:00",
    freshness: validFreshness,
  };

  test("enforces global scope for every service", () => {
    expect(serviceHealthSummarySchema.parse(base).platformScope).toBe("global");
    expect(() => serviceHealthSummarySchema.parse({ ...base, platformScope: "ios" })).toThrow();
  });
});

describe("overview summary response (US1)", () => {
  test("accepts a complete summary and rejects malformed freshness", () => {
    const response = {
      query: { platform: "all", period: "30d", locale: "ar" },
      metrics: [validMetric],
      subscriptionRevenue: {
        paidCustomers: 31870,
        freeCustomers: 96580,
        recurringRevenue: 2480000,
        currency: "SAR",
        distribution: [
          { plan: "مجاني", customers: 96580, share: 0.752 },
          { plan: "Premium", customers: 31870, share: 0.248 },
        ],
        revenueTrend: {
          id: "revenue",
          label: "الإيراد",
          kind: "currency",
          unit: "SAR",
          period: "30d",
          platformScope: "all",
          points: [{ timestamp: "2026-07-27T00:00:00+03:00", value: 2480000 }],
          summary: "الإيراد مستقر.",
        },
        freshness: validFreshness,
      },
      operationalMetrics: [],
      serviceHealth: [],
      regions: [{ region: "metrics", availability: "available", retryable: false }],
      freshness: validFreshness,
    };
    expect(overviewSummaryResponseSchema.parse(response).metrics).toHaveLength(1);
    expect(() =>
      overviewSummaryResponseSchema.parse({ ...response, freshness: { state: "fresh" } }),
    ).toThrow();
  });
});

describe("customer platform breakdown invariants (US2)", () => {
  const valid = {
    uniqueCustomersTotal: 100,
    iosCustomers: 54,
    androidCustomers: 46,
    iosOnlyCustomers: 54,
    androidOnlyCustomers: 46,
    multiPlatformCustomers: 0,
    activeCustomersTotal: 70,
    activeIosCustomers: 40,
    activeAndroidCustomers: 35,
    newCustomersTotal: 12,
    newIosCustomers: 7,
    newAndroidCustomers: 5,
    period: "30d" as const,
    freshness: validFreshness,
  };

  test("accepts a deduplicated multi-platform breakdown", () => {
    const multi = {
      ...valid,
      uniqueCustomersTotal: 90,
      iosCustomers: 54,
      androidCustomers: 46,
      iosOnlyCustomers: 44,
      androidOnlyCustomers: 36,
      multiPlatformCustomers: 10,
    };
    expect(customerPlatformBreakdownSchema.parse(multi).multiPlatformCustomers).toBe(10);
  });

  test("rejects ios-only + android-only + multi that does not equal unique total", () => {
    expect(() =>
      customerPlatformBreakdownSchema.parse({ ...valid, uniqueCustomersTotal: 200 }),
    ).toThrow();
  });

  test("rejects iOS customers that do not equal iOS-only + multi", () => {
    expect(() => customerPlatformBreakdownSchema.parse({ ...valid, iosCustomers: 99 })).toThrow();
  });

  test("rejects active total greater than the sum of overlapping audiences", () => {
    expect(() =>
      customerPlatformBreakdownSchema.parse({ ...valid, activeCustomersTotal: 90 }),
    ).toThrow();
  });

  test("rejects mutually exclusive new customer counts that do not sum", () => {
    expect(() =>
      customerPlatformBreakdownSchema.parse({ ...valid, newCustomersTotal: 50 }),
    ).toThrow();
  });
});

describe("trend series invariants (US2)", () => {
  const base = {
    id: "user-growth",
    label: "نمو المستخدمين",
    kind: "unique-customers" as const,
    unit: "عملاء",
    period: "30d" as const,
    platformScope: "all" as const,
    points: [
      { timestamp: "2026-07-01T00:00:00+03:00", value: 95000 },
      { timestamp: "2026-07-15T00:00:00+03:00", value: 110000 },
    ],
    summary: "نمو مستقر خلال الفترة.",
  };

  test("rejects duplicate timestamps and non-chronological points", () => {
    expect(() =>
      trendSeriesSchema.parse({
        ...base,
        points: [
          { timestamp: "2026-07-01T00:00:00+03:00", value: 1 },
          { timestamp: "2026-07-01T00:00:00+03:00", value: 2 },
        ],
      }),
    ).toThrow();
    expect(() =>
      trendSeriesSchema.parse({
        ...base,
        points: [
          { timestamp: "2026-07-15T00:00:00+03:00", value: 2 },
          { timestamp: "2026-07-01T00:00:00+03:00", value: 1 },
        ],
      }),
    ).toThrow();
  });

  test("trend point rejects malformed timestamp", () => {
    expect(() => trendPointSchema.parse({ timestamp: "yesterday", value: 1 })).toThrow();
  });
});

describe("platform analytics response (US2)", () => {
  test("accepts a valid platform analytics response with overlap semantics", () => {
    const response = makeValidPlatformAnalyticsResponse();
    expect(platformAnalyticsResponseSchema.parse(response).customers.uniqueCustomersTotal).toBe(90);
  });

  test("rejects an impossible customer breakdown", () => {
    const response = makeValidPlatformAnalyticsResponse();
    response.customers.uniqueCustomersTotal = 500;
    expect(() => platformAnalyticsResponseSchema.parse(response)).toThrow();
  });
});

function makeValidPlatformAnalyticsResponse() {
  return {
    query: { platform: "all", period: "30d", locale: "ar" },
    customers: {
      uniqueCustomersTotal: 90,
      iosCustomers: 54,
      androidCustomers: 46,
      iosOnlyCustomers: 44,
      androidOnlyCustomers: 36,
      multiPlatformCustomers: 10,
      activeCustomersTotal: 60,
      activeIosCustomers: 40,
      activeAndroidCustomers: 35,
      newCustomersTotal: 12,
      newIosCustomers: 7,
      newAndroidCustomers: 5,
      period: "30d",
      freshness: validFreshness,
    },
    userGrowth: {
      id: "ug",
      label: "نمو",
      kind: "unique-customers",
      unit: "عملاء",
      period: "30d",
      platformScope: "all",
      points: [{ timestamp: "2026-07-01T00:00:00+03:00", value: 80 }],
      summary: "نمو.",
    },
    dailyActiveUsers: {
      id: "dau",
      label: "نشط يومي",
      kind: "unique-customers",
      unit: "عملاء",
      period: "30d",
      platformScope: "all",
      points: [{ timestamp: "2026-07-01T00:00:00+03:00", value: 30 }],
      summary: "نشاط يومي.",
    },
    monthlyActiveUsers: {
      id: "mau",
      label: "نشط شهري",
      kind: "unique-customers",
      unit: "عملاء",
      period: "30d",
      platformScope: "all",
      points: [{ timestamp: "2026-07-01T00:00:00+03:00", value: 60 }],
      summary: "نشاط شهري.",
    },
    versions: [],
    capabilities: [],
    devices: [],
    imports: [],
    support: [],
    comparisonTrends: [],
    errorRateTrend: {
      id: "err",
      label: "معدل الخطأ",
      kind: "requests",
      unit: "نسبة",
      period: "30d",
      platformScope: "all",
      points: [{ timestamp: "2026-07-01T00:00:00+03:00", value: 0.01 }],
      summary: "معدل خطأ منخفض.",
    },
    regions: [{ region: "customers", availability: "available", retryable: false }],
  };
}

describe("app version distribution (US3)", () => {
  test("accepts known and unknown platform versions", () => {
    expect(
      appVersionDistributionItemSchema.parse({
        platform: "ios",
        version: "4.2.1",
        supportState: "current",
        deviceCount: 1200,
        share: 0.6,
        unattributed: false,
      }),
    ).toMatchObject({ platform: "ios" });
    expect(
      appVersionDistributionItemSchema.parse({
        platform: "unknown",
        version: "غير معروف",
        supportState: "unknown",
        deviceCount: 50,
        share: 0.02,
        unattributed: true,
      }),
    ).toMatchObject({ unattributed: true });
  });

  test("rejects share outside 0..1", () => {
    expect(() =>
      appVersionDistributionItemSchema.parse({
        platform: "ios",
        version: "4.2.1",
        supportState: "current",
        deviceCount: 1,
        share: 1.5,
        unattributed: false,
      }),
    ).toThrow();
  });
});

describe("capability adoption (US3)", () => {
  test("accepts iOS shortcut and rejects prohibited iOS SMS capability", () => {
    expect(
      capabilityAdoptionMetricSchema.parse({
        platform: "ios",
        capability: "shortcut",
        eligiblePopulation: 100,
        enabledPopulation: 40,
        rate: 0.4,
        period: "30d",
        caveat: "اختصارات iOS محدودة.",
      }),
    ).toMatchObject({ capability: "shortcut" });
    expect(() =>
      capabilityAdoptionMetricSchema.parse({
        platform: "ios",
        capability: "sms-tracking",
        eligiblePopulation: 100,
        enabledPopulation: 1,
        rate: 0.01,
        period: "30d",
        caveat: "iOS لا يدعم تتبع الرسائل.",
      }),
    ).toThrow();
  });

  test("rejects enabled greater than eligible and rate mismatch", () => {
    expect(() =>
      capabilityAdoptionMetricSchema.parse({
        platform: "android",
        capability: "sms-tracking",
        eligiblePopulation: 100,
        enabledPopulation: 120,
        rate: 1.2,
        period: "30d",
        caveat: "تجاوز.",
      }),
    ).toThrow();
    expect(() =>
      capabilityAdoptionMetricSchema.parse({
        platform: "android",
        capability: "notification-listener",
        eligiblePopulation: 100,
        enabledPopulation: 30,
        rate: 0.9,
        period: "30d",
        caveat: "تطابق خاطئ.",
      }),
    ).toThrow();
  });
});

describe("device distribution (US3)", () => {
  test("aggregates devices without identifiers", () => {
    expect(
      deviceDistributionItemSchema.parse({
        platform: "android",
        category: "هواتف منتصف المدى",
        deviceCount: 500,
        share: 0.5,
      }),
    ).toMatchObject({ deviceCount: 500 });
    expect(() =>
      deviceDistributionItemSchema.parse({ platform: "android", category: "x", deviceCount: -1, share: 0.1 }),
    ).toThrow();
  });
});

describe("overview activity (US5)", () => {
  test("query bounds pagination", () => {
    expect(overviewActivityQuerySchema.parse({})).toMatchObject({ page: 1, pageSize: 10 });
    expect(() => overviewActivityQuerySchema.parse({ page: 0, pageSize: 10 })).toThrow();
    expect(() => overviewActivityQuerySchema.parse({ page: 1, pageSize: 26 })).toThrow();
  });

  test("item rejects unsupported event type and unapproved destination", () => {
    expect(
      overviewActivityItemSchema.parse({
        id: "ACT-1",
        eventType: "customer-registration",
        summary: "تسجيل جديد.",
        occurredAt: "2026-07-27T09:00:00+03:00",
        platformScope: "ios",
        permission: "admin.overview.read",
      }),
    ).toMatchObject({ eventType: "customer-registration" });
    expect(() =>
      overviewActivityItemSchema.parse({
        id: "ACT-1",
        eventType: "unknown-event",
        summary: "x",
        occurredAt: "2026-07-27T09:00:00+03:00",
        platformScope: "ios",
        permission: "admin.overview.read",
      }),
    ).toThrow();
    expect(() =>
      overviewActivityItemSchema.parse({
        id: "ACT-1",
        eventType: "customer-registration",
        summary: "x",
        occurredAt: "2026-07-27T09:00:00+03:00",
        platformScope: "ios",
        permission: "admin.overview.read",
        destination: "/admin/secret",
      }),
    ).toThrow();
  });
});
