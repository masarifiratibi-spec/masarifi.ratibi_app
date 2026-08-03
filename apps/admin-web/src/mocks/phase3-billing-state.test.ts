import { beforeEach, describe, expect, it } from "vitest";
import { billingFixtures } from "@/mocks/fixtures/billing";
import {
  clearActionHistory,
  getAllReconciliationIssues,
  getAllSubscriptions,
  getActionHistory,
  getBillingState,
  getSubscription,
  isOperationPending,
  lockOperation,
  recordAction,
  resetBillingState,
  unlockOperation,
  updateFailedPayment,
  updatePlan,
  updateReconciliationIssue,
  updateSubscription,
  validateExpectedState,
} from "@/mocks/phase3-billing-state";

describe("phase3-billing-state runtime semantics", () => {
  beforeEach(() => {
    resetBillingState();
  });

  describe("runtime-only reset semantics", () => {
    it("seeds state from fixtures and exposes fresh copies on reset", () => {
      const before = getAllSubscriptions();
      expect(before.length).toBe(billingFixtures.subscriptionListItems.length);

      updateSubscription("SUB-123", { status: "cancelled", cancelAtPeriodEnd: true });
      expect(getSubscription("SUB-123")?.status).toBe("cancelled");

      resetBillingState();
      expect(getSubscription("SUB-123")?.status).toBe("active");
      expect(getSubscription("SUB-123")?.cancelAtPeriodEnd).toBe(false);
    });
  });

  describe("immutable source fixtures", () => {
    it("keeps the original fixture untouched when runtime state mutates", () => {
      const original = billingFixtures.subscriptionListItems.find((item) => item.id === "SUB-123");
      const originalStatus = original?.status;

      updateSubscription("SUB-123", { status: "expired" });

      expect(billingFixtures.subscriptionListItems.find((item) => item.id === "SUB-123")?.status).toBe(
        originalStatus,
      );
    });

    it("returns plan, failed-payment, and reconciliation updates without leaking fixture references", () => {
      const plan = updatePlan("PLAN-Basic", { active: false });
      expect(plan?.active).toBe(false);
      expect(billingFixtures.planDetails.find((item) => item.id === "PLAN-Basic")?.active).toBe(true);

      const failed = updateFailedPayment("FAIL-001", { status: "reviewed", expectedState: "reviewed" });
      expect(failed?.status).toBe("reviewed");
      expect(billingFixtures.failedPaymentItems.find((item) => item.id === "FAIL-001")?.status).toBe("open");

      const issue = updateReconciliationIssue("REC-001", { status: "reviewing", expectedState: "reviewing" });
      expect(issue?.status).toBe("reviewing");
      expect(billingFixtures.reconciliationItems.find((item) => item.id === "REC-001")?.status).toBe("open");
    });
  });

  describe("expected-state conflicts", () => {
    it("accepts matching expected state and rejects stale state", () => {
      expect(validateExpectedState("SUB-124", "active", "subscription")).toBe(true);
      expect(validateExpectedState("SUB-124", "cancelled", "subscription")).toBe(false);

      expect(validateExpectedState("FAIL-002", "reviewed", "failedPayment")).toBe(true);
      expect(validateExpectedState("FAIL-002", "open", "failedPayment")).toBe(false);

      expect(validateExpectedState("REC-002", "reviewing", "reconciliation")).toBe(true);
      expect(validateExpectedState("REC-002", "open", "reconciliation")).toBe(false);
    });

    it("returns false for unknown identifiers", () => {
      expect(validateExpectedState("SUB-MISSING", "active", "subscription")).toBe(false);
    });
  });

  describe("duplicate operation rejection", () => {
    it("locks a pending operation and rejects a second attempt until unlocked", () => {
      const key = "subscription:action:SUB-123:change_plan";
      expect(lockOperation(key)).toBe(true);
      expect(isOperationPending(key)).toBe(true);
      expect(lockOperation(key)).toBe(false);

      unlockOperation(key);
      expect(isOperationPending(key)).toBe(false);
      expect(lockOperation(key)).toBe(true);
    });

    it("records and clears action history in runtime memory only", () => {
      recordAction({
        id: "SUB-123",
        previousState: "active",
        currentState: "cancelled",
        outcome: "simulated_success",
        timestamp: "2026-07-28T12:00:00+03:00",
        message: "mock",
        plannedAuditReference: "AUD-MOCK-20260728",
      });
      expect(getActionHistory()).toHaveLength(1);

      clearActionHistory();
      expect(getActionHistory()).toEqual([]);

      resetBillingState();
      expect(getActionHistory()).toEqual([]);
    });
  });

  describe("reconciliation and failed-payment reachability", () => {
    it("exposes seeded reconciliation and subscription records for listing", () => {
      expect(getAllReconciliationIssues().length).toBeGreaterThan(0);
      expect(getAllSubscriptions().length).toBeGreaterThan(0);
      expect(getBillingState().subscriptions.size).toBe(getAllSubscriptions().length);
    });
  });
});
