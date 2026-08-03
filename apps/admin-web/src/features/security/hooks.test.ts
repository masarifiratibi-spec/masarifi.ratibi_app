import { describe, expect, test } from "vitest";
import { securityActionLockKey, securityQueryKeys } from "./hooks";

describe("Phase 7 security hook foundations", () => {
  test("scopes every query key by Phase 7, role, resource, and validated input", () => {
    expect(securityQueryKeys.overview("security-administrator", { platform: "all", period: "30d" })).toEqual([
      "phase7-security",
      "security-administrator",
      "overview",
      { platform: "all", period: "30d" },
    ]);

    expect(securityQueryKeys.list("super-admin", "audit", { page: 1, pageSize: 25 })).toEqual([
      "phase7-security",
      "super-admin",
      "audit",
      { page: 1, pageSize: 25 },
    ]);

    expect(securityQueryKeys.detail("support-agent", "export", "EXP-1001")).toEqual([
      "phase7-security",
      "support-agent",
      "export",
      "EXP-1001",
    ]);
  });

  test("keeps resources, roles, filters, and action locks isolated", () => {
    expect(securityQueryKeys.list("super-admin", "exports", { page: 1, pageSize: 25 })).not.toEqual(
      securityQueryKeys.list("super-admin", "deletions", { page: 1, pageSize: 25 }),
    );
    expect(securityQueryKeys.list("super-admin", "audit", { page: 1, pageSize: 25 })).not.toEqual(
      securityQueryKeys.list("security-administrator", "audit", { page: 1, pageSize: 25 }),
    );
    expect(securityQueryKeys.list("super-admin", "audit", { page: 1, pageSize: 25 })).not.toEqual(
      securityQueryKeys.list("super-admin", "audit", { page: 2, pageSize: 25 }),
    );
    expect(securityActionLockKey("exports", "EXP-1001", "simulate-download")).toBe(
      "phase7:exports:EXP-1001:simulate-download",
    );
  });
});
