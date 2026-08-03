import { describe, expect, test } from "vitest";
import {
  billingQueryKeys,
  failedPaymentMutationLockKeys,
  reconciliationMutationLockKeys,
  subscriptionMutationLockKeys,
} from "./hooks";

describe("billing query keys", () => {
  test("produces stable, schema-normalized overview keys with defaults", () => {
    expect(billingQueryKeys.overview({ period: "30d", platform: "all" })).toEqual([
      "billing",
      "overview",
      { period: "30d", platform: "all" },
    ]);
    expect(billingQueryKeys.overview({ period: "30d", platform: "all", currency: "AED" })).not.toEqual(
      billingQueryKeys.overview({ period: "30d", platform: "all" }),
    );
  });

  test("isolates subscription list keys by platform and pagination", () => {
    const base = billingQueryKeys.subscriptions({ platform: "all", sort: "renewalDate", order: "asc", page: 1, pageSize: 25 });
    const paged = billingQueryKeys.subscriptions({ platform: "all", sort: "renewalDate", order: "asc", page: 2, pageSize: 25 });
    const ios = billingQueryKeys.subscriptions({ platform: "ios", sort: "renewalDate", order: "asc", page: 1, pageSize: 25 });

    expect(base).not.toEqual(paged);
    expect(base).not.toEqual(ios);
    expect(ios.at(-1)).toMatchObject({ platform: "ios" });
  });

  test("isolates detail keys by validated identifier", () => {
    expect(billingQueryKeys.subscription({ subscriptionId: "SUB-123" })).not.toEqual(
      billingQueryKeys.subscription({ subscriptionId: "SUB-124" }),
    );
    expect(billingQueryKeys.paymentEvent({ eventId: "EVT-20260728-001" }).at(-1)).toMatchObject({
      eventId: "EVT-20260728-001",
    });
  });

  test("keeps plan, promo, payment, failure, and reconciliation keys namespaced", () => {
    expect(billingQueryKeys.plans()).toEqual(["billing", "plans"]);
    expect(billingQueryKeys.promotionalCodes({ page: 1, pageSize: 25 }).at(0)).toBe("billing");
    expect(billingQueryKeys.paymentsOverview({ period: "30d", platform: "all" }).at(1)).toBe("paymentsOverview");
    expect(billingQueryKeys.paymentEvents({ platform: "all", sort: "date", order: "desc", page: 1, pageSize: 25 }).at(1)).toBe("paymentEvents");
    expect(billingQueryKeys.failedPayments({ platform: "all", sort: "date", order: "desc", page: 1, pageSize: 25 }).at(1)).toBe("failedPayments");
    expect(billingQueryKeys.reconciliation({ platform: "all", sort: "age", order: "desc", page: 1, pageSize: 25 }).at(1)).toBe("reconciliation");
  });
});

describe("billing mutation lock keys", () => {
  test("scopes subscription locks by id and action", () => {
    expect(subscriptionMutationLockKeys.action("SUB-123", "change_plan"))
      .toBe("subscription:action:SUB-123:change_plan");
    expect(subscriptionMutationLockKeys.action("SUB-123", "change_plan"))
      .not.toBe(subscriptionMutationLockKeys.action("SUB-123", "resume"));
  });

  test("scopes failed-payment and reconciliation locks by id and operation", () => {
    expect(failedPaymentMutationLockKeys.action("FAIL-001", "mark_reviewed"))
      .toBe("failedPayment:action:FAIL-001:mark_reviewed");
    expect(reconciliationMutationLockKeys.action("REC-001", "mark_reviewing"))
      .toBe("reconciliation:action:REC-001:mark_reviewing");
  });
});
