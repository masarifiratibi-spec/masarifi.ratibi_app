import { describe, expect, test } from "vitest";
import { ADMIN_ROLES, type PermissionKey } from "@/core/permissions/permissions";
import { hasPermission } from "@/core/permissions/role-map";
import { navigationFixture } from "@/mocks/fixtures/foundation";
import {
  directionForLocale,
  environmentLabel,
  isActiveRoute,
  nextTheme,
  resolveRoutePermission,
  roleLabel,
  usesMobileDrawer,
} from "./shell-state";

describe("admin shell state", () => {
  test("keeps active and planned navigation explicit", () => {
    const items = navigationFixture.flatMap((group) => group.items);
    expect(items.filter((item) => item.availability === "active")).toHaveLength(44);
    expect(navigationFixture.find((group) => group.id === "communications")?.items).toHaveLength(22);
    expect(navigationFixture.find((group) => group.id === "governance")?.items.map((item) => item.id)).toEqual([
      "security",
      "audit-logs",
      "data-requests",
      "admin-team",
      "roles",
      "settings",
    ]);
    expect(items.filter((item) => item.availability === "planned")).toHaveLength(0);
    expect(isActiveRoute("/admin/users", "/admin/users")).toBe(true);
    expect(isActiveRoute("/admin/users/USR-1", "/admin/users")).toBe(true);
    expect(isActiveRoute("/admin/users", "/admin")).toBe(false);
  });

  test("includes a permitted access requests navigation item", () => {
    const item = navigationFixture
      .flatMap((group) => group.items)
      .find((entry) => entry.id === "access-requests");
    expect(item?.availability).toBe("active");
    expect(item?.route).toBe("/admin/access-requests");
    expect(item?.permission).toBe("support.access.read");
  });

  test("activates Phase 8 Jobs and operational destinations with route permissions", () => {
    const items = navigationFixture.flatMap((group) => group.items);
    expect(items.find((item) => item.id === "jobs")).toMatchObject({
      availability: "active",
      route: "/admin/jobs/queues",
      permission: "jobs.queues.read",
    });
    expect(items.find((item) => item.id === "health-api")).toMatchObject({
      availability: "active",
      route: "/admin/system-health/api",
      permission: "system-health.api.read",
    });
    expect(items.find((item) => item.id === "health-providers")).toMatchObject({
      availability: "active",
      route: "/admin/system-health/providers",
      permission: "system-health.providers.read",
    });
    expect(items.find((item) => item.id === "job-runs")).toMatchObject({
      availability: "active",
      route: "/admin/jobs/runs",
      permission: "jobs.runs.read",
    });
    expect(items.find((item) => item.id === "scheduled-jobs")).toMatchObject({
      availability: "active",
      route: "/admin/jobs/scheduled",
      permission: "jobs.schedules.read",
    });
  });

  test("activates Spec 010 governance navigation entries", () => {
    const governanceItems = navigationFixture.find((group) => group.id === "governance")?.items ?? [];
    expect(governanceItems.map((item) => item.id)).toEqual([
      "security",
      "audit-logs",
      "data-requests",
      "admin-team",
      "roles",
      "settings",
    ]);
    expect(governanceItems.find((item) => item.id === "admin-team")).toMatchObject({
      availability: "active",
      route: "/admin/admin-team",
      permission: "admin-team.read",
      labelKey: "Admin Team",
    });
    expect(governanceItems.find((item) => item.id === "roles")).toMatchObject({
      availability: "active",
      route: "/admin/roles",
      permission: "roles.read",
      labelKey: "Roles and Permissions",
    });
    expect(governanceItems.find((item) => item.id === "settings")).toMatchObject({
      availability: "active",
      route: "/admin/settings",
      permission: "settings.general.read",
      labelKey: "System Settings",
    });
  });

  test("marks Spec 010 child routes active under their governance navigation item", () => {
    expect(isActiveRoute("/admin/admin-team/ADM-DEMO-SECURITY-02", "/admin/admin-team")).toBe(true);
    expect(isActiveRoute("/admin/roles/ROLE-DEMO-SUPPORT", "/admin/roles")).toBe(true);
    expect(isActiveRoute("/admin/settings/security", "/admin/settings")).toBe(true);
  });

  test("role filtering follows Spec 010 governance permissions", () => {
    expect(hasPermission("super-admin", "admin-team.read" as PermissionKey)).toBe(true);
    expect(hasPermission("security-administrator", "admin-team.read" as PermissionKey)).toBe(true);
    expect(hasPermission("security-administrator", "roles.manage" as PermissionKey)).toBe(false);
    expect(hasPermission("security-administrator", "settings.security.manage" as PermissionKey)).toBe(true);
    for (const role of ["support-agent", "billing-operator", "import-operator", "ai-operator", "content-manager"] as const) {
      expect(hasPermission(role, "admin-team.read" as PermissionKey)).toBe(false);
      expect(hasPermission(role, "settings.general.read" as PermissionKey)).toBe(false);
    }
  });

  test("role-filtered Phase 8 destinations follow the permission matrix", () => {
    expect(hasPermission("super-admin", "jobs.queues.read" as PermissionKey)).toBe(true);
    expect(hasPermission("security-administrator", "jobs.runs.retry" as PermissionKey)).toBe(false);
    expect(hasPermission("billing-operator", "jobs.runs.cancel" as PermissionKey)).toBe(false);
    expect(hasPermission("billing-operator", "jobs.schedules.read" as PermissionKey)).toBe(true);
    expect(hasPermission("support-agent", "jobs.runs.read" as PermissionKey)).toBe(false);
  });

  test("resolves route permissions including dynamic phase 2 routes", () => {
    expect(resolveRoutePermission("/admin/users")).toBe("users.read");
    expect(resolveRoutePermission("/admin/users/USR-10482")).toBe("users.read");
    expect(resolveRoutePermission("/admin/access-requests")).toBe("support.access.read");
    expect(resolveRoutePermission("/admin/access-requests/ACC-001")).toBe("support.access.read");
    expect(resolveRoutePermission("/admin/access-requests/ACC-001/workspace")).toBe("support.access.use");
    expect(resolveRoutePermission("/admin/imports")).toBe("imports.read");
    expect(resolveRoutePermission("/admin/system-health")).toBe("system-health.read");
    expect(resolveRoutePermission("/admin")).toBe("admin.overview.read");
    expect(resolveRoutePermission("/unknown")).toBeUndefined();
  });

  test("resolves billing routes to their least-privileged permissions with detail precedence", () => {
    expect(resolveRoutePermission("/admin/subscriptions")).toBe("subscriptions.read");
    expect(resolveRoutePermission("/admin/subscriptions/SUB-123")).toBe("subscriptions.detail.read");
    expect(resolveRoutePermission("/admin/subscriptions/plans")).toBe("plans.read");
    expect(resolveRoutePermission("/admin/subscriptions/promotional-codes")).toBe("promotions.read");

    expect(resolveRoutePermission("/admin/payments")).toBe("payments.read");
    expect(resolveRoutePermission("/admin/payments/events/EVT-20260728-001")).toBe("payments.detail.read");
    expect(resolveRoutePermission("/admin/payments/failed")).toBe("payment_failures.manage");
    expect(resolveRoutePermission("/admin/payments/reconciliation")).toBe("billing_reconciliation.read");
  });

  test("grants billing navigation only to roles with the matching read permission", () => {
    const billingRoles = ["super-admin", "billing-operator"] as const;
    const nonBillingRoles = ["support-agent", "import-operator", "ai-operator", "content-manager"] as const;

    for (const role of billingRoles) {
      expect(hasPermission(role, "subscriptions.read" as PermissionKey)).toBe(true);
      expect(hasPermission(role, "payments.read" as PermissionKey)).toBe(true);
      expect(hasPermission(role, "plans.read" as PermissionKey)).toBe(true);
      expect(hasPermission(role, "promotions.read" as PermissionKey)).toBe(true);
    }
    for (const role of nonBillingRoles) {
      expect(hasPermission(role, "subscriptions.read" as PermissionKey)).toBe(false);
      expect(hasPermission(role, "payments.read" as PermissionKey)).toBe(false);
    }
    expect(hasPermission("security-administrator", "payments.read" as PermissionKey)).toBe(true);
    expect(hasPermission("security-administrator", "billing_reconciliation.read" as PermissionKey)).toBe(true);
    expect(hasPermission("security-administrator", "plans.read" as PermissionKey)).toBe(false);
  });

  test("access requests navigation is hidden for roles without the permission", () => {
    const noAccessRoles = ["billing-operator", "import-operator", "ai-operator", "content-manager"] as const;
    for (const role of noAccessRoles) {
      expect(hasPermission(role, "support.access.read" as PermissionKey)).toBe(false);
    }
    expect(hasPermission("super-admin", "support.access.read" as PermissionKey)).toBe(true);
    expect(hasPermission("support-agent", "support.access.read" as PermissionKey)).toBe(true);
  });

  test("labels every development role", () => {
    expect(ADMIN_ROLES.map(roleLabel)).toEqual([
      "المسؤول الأعلى",
      "وكيل الدعم",
      "مشغل الفوترة",
      "مشغل الاستيراد",
      "مشغل الذكاء الاصطناعي",
      "مدير المحتوى",
      "مسؤول الأمان",
    ]);
  });

  test("maps locale, theme, environment, and mobile breakpoint deterministically", () => {
    expect(directionForLocale("ar")).toBe("rtl");
    expect(directionForLocale("en")).toBe("ltr");
    expect(nextTheme("light")).toBe("dark");
    expect(environmentLabel("development", "ar")).toBe("التطوير");
    expect(usesMobileDrawer(899)).toBe(true);
    expect(usesMobileDrawer(900)).toBe(false);
  });
});
