import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import { DateRangeControl } from "@/components/admin/DateRangeControl";
import { buildOverviewSummary, buildPlatformAnalytics, overviewActivityFixture } from "@/mocks/fixtures/overview";

describe("admin overview Spec 002 page data", () => {
  test("uses All Platforms and 30 days as the default combined scope", () => {
    const summary = buildOverviewSummary("all", "30d");
    const unique = summary.metrics.find((metric) => metric.id === "unique-customers");

    expect(summary.query).toEqual({ platform: "all", period: "30d", locale: "ar" });
    expect(unique?.numericValue).toBe(128450);
    expect(summary.serviceHealth.every((service) => service.platformScope === "global")).toBe(true);
  });

  test("does not derive unique customers by adding iOS and Android audiences", () => {
    const analytics = buildPlatformAnalytics("all", "30d");
    const customers = analytics.customers;

    expect(customers.iosCustomers + customers.androidCustomers).toBeGreaterThan(customers.uniqueCustomersTotal);
    expect(customers.iosOnlyCustomers + customers.androidOnlyCustomers + customers.multiPlatformCustomers).toBe(
      customers.uniqueCustomersTotal,
    );
  });

  test("keeps platform-specific adoption accurate", () => {
    const ios = buildPlatformAnalytics("ios", "30d");
    const android = buildPlatformAnalytics("android", "30d");

    expect(ios.capabilities.map((item) => item.capability)).toEqual(["shortcut", "share-extension"]);
    expect(android.capabilities.map((item) => item.capability)).toEqual([
      "sms-tracking",
      "notification-listener",
    ]);
    expect(ios.capabilities.some((item) => item.capability === "sms-tracking")).toBe(false);
  });

  test("limits the Overview date control to approved reporting presets", () => {
    const html = renderToStaticMarkup(
      <DateRangeControl
        allowedPresets={["7d", "30d", "90d"]}
        value={{ start: "2026-06-28", end: "2026-07-27", preset: "30d" }}
        onChange={() => undefined}
      />,
    );
    const host = document.createElement("div");
    host.innerHTML = html;
    const presetButtons = [...host.querySelectorAll("button")];

    expect(presetButtons.map((button) => button.textContent)).toEqual([
      "آخر 7 أيام",
      "آخر 30 يوما",
      "آخر 90 يوما",
    ]);
    expect(presetButtons[1]?.getAttribute("aria-pressed")).toBe("true");
    expect(host.querySelector('input[type="date"]')).toBeNull();
  });

  test("activity remains bounded and sanitized", () => {
    expect(overviewActivityFixture.length).toBeGreaterThan(10);
    expect(overviewActivityFixture.every((item) => !/[@]|token|provider payload/i.test(item.summary))).toBe(true);
  });
});
