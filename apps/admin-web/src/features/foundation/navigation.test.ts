import { describe, expect, test } from "vitest";
import { getLiveNavigation } from "./navigation";

describe("live Admin navigation", () => {
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
