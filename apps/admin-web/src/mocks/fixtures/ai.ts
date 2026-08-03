import type {
  AiModelSummary,
  AiOperationalRecord,
  AiOverviewData,
  AiPromptDetail,
  AiProviderDetail,
  AiProviderSummary,
  PlatformScope,
} from "@/features/ai/contracts";

const freshness = "2026-07-29T10:00:00.000Z";

export const aiOverviewFixture: AiOverviewData = {
  query: { platform: "all", period: "30d" },
  metrics: [
    {
      key: "original_requests",
      label: "Original requests",
      value: 1200,
      unit: "requests",
      platform: "all",
      denominator: "original_requests",
      freshness,
    },
    {
      key: "successful_requests",
      label: "Successful requests",
      value: 1128,
      unit: "requests",
      platform: "all",
      denominator: "original_requests",
      freshness,
    },
    {
      key: "failed_requests",
      label: "Failed requests",
      value: 72,
      unit: "failures",
      platform: "all",
      denominator: "original_requests",
      freshness,
    },
    {
      key: "attempts",
      label: "Attempts",
      value: 1320,
      unit: "attempts",
      platform: "all",
      denominator: "attempts",
      freshness,
    },
    {
      key: "fallback_attempts",
      label: "Fallback attempts",
      value: 80,
      unit: "attempts",
      platform: "all",
      denominator: "attempts",
      freshness,
    },
    {
      key: "average_latency",
      label: "Average response time",
      value: 840,
      unit: "duration_ms",
      platform: "all",
      denominator: "original_requests",
      freshness,
    },
    {
      key: "input_units",
      label: "Average input units",
      value: 910,
      unit: "input_units",
      platform: "all",
      denominator: "original_requests",
      freshness,
    },
    {
      key: "output_units",
      label: "Average output units",
      value: 260,
      unit: "output_units",
      platform: "all",
      denominator: "original_requests",
      freshness,
    },
    {
      key: "user_reports",
      label: "User reports",
      value: 9,
      unit: "reports",
      platform: "all",
      denominator: "reports",
      freshness,
    },
  ],
  totalOriginalRequests: 1200,
  totalAttempts: 1320,
  fallbackAttempts: 80,
  costByCurrency: [
    { amount: "42.10", currency: "USD", estimated: true, freshness },
    {
      amount: "155.20",
      currency: "AED",
      estimated: true,
      freshness,
      normalizedAmount: "42.25",
      normalizedCurrency: "USD",
      conversionTimestamp: freshness,
    },
  ],
  featureDistribution: [
    { label: "receipt_analysis", value: 520 },
    { label: "categorization", value: 310 },
    { label: "financial_assistant", value: 220 },
  ],
  providerDistribution: [
    { label: "AIP-OPENAI", value: 900 },
    { label: "AIP-ANTHROPIC", value: 300 },
  ],
  platformDistribution: [
    { label: "ios", value: 560 },
    { label: "android", value: 625 },
    { label: "unknown", value: 15 },
  ],
  trend: [
    { label: "2026-07-23", value: 160 },
    { label: "2026-07-24", value: 174 },
    { label: "2026-07-25", value: 180 },
    { label: "2026-07-26", value: 190 },
    { label: "2026-07-27", value: 201 },
    { label: "2026-07-28", value: 142 },
    { label: "2026-07-29", value: 153 },
  ],
  regions: {
    metrics: { availability: "available" },
    charts: { availability: "partial", message: "Provider trend delayed", retryable: true },
  },
};

export function buildAiOverview(platform: PlatformScope): AiOverviewData {
  if (platform === "all") return aiOverviewFixture;
  const factor = platform === "ios" ? 0.46 : platform === "android" ? 0.52 : 0.02;
  const requests = Math.round(aiOverviewFixture.totalOriginalRequests * factor);
  const attempts = Math.round(aiOverviewFixture.totalAttempts * factor);
  return {
    ...aiOverviewFixture,
    query: { ...aiOverviewFixture.query, platform },
    metrics: aiOverviewFixture.metrics.map((metric) => ({
      ...metric,
      platform,
      value: Math.round(metric.value * factor),
    })),
    totalOriginalRequests: requests,
    totalAttempts: attempts,
    fallbackAttempts: Math.round(aiOverviewFixture.fallbackAttempts * factor),
  };
}

const usdCost = { amount: "42.10", currency: "USD", estimated: true, freshness } as const;

export const aiProvidersFixture: AiProviderSummary[] = [
  {
    id: "AIP-OPENAI",
    name: "OpenAI",
    health: "healthy",
    defaultModelId: "AIM-GPT-4O",
    features: ["receipt_analysis", "categorization"],
    locales: ["ar", "en"],
    latencyMs: 840,
    failureRate: 0.03,
    estimatedCost: usdCost,
    fallbackRoutes: [
      {
        feature: "receipt_analysis",
        locale: "ar",
        priority: 1,
        providerId: "AIP-OPENAI",
        modelId: "AIM-GPT-4O",
        compatible: true,
        terminalEligible: true,
        enabled: true,
      },
      {
        feature: "receipt_analysis",
        locale: "ar",
        priority: 2,
        providerId: "AIP-OPENAI",
        modelId: "AIM-GPT-4O-MINI",
        compatible: true,
        terminalEligible: true,
        enabled: true,
      },
    ],
    rateLimit: "within_limit",
    freshness,
    revision: 1,
    accessLevel: "full",
    actions: ["activate", "deactivate", "update_fallback"],
  },
];

export const aiProviderDetailFixture: AiProviderDetail = aiProvidersFixture[0];

export const aiModelsFixture: AiModelSummary[] = [
  {
    id: "AIM-GPT-4O",
    accessLevel: "full",
    name: "GPT-4o",
    providerId: "AIP-OPENAI",
    features: ["receipt_analysis", "categorization"],
    locales: ["ar", "en"],
    assignments: [{ feature: "receipt_analysis", locale: "ar", primary: true }],
    inputLimit: 128000,
    inputCost: usdCost,
    outputCost: usdCost,
    status: "active",
    version: "2026-07",
    eligible: true,
    revision: 1,
    actions: ["assign", "unassign", "activate", "deactivate"],
  },
  {
    id: "AIM-GPT-4O-MINI",
    accessLevel: "full",
    name: "GPT-4o mini",
    providerId: "AIP-OPENAI",
    features: ["receipt_analysis"],
    locales: ["ar", "en"],
    assignments: [{ feature: "receipt_analysis", locale: "ar", primary: false }],
    inputLimit: 128000,
    inputCost: usdCost,
    outputCost: usdCost,
    status: "active",
    version: "2026-07",
    eligible: true,
    revision: 1,
    actions: ["assign", "unassign", "activate", "deactivate"],
  },
];

export const aiOperationalFixture: AiOperationalRecord[] = [
  {
    id: "AIPR-RECEIPT-AR-V3", resource: "prompts", title: "Receipt analysis Arabic",
    accessLevel: "full",
    feature: "receipt_analysis", status: "active", locale: "ar", version: "3",
    updatedAt: freshness, revision: 3, actions: ["test", "retire", "rollback"],
  },
  {
    id: "AIPR-CAT-EN-V2", resource: "prompts", title: "Categorization English candidate",
    accessLevel: "full", feature: "categorization", status: "testing", locale: "en",
    version: "2", updatedAt: freshness, revision: 2, actions: ["activate", "test", "retire"],
  },
  {
    id: "AIPR-VOICE-AR-V4", resource: "prompts", title: "Voice parsing Arabic candidate",
    accessLevel: "full", feature: "voice_parsing", status: "testing", locale: "ar",
    version: "4", updatedAt: freshness, revision: 4, actions: ["activate", "test", "retire"],
  },
  {
    id: "AIU-0001", resource: "usage", title: "Usage event",
    accessLevel: "full",
    feature: "receipt_analysis", status: "succeeded", platform: "ios",
    providerId: "AIP-OPENAI", modelId: "AIM-GPT-4O", maskedUser: "USR-*****7K",
    originalRequestId: "AIU-REQ-0001", attemptCount: 2, fallbackCount: 1,
    inputUnits: 910, outputUnits: 260, estimatedCost: usdCost,
    updatedAt: freshness, revision: 1, actions: [],
  },
  {
    id: "AIF-0001", resource: "failures", title: "Provider timeout",
    accessLevel: "full",
    feature: "receipt_analysis", status: "open", severity: "high", platform: "android",
    providerId: "AIP-OPENAI", modelId: "AIM-GPT-4O", attemptCount: 2,
    fallbackCount: 1, safeErrorClass: "provider_timeout",
    correlationReference: "CORR-7K2M", updatedAt: freshness, revision: 1,
    actions: ["acknowledge", "assign", "resolve", "escalate"],
  },
  {
    id: "AIR-0001", resource: "reports", title: "Incorrect categorization",
    accessLevel: "full",
    feature: "categorization", status: "pending_review", severity: "high",
    platform: "ios", maskedUser: "USR-*****9Q", modelId: "AIM-GPT-4O",
    sanitizedExcerpt: "Fictional sanitized output excerpt for reviewer context.",
    sanitizedBy: "future_backend",
    omissionLabel: "Sensitive values omitted", version: "AIPR-3",
    updatedAt: freshness, revision: 1,
    actions: ["confirmed_issue", "no_issue", "escalate", "duplicate"],
  },
  {
    id: "AIS-0001", resource: "safety-rules", title: "Block unsupported financial advice",
    accessLevel: "full",
    feature: "financial_assistant", status: "active", severity: "critical",
    locale: "ar", version: "5", triggerCount: 12, updatedAt: freshness,
    safetyDefinition: {
      conditions: [{ field: "feature", operator: "equals", value: "financial_assistant" }],
      outcome: "require_review",
      requiredCoverage: true,
    },
    revision: 5, actions: [],
  },
  {
    id: "AIS-0002", resource: "safety-rules", title: "Mask unsupported category output",
    accessLevel: "full", feature: "categorization", status: "draft", severity: "high",
    locale: "en", version: "1", triggerCount: 0, updatedAt: freshness,
    safetyDefinition: {
      conditions: [{ field: "feature", operator: "equals", value: "categorization" }],
      outcome: "mask",
      requiredCoverage: false,
    },
    revision: 1, actions: ["activate", "retire"],
  },
];

export const aiPromptDetailFixture: AiPromptDetail = {
  ...aiOperationalFixture[0],
  resource: "prompts",
  sanitizedPreview: "You are a fictional receipt analysis assistant. Return only the documented structured fields.",
  variables: ["merchant_name", "total_amount", "currency_code"],
  outputSchemaSummary: ["merchant_name: string", "total_amount: decimal", "currency_code: ISO-4217"],
  validationRules: ["Required tests must pass before activation", "No customer content is retained"],
  fictionalTests: [
    { name: "Arabic receipt fixture", required: true, passed: true },
    { name: "Unsupported currency fixture", required: true, passed: true },
  ],
  history: [
    { version: "1", status: "retired", immutable: true },
    { version: "2", status: "retired", immutable: true },
    { version: "3", status: "active", immutable: true },
  ],
};

export const aiPromptDetailsFixture: AiPromptDetail[] = [
  aiPromptDetailFixture,
  {
    ...aiPromptDetailFixture,
    ...aiOperationalFixture[1],
    resource: "prompts",
    sanitizedPreview: "Classify a fictional transaction using only documented categories.",
    fictionalTests: [{ name: "English category fixture", required: true, passed: true }],
    history: [
      { version: "1", status: "retired", immutable: true },
      { version: "2", status: "testing", immutable: true },
    ],
  },
  {
    ...aiPromptDetailFixture,
    ...aiOperationalFixture[2],
    resource: "prompts",
    sanitizedPreview: "Parse a fictional Arabic voice expense into documented fields.",
    fictionalTests: [{ name: "Arabic voice fixture", required: true, passed: false }],
    history: [
      { version: "3", status: "retired", immutable: true },
      { version: "4", status: "testing", immutable: true },
    ],
  },
];
