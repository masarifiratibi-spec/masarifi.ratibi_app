import { describe, expect, test } from "vitest";
import {
  aiFeatureSchema,
  aiListQuerySchema,
  apiErrorSchema,
  buildAiQuery,
  localeScopeSchema,
  moneyEstimateSchema,
  aiOverviewSchema,
  platformScopeSchema,
  reasonTextSchema,
  safeAiIdSchema,
  safeScenarioSchema,
  searchTextSchema,
  fallbackRoutesSchema,
  aiProviderDetailSchema,
  aiProvidersPageSchema,
  aiModelsPageSchema,
  aiOperationalRecordSchema,
  aiSafetyDefinitionSchema,
} from "./contracts";

describe("Spec 006 shared AI contracts", () => {
  test.each([
    ["AIP-OPENAI", true],
    ["AIM-GPT-4O", true],
    ["AIPR-VOICE-AR-001", true],
    ["AIU-0001", true],
    ["AIF-0001", true],
    ["AIR-0001", true],
    ["AIS-0001", true],
    ["AIA-0001", true],
    ["BAD-0001", false],
    ["AIP-", false],
    ["AIP-" + "X".repeat(45), false],
    ["../AIP-OPENAI", false],
  ] as const)("validates safe AI id %s", (id, shouldPass) => {
    expect(safeAiIdSchema.safeParse(id).success).toBe(shouldPass);
  });

  test("accepts documented platform, locale, feature, and scenario values only", () => {
    expect(platformScopeSchema.options).toEqual(["all", "ios", "android", "unknown"]);
    expect(localeScopeSchema.options).toEqual(["ar", "en"]);
    expect(aiFeatureSchema.safeParse("receipt_analysis").success).toBe(true);
    expect(aiFeatureSchema.safeParse("mobile_platform_fallback").success).toBe(false);
    expect(safeScenarioSchema.safeParse("masking-violation").success).toBe(true);
    expect(safeScenarioSchema.safeParse("raw-response").success).toBe(false);
  });

  test("bounds pagination, dates, search, and action reasons", () => {
    expect(aiListQuerySchema.parse({})).toMatchObject({ page: 1, pageSize: 25 });
    expect(aiListQuerySchema.safeParse({ page: 0 }).success).toBe(false);
    expect(aiListQuerySchema.safeParse({ pageSize: 75 }).success).toBe(false);
    expect(aiListQuerySchema.safeParse({ dateFrom: "2026-07-29" }).success).toBe(true);
    expect(aiListQuerySchema.safeParse({ dateFrom: "29-07-2026" }).success).toBe(false);
    expect(searchTextSchema.safeParse("x".repeat(120)).success).toBe(true);
    expect(searchTextSchema.safeParse("x".repeat(121)).success).toBe(false);
    expect(reasonTextSchema.safeParse("x".repeat(500)).success).toBe(true);
    expect(reasonTextSchema.safeParse("x".repeat(501)).success).toBe(false);
  });

  test("serializes validated queries and maps scenario to __scenario", () => {
    const params = buildAiQuery(aiListQuerySchema, {
      search: "fallback",
      platform: "ios",
      scenario: "partial",
      page: 2,
      pageSize: 50,
    });

    expect(params.get("search")).toBe("fallback");
    expect(params.get("platform")).toBe("ios");
    expect(params.get("__scenario")).toBe("partial");
    expect(params.get("scenario")).toBeNull();
    expect(params.get("page")).toBe("2");
  });

  test("rejects unknown fields at the contract boundary", () => {
    expect(aiListQuerySchema.safeParse({ page: 1, rawPrompt: "private" }).success).toBe(false);
    expect(apiErrorSchema.safeParse({
      status: 403,
      code: "forbidden",
      message: "Forbidden",
      stack: "internal",
    }).success).toBe(false);
  });

  test("requires complete authoritative normalized money fields", () => {
    const base = {
      amount: "12.340000",
      currency: "USD",
      estimated: true,
      freshness: "2026-07-29T10:00:00.000Z",
    };

    expect(moneyEstimateSchema.safeParse(base).success).toBe(true);
    expect(moneyEstimateSchema.safeParse({
      ...base,
      normalizedAmount: "45.10",
      normalizedCurrency: "AED",
      conversionTimestamp: "2026-07-29T10:00:00.000Z",
    }).success).toBe(true);
    expect(moneyEstimateSchema.safeParse({ ...base, normalizedAmount: "45.10" }).success).toBe(false);
  });
});

describe("Spec 006 report and safety privacy contracts", () => {
  const report = {
    id: "AIR-0001",
    resource: "reports",
    accessLevel: "full",
    title: "Safe report",
    feature: "categorization",
    status: "pending_review",
    severity: "high",
    maskedUser: "USR-*****9Q",
    sanitizedExcerpt: "😀".repeat(280),
    sanitizedBy: "future_backend",
    omissionLabel: "Sensitive values omitted",
    updatedAt: "2026-07-29T10:00:00.000Z",
    revision: 1,
    actions: ["confirmed_issue"],
  };

  test("measures sanitized report excerpts by Unicode code point and rejects raw fields", () => {
    expect(aiOperationalRecordSchema.safeParse(report).success).toBe(true);
    expect(aiOperationalRecordSchema.safeParse({ ...report, sanitizedExcerpt: "😀".repeat(281) }).success).toBe(false);
    expect(aiOperationalRecordSchema.safeParse({ ...report, rawResponse: "private" }).success).toBe(false);
    expect(aiOperationalRecordSchema.safeParse({ ...report, sanitizedBy: "frontend" }).success).toBe(false);
  });

  test("accepts only bounded declarative safety definitions", () => {
    const definition = {
      conditions: [{ field: "feature", operator: "equals", value: "financial_assistant" }],
      outcome: "require_review",
      requiredCoverage: true,
    };
    expect(aiSafetyDefinitionSchema.safeParse(definition).success).toBe(true);
    expect(aiSafetyDefinitionSchema.safeParse({ ...definition, script: "fetch('https://example.test')" }).success).toBe(false);
    expect(aiSafetyDefinitionSchema.safeParse({
      ...definition,
      conditions: [{ field: "feature", operator: "eval", value: "process.exit()" }],
    }).success).toBe(false);
  });
});

describe("Spec 006 AI overview contracts", () => {
  const overview = {
    query: { platform: "all", period: "30d" },
    metrics: [
      {
        key: "original_requests",
        label: "Original requests",
        value: 1200,
        unit: "requests",
        platform: "all",
        denominator: "original_requests",
        freshness: "2026-07-29T10:00:00.000Z",
      },
      {
        key: "attempts",
        label: "Attempts",
        value: 1320,
        unit: "attempts",
        platform: "all",
        denominator: "attempts",
        freshness: "2026-07-29T10:00:00.000Z",
      },
    ],
    totalOriginalRequests: 1200,
    totalAttempts: 1320,
    fallbackAttempts: 80,
    costByCurrency: [
      {
        amount: "42.10",
        currency: "USD",
        estimated: true,
        freshness: "2026-07-29T10:00:00.000Z",
      },
      {
        amount: "31.00",
        currency: "AED",
        estimated: true,
        freshness: "2026-07-29T10:00:00.000Z",
      },
    ],
    featureDistribution: [{ label: "receipt_analysis", value: 520 }],
    providerDistribution: [{ label: "AIP-OPENAI", value: 900 }],
    platformDistribution: [{ label: "unknown", value: 15 }],
    trend: [{ label: "2026-07-29", value: 1200 }],
    regions: {
      metrics: { availability: "available" },
      charts: { availability: "partial", message: "Provider trend delayed", retryable: true },
    },
  };

  test("accepts authoritative denominators, platform attribution, freshness, and partial regions", () => {
    expect(aiOverviewSchema.safeParse(overview).success).toBe(true);
  });

  test("keeps original requests separate from attempts and rejects invalid currency normalization", () => {
    expect(aiOverviewSchema.safeParse({ ...overview, totalAttempts: 1100 }).success).toBe(false);
    expect(aiOverviewSchema.safeParse({
      ...overview,
      costByCurrency: [{ ...overview.costByCurrency[0], normalizedAmount: "154.10" }],
    }).success).toBe(false);
  });
});

describe("Spec 006 provider and model contracts", () => {
  const cost = {
    amount: "42.10",
    currency: "USD",
    estimated: true,
    freshness: "2026-07-29T10:00:00.000Z",
  };
  const route = {
    feature: "receipt_analysis",
    locale: "ar",
    priority: 1,
    providerId: "AIP-OPENAI",
    modelId: "AIM-GPT-4O",
    compatible: true,
    terminalEligible: true,
    enabled: true,
  };
  const provider = {
    id: "AIP-OPENAI",
    name: "OpenAI",
    health: "healthy",
    defaultModelId: "AIM-GPT-4O",
    features: ["receipt_analysis"],
    locales: ["ar", "en"],
    latencyMs: 840,
    failureRate: 0.03,
    estimatedCost: cost,
    fallbackRoutes: [route],
    rateLimit: "within_limit",
    freshness: "2026-07-29T10:00:00.000Z",
    revision: 1,
    accessLevel: "full",
    actions: ["activate", "deactivate", "update_fallback"],
  };

  test("fallback identity is feature and locale, not platform", () => {
    expect(fallbackRoutesSchema.safeParse([route]).success).toBe(true);
    expect(fallbackRoutesSchema.safeParse([{ ...route, platform: "ios" }]).success).toBe(false);
  });

  test("rejects duplicate priorities, incompatible routes, and missing terminal coverage", () => {
    expect(fallbackRoutesSchema.safeParse([route, { ...route, modelId: "AIM-CLAUDE" }]).success).toBe(false);
    expect(fallbackRoutesSchema.safeParse([{ ...route, compatible: false }]).success).toBe(false);
    expect(fallbackRoutesSchema.safeParse([{ ...route, terminalEligible: false }]).success).toBe(false);
  });

  test("accepts provider and model pages without secret/raw payload fields", () => {
    expect(aiProvidersPageSchema.safeParse({
      items: [provider],
      pagination: { page: 1, pageSize: 25, totalItems: 1, totalPages: 1 },
      region: { availability: "available" },
    }).success).toBe(true);
    expect(aiProviderDetailSchema.safeParse({ ...provider, apiKey: "sk-test" }).success).toBe(false);
    expect(aiProviderDetailSchema.safeParse({
      id: "AIP-OPENAI",
      name: "OpenAI",
      freshness: "2026-07-29T10:00:00.000Z",
      revision: 1,
      accessLevel: "aggregate",
      estimatedCost: cost,
      actions: [],
      health: "healthy",
    }).success).toBe(false);
    expect(aiModelsPageSchema.safeParse({
      items: [{
        id: "AIM-GPT-4O",
        accessLevel: "full",
        name: "GPT-4o",
        providerId: "AIP-OPENAI",
        features: ["receipt_analysis"],
        locales: ["ar", "en"],
        assignments: [{ feature: "receipt_analysis", locale: "ar", primary: true }],
        inputLimit: 128000,
        inputCost: cost,
        outputCost: cost,
        status: "active",
        version: "2026-07",
        eligible: true,
        revision: 1,
        actions: ["assign", "unassign", "activate", "deactivate"],
      }],
      pagination: { page: 1, pageSize: 25, totalItems: 1, totalPages: 1 },
      region: { availability: "available" },
    }).success).toBe(true);
    expect(aiModelsPageSchema.safeParse({
      items: [{
        id: "AIM-GPT-4O",
        name: "GPT-4o",
        providerId: "AIP-OPENAI",
        revision: 1,
        accessLevel: "aggregate",
        inputCost: cost,
        outputCost: cost,
        actions: [],
        assignments: [],
      }],
      pagination: { page: 1, pageSize: 25, totalItems: 1, totalPages: 1 },
      region: { availability: "available" },
    }).success).toBe(false);
  });
});
