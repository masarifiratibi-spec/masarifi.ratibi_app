import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import type {
  Currency,
  PaymentEventListItem,
  SanitizedPaymentPayloadPreview,
  SubscriptionListItem,
} from "@/features/billing/contracts";
import {
  PaymentEventPayloadPreview,
  PaymentEventRows,
  SubscriptionCards,
  SubscriptionRows,
} from "@/features/billing/BillingViews";

function money(amount: number, currency: Currency) {
  return { amount, currency };
}

const maskedSubscriptions: SubscriptionListItem[] = [
  {
    id: "SUB-901",
    customer: {
      customerId: "USR-901",
      displayName: "مشغل الفوترة التجريبي",
      maskedEmail: "n***@example.test",
      platform: "ios",
    },
    plan: "Premium",
    status: "active",
    provider: "stripe_mock",
    renewalDate: "2026-08-28T00:00:00+03:00",
    amount: money(99.99, "AED"),
    cancelAtPeriodEnd: false,
    paymentStatus: "paid",
    permittedActions: ["change_plan", "set_cancel_at_period_end", "record_internal_note"],
  },
  {
    id: "SUB-902",
    customer: {
      customerId: "USR-902",
      displayName: "متعدد المنصات",
      maskedEmail: "m***@example.test",
      platform: "multi_platform",
    },
    plan: "Basic",
    status: "past_due",
    provider: "stripe_mock",
    renewalDate: "2026-07-25T00:00:00+03:00",
    amount: money(49.99, "SAR"),
    cancelAtPeriodEnd: false,
    paymentStatus: "failed",
    permittedActions: ["change_plan", "set_cancel_at_period_end", "record_internal_note"],
  },
];

const maskedEvents: PaymentEventListItem[] = [
  {
    id: "EVT-20260728-901",
    customer: {
      customerId: "USR-901",
      displayName: "مشغل الفوترة التجريبي",
      maskedEmail: "n***@example.test",
      platform: "ios",
    },
    subscriptionId: "SUB-901",
    eventType: "renewal",
    amount: money(99.99, "AED"),
    provider: "stripe_mock",
    status: "processed",
    receivedAt: "2026-07-28T00:00:00+03:00",
    processedAt: "2026-07-28T00:01:30+03:00",
    retryCount: 0,
  },
];

describe("subscription visible rows and cards", () => {
  test("rows render masked customer, safe ids, explicit currency, and plan links", () => {
    const html = renderToStaticMarkup(<table><tbody><SubscriptionRows subscriptions={maskedSubscriptions} /></tbody></table>);

    expect(html).toContain("/admin/subscriptions/SUB-901");
    expect(html).toContain("n***@example.test");
    expect(html).toContain("AED");
    expect(html).toContain("SAR");
    expect(html).toContain("متعدد المنصات");
    expect(html).not.toMatch(/[a-z0-9._%+-]+@(?!example\.test)/i);
    expect(html).not.toMatch(/\b4[0-9]{12}\b|\bcvv\b|\bpan\b/i);
  });

  test("rows render customer values as escaped plain text", () => {
    const unsafe: SubscriptionListItem[] = [
      {
        ...maskedSubscriptions[0],
        customer: {
          ...maskedSubscriptions[0].customer,
          displayName: "<script>steal()</script>",
          maskedEmail: "x***@example.test",
        },
      },
    ];
    const html = renderToStaticMarkup(<table><tbody><SubscriptionRows subscriptions={unsafe} /></tbody></table>);

    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });

  test("mobile cards expose masked summaries and currency labels", () => {
    const html = renderToStaticMarkup(<SubscriptionCards subscriptions={maskedSubscriptions} />);

    expect(html).toContain("mobile-cards");
    expect(html).toContain("/admin/subscriptions/SUB-902");
    expect(html).toContain("البريد المقنع");
    expect(html).toContain("SAR");
    expect(html).not.toMatch(/[a-z0-9._%+-]+@(?!example\.test)/i);
  });
});

describe("payment event visible rows", () => {
  test("rows render masked user, retry count, and detail link", () => {
    const html = renderToStaticMarkup(<table><tbody><PaymentEventRows events={maskedEvents} /></tbody></table>);

    expect(html).toContain("/admin/payments/events/EVT-20260728-901");
    expect(html).toContain("n***@example.test");
    expect(html).toContain("renewal");
    expect(html).not.toMatch(/\bcvv\b|\bcard_number\b|\btoken\b/i);
  });
});

describe("payment event sanitized payload preview", () => {
  const preview: SanitizedPaymentPayloadPreview = {
    eventId: "EVT-20260728-901",
    eventType: "invoice.payment_succeeded",
    status: "succeeded",
    receivedAt: "2026-07-28T00:00:00+03:00",
    processedAt: "2026-07-28T00:01:30+03:00",
    amount: money(99.99, "AED"),
    subscriptionReference: "SUB-901",
    retryCount: 2,
    providerErrorCode: "card_declined",
    providerErrorMessage: "Customer card was declined",
  };

  test("renders only the allowlisted fields as plain text", () => {
    const html = renderToStaticMarkup(<PaymentEventPayloadPreview preview={preview} />);

    expect(html).toContain("EVT-20260728-901");
    expect(html).toContain("SUB-901");
    expect(html).toContain("AED");
    expect(html).toContain("card_declined");
    expect(html).not.toContain("rawPayload");
    expect(html).not.toContain("cvv");
    expect(html).not.toContain("token");
    expect(html).not.toContain("signature");
    expect(html).not.toContain("billing_address");
    expect(html).not.toContain("webhook");
    expect(html).not.toContain("424242424242");
  });

  test("escapes unsafe provider error text instead of interpreting markup", () => {
    const unsafe: SanitizedPaymentPayloadPreview = {
      ...preview,
      providerErrorMessage: "<img src=x onerror=alert(1)>",
    };
    const html = renderToStaticMarkup(<PaymentEventPayloadPreview preview={unsafe} />);

    expect(html).not.toContain("<img");
    expect(html).toContain("&lt;img");
  });
});
