import { describe, expect, test } from "vitest";
import { billingFixtures } from "@/mocks/fixtures/billing";
import {
  billingActionResultSchema,
  failedPaymentActionRequestSchema,
  paymentEventDetailSchema,
  planMutationRequestSchema,
  promotionalCodeMutationRequestSchema,
  reconciliationActionRequestSchema,
  subscriptionActionRequestSchema,
  subscriptionOverviewQuerySchema,
  subscriptionOverviewSchema,
  subscriptionStatusSchema,
  subscriptionsQuerySchema,
} from "./contracts";

describe("billing contracts", () => {
  test("enforces overview defaults, currencies, freshness, and authoritative platform totals", () => {
    expect(subscriptionOverviewQuerySchema.parse({ period: "30d", platform: "all" })).toEqual({
      period: "30d",
      platform: "all",
    });
    expect(() => subscriptionOverviewQuerySchema.parse({ period: "365d", platform: "all" })).toThrow();

    const overview = subscriptionOverviewSchema.parse(billingFixtures.subscriptionOverview);
    expect(overview.currencyGroups.map((group) => group.currency)).toEqual(["AED", "SAR"]);
    expect(overview.freshnessAt).toBe("2026-07-28T12:00:00+03:00");

    const ios = overview.platformBreakdown.find((item) => item.platform === "ios")?.uniqueSubscriptions ?? 0;
    const android = overview.platformBreakdown.find((item) => item.platform === "android")?.uniqueSubscriptions ?? 0;
    expect(overview.kpis.active).not.toBe(ios + android);
  });

  test("rejects unsafe IDs, unknown fields, invalid pagination, and invalid date ranges", () => {
    expect(() => subscriptionsQuerySchema.parse({
      platform: "all",
      sort: "renewalDate",
      order: "asc",
      page: 1,
      pageSize: 25,
      unknown: true,
    })).toThrow();
    expect(() => subscriptionsQuerySchema.parse({
      platform: "all",
      sort: "renewalDate",
      order: "asc",
      page: 1,
      pageSize: 75,
    })).toThrow();
    expect(() => subscriptionsQuerySchema.parse({
      platform: "all",
      sort: "renewalDate",
      order: "asc",
      page: 1,
      pageSize: 25,
      renewalFrom: "2026-12-31",
      renewalTo: "2026-01-01",
    })).toThrow();
  });

  test("allows only the clarified subscription actions and conditional fields", () => {
    expect(subscriptionStatusSchema.options).toContain("cancel_at_period_end");
    expect(() => subscriptionActionRequestSchema.parse({
      action: "change_plan",
      reason: "operator reviewed",
      targetPlanId: "PLAN-Basic",
      effectiveTiming: "immediate",
      expectedCurrentState: "active",
      confirmationToken: "TOKEN-MOCK-20260728",
    })).not.toThrow();
    expect(() => subscriptionActionRequestSchema.parse({
      action: "refund",
      reason: "not allowed",
      expectedCurrentState: "active",
      confirmationToken: "TOKEN-MOCK-20260728",
    })).toThrow();
    expect(() => subscriptionActionRequestSchema.parse({
      action: "record_internal_note",
      reason: "operator reviewed",
      expectedCurrentState: "active",
      confirmationToken: "TOKEN-MOCK-20260728",
    })).toThrow();
  });

  test("validates plan and promotional mutations without provider secrets", () => {
    const plan = billingFixtures.planDetails[1];
    expect(() => planMutationRequestSchema.parse({
      price: plan.price,
      interval: plan.interval,
      limits: plan.limits,
      active: plan.active,
      providerPriceLabel: plan.providerPriceLabel,
      reason: "operator reviewed",
      confirmationToken: "TOKEN-MOCK-20260728",
    })).not.toThrow();
    expect(() => promotionalCodeMutationRequestSchema.parse({
      ...billingFixtures.promotionalCodeDetails[0],
      reason: "operator reviewed",
      confirmationToken: "TOKEN-MOCK-20260728",
      rawPayload: "forbidden",
    })).toThrow();
  });

  test("sanitizes payment event detail and rejects forbidden preview fields", () => {
    const event = paymentEventDetailSchema.parse(billingFixtures.paymentEventDetail);
    expect(event.payloadPreview).not.toHaveProperty("card");
    expect(event.payloadPreview).not.toHaveProperty("token");
    expect(event.payloadPreview).not.toHaveProperty("signature");
    expect(() => paymentEventDetailSchema.parse({
      ...billingFixtures.paymentEventDetail,
      payloadPreview: { ...billingFixtures.paymentEventDetail.payloadPreview, rawPayload: "{}" },
    })).toThrow();
  });

  test("validates failed-payment and reconciliation action allowlists", () => {
    expect(() => failedPaymentActionRequestSchema.parse({
      action: "prepare_retry_handoff",
      reason: "operator reviewed",
      scope: "FAIL-001",
      expectedCurrentState: "open",
      confirmationToken: "TOKEN-MOCK-20260728",
    })).not.toThrow();
    expect(() => failedPaymentActionRequestSchema.parse({
      action: "charge_now",
      reason: "not allowed",
      scope: "FAIL-001",
      expectedCurrentState: "open",
      confirmationToken: "TOKEN-MOCK-20260728",
    })).toThrow();
    expect(() => reconciliationActionRequestSchema.parse({
      decision: "mark_reviewing",
      reason: "operator reviewed",
      expectedIssueState: "open",
      providerFreshness: "fresh",
      confirmationToken: "TOKEN-MOCK-20260728",
    })).not.toThrow();
  });

  test("keeps shared action results safe and audit-planned", () => {
    expect(() => billingActionResultSchema.parse({
      id: "SUB-123",
      previousState: "active",
      currentState: "cancel_at_period_end",
      outcome: "simulated_success",
      timestamp: "2026-07-28T12:00:00+03:00",
      message: "Mock action only.",
      plannedAuditReference: "AUD-MOCK-20260728",
    })).not.toThrow();
  });
});
