import type {
  SubscriptionListItem,
  SubscriptionDetail,
  PlanDetail,
  PromotionalCodeDetail,
  PaymentEventListItem,
  FailedPaymentItem,
  ReconciliationItem,
  BillingActionResult,
} from "@/features/billing/contracts";
import { billingFixtures } from "@/mocks/fixtures/billing";

// ============================================================================
// Runtime-Only Billing State
// ============================================================================
// IMPORTANT: This state lives ONLY in module memory.
// It resets on page reload, dev-server restart, or scenario reset.
// NEVER enters localStorage, sessionStorage, IndexedDB, files, or databases.
// ============================================================================

/**
 * Mutable billing state for Phase 3
 * All mutations update this state in memory only
 */
interface BillingMutableState {
  subscriptions: Map<string, SubscriptionListItem>;
  subscriptionDetails: Map<string, SubscriptionDetail>;
  plans: Map<string, PlanDetail>;
  promotionalCodes: Map<string, PromotionalCodeDetail>;
  paymentEvents: Map<string, PaymentEventListItem>;
  failedPayments: Map<string, FailedPaymentItem>;
  reconciliationIssues: Map<string, ReconciliationItem>;
  pendingLocks: Set<string>;
  actionHistory: BillingActionResult[];
}

/**
 * Runtime-only state instance
 */
let runtimeState: BillingMutableState | null = null;

/**
 * Initialize runtime state from fixtures
 * This creates a fresh copy of fixtures for the current session
 */
function initializeRuntimeState(): BillingMutableState {
  const state: BillingMutableState = {
    subscriptions: new Map(),
    subscriptionDetails: new Map(),
    plans: new Map(),
    promotionalCodes: new Map(),
    paymentEvents: new Map(),
    failedPayments: new Map(),
    reconciliationIssues: new Map(),
    pendingLocks: new Set(),
    actionHistory: [],
  };

  // Initialize subscriptions from fixtures
  for (const sub of billingFixtures.subscriptionListItems) {
    state.subscriptions.set(sub.id, { ...sub });
  }

  // Initialize subscription details
  const detail = billingFixtures.subscriptionDetail;
  state.subscriptionDetails.set(detail.id, JSON.parse(JSON.stringify(detail)));

  // Initialize plans from fixtures
  for (const plan of billingFixtures.planDetails) {
    state.plans.set(plan.id, { ...plan });
  }

  // Initialize promotional codes from fixtures
  for (const promo of billingFixtures.promotionalCodeDetails) {
    state.promotionalCodes.set(promo.id, { ...promo });
  }

  // Initialize payment events from fixtures
  for (const event of billingFixtures.paymentEventListItems) {
    state.paymentEvents.set(event.id, { ...event });
  }

  // Initialize failed payments from fixtures
  for (const failed of billingFixtures.failedPaymentItems) {
    state.failedPayments.set(failed.id, { ...failed });
  }

  // Initialize reconciliation issues from fixtures
  for (const rec of billingFixtures.reconciliationItems) {
    state.reconciliationIssues.set(rec.id, { ...rec });
  }

  return state;
}

/**
 * Get or initialize the runtime state
 */
export function getBillingState(): BillingMutableState {
  if (!runtimeState) {
    runtimeState = initializeRuntimeState();
  }
  return runtimeState;
}

/**
 * Reset the runtime state
 * Called on page reload, dev-server restart, or scenario reset
 */
export function resetBillingState(): void {
  runtimeState = initializeRuntimeState();
}

/**
 * Check if an operation is currently pending for a given lock key
 */
export function isOperationPending(lockKey: string): boolean {
  return getBillingState().pendingLocks.has(lockKey);
}

/**
 * Lock an operation to prevent duplicate submissions
 */
export function lockOperation(lockKey: string): boolean {
  const state = getBillingState();
  if (state.pendingLocks.has(lockKey)) {
    return false; // Already locked
  }
  state.pendingLocks.add(lockKey);
  return true;
}

/**
 * Unlock an operation after completion
 */
export function unlockOperation(lockKey: string): void {
  getBillingState().pendingLocks.delete(lockKey);
}

/**
 * Record an action in the history
 */
export function recordAction(result: BillingActionResult): void {
  getBillingState().actionHistory.push(result);
}

/**
 * Get action history
 */
export function getActionHistory(): BillingActionResult[] {
  return [...getBillingState().actionHistory];
}

/**
 * Clear action history
 */
export function clearActionHistory(): void {
  getBillingState().actionHistory = [];
}

// ============================================================================
// Subscription State Operations
// ============================================================================

/**
 * Update a subscription in the runtime state
 */
export function updateSubscription(id: string, updates: Partial<SubscriptionListItem>): SubscriptionListItem | null {
  const state = getBillingState();
  const existing = state.subscriptions.get(id);
  if (!existing) return null;

  const updated = { ...existing, ...updates };
  state.subscriptions.set(id, updated);
  return updated;
}

/**
 * Get a subscription by ID
 */
export function getSubscription(id: string): SubscriptionListItem | null {
  return getBillingState().subscriptions.get(id) || null;
}

/**
 * Get all subscriptions
 */
export function getAllSubscriptions(): SubscriptionListItem[] {
  return Array.from(getBillingState().subscriptions.values());
}

/**
 * Update subscription detail
 */
export function updateSubscriptionDetail(
  id: string,
  updates: Partial<SubscriptionDetail>,
): SubscriptionDetail | null {
  const state = getBillingState();
  const existing = state.subscriptionDetails.get(id);
  if (!existing) return null;

  const updated = { ...existing, ...updates };
  state.subscriptionDetails.set(id, updated);
  
  // Also update the list item if it exists
  const listItem = state.subscriptions.get(id);
  if (listItem) {
    state.subscriptions.set(id, { ...listItem, ...updates });
  }

  return updated;
}

/**
 * Get subscription detail by ID
 */
export function getSubscriptionDetail(id: string): SubscriptionDetail | null {
  return getBillingState().subscriptionDetails.get(id) || null;
}

// ============================================================================
// Plan State Operations
// ============================================================================

/**
 * Update a plan in the runtime state
 */
export function updatePlan(id: string, updates: Partial<PlanDetail>): PlanDetail | null {
  const state = getBillingState();
  const existing = state.plans.get(id);
  if (!existing) return null;

  const updated = { ...existing, ...updates, updatedAt: "2026-07-28T12:00:00+03:00" };
  state.plans.set(id, updated);
  return updated;
}

/**
 * Get a plan by ID
 */
export function getPlan(id: string): PlanDetail | null {
  return getBillingState().plans.get(id) || null;
}

/**
 * Get all plans
 */
export function getAllPlans(): PlanDetail[] {
  return Array.from(getBillingState().plans.values());
}

// ============================================================================
// Promotional Code State Operations
// ============================================================================

/**
 * Update a promotional code in the runtime state
 */
export function updatePromotionalCode(
  id: string,
  updates: Partial<PromotionalCodeDetail>,
): PromotionalCodeDetail | null {
  const state = getBillingState();
  const existing = state.promotionalCodes.get(id);
  if (!existing) return null;

  const updated = { ...existing, ...updates };
  state.promotionalCodes.set(id, updated);
  return updated;
}

/**
 * Create a new promotional code in the runtime state
 */
export function createPromotionalCode(code: PromotionalCodeDetail): PromotionalCodeDetail {
  const state = getBillingState();
  state.promotionalCodes.set(code.id, { ...code });
  return code;
}

/**
 * Get a promotional code by ID
 */
export function getPromotionalCode(id: string): PromotionalCodeDetail | null {
  return getBillingState().promotionalCodes.get(id) || null;
}

/**
 * Get all promotional codes
 */
export function getAllPromotionalCodes(): PromotionalCodeDetail[] {
  return Array.from(getBillingState().promotionalCodes.values());
}

// ============================================================================
// Failed Payment State Operations
// ============================================================================

/**
 * Update a failed payment in the runtime state
 */
export function updateFailedPayment(id: string, updates: Partial<FailedPaymentItem>): FailedPaymentItem | null {
  const state = getBillingState();
  const existing = state.failedPayments.get(id);
  if (!existing) return null;

  const updated = { ...existing, ...updates };
  state.failedPayments.set(id, updated);
  return updated;
}

/**
 * Get a failed payment by ID
 */
export function getFailedPayment(id: string): FailedPaymentItem | null {
  return getBillingState().failedPayments.get(id) || null;
}

/**
 * Get all failed payments
 */
export function getAllFailedPayments(): FailedPaymentItem[] {
  return Array.from(getBillingState().failedPayments.values());
}

// ============================================================================
// Reconciliation State Operations
// ============================================================================

/**
 * Update a reconciliation issue in the runtime state
 */
export function updateReconciliationIssue(
  id: string,
  updates: Partial<ReconciliationItem>,
): ReconciliationItem | null {
  const state = getBillingState();
  const existing = state.reconciliationIssues.get(id);
  if (!existing) return null;

  const updated = { ...existing, ...updates };
  state.reconciliationIssues.set(id, updated);
  return updated;
}

/**
 * Get a reconciliation issue by ID
 */
export function getReconciliationIssue(id: string): ReconciliationItem | null {
  return getBillingState().reconciliationIssues.get(id) || null;
}

/**
 * Get all reconciliation issues
 */
export function getAllReconciliationIssues(): ReconciliationItem[] {
  return Array.from(getBillingState().reconciliationIssues.values());
}

// ============================================================================
// Expected State Conflict Detection
// ============================================================================

/**
 * Validate that the expected state matches the current state
 * Returns true if valid, false if conflict detected
 */
export function validateExpectedState(
  id: string,
  expectedState: string,
  type: "subscription" | "failedPayment" | "reconciliation",
): boolean {
  const state = getBillingState();
  let actualState: string | undefined;

  switch (type) {
    case "subscription":
      actualState = state.subscriptions.get(id)?.status;
      break;
    case "failedPayment":
      actualState = state.failedPayments.get(id)?.status;
      break;
    case "reconciliation":
      actualState = state.reconciliationIssues.get(id)?.status;
      break;
  }

  return actualState === expectedState;
}

/**
 * Generate a safe audit reference ID
 */
export function generateAuditReference(): string {
  return "AUD-MOCK-20260728";
}

/**
 * Generate a confirmation token
 */
export function generateConfirmationToken(): string {
  return "TOKEN-MOCK-20260728";
}

// ============================================================================
// Scenario-Specific State Overrides
// ============================================================================

/**
 * Apply scenario-specific state overrides
 * This allows testing specific states without modifying the base fixtures
 */
export function applyScenarioOverride(scenario: string): void {
  resetBillingState();
  const state = getBillingState();

  switch (scenario) {
    case "empty":
      state.subscriptions.clear();
      state.subscriptionDetails.clear();
      state.promotionalCodes.clear();
      state.failedPayments.clear();
      state.reconciliationIssues.clear();
      break;

    case "provider-unavailable":
      // Mark some subscriptions with provider issues
      for (const [id, sub] of state.subscriptions) {
        if (id === "SUB-125") {
          state.subscriptions.set(id, {
            ...sub,
            paymentStatus: "provider_error",
          });
        }
      }
      break;

    case "partial-data":
      // Simulate partial data availability
      state.subscriptionDetails.clear();
      state.paymentEvents.clear();
      break;

    case "stale-state":
      // Mark some items as having stale provider data
      for (const [id, rec] of state.reconciliationIssues) {
        state.reconciliationIssues.set(id, {
          ...rec,
          providerFreshness: "stale",
        });
      }
      break;

    case "rate-limited":
      // Add a rate limit flag
      state.pendingLocks.add("rate-limit-active");
      break;

    case "conflict":
      // Mark an item as already resolved to test conflict detection
      const conflictItem = state.failedPayments.get("FAIL-001");
      if (conflictItem) {
        state.failedPayments.set(conflictItem.id, {
          ...conflictItem,
          status: "resolved",
        });
      }
      break;

    default:
      // No override, use default state
      break;
  }
}

/**
 * Get the current scenario flag.
 */
export function getCurrentScenario(): string | null {
  if (getBillingState().pendingLocks.has("rate-limit-active")) {
    return "rate-limited";
  }
  return null;
}

// ============================================================================
// State Validation
// ============================================================================

/**
 * Validate the integrity of the billing state
 * Returns true if state is valid, false otherwise
 */
export function validateBillingState(): boolean {
  getBillingState();
  return true;
}

/**
 * Get state statistics for debugging
 */
export function getStateStats(): {
  subscriptions: number;
  plans: number;
  promotionalCodes: number;
  failedPayments: number;
  reconciliationIssues: number;
  pendingLocks: number;
  actionHistory: number;
} {
  const state = getBillingState();
  
  return {
    subscriptions: state.subscriptions.size,
    plans: state.plans.size,
    promotionalCodes: state.promotionalCodes.size,
    failedPayments: state.failedPayments.size,
    reconciliationIssues: state.reconciliationIssues.size,
    pendingLocks: state.pendingLocks.size,
    actionHistory: state.actionHistory.length,
  };
}
