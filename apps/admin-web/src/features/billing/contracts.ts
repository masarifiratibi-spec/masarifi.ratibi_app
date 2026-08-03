import { z } from "zod";

export const safeIdSchema = z
  .string()
  .min(3)
  .max(80)
  .regex(/^[A-Za-z0-9_-]+$/, "ID must contain only letters, numbers, underscores, and hyphens");

export type SafeId = z.infer<typeof safeIdSchema>;

export const platformFilterSchema = z.enum([
  "all",
  "ios", 
  "android",
  "multi_platform",
  "unattributed",
]);

export type PlatformFilter = z.infer<typeof platformFilterSchema>;

export const platformSchema = z.enum(["ios", "android", "multi_platform", "unattributed"]);

export type Platform = z.infer<typeof platformSchema>;

export const currencySchema = z.enum(["AED", "SAR"]);

export type Currency = z.infer<typeof currencySchema>;

export const moneySchema = z
  .object({
    amount: z.number().nonnegative(),
    currency: currencySchema,
  })
  .strict();

export type Money = z.infer<typeof moneySchema>;

export const maskedCustomerSchema = z
  .object({
    customerId: safeIdSchema,
    displayName: z.string().min(1).max(100),
    maskedEmail: z
      .string()
      .regex(/^[^@]*\*{3}[^@]*@example\.test$/, "Email must be masked and use example.test domain")
      .max(160),
    platform: platformSchema,
  })
  .strict();

export type MaskedCustomer = z.infer<typeof maskedCustomerSchema>;

/**
 * Safe API error - no stack traces, raw payloads, or private data
 */
export const apiErrorSchema = z
  .object({
    status: z.number().int(),
    code: z.string().max(80),
    message: z.string().max(300),
    fieldErrors: z.record(z.string(), z.string()).optional(),
    correlationId: safeIdSchema.optional(),
  })
  .strict();

export type ApiError = z.infer<typeof apiErrorSchema>;

/**
 * Bounded pagination
 */
export const paginationSchema = z
  .object({
    page: z.number().int().min(1),
    pageSize: z.union([z.literal(25), z.literal(50), z.literal(100)]),
    total: z.number().int().min(0),
  })
  .strict();

export type Pagination = z.infer<typeof paginationSchema>;

/**
 * Page metadata
 */
export const pageMetaSchema = paginationSchema.extend({
  totalPages: z.number().int().min(0),
});

export type PageMeta = z.infer<typeof pageMetaSchema>;

/**
 * Reporting period for overview queries
 */
export const periodSchema = z.enum(["7d", "30d", "90d"]).default("30d");

export type Period = z.infer<typeof periodSchema>;

/**
 * Region state for data availability
 */
export const regionAvailabilitySchema = z.enum([
  "available",
  "empty",
  "partial",
  "stale",
  "unavailable",
  "forbidden",
]);

export type RegionAvailability = z.infer<typeof regionAvailabilitySchema>;

export const regionStateSchema = z
  .object({
    availability: regionAvailabilitySchema,
    message: z.string().max(240).optional(),
    retryable: z.boolean().optional(),
    updatedAt: z.iso.datetime({ offset: true }).optional(),
  })
  .strict();

export type RegionState = z.infer<typeof regionStateSchema>;

// ============================================================================
// Subscription Contracts
// ============================================================================

/**
 * Subscription status states
 */
export const subscriptionStatusSchema = z.enum([
  "trialing",
  "active",
  "past_due",
  "cancel_at_period_end",
  "cancelled",
  "expired",
  "suspended",
]);

export type SubscriptionStatus = z.infer<typeof subscriptionStatusSchema>;

/**
 * Subscription plan
 */
export const planNameSchema = z.enum(["Free", "Basic", "Premium"]);

export type PlanName = z.infer<typeof planNameSchema>;

/**
 * Billing interval
 */
export const billingIntervalSchema = z.enum(["monthly", "yearly", "none"]);

export type BillingInterval = z.infer<typeof billingIntervalSchema>;

/**
 * Subscription action types (allowlisted only)
 */
export const subscriptionActionSchema = z.enum([
  "change_plan",
  "set_cancel_at_period_end",
  "clear_cancel_at_period_end",
  "resume",
  "record_internal_note",
]);

export type SubscriptionAction = z.infer<typeof subscriptionActionSchema>;

/**
 * Subscription overview query parameters
 */
export const subscriptionOverviewQuerySchema = z
  .object({
    period: periodSchema,
    platform: platformFilterSchema,
    currency: currencySchema.optional(),
    scenario: z.string().max(40).optional(),
  })
  .strict();

export type SubscriptionOverviewQuery = z.infer<typeof subscriptionOverviewQuerySchema>;

/**
 * KPI groups for subscription overview
 */
export const kpiSchema = z
  .object({
    active: z.number().int().min(0),
    trialing: z.number().int().min(0),
    free: z.number().int().min(0),
    basic: z.number().int().min(0),
    premium: z.number().int().min(0),
    upgrades: z.number().int().min(0),
    downgrades: z.number().int().min(0),
    cancellations: z.number().int().min(0),
    churnRate: z.number().min(0),
    mrrAed: z.number().min(0),
    mrrSar: z.number().min(0),
    failedRenewals: z.number().int().min(0),
  })
  .strict();

export type Kpi = z.infer<typeof kpiSchema>;

/**
 * Currency group for revenue breakdown
 */
export const currencyGroupSchema = z
  .object({
    currency: currencySchema,
    value: z.number(),
  })
  .strict();

export type CurrencyGroup = z.infer<typeof currencyGroupSchema>;

/**
 * Platform breakdown with authoritative unique totals
 */
export const platformBreakdownSchema = z
  .object({
    platform: platformSchema,
    uniqueSubscriptions: z.number().int().min(0),
    revenue: z.array(moneySchema),
  })
  .strict();

export type PlatformBreakdown = z.infer<typeof platformBreakdownSchema>;

/**
 * Subscription overview response
 */
export const subscriptionOverviewSchema = z
  .object({
    period: periodSchema,
    freshnessAt: z.iso.datetime({ offset: true }),
    partial: z.boolean().optional(),
    kpis: kpiSchema,
    currencyGroups: z.array(currencyGroupSchema),
    platformBreakdown: z.array(platformBreakdownSchema),
    region: regionStateSchema,
  })
  .strict();

export type SubscriptionOverview = z.infer<typeof subscriptionOverviewSchema>;

/**
 * Subscriptions list query parameters
 */
export const subscriptionsQuerySchema = z
  .object({
    search: z.string().trim().max(100).optional(),
    plan: planNameSchema.optional(),
    status: subscriptionStatusSchema.optional(),
    provider: z.string().max(40).optional(),
    paymentStatus: z.string().max(40).optional(),
    currency: currencySchema.optional(),
    platform: platformFilterSchema.default("all"),
    renewalFrom: z.iso.date().optional(),
    renewalTo: z.iso.date().optional(),
    sort: z.enum([
      "customer",
      "plan",
      "status",
      "renewalDate",
      "amount",
      "paymentStatus",
    ]).default("renewalDate"),
    order: z.enum(["asc", "desc"]).default("asc"),
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().pipe(z.union([z.literal(25), z.literal(50), z.literal(100)])).default(25),
    scenario: z.string().max(40).optional(),
  })
  .strict()
  .refine((value) => !value.renewalFrom || !value.renewalTo || value.renewalFrom <= value.renewalTo, {
    message: "renewalFrom must not exceed renewalTo",
    path: ["renewalTo"],
  });

export type SubscriptionsQuery = z.infer<typeof subscriptionsQuerySchema>;

/**
 * Subscription list item
 */
export const subscriptionListItemSchema = z
  .object({
    id: safeIdSchema,
    customer: maskedCustomerSchema,
    plan: planNameSchema,
    status: subscriptionStatusSchema,
    provider: z.string().max(40),
    renewalDate: z.iso.datetime({ offset: true }).nullable(),
    amount: moneySchema,
    cancelAtPeriodEnd: z.boolean(),
    paymentStatus: z.string().max(40),
    permittedActions: z.array(subscriptionActionSchema),
  })
  .strict();

export type SubscriptionListItem = z.infer<typeof subscriptionListItemSchema>;

export const billingEventSchema = z
  .object({
    id: safeIdSchema,
    eventType: z.string().max(80),
    status: z.string().max(40),
    occurredAt: z.iso.datetime({ offset: true }),
    amount: moneySchema,
  })
  .strict();

export const planChangeEventSchema = z
  .object({
    id: safeIdSchema,
    fromPlan: planNameSchema,
    toPlan: planNameSchema,
    changedAt: z.iso.datetime({ offset: true }),
    reason: z.string().max(200),
  })
  .strict();

/**
 * Subscriptions page response
 */
export const subscriptionsPageSchema = z
  .object({
    items: z.array(subscriptionListItemSchema),
    meta: pageMetaSchema,
    region: regionStateSchema,
  })
  .strict();

export type SubscriptionsPage = z.infer<typeof subscriptionsPageSchema>;

/**
 * Subscription detail request
 */
export const subscriptionDetailRequestSchema = z
  .object({
    subscriptionId: safeIdSchema,
    scenario: z.string().max(40).optional(),
  })
  .strict();

export type SubscriptionDetailRequest = z.infer<typeof subscriptionDetailRequestSchema>;

/**
 * Subscription detail
 */
export const subscriptionDetailSchema = subscriptionListItemSchema.extend({
  billingInterval: billingIntervalSchema,
  limits: z.record(z.string(), z.number().int().min(0)),
  safeProviderReferences: z.array(safeIdSchema),
  billingEvents: z.array(billingEventSchema),
  planChangeHistory: z.array(planChangeEventSchema),
  expectedState: z.string().max(40),
});

export type SubscriptionDetail = z.infer<typeof subscriptionDetailSchema>;

/**
 * Subscription action request
 */
export const subscriptionActionRequestSchema = z
  .object({
    action: subscriptionActionSchema,
    reason: z.string().trim().min(3).max(500),
    targetPlanId: safeIdSchema.optional(),
    effectiveTiming: z.enum(["immediate", "period_end"]).optional(),
    note: z.string().trim().max(1000).optional(),
    expectedCurrentState: z.string().max(40),
    confirmationToken: z.string().min(1).max(120),
  })
  .strict()
  .refine((value) => {
    if (value.action === "change_plan") {
      return value.targetPlanId !== undefined;
    }
    if (value.action === "record_internal_note") {
      return value.note !== undefined && value.note.length > 0;
    }
    return true;
  }, {
    message: "Action requires additional fields",
  });

export type SubscriptionActionRequest = z.infer<typeof subscriptionActionRequestSchema>;

// ============================================================================
// Plan Management Contracts
// ============================================================================

/**
 * Plan detail
 */
export const planDetailSchema = z
  .object({
    id: safeIdSchema,
    name: planNameSchema,
    price: moneySchema,
    interval: billingIntervalSchema,
    limits: z.record(z.string(), z.number().int().min(0)),
    active: z.boolean(),
    providerPriceLabel: z.string().max(100),
    updatedAt: z.iso.datetime({ offset: true }),
  })
  .strict();

export type PlanDetail = z.infer<typeof planDetailSchema>;

/**
 * Plan mutation request
 */
export const planMutationRequestSchema = z
  .object({
    price: moneySchema,
    interval: billingIntervalSchema,
    limits: z.record(z.string(), z.number().int().min(0)),
    active: z.boolean(),
    providerPriceLabel: z.string().max(100),
    reason: z.string().trim().min(3).max(500),
    confirmationToken: z.string().min(1).max(120),
  })
  .strict();

export type PlanMutationRequest = z.infer<typeof planMutationRequestSchema>;

// ============================================================================
// Promotional Code Contracts
// ============================================================================

/**
 * Promotional code status
 */
export const promotionalCodeStatusSchema = z.enum([
  "draft",
  "active",
  "expired",
  "exhausted",
  "disabled",
]);

export type PromotionalCodeStatus = z.infer<typeof promotionalCodeStatusSchema>;

/**
 * Discount kind
 */
export const discountKindSchema = z.enum(["percentage", "fixed"]);

export type DiscountKind = z.infer<typeof discountKindSchema>;

/**
 * Discount duration
 */
export const discountDurationSchema = z.enum(["once", "repeating", "forever"]);

export type DiscountDuration = z.infer<typeof discountDurationSchema>;

/**
 * Promotional code detail
 */
export const promotionalCodeDetailSchema = z
  .object({
    id: safeIdSchema,
    code: z.string().regex(/^[A-Z0-9_-]{3,32}$/),
    discountKind: discountKindSchema,
    discountValue: z.number().positive(),
    duration: discountDurationSchema,
    redemptionCount: z.number().int().min(0),
    redemptionLimit: z.number().int().min(1).nullable(),
    expiresAt: z.iso.datetime({ offset: true }).nullable(),
    status: promotionalCodeStatusSchema,
    eligiblePlanIds: z.array(safeIdSchema),
  })
  .strict();

export type PromotionalCodeDetail = z.infer<typeof promotionalCodeDetailSchema>;

/**
 * Promotional code mutation request
 */
export const promotionalCodeMutationRequestSchema = promotionalCodeDetailSchema
  .extend({
    reason: z.string().trim().min(3).max(500),
    confirmationToken: z.string().min(1).max(120),
  })
  .strict();

export type PromotionalCodeMutationRequest = z.infer<typeof promotionalCodeMutationRequestSchema>;

/**
 * Promotional codes query parameters
 */
export const promotionalCodesQuerySchema = z
  .object({
    status: promotionalCodeStatusSchema.optional(),
    search: z.string().trim().max(32).optional(),
    planId: safeIdSchema.optional(),
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().pipe(z.union([z.literal(25), z.literal(50), z.literal(100)])).default(25),
    scenario: z.string().max(40).optional(),
  })
  .strict();

export type PromotionalCodesQuery = z.infer<typeof promotionalCodesQuerySchema>;

/**
 * Promotional codes page response
 */
export const promotionalCodesPageSchema = z
  .object({
    items: z.array(promotionalCodeDetailSchema),
    meta: pageMetaSchema,
    region: regionStateSchema,
  })
  .strict();

export type PromotionalCodesPage = z.infer<typeof promotionalCodesPageSchema>;

// ============================================================================
// Payment Contracts
// ============================================================================

/**
 * Payments overview query parameters
 */
export const paymentsOverviewQuerySchema = z
  .object({
    period: periodSchema,
    platform: platformFilterSchema,
    currency: currencySchema.optional(),
    scenario: z.string().max(40).optional(),
  })
  .strict();

export type PaymentsOverviewQuery = z.infer<typeof paymentsOverviewQuerySchema>;

/**
 * Payments overview response
 */
export const paymentsOverviewSchema = z
  .object({
    period: periodSchema,
    freshnessAt: z.iso.datetime({ offset: true }),
    currencyGroups: z.array(
      z.object({
        currency: currencySchema,
        successful: z.number(),
        failed: z.number(),
        refunded: z.number(),
        disputed: z.number(),
        pending: z.number(),
      }).strict()
    ),
    reconciliationCount: z.number().int().min(0),
    region: regionStateSchema,
  })
  .strict();

export type PaymentsOverview = z.infer<typeof paymentsOverviewSchema>;

/**
 * Payment event query parameters
 */
export const paymentEventsQuerySchema = z
  .object({
    search: z.string().trim().max(100).optional(),
    eventType: z.string().max(40).optional(),
    status: z.string().max(40).optional(),
    provider: z.string().max(40).optional(),
    currency: currencySchema.optional(),
    platform: platformFilterSchema.default("all"),
    dateFrom: z.iso.date().optional(),
    dateTo: z.iso.date().optional(),
    sort: z.enum([
      "date",
      "eventType",
      "amount",
      "status",
    ]).default("date"),
    order: z.enum(["asc", "desc"]).default("desc"),
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().pipe(z.union([z.literal(25), z.literal(50), z.literal(100)])).default(25),
    scenario: z.string().max(40).optional(),
  })
  .strict()
  .refine((value) => !value.dateFrom || !value.dateTo || value.dateFrom <= value.dateTo, {
    message: "dateFrom must not exceed dateTo",
    path: ["dateTo"],
  });

export type PaymentEventsQuery = z.infer<typeof paymentEventsQuerySchema>;

/**
 * Payment event list item
 */
export const paymentEventListItemSchema = z
  .object({
    id: safeIdSchema,
    customer: maskedCustomerSchema,
    subscriptionId: safeIdSchema,
    eventType: z.string().max(40),
    amount: moneySchema,
    provider: z.string().max(40),
    status: z.string().max(40),
    receivedAt: z.iso.datetime({ offset: true }),
    processedAt: z.iso.datetime({ offset: true }).nullable(),
    retryCount: z.number().int().min(0),
  })
  .strict();

export type PaymentEventListItem = z.infer<typeof paymentEventListItemSchema>;

export const paymentTimelineEventSchema = z
  .object({
    timestamp: z.iso.datetime({ offset: true }),
    event: z.string().max(80),
    message: z.string().max(240),
  })
  .strict();

export const paymentRetryEventSchema = z
  .object({
    attemptedAt: z.iso.datetime({ offset: true }),
    status: z.string().max(40),
    providerErrorCode: z.string().max(80).optional(),
    providerErrorMessage: z.string().max(300).optional(),
  })
  .strict();

/**
 * Payment events page response
 */
export const paymentEventsPageSchema = z
  .object({
    items: z.array(paymentEventListItemSchema),
    meta: pageMetaSchema,
    region: regionStateSchema,
  })
  .strict();

export type PaymentEventsPage = z.infer<typeof paymentEventsPageSchema>;

/**
 * Payment event detail request
 */
export const paymentEventDetailRequestSchema = z
  .object({
    eventId: safeIdSchema,
    scenario: z.string().max(40).optional(),
  })
  .strict();

export type PaymentEventDetailRequest = z.infer<typeof paymentEventDetailRequestSchema>;

/**
 * Sanitized payment payload preview (allowlisted fields only)
 * Raw provider payloads, card data, tokens, signatures, etc. are NEVER exposed
 */
export const sanitizedPaymentPayloadPreviewSchema = z
  .object({
    eventId: safeIdSchema,
    eventType: z.string().max(80),
    status: z.string().max(40),
    receivedAt: z.iso.datetime({ offset: true }),
    processedAt: z.iso.datetime({ offset: true }).nullable(),
    amount: moneySchema,
    subscriptionReference: safeIdSchema,
    retryCount: z.number().int().min(0),
    providerErrorCode: z.string().max(80).optional(),
    providerErrorMessage: z.string().max(300).optional(),
  })
  .strict();

export type SanitizedPaymentPayloadPreview = z.infer<typeof sanitizedPaymentPayloadPreviewSchema>;

/**
 * Payment event detail
 */
export const paymentEventDetailSchema = paymentEventListItemSchema.extend({
  timeline: z.array(paymentTimelineEventSchema),
  payloadPreview: sanitizedPaymentPayloadPreviewSchema,
  retryHistory: z.array(paymentRetryEventSchema),
});

export type PaymentEventDetail = z.infer<typeof paymentEventDetailSchema>;

/**
 * Failed payment status
 */
export const failedPaymentStatusSchema = z.enum([
  "open",
  "reviewed",
  "retry_handoff_prepared",
  "customer_contact_handoff",
  "provider_recovered",
  "resolved",
]);

export type FailedPaymentStatus = z.infer<typeof failedPaymentStatusSchema>;

/**
 * Failed payment item
 */
export const failedPaymentItemSchema = z
  .object({
    id: safeIdSchema,
    customer: maskedCustomerSchema,
    plan: planNameSchema,
    failedAmount: moneySchema,
    reason: z.string().max(200),
    attemptCount: z.number().int().min(1),
    status: failedPaymentStatusSchema,
    expectedState: z.string().max(40),
  })
  .strict();

export type FailedPaymentItem = z.infer<typeof failedPaymentItemSchema>;

/**
 * Failed payments query parameters
 */
export const failedPaymentsQuerySchema = z
  .object({
    platform: platformFilterSchema.default("all"),
    currency: currencySchema.optional(),
    status: failedPaymentStatusSchema.optional(),
    sort: z.enum([
      "date",
      "amount",
      "attemptCount",
      "status",
    ]).default("date"),
    order: z.enum(["asc", "desc"]).default("desc"),
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().pipe(z.union([z.literal(25), z.literal(50), z.literal(100)])).default(25),
    scenario: z.string().max(40).optional(),
  })
  .strict();

export type FailedPaymentsQuery = z.infer<typeof failedPaymentsQuerySchema>;

/**
 * Failed payments page response
 */
export const failedPaymentsPageSchema = z
  .object({
    items: z.array(failedPaymentItemSchema),
    meta: pageMetaSchema,
    region: regionStateSchema,
  })
  .strict();

export type FailedPaymentsPage = z.infer<typeof failedPaymentsPageSchema>;

/**
 * Failed payment action types (allowlisted only)
 */
export const failedPaymentActionSchema = z.enum([
  "mark_reviewed",
  "prepare_retry_handoff",
  "record_customer_contact_handoff",
  "mark_provider_recovered",
]);

export type FailedPaymentAction = z.infer<typeof failedPaymentActionSchema>;

/**
 * Failed payment action request
 */
export const failedPaymentActionRequestSchema = z
  .object({
    action: failedPaymentActionSchema,
    reason: z.string().trim().min(3).max(500),
    scope: z.string().trim().max(120),
    expectedCurrentState: z.string().max(40),
    confirmationToken: z.string().min(1).max(120),
  })
  .strict();

export type FailedPaymentActionRequest = z.infer<typeof failedPaymentActionRequestSchema>;

// ============================================================================
// Reconciliation Contracts
// ============================================================================

/**
 * Reconciliation issue severity
 */
export const reconciliationSeveritySchema = z.enum(["low", "medium", "high", "critical"]);

export type ReconciliationSeverity = z.infer<typeof reconciliationSeveritySchema>;

/**
 * Reconciliation issue status
 */
export const reconciliationStatusSchema = z.enum([
  "open",
  "reviewing",
  "resolved",
  "blocked",
  "stale",
]);

export type ReconciliationStatus = z.infer<typeof reconciliationStatusSchema>;

/**
 * Provider freshness
 */
export const providerFreshnessSchema = z.enum(["fresh", "stale", "unavailable"]);

export type ProviderFreshness = z.infer<typeof providerFreshnessSchema>;

/**
 * Reconciliation decision types (allowlisted only)
 */
export const reconciliationDecisionSchema = z.enum([
  "mark_reviewing",
  "accept_internal",
  "accept_provider",
  "defer",
  "mark_resolved",
]);

export type ReconciliationDecision = z.infer<typeof reconciliationDecisionSchema>;

/**
 * Reconciliation item
 */
export const reconciliationItemSchema = z
  .object({
    id: safeIdSchema,
    internalStatus: z.string().max(40),
    providerStatus: z.string().max(40),
    difference: z.string().max(300),
    recommendedAction: z.string().max(200),
    severity: reconciliationSeveritySchema,
    ageSeconds: z.number().int().min(0),
    currencyImpact: moneySchema.optional(),
    providerFreshness: providerFreshnessSchema,
    status: reconciliationStatusSchema,
    expectedState: z.string().max(40),
  })
  .strict();

export type ReconciliationItem = z.infer<typeof reconciliationItemSchema>;

/**
 * Reconciliation query parameters
 */
export const reconciliationQuerySchema = z
  .object({
    platform: platformFilterSchema.default("all"),
    severity: reconciliationSeveritySchema.optional(),
    status: reconciliationStatusSchema.optional(),
    sort: z.enum([
      "age",
      "severity",
      "status",
    ]).default("age"),
    order: z.enum(["asc", "desc"]).default("desc"),
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().pipe(z.union([z.literal(25), z.literal(50), z.literal(100)])).default(25),
    scenario: z.string().max(40).optional(),
  })
  .strict();

export type ReconciliationQuery = z.infer<typeof reconciliationQuerySchema>;

/**
 * Reconciliation page response
 */
export const reconciliationPageSchema = z
  .object({
    items: z.array(reconciliationItemSchema),
    meta: pageMetaSchema,
    region: regionStateSchema,
  })
  .strict();

export type ReconciliationPage = z.infer<typeof reconciliationPageSchema>;

/**
 * Reconciliation action request
 */
export const reconciliationActionRequestSchema = z
  .object({
    decision: reconciliationDecisionSchema,
    reason: z.string().trim().min(3).max(500),
    expectedIssueState: z.string().max(40),
    providerFreshness: providerFreshnessSchema,
    confirmationToken: z.string().min(1).max(120),
  })
  .strict();

export type ReconciliationActionRequest = z.infer<typeof reconciliationActionRequestSchema>;

// ============================================================================
// Action Result Contracts
// ============================================================================

/**
 * Billing action outcome
 */
export const billingActionOutcomeSchema = z.enum([
  "simulated_success",
  "conflict",
  "forbidden",
  "rejected",
]);

export type BillingActionOutcome = z.infer<typeof billingActionOutcomeSchema>;

/**
 * Billing action result (shared for all action types)
 */
export const billingActionResultSchema = z
  .object({
    id: safeIdSchema,
    previousState: z.string().max(40),
    currentState: z.string().max(40),
    outcome: billingActionOutcomeSchema,
    timestamp: z.iso.datetime({ offset: true }),
    message: z.string().max(300),
    plannedAuditReference: safeIdSchema,
  })
  .strict();

export type BillingActionResult = z.infer<typeof billingActionResultSchema>;
