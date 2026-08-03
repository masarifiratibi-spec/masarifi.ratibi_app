import { describe, expect, test } from "vitest";
import { governanceRepository } from "./repository";

describe("US1 governance repository", () => {
  test("lists admins, details, and invitations through strict safe responses", async () => {
    await expect(governanceRepository.listAdminUsers({ page: 1, pageSize: 25 }))
      .resolves.toMatchObject({ items: expect.arrayContaining([expect.objectContaining({ id: "ADM-DEMO-SUPER-01" })]) });
    await expect(governanceRepository.getAdminUser("ADM-DEMO-SECURITY-02"))
      .resolves.toMatchObject({ id: "ADM-DEMO-SECURITY-02", assignedTickets: { openCount: 2 } });
    await expect(governanceRepository.listAdminInvitations({ page: 1, pageSize: 25 }))
      .resolves.toMatchObject({ items: expect.arrayContaining([expect.objectContaining({ status: "pending" })]) });
  });

  test("creates pending invitations and rejects duplicate normalized emails safely", async () => {
    await expect(governanceRepository.inviteAdmin({
      email: "Repo.Admin@Example.Test",
      name: "Repo Admin",
      roleId: "ROLE-DEMO-SUPPORT",
      department: "Support",
      expiryDays: 7,
      message: "Welcome through a repository test.",
      submissionKey: "SUB-DEMO-REPO-INVITE",
    })).resolves.toMatchObject({ invitation: { status: "pending", maskedEmail: "r***@example.test" } });

    await expect(governanceRepository.inviteAdmin({
      email: "repo.admin@example.test",
      name: "Repo Admin Duplicate",
      roleId: "ROLE-DEMO-SUPPORT",
      department: "Support",
      expiryDays: 7,
      submissionKey: "SUB-DEMO-REPO-DUPLICATE",
    })).rejects.toMatchObject({ status: 409 });
  });

  test("assigns roles, revokes sessions, disables admins, and protects permission/privacy cases", async () => {
    await expect(governanceRepository.assignAdminRoles("ADM-DEMO-SUPPORT-03", {
      adminId: "ADM-DEMO-SUPPORT-03",
      roleIds: ["ROLE-DEMO-SECURITY"],
      reason: "Repository role assignment with version guard.",
      expectedVersion: 1,
      submissionKey: "SUB-DEMO-REPO-ASSIGN",
    })).resolves.toMatchObject({ admin: { version: 2 } });

    await expect(governanceRepository.revokeAdminSessions("ADM-DEMO-SUPPORT-03", {
      adminId: "ADM-DEMO-SUPPORT-03",
      sessionIds: ["ASES-DEMO-SUPPORT-03"],
      revokeAllEligible: false,
      reason: "Repository session revoke with version guard.",
      expectedVersion: 2,
      submissionKey: "SUB-DEMO-REPO-REVOKE",
    })).resolves.toMatchObject({ revokedSessionIds: ["ASES-DEMO-SUPPORT-03"] });

    await expect(governanceRepository.disableAdmin("ADM-DEMO-SECURITY-02", {
      adminId: "ADM-DEMO-SECURITY-02",
      reason: "Repository disable with replacement selection.",
      revokeEligibleSessions: true,
      replacementAdminId: "ADM-DEMO-SUPPORT-03",
      expectedStatus: "active",
      expectedVersion: 1,
      submissionKey: "SUB-DEMO-REPO-DISABLE",
    })).resolves.toMatchObject({ admin: { status: "disabled" } });

    await expect(governanceRepository.getAdminUser("ADM-DEMO-MISSING-99")).rejects.toMatchObject({ status: 404 });
    window.sessionStorage.setItem("admin-simulated-role", "billing-operator");
    await expect(governanceRepository.listAdminUsers({ page: 1, pageSize: 25 })).rejects.toMatchObject({ status: 403 });
  });
});

describe("US2 role repository", () => {
  test("lists, reads, creates, updates roles, and reads permission matrix", async () => {
    await expect(governanceRepository.listRoles({ page: 1, pageSize: 25 }))
      .resolves.toMatchObject({ items: expect.arrayContaining([expect.objectContaining({ id: "ROLE-DEMO-SUPER", kind: "system" })]) });
    await expect(governanceRepository.getRole("ROLE-DEMO-CUSTOM-RISK"))
      .resolves.toMatchObject({ kind: "custom", assignmentCount: 0 });
    await expect(governanceRepository.getRole("ROLE-DEMO-CUSTOM-01"))
      .resolves.toMatchObject({ id: "ROLE-DEMO-CUSTOM-RISK", kind: "custom" });
    await expect(governanceRepository.getPermissionMatrix({ page: 1, pageSize: 25 }))
      .resolves.toMatchObject({ permissionCount: expect.any(Number) });

    const created = await governanceRepository.createRole({
      key: "repository-reviewer",
      name: { ar: "Repository Reviewer", en: "Repository Reviewer" },
      description: "Repository-created least privilege role.",
      permissionKeys: ["admin-team.read"],
      reason: "Create role through repository test.",
      submissionKey: "SUB-DEMO-REPO-ROLE-CREATE",
    }) as { role: { id: string; version: number } };
    expect(created.role.version).toBe(1);
    await expect(governanceRepository.updateRole(created.role.id, {
      status: "disabled",
      reason: "Disable unassigned repository role.",
      expectedVersion: 1,
      submissionKey: "SUB-DEMO-REPO-ROLE-DISABLE",
    })).resolves.toMatchObject({ role: { status: "disabled" } });
  });

  test("protects role permissions, immutable system roles, stale versions, and duplicate keys", async () => {
    await expect(governanceRepository.updateRole("ROLE-DEMO-SUPER", {
      status: "disabled",
      reason: "System role mutation must be rejected.",
      expectedVersion: 1,
      submissionKey: "SUB-DEMO-REPO-SYSTEM",
    })).rejects.toMatchObject({ status: 409 });

    await expect(governanceRepository.createRole({
      key: "risk-reviewer",
      name: { ar: "Duplicate", en: "Duplicate" },
      description: "Duplicate custom role key rejected.",
      permissionKeys: ["admin-team.read"],
      reason: "Duplicate role key should fail safely.",
      submissionKey: "SUB-DEMO-REPO-ROLE-DUPE",
    })).rejects.toMatchObject({ status: 409 });

    window.sessionStorage.setItem("admin-simulated-role", "support-agent");
    await expect(governanceRepository.listRoles({ page: 1, pageSize: 25 })).rejects.toMatchObject({ status: 403 });
  });
});

describe("US3 settings repository", () => {
  test("gets and atomically updates six settings groups", async () => {
    for (const group of ["general", "mobile", "imports", "ai", "subscriptions", "security"] as const) {
      await expect(governanceRepository.getSettingsGroup(group)).resolves.toMatchObject({ group, version: 1 });
    }
    await expect(governanceRepository.updateSettingsGroup("mobile", {
      expectedVersion: 1,
      changes: { forceUpdate: true },
      reason: "Repository changed-fields-only settings update.",
      submissionKey: "SUB-DEMO-REPO-SETTINGS-MOBILE",
    })).resolves.toMatchObject({ group: "mobile", version: 2, values: { forceUpdate: true } });
  });

  test("rejects invalid group, stale settings, invalid payload, and unauthorized reads safely", async () => {
    expect(() => governanceRepository.getSettingsGroup("unknown")).toThrow();
    await expect(governanceRepository.updateSettingsGroup("security", {
      expectedVersion: 9,
      changes: { sessionMinutes: 90 },
      reason: "Stale settings update should be rejected.",
      submissionKey: "SUB-DEMO-REPO-SETTINGS-STALE",
    })).rejects.toMatchObject({ status: 409 });
    await expect(governanceRepository.updateSettingsGroup("security", {
      expectedVersion: 1,
      changes: { riskThresholds: { low: 90, medium: 50, high: 80 } },
      reason: "Invalid thresholds should be rejected.",
      submissionKey: "SUB-DEMO-REPO-SETTINGS-INVALID",
    })).rejects.toMatchObject({ status: 400 });
    window.sessionStorage.setItem("admin-simulated-role", "support-agent");
    await expect(governanceRepository.getSettingsGroup("security")).rejects.toMatchObject({ status: 403 });
  });
});

describe("US4 flag and maintenance repository", () => {
  test("lists and updates feature flags and maintenance", async () => {
    await expect(governanceRepository.listFeatureFlags({ page: 1, pageSize: 25 }))
      .resolves.toMatchObject({ items: expect.arrayContaining([expect.objectContaining({ id: "FLAG-DEMO-IOS-SHORTCUT" })]) });
    await expect(governanceRepository.updateFeatureFlag("FLAG-DEMO-IOS-SHORTCUT", {
      audience: "all_customers",
      rolloutPercent: 30,
      expectedVersion: 1,
      reason: "Repository flag update.",
      submissionKey: "SUB-DEMO-REPO-FLAG",
    })).resolves.toMatchObject({ flag: { rolloutPercent: 30 } });
    await expect(governanceRepository.getMaintenance()).resolves.toMatchObject({ state: "off", mockOnly: true });
    await expect(governanceRepository.updateMaintenance({
      nextState: "scheduled",
      message: { ar: "Scheduled maintenance", en: "Scheduled maintenance" },
      startsAt: "2026-08-02T12:00:00+03:00",
      endsAt: "2026-08-02T13:00:00+03:00",
      expectedVersion: 1,
      reason: "Schedule maintenance through repository.",
      submissionKey: "SUB-DEMO-REPO-MAINTENANCE",
    })).resolves.toMatchObject({ maintenance: { state: "scheduled" } });
  });

  test("rejects ended flags and invalid maintenance transitions", async () => {
    await expect(governanceRepository.updateFeatureFlag("FLAG-DEMO-ENDED", {
      rolloutPercent: 90,
      expectedVersion: 1,
      reason: "Ended flags are read-only.",
      submissionKey: "SUB-DEMO-REPO-FLAG-ENDED",
    })).rejects.toMatchObject({ status: 409 });
    await expect(governanceRepository.updateMaintenance({
      nextState: "off",
      message: { ar: "Already off", en: "Already off" },
      expectedVersion: 1,
      reason: "Off to off is rejected.",
      submissionKey: "SUB-DEMO-REPO-MAINTENANCE-OFF",
    })).rejects.toMatchObject({ status: 409 });
  });
});
