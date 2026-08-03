import { describe, expect, test } from "vitest";
import { ADMIN_ROLES, PERMISSION_KEYS, type AdminRole, type PermissionKey } from "./permissions";
import { hasPermission } from "./role-map";

const PHASE7_PERMISSIONS: PermissionKey[] = [
  "security.events.read",
  "security.incidents.manage",
  "security.admins.read",
  "security.permissions.read",
  "security.support_access.read",
  "security.support_access.revoke",
  "audit.logs.read",
  "data_requests.exports.read",
  "data_requests.exports.manage",
  "data_requests.deletions.read",
  "data_requests.deletions.manage",
  "data_retention.read",
  "data_retention.manage",
];

describe("Phase 7 security, audit, and privacy permissions", () => {
  test("all Phase 7 permission keys are registered", () => {
    for (const permission of PHASE7_PERMISSIONS) {
      expect(PERMISSION_KEYS).toContain(permission);
    }
  });

  test("Super Admin and Security Administrator have full Phase 7 access", () => {
    for (const role of ["super-admin", "security-administrator"] as const) {
      for (const permission of PHASE7_PERMISSIONS) {
        expect(hasPermission(role, permission)).toBe(true);
      }
    }
  });

  test("other roles have no direct Phase 7 route access", () => {
    const deniedRoles: AdminRole[] = ADMIN_ROLES.filter(
      (role) => role !== "super-admin" && role !== "security-administrator",
    );

    for (const role of deniedRoles) {
      for (const permission of PHASE7_PERMISSIONS) {
        expect(hasPermission(role, permission)).toBe(false);
      }
    }
  });

  test("Support Agent retains prior own-access permissions without Phase 7 route grants", () => {
    expect(hasPermission("support-agent", "support.access.read")).toBe(true);
    expect(hasPermission("support-agent", "support.access.revoke")).toBe(true);
    expect(hasPermission("support-agent", "security.support_access.read")).toBe(false);
    expect(hasPermission("support-agent", "security.support_access.revoke")).toBe(false);
  });

  test("Billing Operator receives no direct data-request route permission", () => {
    expect(hasPermission("billing-operator", "subscriptions.read")).toBe(true);
    expect(hasPermission("billing-operator", "data_requests.deletions.read")).toBe(false);
    expect(hasPermission("billing-operator", "data_requests.exports.read")).toBe(false);
  });
});
