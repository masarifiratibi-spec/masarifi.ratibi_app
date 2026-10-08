import { describe, expect, test } from "vitest";
import { getLiveNavigation } from "./navigation";
import { buildSidebarSections, resolveRoutePermission, strongestActiveRoute } from "@/components/admin/shell-state";

describe("live Admin navigation", () => {
  test("opens AI Usage Limits within System Health and selects its own destination", () => {
    const path = "/admin/system-health/ai-usage-limits";
    const sections = buildSidebarSections(getLiveNavigation(), path);
    const platform = sections.find((section) => section.id === "platform");
    expect(platform?.items.map((item) => item.id)).toEqual(["overview", "system-health"]);
    const health = platform?.items.find((item) => item.id === "system-health");
    expect(health?.kind).toBe("accordion");
    if (health?.kind !== "accordion") throw new Error("Missing System Health menu");
    expect(health.defaultOpen).toBe(true);
    const limits = health.items.find((item) => item.id === "ai-usage-limits");
    expect(limits?.kind).toBe("item");
    if (limits?.kind !== "item") throw new Error("Missing quota destination");
    expect(limits.item.route).toBe(path);
    expect(limits.item.permission).toBe("operations.settings.read");
    expect(strongestActiveRoute(path, health.items)).toBe(path);
  });

  test("protects the quota page with its existing operational read permission", () => {
    expect(resolveRoutePermission("/admin/system-health/ai-usage-limits")).toBe("operations.settings.read");
    expect(resolveRoutePermission("/admin/system-health/providers")).toBe("system-health.providers.read");
  });

  test("keeps backend-supported routes and hides mock-only routes", () => {
    const itemIds = getLiveNavigation().flatMap((group) =>
      group.items.map((item) => item.id),
    );

    expect(itemIds).toEqual(
      expect.arrayContaining([
        "overview",
        "health",
        "jobs",
        "imports",
        "parsers",
        "ai",
        "security",
        "admin-team",
        "roles",
        "settings",
      ]),
    );
    expect(itemIds).not.toEqual(
      expect.arrayContaining([
        "users",
        "access-requests",
        "subscriptions",
        "payments",
        "audit-logs",
        "data-requests",
      ]),
    );
    expect(getLiveNavigation().every((group) => group.items.length > 0)).toBe(
      true,
    );
  });
});
