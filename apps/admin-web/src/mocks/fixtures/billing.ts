import type {
  SubscriptionOverview,
  SubscriptionListItem,
  SubscriptionDetail,
  PlanDetail,
  PromotionalCodeDetail,
  PaymentsOverview,
  PaymentEventListItem,
  PaymentEventDetail,
  FailedPaymentItem,
  ReconciliationItem,
  Money,
  MaskedCustomer,
  BillingInterval,
  PromotionalCodeStatus,
  DiscountKind,
  DiscountDuration,
  FailedPaymentStatus,
  ReconciliationSeverity,
  ReconciliationStatus,
  ProviderFreshness,
} from "@/features/billing/contracts";

// ============================================================================
// Helper Functions
// ============================================================================

function createMoney(amount: number, currency: "AED" | "SAR"): Money {
  return { amount, currency };
}

function createMaskedCustomer(
  id: string,
  name: string,
  email: string,
  platform: "ios" | "android" | "multi_platform" | "unattributed",
): MaskedCustomer {
  return {
    customerId: id,
    displayName: name,
    maskedEmail: email,
    platform,
  };
}

// ============================================================================
// Subscription Fixtures
// ============================================================================

const subscriptionOverviewFixture: SubscriptionOverview = {
  period: "30d",
  freshnessAt: "2026-07-28T12:00:00+03:00",
  partial: false,
  kpis: {
    active: 842,
    trialing: 156,
    free: 1234,
    basic: 890,
    premium: 250,
    upgrades: 45,
    downgrades: 12,
    cancellations: 28,
    churnRate: 0.033,
    mrrAed: 28450,
    mrrSar: 18920,
    failedRenewals: 18,
  },
  currencyGroups: [
    { currency: "AED", value: 28450 },
    { currency: "SAR", value: 18920 },
  ],
  platformBreakdown: [
    {
      platform: "ios",
      uniqueSubscriptions: 542,
      revenue: [
        createMoney(15420, "AED"),
        createMoney(9820, "SAR"),
      ],
    },
    {
      platform: "android",
      uniqueSubscriptions: 456,
      revenue: [
        createMoney(13030, "AED"),
        createMoney(9100, "SAR"),
      ],
    },
    {
      platform: "multi_platform",
      uniqueSubscriptions: 110,
      revenue: [
        createMoney(3870, "AED"),
        createMoney(2450, "SAR"),
      ],
    },
    {
      platform: "unattributed",
      uniqueSubscriptions: 15,
      revenue: [
        createMoney(120, "AED"),
        createMoney(80, "SAR"),
      ],
    },
  ],
  region: {
    availability: "available",
    message: "Data is current",
    retryable: false,
    updatedAt: "2026-07-28T12:00:00+03:00",
  },
};

const subscriptionListItemsFixture: SubscriptionListItem[] = [
  {
    id: "SUB-123",
    customer: createMaskedCustomer(
      "USR-001",
      "نورة العتيبي",
      "n***@example.test",
      "ios",
    ),
    plan: "Premium",
    status: "active",
    provider: "stripe_mock",
    renewalDate: "2026-08-28T00:00:00+03:00",
    amount: createMoney(99.99, "AED"),
    cancelAtPeriodEnd: false,
    paymentStatus: "paid",
    permittedActions: [
      "change_plan",
      "set_cancel_at_period_end",
      "record_internal_note",
    ],
  },
  {
    id: "SUB-124",
    customer: createMaskedCustomer(
      "USR-002",
      "محمد الأحمدي",
      "m***@example.test",
      "android",
    ),
    plan: "Basic",
    status: "active",
    provider: "stripe_mock",
    renewalDate: "2026-08-25T00:00:00+03:00",
    amount: createMoney(49.99, "SAR"),
    cancelAtPeriodEnd: false,
    paymentStatus: "paid",
    permittedActions: [
      "change_plan",
      "set_cancel_at_period_end",
      "record_internal_note",
    ],
  },
  {
    id: "SUB-125",
    customer: createMaskedCustomer(
      "USR-003",
      "فاطمة محمد",
      "f***@example.test",
      "multi_platform",
    ),
    plan: "Premium",
    status: "past_due",
    provider: "stripe_mock",
    renewalDate: "2026-07-25T00:00:00+03:00",
    amount: createMoney(99.99, "AED"),
    cancelAtPeriodEnd: false,
    paymentStatus: "failed",
    permittedActions: [
      "change_plan",
      "set_cancel_at_period_end",
      "record_internal_note",
    ],
  },
  {
    id: "SUB-126",
    customer: createMaskedCustomer(
      "USR-004",
      "أحمد سالم",
      "a***@example.test",
      "ios",
    ),
    plan: "Free",
    status: "trialing",
    provider: "stripe_mock",
    renewalDate: "2026-08-05T00:00:00+03:00",
    amount: createMoney(0, "AED"),
    cancelAtPeriodEnd: false,
    paymentStatus: "none",
    permittedActions: [
      "change_plan",
      "set_cancel_at_period_end",
      "record_internal_note",
    ],
  },
  {
    id: "SUB-127",
    customer: createMaskedCustomer(
      "USR-005",
      "سارة عبدالله",
      "s***@example.test",
      "android",
    ),
    plan: "Premium",
    status: "cancel_at_period_end",
    provider: "stripe_mock",
    renewalDate: "2026-08-15T00:00:00+03:00",
    amount: createMoney(99.99, "SAR"),
    cancelAtPeriodEnd: true,
    paymentStatus: "paid",
    permittedActions: [
      "clear_cancel_at_period_end",
      "record_internal_note",
    ],
  },
];

const subscriptionDetailFixture: SubscriptionDetail = {
  ...subscriptionListItemsFixture[0],
  billingInterval: "monthly" as BillingInterval,
  limits: {
    accounts: 10,
    transactions: 500,
    goals: 50,
    imports: 10,
    aiQueries: 1000,
  },
  safeProviderReferences: [
    "STRIPE-CUSTOMER-123",
    "STRIPE-SUBSCRIPTION-456",
  ],
  billingEvents: [
    {
      id: "EVT-001",
      eventType: "renewal",
      status: "paid",
      occurredAt: "2026-07-28T00:00:00+03:00",
      amount: createMoney(99.99, "AED"),
    },
    {
      id: "EVT-002",
      eventType: "renewal",
      status: "paid",
      occurredAt: "2026-06-28T00:00:00+03:00",
      amount: createMoney(99.99, "AED"),
    },
  ],
  planChangeHistory: [
    {
      id: "PCH-001",
      fromPlan: "Basic",
      toPlan: "Premium",
      changedAt: "2026-01-15T00:00:00+03:00",
      reason: "upgrade",
    },
  ],
  expectedState: "active",
};

// ============================================================================
// Plan Management Fixtures
// ============================================================================

const planDetailsFixture: PlanDetail[] = [
  {
    id: "PLAN-Free",
    name: "Free",
    price: createMoney(0, "AED"),
    interval: "none",
    limits: {
      accounts: 1,
      transactions: 50,
      goals: 5,
      imports: 3,
      aiQueries: 0,
    },
    active: true,
    providerPriceLabel: "FREE_TIER",
    updatedAt: "2026-01-01T00:00:00+03:00",
  },
  {
    id: "PLAN-Basic",
    name: "Basic",
    price: createMoney(49.99, "AED"),
    interval: "monthly",
    limits: {
      accounts: 3,
      transactions: 200,
      goals: 20,
      imports: 10,
      aiQueries: 200,
    },
    active: true,
    providerPriceLabel: "PRICE_BASIC_MONTHLY",
    updatedAt: "2026-01-01T00:00:00+03:00",
  },
  {
    id: "PLAN-Premium",
    name: "Premium",
    price: createMoney(99.99, "AED"),
    interval: "monthly",
    limits: {
      accounts: 10,
      transactions: 500,
      goals: 50,
      imports: 10,
      aiQueries: 1000,
    },
    active: true,
    providerPriceLabel: "PRICE_PREMIUM_MONTHLY",
    updatedAt: "2026-01-01T00:00:00+03:00",
  },
];

// ============================================================================
// Promotional Code Fixtures
// ============================================================================

const promotionalCodeDetailsFixture: PromotionalCodeDetail[] = [
  {
    id: "PROMO-WELCOME10",
    code: "WELCOME10",
    discountKind: "percentage" as DiscountKind,
    discountValue: 10,
    duration: "once" as DiscountDuration,
    redemptionCount: 245,
    redemptionLimit: 500,
    expiresAt: "2026-12-31T23:59:59+03:00",
    status: "active" as PromotionalCodeStatus,
    eligiblePlanIds: ["PLAN-Basic", "PLAN-Premium"],
  },
  {
    id: "PROMO-SAVE50",
    code: "SAVE50",
    discountKind: "fixed" as DiscountKind,
    discountValue: 50,
    duration: "repeating" as DiscountDuration,
    redemptionCount: 89,
    redemptionLimit: 200,
    expiresAt: "2026-09-30T23:59:59+03:00",
    status: "active" as PromotionalCodeStatus,
    eligiblePlanIds: ["PLAN-Premium"],
  },
  {
    id: "PROMO-EXPIRED20",
    code: "EXPIRED20",
    discountKind: "percentage" as DiscountKind,
    discountValue: 20,
    duration: "once" as DiscountDuration,
    redemptionCount: 150,
    redemptionLimit: 200,
    expiresAt: "2026-06-30T23:59:59+03:00",
    status: "expired" as PromotionalCodeStatus,
    eligiblePlanIds: ["PLAN-Basic", "PLAN-Premium"],
  },
];

// ============================================================================
// Payments Overview Fixtures
// ============================================================================

const paymentsOverviewFixture: PaymentsOverview = {
  period: "30d",
  freshnessAt: "2026-07-28T12:00:00+03:00",
  currencyGroups: [
    {
      currency: "AED",
      successful: 28450,
      failed: 850,
      refunded: 250,
      disputed: 100,
      pending: 320,
    },
    {
      currency: "SAR",
      successful: 18920,
      failed: 560,
      refunded: 180,
      disputed: 75,
      pending: 210,
    },
  ],
  reconciliationCount: 8,
  region: {
    availability: "available",
    message: "Data is current",
    retryable: false,
    updatedAt: "2026-07-28T12:00:00+03:00",
  },
};

// ============================================================================
// Payment Events Fixtures
// ============================================================================

const paymentEventListItemsFixture: PaymentEventListItem[] = [
  {
    id: "EVT-20260728-001",
    customer: createMaskedCustomer(
      "USR-001",
      "نورة العتيبي",
      "n***@example.test",
      "ios",
    ),
    subscriptionId: "SUB-123",
    eventType: "renewal",
    amount: createMoney(99.99, "AED"),
    provider: "stripe_mock",
    status: "processed",
    receivedAt: "2026-07-28T00:00:00+03:00",
    processedAt: "2026-07-28T00:01:30+03:00",
    retryCount: 0,
  },
  {
    id: "EVT-20260727-001",
    customer: createMaskedCustomer(
      "USR-003",
      "فاطمة محمد",
      "f***@example.test",
      "multi_platform",
    ),
    subscriptionId: "SUB-125",
    eventType: "renewal",
    amount: createMoney(99.99, "AED"),
    provider: "stripe_mock",
    status: "failed",
    receivedAt: "2026-07-27T00:00:00+03:00",
    processedAt: "2026-07-27T00:05:00+03:00",
    retryCount: 2,
  },
  {
    id: "EVT-20260726-001",
    customer: createMaskedCustomer(
      "USR-002",
      "محمد الأحمدي",
      "m***@example.test",
      "android",
    ),
    subscriptionId: "SUB-124",
    eventType: "renewal",
    amount: createMoney(49.99, "SAR"),
    provider: "stripe_mock",
    status: "processed",
    receivedAt: "2026-07-26T00:00:00+03:00",
    processedAt: "2026-07-26T00:01:20+03:00",
    retryCount: 0,
  },
];

const paymentEventDetailFixture: PaymentEventDetail = {
  ...paymentEventListItemsFixture[0],
  timeline: [
    {
      timestamp: "2026-07-28T00:00:00+03:00",
      event: "payment_received",
      message: "Payment request received from provider",
    },
    {
      timestamp: "2026-07-28T00:01:30+03:00",
      event: "payment_processed",
      message: "Payment successfully processed",
    },
  ],
  payloadPreview: {
    eventId: "EVT-20260728-001",
    eventType: "invoice.payment_succeeded",
    status: "succeeded",
    receivedAt: "2026-07-28T00:00:00+03:00",
    processedAt: "2026-07-28T00:01:30+03:00",
    amount: createMoney(99.99, "AED"),
    subscriptionReference: "SUB-123",
    retryCount: 0,
    providerErrorCode: undefined,
    providerErrorMessage: undefined,
  },
  retryHistory: [],
};

// ============================================================================
// Failed Payments Fixtures
// ============================================================================

const failedPaymentItemsFixture: FailedPaymentItem[] = [
  {
    id: "FAIL-001",
    customer: createMaskedCustomer(
      "USR-003",
      "فاطمة محمد",
      "f***@example.test",
      "multi_platform",
    ),
    plan: "Premium",
    failedAmount: createMoney(99.99, "AED"),
    reason: "card_declined",
    attemptCount: 2,
    status: "open" as FailedPaymentStatus,
    expectedState: "open",
  },
  {
    id: "FAIL-002",
    customer: createMaskedCustomer(
      "USR-006",
      "خالد العمري",
      "k***@example.test",
      "android",
    ),
    plan: "Basic",
    failedAmount: createMoney(49.99, "SAR"),
    reason: "insufficient_funds",
    attemptCount: 1,
    status: "reviewed" as FailedPaymentStatus,
    expectedState: "reviewed",
  },
  {
    id: "FAIL-003",
    customer: createMaskedCustomer(
      "USR-007",
      "ليلى الحربي",
      "l***@example.test",
      "ios",
    ),
    plan: "Premium",
    failedAmount: createMoney(99.99, "SAR"),
    reason: "network_error",
    attemptCount: 3,
    status: "retry_handoff_prepared" as FailedPaymentStatus,
    expectedState: "retry_handoff_prepared",
  },
];

// ============================================================================
// Reconciliation Fixtures
// ============================================================================

const reconciliationItemsFixture: ReconciliationItem[] = [
  {
    id: "REC-001",
    internalStatus: "active",
    providerStatus: "cancelled",
    difference: "Subscription shows active internally but cancelled in provider",
    recommendedAction: "Update internal status to cancelled",
    severity: "high" as ReconciliationSeverity,
    ageSeconds: 86400, // 1 day
    currencyImpact: createMoney(99.99, "AED"),
    providerFreshness: "fresh" as ProviderFreshness,
    status: "open" as ReconciliationStatus,
    expectedState: "open",
  },
  {
    id: "REC-002",
    internalStatus: "Basic",
    providerStatus: "Premium",
    difference: "Plan tier mismatch between internal and provider records",
    recommendedAction: "Update internal plan to Premium",
    severity: "medium" as ReconciliationSeverity,
    ageSeconds: 172800, // 2 days
    currencyImpact: createMoney(50, "AED"),
    providerFreshness: "stale" as ProviderFreshness,
    status: "reviewing" as ReconciliationStatus,
    expectedState: "reviewing",
  },
  {
    id: "REC-003",
    internalStatus: "cancelled",
    providerStatus: "active",
    difference: "Subscription cancelled internally but still active in provider",
    recommendedAction: "Cancel subscription in provider",
    severity: "critical" as ReconciliationSeverity,
    ageSeconds: 259200, // 3 days
    currencyImpact: createMoney(99.99, "SAR"),
    providerFreshness: "fresh" as ProviderFreshness,
    status: "open" as ReconciliationStatus,
    expectedState: "open",
  },
];

// ============================================================================
// Export Fixtures
// ============================================================================

export const billingFixtures = {
  subscriptionOverview: subscriptionOverviewFixture,
  subscriptionListItems: subscriptionListItemsFixture,
  subscriptionDetail: subscriptionDetailFixture,
  planDetails: planDetailsFixture,
  promotionalCodeDetails: promotionalCodeDetailsFixture,
  paymentsOverview: paymentsOverviewFixture,
  paymentEventListItems: paymentEventListItemsFixture,
  paymentEventDetail: paymentEventDetailFixture,
  failedPaymentItems: failedPaymentItemsFixture,
  reconciliationItems: reconciliationItemsFixture,
};

// ============================================================================
// Empty State Fixtures
// ============================================================================

export const emptyBillingFixtures = {
  subscriptionOverview: {
    ...subscriptionOverviewFixture,
    kpis: {
      active: 0,
      trialing: 0,
      free: 0,
      basic: 0,
      premium: 0,
      upgrades: 0,
      downgrades: 0,
      cancellations: 0,
      churnRate: 0,
      mrrAed: 0,
      mrrSar: 0,
      failedRenewals: 0,
    },
    currencyGroups: [
      { currency: "AED", value: 0 },
      { currency: "SAR", value: 0 },
    ],
    platformBreakdown: [],
  },
  subscriptionListItems: [],
  planDetails: planDetailsFixture,
  promotionalCodeDetails: [],
  paymentsOverview: {
    ...paymentsOverviewFixture,
    currencyGroups: [
      {
        currency: "AED",
        successful: 0,
        failed: 0,
        refunded: 0,
        disputed: 0,
        pending: 0,
      },
      {
        currency: "SAR",
        successful: 0,
        failed: 0,
        refunded: 0,
        disputed: 0,
        pending: 0,
      },
    ],
    reconciliationCount: 0,
  },
  paymentEventListItems: [],
  failedPaymentItems: [],
  reconciliationItems: [],
};

// ============================================================================
// Partial State Fixtures
// ============================================================================

export const partialBillingFixtures = {
  subscriptionOverview: {
    ...subscriptionOverviewFixture,
    partial: true,
    kpis: {
      active: 842,
      trialing: 156,
      free: 1234,
      basic: 890,
      premium: 250,
      upgrades: 45,
      downgrades: 12,
      cancellations: 28,
      churnRate: 0.033,
      mrrAed: 28450,
      mrrSar: 0,
      failedRenewals: 18,
    },
    region: {
      availability: "partial",
      message: "SAR data temporarily unavailable",
      retryable: true,
      updatedAt: "2026-07-28T12:00:00+03:00",
    },
  },
  paymentEventListItems: paymentEventListItemsFixture,
  failedPaymentItems: failedPaymentItemsFixture,
};

// ============================================================================
// Multi-platform Overlap Fixtures
// ============================================================================

export const multiPlatformBillingFixtures = {
  subscriptionOverview: {
    ...subscriptionOverviewFixture,
    platformBreakdown: [
      {
        platform: "ios",
        uniqueSubscriptions: 300,
        revenue: [
          createMoney(10000, "AED"),
          createMoney(7000, "SAR"),
        ],
      },
      {
        platform: "android",
        uniqueSubscriptions: 250,
        revenue: [
          createMoney(8000, "AED"),
          createMoney(6000, "SAR"),
        ],
      },
      {
        platform: "multi_platform",
        uniqueSubscriptions: 75, // These are unique customers who use both iOS and Android
        revenue: [
          createMoney(4500, "AED"),
          createMoney(3000, "SAR"),
        ],
      },
    ],
  },
  subscriptionListItems: [
    ...subscriptionListItemsFixture,
    {
      id: "SUB-128",
      customer: createMaskedCustomer(
        "USR-008",
        "عبدالله الغامدي",
        "a***@example.test",
        "multi_platform",
      ),
      plan: "Premium",
      status: "active",
      provider: "stripe_mock",
      renewalDate: "2026-08-30T00:00:00+03:00",
      amount: createMoney(99.99, "AED"),
      cancelAtPeriodEnd: false,
      paymentStatus: "paid",
      permittedActions: [
        "change_plan",
        "set_cancel_at_period_end",
        "record_internal_note",
      ],
    },
  ],
};

// ============================================================================
// Mixed Currency Fixtures
// ============================================================================

export const mixedCurrencyBillingFixtures = {
  subscriptionOverview: {
    ...subscriptionOverviewFixture,
    currencyGroups: [
      { currency: "AED", value: 28450 },
      { currency: "SAR", value: 18920 },
    ],
    kpis: {
      active: 842,
      trialing: 156,
      free: 1234,
      basic: 890,
      premium: 250,
      upgrades: 45,
      downgrades: 12,
      cancellations: 28,
      churnRate: 0.033,
      mrrAed: 28450,
      mrrSar: 18920,
      failedRenewals: 18,
    },
  },
  subscriptionListItems: [
    ...subscriptionListItemsFixture.slice(0, 3),
    {
      id: "SUB-129",
      customer: createMaskedCustomer(
        "USR-009",
        "منى القحطاني",
        "m***@example.test",
        "ios",
      ),
      plan: "Basic",
      status: "active",
      provider: "stripe_mock",
      renewalDate: "2026-08-20T00:00:00+03:00",
      amount: createMoney(49.99, "SAR"),
      cancelAtPeriodEnd: false,
      paymentStatus: "paid",
      permittedActions: [
        "change_plan",
        "set_cancel_at_period_end",
        "record_internal_note",
      ],
    },
  ],
};

export default billingFixtures;
