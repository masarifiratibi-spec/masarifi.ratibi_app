import { z } from "zod";

export const platformFilterSchema = z.enum(["all", "ios", "android"]);
export const reportingPeriodSchema = z.enum(["7d", "30d", "90d"]);
export const platformScopeSchema = z.enum(["all", "ios", "android", "global", "unknown"]);
export const metricKindSchema = z.enum([
  "unique-customers",
  "devices",
  "events",
  "imports",
  "requests",
  "payments",
  "tickets",
  "currency",
]);
export const freshnessStateSchema = z.enum(["fresh", "stale", "partial", "unavailable"]);
export const regionAvailabilitySchema = z.enum([
  "available",
  "empty",
  "stale",
  "partial",
  "unavailable",
  "forbidden",
]);
export const severitySchema = z.enum(["info", "low", "medium", "high", "critical"]);
export const overviewRegionNameSchema = z.enum([
  "metrics",
  "customers",
  "revenue",
  "adoption",
  "imports",
  "support",
  "health",
  "attention",
  "activity",
]);
export const currencySchema = z.enum(["SAR", "AED"]);
export const metricToneSchema = z.enum(["neutral", "positive", "negative", "warning", "premium"]);
export const localeSchema = z.enum(["ar", "en"]);

export const scenarioSchema = z.string().trim().min(1).max(50);

export const dataFreshnessSchema = z
  .object({
    state: freshnessStateSchema,
    asOf: z.iso.datetime({ offset: true }).optional(),
    warning: z.string().trim().min(1).max(240).optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.state !== "unavailable" && value.asOf === undefined) {
      ctx.addIssue({
        code: "custom",
        message: "asOf timestamp is required unless the freshness state is unavailable.",
        path: ["asOf"],
      });
    }
    if (value.state === "unavailable" && value.asOf !== undefined) {
      ctx.addIssue({
        code: "custom",
        message: "Unavailable freshness must not carry an asOf timestamp.",
        path: ["asOf"],
      });
    }
  });

export const overviewQuerySchema = z
  .object({
    platform: platformFilterSchema.default("all"),
    period: reportingPeriodSchema.default("30d"),
    locale: localeSchema.default("ar"),
    scenario: scenarioSchema.optional(),
  })
  .strict();

export const overviewRegionStateSchema = z
  .object({
    region: overviewRegionNameSchema,
    availability: regionAvailabilitySchema,
    message: z.string().trim().min(1).max(240).optional(),
    lastSuccessfulAt: z.iso.datetime({ offset: true }).optional(),
    retryable: z.boolean(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.availability === "stale" && value.lastSuccessfulAt === undefined) {
      ctx.addIssue({
        code: "custom",
        message: "Stale region state requires a lastSuccessfulAt timestamp.",
        path: ["lastSuccessfulAt"],
      });
    }
  });

export const overviewMetricSchema = z
  .object({
    id: z.string().trim().min(1).max(100),
    label: z.string().trim().min(1).max(120),
    numericValue: z.number().min(0),
    formattedValue: z.string().trim().min(1).max(80),
    kind: metricKindSchema,
    platformScope: platformScopeSchema,
    period: reportingPeriodSchema,
    freshness: dataFreshnessSchema,
    change: z.number().finite().optional(),
    tone: metricToneSchema,
    note: z.string().trim().max(240).optional(),
  })
  .strict();

export const moneyMetricSchema = z
  .object({
    amount: z.number().min(0),
    currency: currencySchema,
    formattedValue: z.string().trim().min(1).max(80),
    period: reportingPeriodSchema,
    platformScope: z.enum(["all", "ios", "android"]),
  })
  .strict();

export const trendPointSchema = z
  .object({
    timestamp: z.iso.datetime({ offset: true }),
    value: z.number().finite(),
    comparisonValue: z.number().finite().optional(),
  })
  .strict();

export const trendSeriesSchema = z
  .object({
    id: z.string().trim().min(1).max(100),
    label: z.string().trim().min(1).max(120),
    kind: metricKindSchema,
    unit: z.string().trim().min(1).max(40),
    period: reportingPeriodSchema,
    platformScope: platformScopeSchema,
    points: z.array(trendPointSchema).min(1).max(100),
    summary: z.string().trim().min(1).max(500),
  })
  .strict()
  .superRefine((value, ctx) => {
    for (let index = 1; index < value.points.length; index += 1) {
      const previous = value.points[index - 1]?.timestamp;
      const current = value.points[index]?.timestamp;
      if (previous && current && new Date(current).getTime() < new Date(previous).getTime()) {
        ctx.addIssue({
          code: "custom",
          message: "Trend points must be chronological.",
          path: ["points", index, "timestamp"],
        });
      }
    }
    const seen = new Set<string>();
    for (const point of value.points) {
      if (seen.has(point.timestamp)) {
        ctx.addIssue({
          code: "custom",
          message: "Trend points must not repeat a timestamp.",
          path: ["points"],
        });
        break;
      }
      seen.add(point.timestamp);
    }
  });

export const customerPlatformBreakdownSchema = z
  .object({
    uniqueCustomersTotal: z.number().int().nonnegative(),
    iosCustomers: z.number().int().nonnegative(),
    androidCustomers: z.number().int().nonnegative(),
    iosOnlyCustomers: z.number().int().nonnegative(),
    androidOnlyCustomers: z.number().int().nonnegative(),
    multiPlatformCustomers: z.number().int().nonnegative(),
    activeCustomersTotal: z.number().int().nonnegative(),
    activeIosCustomers: z.number().int().nonnegative(),
    activeAndroidCustomers: z.number().int().nonnegative(),
    newCustomersTotal: z.number().int().nonnegative(),
    newIosCustomers: z.number().int().nonnegative(),
    newAndroidCustomers: z.number().int().nonnegative(),
    period: reportingPeriodSchema,
    freshness: dataFreshnessSchema,
  })
  .strict()
  .superRefine((value, ctx) => {
    const {
      iosOnlyCustomers,
      androidOnlyCustomers,
      multiPlatformCustomers,
      uniqueCustomersTotal,
      iosCustomers,
      androidCustomers,
      activeCustomersTotal,
      activeIosCustomers,
      activeAndroidCustomers,
      newCustomersTotal,
      newIosCustomers,
      newAndroidCustomers,
    } = value;

    if (iosOnlyCustomers + androidOnlyCustomers + multiPlatformCustomers !== uniqueCustomersTotal) {
      ctx.addIssue({
        code: "custom",
        message: "iOS-only + Android-only + multi-platform must equal the unique customer total.",
        path: ["uniqueCustomersTotal"],
      });
    }
    if (iosOnlyCustomers + multiPlatformCustomers !== iosCustomers) {
      ctx.addIssue({
        code: "custom",
        message: "iOS customers must equal iOS-only + multi-platform customers.",
        path: ["iosCustomers"],
      });
    }
    if (androidOnlyCustomers + multiPlatformCustomers !== androidCustomers) {
      ctx.addIssue({
        code: "custom",
        message: "Android customers must equal Android-only + multi-platform customers.",
        path: ["androidCustomers"],
      });
    }
    if (activeCustomersTotal > activeIosCustomers + activeAndroidCustomers) {
      ctx.addIssue({
        code: "custom",
        message: "Authoritative active total cannot exceed the sum of overlapping active audiences.",
        path: ["activeCustomersTotal"],
      });
    }
    if (newIosCustomers + newAndroidCustomers !== newCustomersTotal) {
      ctx.addIssue({
        code: "custom",
        message: "New customer total must equal the sum of mutually exclusive platform new customers.",
        path: ["newCustomersTotal"],
      });
    }
  });

export const subscriptionDistributionItemSchema = z
  .object({
    plan: z.string().trim().min(1).max(80),
    customers: z.number().int().nonnegative(),
    share: z.number().min(0).max(1),
  })
  .strict();

export const subscriptionRevenueSummarySchema = z
  .object({
    paidCustomers: z.number().int().nonnegative(),
    freeCustomers: z.number().int().nonnegative(),
    recurringRevenue: z.number().min(0),
    currency: currencySchema,
    distribution: z.array(subscriptionDistributionItemSchema).min(1).max(10),
    revenueTrend: trendSeriesSchema,
    freshness: dataFreshnessSchema,
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.revenueTrend.kind !== "currency") {
      ctx.addIssue({
        code: "custom",
        message: "Revenue trend must use the currency metric kind.",
        path: ["revenueTrend", "kind"],
      });
    }
  });

export const platformOperationalMetricSchema = z
  .object({
    id: z.string().trim().min(1).max(100),
    kind: z.enum(["imports", "events", "requests", "tickets"]),
    platformScope: platformScopeSchema,
    total: z.number().int().nonnegative(),
    successful: z.number().int().nonnegative().optional(),
    failed: z.number().int().nonnegative().optional(),
    rate: z.number().min(0).max(1).optional(),
    period: reportingPeriodSchema,
    freshness: dataFreshnessSchema,
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.successful !== undefined && value.successful > value.total) {
      ctx.addIssue({ code: "custom", message: "successful cannot exceed total.", path: ["successful"] });
    }
    if (value.failed !== undefined && value.failed > value.total) {
      ctx.addIssue({ code: "custom", message: "failed cannot exceed total.", path: ["failed"] });
    }
    if (
      value.successful !== undefined
      && value.failed !== undefined
      && value.successful + value.failed > value.total
    ) {
      ctx.addIssue({
        code: "custom",
        message: "successful + failed cannot exceed total.",
        path: ["total"],
      });
    }
  });

export const serviceHealthSummarySchema = z
  .object({
    service: z.enum([
      "api",
      "database",
      "cache",
      "worker",
      "storage",
      "payment-webhook",
      "ai-provider",
      "push-notification",
    ]),
    status: z.enum(["operational", "degraded", "partial-outage", "major-outage", "maintenance"]),
    platformScope: z.literal("global"),
    uptime: z.number().min(0).max(1),
    latencyMs: z.number().min(0),
    errorRate: z.number().min(0).max(1),
    lastCheckedAt: z.iso.datetime({ offset: true }),
    freshness: dataFreshnessSchema,
  })
  .strict();

export const overviewSummaryResponseSchema = z
  .object({
    query: overviewQuerySchema,
    metrics: z.array(overviewMetricSchema).max(30),
    subscriptionRevenue: subscriptionRevenueSummarySchema,
    operationalMetrics: z.array(platformOperationalMetricSchema).max(30),
    serviceHealth: z.array(serviceHealthSummarySchema).max(20),
    regions: z.array(overviewRegionStateSchema).max(20),
    freshness: dataFreshnessSchema,
  })
  .strict();

export const appVersionDistributionItemSchema = z
  .object({
    platform: z.enum(["ios", "android", "unknown"]),
    version: z.string().trim().min(1).max(40),
    supportState: z.enum(["current", "supported-older", "unsupported", "unknown"]),
    customerCount: z.number().int().nonnegative().optional(),
    deviceCount: z.number().int().nonnegative(),
    share: z.number().min(0).max(1),
    unattributed: z.boolean(),
  })
  .strict();

export const capabilityAdoptionMetricSchema = z
  .object({
    platform: z.enum(["ios", "android"]),
    capability: z.enum(["shortcut", "share-extension", "sms-tracking", "notification-listener"]),
    eligiblePopulation: z.number().int().nonnegative(),
    enabledPopulation: z.number().int().nonnegative(),
    rate: z.number().min(0).max(1),
    period: reportingPeriodSchema,
    caveat: z.string().trim().min(1).max(240),
  })
  .strict()
  .superRefine((value, ctx) => {
    const platformCapabilities: Record<string, string[]> = {
      ios: ["shortcut", "share-extension"],
      android: ["sms-tracking", "notification-listener"],
    };
    if (!platformCapabilities[value.platform]?.includes(value.capability)) {
      ctx.addIssue({
        code: "custom",
        message: `${value.capability} does not belong to the ${value.platform} platform.`,
        path: ["capability"],
      });
    }
    if (value.enabledPopulation > value.eligiblePopulation) {
      ctx.addIssue({
        code: "custom",
        message: "enabledPopulation cannot exceed eligiblePopulation.",
        path: ["enabledPopulation"],
      });
    }
    if (value.eligiblePopulation > 0) {
      const expected = value.enabledPopulation / value.eligiblePopulation;
      if (Math.abs(expected - value.rate) > 0.0001) {
        ctx.addIssue({
          code: "custom",
          message: "rate must equal enabledPopulation / eligiblePopulation when eligible > 0.",
          path: ["rate"],
        });
      }
    }
  });

export const deviceDistributionItemSchema = z
  .object({
    platform: z.enum(["ios", "android", "unknown"]),
    category: z.string().trim().min(1).max(80),
    deviceCount: z.number().int().nonnegative(),
    share: z.number().min(0).max(1),
  })
  .strict();

export const platformAnalyticsResponseSchema = z
  .object({
    query: overviewQuerySchema,
    customers: customerPlatformBreakdownSchema,
    userGrowth: trendSeriesSchema,
    dailyActiveUsers: trendSeriesSchema,
    monthlyActiveUsers: trendSeriesSchema,
    versions: z.array(appVersionDistributionItemSchema).max(50),
    capabilities: z.array(capabilityAdoptionMetricSchema).max(10),
    devices: z.array(deviceDistributionItemSchema).max(30),
    imports: z.array(platformOperationalMetricSchema).max(20),
    support: z.array(platformOperationalMetricSchema).max(20),
    comparisonTrends: z.array(trendSeriesSchema).max(20),
    errorRateTrend: trendSeriesSchema,
    regions: z.array(overviewRegionStateSchema).max(20),
  })
  .strict();

export interface OverviewAnalyticsInput {
  platform: z.infer<typeof platformFilterSchema>;
  period: z.infer<typeof reportingPeriodSchema>;
  locale: z.infer<typeof localeSchema>;
  scenario?: string;
  page?: number;
  pageSize?: number;
}

export function overviewAnalyticsQueryNormalizer(
  input: z.infer<typeof overviewQuerySchema>,
): OverviewAnalyticsInput {
  return {
    platform: input.platform,
    period: input.period,
    locale: input.locale,
    ...(input.scenario ? { scenario: input.scenario } : {}),
  };
}

export const overviewActivityQuerySchema = overviewQuerySchema
  .extend({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(25).default(10),
  })
  .strict();

export const overviewActivityItemSchema = z
  .object({
    id: z.string().trim().min(1).max(100),
    eventType: z.enum([
      "customer-registration",
      "subscription-upgrade",
      "webhook-failure",
      "parser-rule-update",
      "admin-role-change",
      "support-access-approval",
      "account-deletion-completed",
    ]),
    summary: z.string().trim().min(1).max(240),
    occurredAt: z.iso.datetime({ offset: true }),
    platformScope: platformScopeSchema,
    permission: z.enum([
      "admin.overview.read",
      "users.read",
      "imports.read",
      "system-health.read",
      "global-search.use",
      "attention.read",
    ]),
    destination: z
      .enum(["/admin", "/admin/users", "/admin/imports", "/admin/system-health"])
      .optional(),
  })
  .strict();

export function paginatedResponseSchema<T extends z.ZodType>(item: T) {
  return z
    .object({
      items: z.array(item).max(25),
      page: z.number().int().min(1),
      pageSize: z.number().int().min(1).max(25),
      totalItems: z.number().int().nonnegative(),
      totalPages: z.number().int().min(0),
      region: overviewRegionStateSchema,
    })
    .strict();
}

export const overviewActivityResponseSchema = paginatedResponseSchema(overviewActivityItemSchema);

export type PlatformFilter = z.infer<typeof platformFilterSchema>;
export type ReportingPeriod = z.infer<typeof reportingPeriodSchema>;
export type PlatformScope = z.infer<typeof platformScopeSchema>;
export type MetricKind = z.infer<typeof metricKindSchema>;
export type FreshnessState = z.infer<typeof freshnessStateSchema>;
export type RegionAvailability = z.infer<typeof regionAvailabilitySchema>;
export type OverviewRegionName = z.infer<typeof overviewRegionNameSchema>;
export type DataFreshness = z.infer<typeof dataFreshnessSchema>;
export type OverviewQuery = z.input<typeof overviewQuerySchema>;
export type OverviewRegionState = z.infer<typeof overviewRegionStateSchema>;
export type OverviewMetric = z.infer<typeof overviewMetricSchema>;
export type MoneyMetric = z.infer<typeof moneyMetricSchema>;
export type TrendPoint = z.infer<typeof trendPointSchema>;
export type TrendSeries = z.infer<typeof trendSeriesSchema>;
export type CustomerPlatformBreakdown = z.infer<typeof customerPlatformBreakdownSchema>;
export type SubscriptionDistributionItem = z.infer<typeof subscriptionDistributionItemSchema>;
export type SubscriptionRevenueSummary = z.infer<typeof subscriptionRevenueSummarySchema>;
export type PlatformOperationalMetric = z.infer<typeof platformOperationalMetricSchema>;
export type ServiceHealthSummary = z.infer<typeof serviceHealthSummarySchema>;
export type OverviewSummaryResponse = z.infer<typeof overviewSummaryResponseSchema>;
export type AppVersionDistributionItem = z.infer<typeof appVersionDistributionItemSchema>;
export type CapabilityAdoptionMetric = z.infer<typeof capabilityAdoptionMetricSchema>;
export type DeviceDistributionItem = z.infer<typeof deviceDistributionItemSchema>;
export type PlatformAnalyticsResponse = z.infer<typeof platformAnalyticsResponseSchema>;
export type OverviewActivityQuery = z.input<typeof overviewActivityQuerySchema>;
export type OverviewActivityItem = z.infer<typeof overviewActivityItemSchema>;
export type OverviewActivityResponse = z.infer<typeof overviewActivityResponseSchema>;

