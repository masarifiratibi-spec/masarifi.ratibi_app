import { describe, expect, test } from "vitest";
import { getLiveNavigation, permittedNavigation } from "./navigation";
import { buildSidebarSections, resolveRoutePermission, strongestActiveRoute } from "@/components/admin/shell-state";

describe("live Admin navigation", () => {
  test("makes existing feedback discoverable only with its read permission", () => {
    const permitted = permittedNavigation(getLiveNavigation(), new Set(["feedback.read"]));
    const sections = buildSidebarSections(permitted, "/admin/feedback");
    const feedback = sections.flatMap(section => section.items).find(item => item.id === "feedback-overview");
    expect(feedback?.kind).toBe("item");
    if (feedback?.kind !== "item") throw new Error("Missing permitted feedback link");
    expect(feedback.item).toMatchObject({ route: "/admin/feedback", permission: "feedback.read", iconKey: "message-square" });
    expect(permittedNavigation(getLiveNavigation(), new Set(["support.overview.read"]))
      .flatMap(group => group.items).some(item => item.route === "/admin/feedback")).toBe(false);
  });
  test("exposes completed customer, support and governance capabilities with their exact read permissions", () => {
    const items = getLiveNavigation().flatMap((group) => group.items);
    for (const [route,permission] of [["/admin/users","users.read"],["/admin/support","support.overview.read"],
      ["/admin/support/tickets","support.tickets.read"],["/admin/access-requests","support.access.read"],
      ["/admin/audit","audit.logs.read"],["/admin/data-requests/exports","data_requests.exports.read"]])
      expect(items.find((item) => item.route === route)?.permission).toBe(permission);
    expect(resolveRoutePermission("/admin/support")).toBe("support.overview.read");
    expect(resolveRoutePermission("/admin/support/tickets/11000000-0000-4000-8000-000000000001")).toBe("support.tickets.detail.read");
    expect(items.some((item) => item.route?.startsWith("/admin/payments") || item.route?.startsWith("/admin/notifications/campaigns/new"))).toBe(false);
  });
  test("exposes a separate social media destination with operational read permission", () => {
    const path = "/admin/social-media";
    expect(getLiveNavigation().flatMap(group => group.items).find(item => item.route === path)).toMatchObject({ id: "social-media", permission: "operations.settings.read" });
    expect(resolveRoutePermission(path)).toBe("operations.settings.read");
  });
  test("opens AI Usage Limits within System Health and selects its own destination", () => {
    const path = "/admin/system-health/ai-usage-limits";
    const sections = buildSidebarSections(getLiveNavigation(), path);
    const platform = sections.find((section) => section.id === "health");
    expect(platform?.items.map((item) => item.id)).toEqual(["system-health"]);
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
