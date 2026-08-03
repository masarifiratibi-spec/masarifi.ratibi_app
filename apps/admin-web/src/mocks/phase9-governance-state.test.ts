import { describe, expect, test } from "vitest";
import {
  PHASE9_FIXED_NOW,
  assignPhase9AdminRoles,
  disablePhase9Admin,
  createPhase9Role,
  getPhase9Admin,
  getPhase9PermissionMatrix,
  getPhase9Role,
  getPhase9SettingsGroup,
  getPhase9Maintenance,
  invitePhase9Admin,
  listPhase9Roles,
  listPhase9FeatureFlags,
  listPhase9Invitations,
  nextPhase9Id,
  nextPhase9Version,
  readPhase9GovernanceState,
  resetPhase9GovernanceState,
  revokePhase9AdminSessions,
  updatePhase9Role,
  updatePhase9SettingsGroup,
  updatePhase9FeatureFlag,
  updatePhase9Maintenance,
} from "./phase9-governance-state";

describe("Spec 010 deterministic governance state", () => {
  test("uses the fixed Phase 9 mock clock", () => {
    expect(PHASE9_FIXED_NOW).toBe("2026-08-01T12:00:00+03:00");
  });

  test("reset restores seeded state with fresh deep snapshots", () => {
    resetPhase9GovernanceState();
    const firstSnapshot = readPhase9GovernanceState();
    expect(firstSnapshot.admins.length).toBeGreaterThan(0);
    firstSnapshot.admins[0].displayName = "Mutated";
    const secondSnapshot = readPhase9GovernanceState();
    expect(secondSnapshot.admins[0].displayName).not.toBe("Mutated");
  });

  test("generated IDs repeat after reset", () => {
    resetPhase9GovernanceState();
    const first = nextPhase9Id("INV");
    const second = nextPhase9Id("INV");
    resetPhase9GovernanceState();
    expect([first, second]).toEqual(["INV-DEMO-0001", "INV-DEMO-0002"]);
    expect(nextPhase9Id("INV")).toBe(first);
  });

  test("versions progress exactly once", () => {
    expect(nextPhase9Version(1)).toBe(2);
    expect(nextPhase9Version(41)).toBe(42);
  });
});

describe("US4 flag and maintenance state", () => {
  test("updates editable flags and blocks Ended/stale flag transitions", () => {
    resetPhase9GovernanceState();
    expect(listPhase9FeatureFlags().items).toHaveLength(4);
    expect(updatePhase9FeatureFlag("FLAG-DEMO-IOS-SHORTCUT", {
      audience: "all_customers",
      rolloutPercent: 30,
      expectedVersion: 1,
      reason: "Update rollout for fixed audience.",
      submissionKey: "SUB-DEMO-FLAG-UPDATE",
    }).flag.rolloutPercent).toBe(30);
    expect(() => updatePhase9FeatureFlag("FLAG-DEMO-ENDED", {
      rolloutPercent: 90,
      expectedVersion: 1,
      reason: "Ended flags are immutable.",
      submissionKey: "SUB-DEMO-FLAG-ENDED",
    })).toThrow("ineligible_transition");
    expect(() => updatePhase9FeatureFlag("FLAG-DEMO-IOS-SHORTCUT", {
      rolloutPercent: 40,
      expectedVersion: 1,
      reason: "Stale flag update rejected.",
      submissionKey: "SUB-DEMO-FLAG-STALE",
    })).toThrow("stale_version");
  });

  test("allows only explicit maintenance transitions", () => {
    resetPhase9GovernanceState();
    expect(getPhase9Maintenance().state).toBe("off");
    expect(updatePhase9Maintenance({
      nextState: "scheduled",
      message: { ar: "Scheduled maintenance", en: "Scheduled maintenance" },
      startsAt: "2026-08-02T12:00:00+03:00",
      endsAt: "2026-08-02T13:00:00+03:00",
      expectedVersion: 1,
      reason: "Schedule maintenance safely.",
      submissionKey: "SUB-DEMO-MAINTENANCE-SCHEDULE",
    }).maintenance.state).toBe("scheduled");
    expect(updatePhase9Maintenance({
      nextState: "active",
      message: { ar: "Active maintenance", en: "Active maintenance" },
      startsAt: null,
      endsAt: null,
      expectedVersion: 2,
      reason: "Activate scheduled maintenance safely.",
      submissionKey: "SUB-DEMO-MAINTENANCE-ACTIVE",
    }).maintenance.state).toBe("active");
    expect(() => updatePhase9Maintenance({
      nextState: "scheduled",
      message: { ar: "Backwards maintenance", en: "Backwards maintenance" },
      expectedVersion: 3,
      reason: "Active to scheduled is rejected.",
      submissionKey: "SUB-DEMO-MAINTENANCE-BACK",
    })).toThrow("ineligible_transition");
  });
});

describe("US3 settings state", () => {
  test("updates changed fields atomically with one version bump and reset", () => {
    resetPhase9GovernanceState();
    const before = getPhase9SettingsGroup("general");
    expect(before?.version).toBe(1);
    const updated = updatePhase9SettingsGroup("general", {
      expectedVersion: 1,
      changes: { platformName: "Masarifi Admin Portal" },
      reason: "Update platform display name safely.",
      submissionKey: "SUB-DEMO-SETTINGS-GENERAL",
    });
    expect(updated.version).toBe(2);
    expect(updated.values.platformName).toBe("Masarifi Admin Portal");
    expect("timezone" in updated.values).toBe(true);
    resetPhase9GovernanceState();
    expect(getPhase9SettingsGroup("general")?.version).toBe(1);
  });

  test("rejects stale and invalid settings updates without partial writes", () => {
    resetPhase9GovernanceState();
    expect(() => updatePhase9SettingsGroup("security", {
      expectedVersion: 9,
      changes: { sessionMinutes: 90 },
      reason: "Stale settings update should be blocked.",
      submissionKey: "SUB-DEMO-SETTINGS-STALE",
    })).toThrow("stale_version");
    expect(() => updatePhase9SettingsGroup("security", {
      expectedVersion: 1,
      changes: { riskThresholds: { low: 90, medium: 50, high: 80 } },
      reason: "Invalid threshold order should not partially mutate.",
      submissionKey: "SUB-DEMO-SETTINGS-INVALID",
    })).toThrow("validation_error");
    expect(getPhase9SettingsGroup("security")?.version).toBe(1);
  });
});

describe("US2 role governance transitions", () => {
  test("creates Active custom roles, edits metadata, toggles status, rejects duplicates and stale versions", () => {
    resetPhase9GovernanceState();
    const created = createPhase9Role({
      key: "custom-audit-reviewer",
      name: { ar: "Audit Reviewer", en: "Audit Reviewer" },
      description: "Custom role for reviewing audit references.",
      permissionKeys: ["admin-team.read", "roles.read"],
      reason: "Create least privilege audit reviewer role.",
      submissionKey: "SUB-DEMO-ROLE-CREATE",
    });
    expect(created.role).toMatchObject({ kind: "custom", status: "active", version: 1 });
    expect(() => createPhase9Role({
      key: "custom-audit-reviewer",
      name: { ar: "Duplicate", en: "Duplicate" },
      description: "Duplicate role key should be blocked.",
      permissionKeys: ["admin-team.read"],
      reason: "Duplicate custom role key is not allowed.",
      submissionKey: "SUB-DEMO-ROLE-DUPE",
    })).toThrow("duplicate_submission");

    const edited = updatePhase9Role(created.role.id, {
      name: { ar: "Audit Reviewer 2", en: "Audit Reviewer 2" },
      permissionKeys: ["admin-team.read"],
      reason: "Update custom role metadata and permissions.",
      expectedVersion: 1,
      submissionKey: "SUB-DEMO-ROLE-EDIT",
    });
    expect(edited.role.version).toBe(2);
    expect(() => updatePhase9Role(created.role.id, {
      status: "disabled",
      reason: "Stale update should be blocked.",
      expectedVersion: 1,
      submissionKey: "SUB-DEMO-ROLE-STALE",
    })).toThrow("stale_version");
    expect(updatePhase9Role(created.role.id, {
      status: "disabled",
      reason: "Disable unassigned custom role safely.",
      expectedVersion: 2,
      submissionKey: "SUB-DEMO-ROLE-DISABLE",
    }).role.status).toBe("disabled");
  });

  test("keeps system roles immutable, derives assignment counts, exposes matrix, and has no delete transition", () => {
    resetPhase9GovernanceState();
    expect(listPhase9Roles().items.length).toBeGreaterThanOrEqual(8);
    expect(getPhase9Role("ROLE-DEMO-SUPER")?.assignmentCount).toBe(1);
    expect(() => updatePhase9Role("ROLE-DEMO-SUPER", {
      status: "disabled",
      reason: "System roles are immutable.",
      expectedVersion: 1,
      submissionKey: "SUB-DEMO-SYSTEM-IMMUTABLE",
    })).toThrow("ineligible_transition");
    expect(getPhase9PermissionMatrix().permissionCount).toBeGreaterThan(100);
    expect({ createPhase9Role, updatePhase9Role }).not.toHaveProperty("deletePhase9Role");
  });
});

describe("US1 admin governance transitions", () => {
  test("creates only Pending invitations and rejects duplicate normalized email", () => {
    resetPhase9GovernanceState();
    const result = invitePhase9Admin({
      email: "Fresh.Admin@Example.Test",
      name: "Fresh Admin",
      roleId: "ROLE-DEMO-SUPPORT",
      department: "Support",
      expiryDays: 7,
      message: "Welcome to the governance console.",
      submissionKey: "SUB-DEMO-INVITE-FRESH",
    });
    expect(result.invitation).toMatchObject({ status: "pending", maskedEmail: "f***@example.test" });
    expect(listPhase9Invitations().items[0].status).toBe("pending");
    expect(() => invitePhase9Admin({
      email: "fresh.admin@example.test",
      name: "Duplicate Admin",
      roleId: "ROLE-DEMO-SUPPORT",
      department: "Support",
      expiryDays: 7,
      submissionKey: "SUB-DEMO-INVITE-DUPE",
    })).toThrow("duplicate_submission");
  });

  test("assigns roles, revokes eligible sessions, and resets deterministically", () => {
    resetPhase9GovernanceState();
    const assigned = assignPhase9AdminRoles("ADM-DEMO-SUPPORT-03", {
      adminId: "ADM-DEMO-SUPPORT-03",
      roleIds: ["ROLE-DEMO-SECURITY"],
      reason: "Switch support lead to security read scope.",
      expectedVersion: 1,
      submissionKey: "SUB-DEMO-ASSIGN-SUPPORT",
    });
    expect(assigned.admin.version).toBe(2);
    expect(assigned.admin.roleSummaries[0].id).toBe("ROLE-DEMO-SECURITY");

    const revoked = revokePhase9AdminSessions("ADM-DEMO-SUPPORT-03", {
      adminId: "ADM-DEMO-SUPPORT-03",
      sessionIds: ["ASES-DEMO-SUPPORT-03"],
      revokeAllEligible: false,
      reason: "Revoke stale support tablet session.",
      expectedVersion: 2,
      submissionKey: "SUB-DEMO-REVOKE-SUPPORT",
    });
    expect(revoked.revokedSessionIds).toEqual(["ASES-DEMO-SUPPORT-03"]);
    expect(revoked.admin.activeSessionCount).toBe(0);

    resetPhase9GovernanceState();
    expect(getPhase9Admin("ADM-DEMO-SUPPORT-03")?.version).toBe(1);
    expect(getPhase9Admin("ADM-DEMO-SUPPORT-03")?.activeSessionCount).toBe(1);
  });

  test("guards current session, stale version, self disable, last Super Admin, ticket replacement, and terminal statuses", () => {
    resetPhase9GovernanceState();
    expect(() => revokePhase9AdminSessions("ADM-DEMO-SUPER-01", {
      adminId: "ADM-DEMO-SUPER-01",
      sessionIds: ["ASES-DEMO-SUPER-01"],
      revokeAllEligible: false,
      reason: "Attempt current-session revoke is blocked.",
      expectedVersion: 1,
      submissionKey: "SUB-DEMO-REVOKE-CURRENT",
    })).toThrow("ineligible_transition");

    expect(() => assignPhase9AdminRoles("ADM-DEMO-SUPPORT-03", {
      adminId: "ADM-DEMO-SUPPORT-03",
      roleIds: ["ROLE-DEMO-SUPPORT"],
      reason: "Stale version must not mutate admin roles.",
      expectedVersion: 9,
      submissionKey: "SUB-DEMO-STALE-ASSIGN",
    })).toThrow("stale_version");

    expect(() => disablePhase9Admin("ADM-DEMO-SUPER-01", {
      adminId: "ADM-DEMO-SUPER-01",
      reason: "Self disable must be blocked safely.",
      revokeEligibleSessions: true,
      expectedStatus: "active",
      expectedVersion: 1,
      submissionKey: "SUB-DEMO-SELF-DISABLE",
    }, "ADM-DEMO-SUPER-01")).toThrow("ineligible_transition");

    expect(() => assignPhase9AdminRoles("ADM-DEMO-SUPER-01", {
      adminId: "ADM-DEMO-SUPER-01",
      roleIds: ["ROLE-DEMO-SUPPORT"],
      reason: "Removing last Super Admin is blocked.",
      expectedVersion: 1,
      submissionKey: "SUB-DEMO-LAST-SUPER",
    })).toThrow("ineligible_transition");

    expect(() => disablePhase9Admin("ADM-DEMO-SECURITY-02", {
      adminId: "ADM-DEMO-SECURITY-02",
      reason: "Open tickets require a replacement admin.",
      revokeEligibleSessions: true,
      expectedStatus: "active",
      expectedVersion: 1,
      submissionKey: "SUB-DEMO-TICKET-BLOCK",
    })).toThrow("ineligible_transition");

    expect(disablePhase9Admin("ADM-DEMO-SECURITY-02", {
      adminId: "ADM-DEMO-SECURITY-02",
      reason: "Transfer tickets before disabling the security admin.",
      revokeEligibleSessions: true,
      replacementAdminId: "ADM-DEMO-SUPPORT-03",
      expectedStatus: "active",
      expectedVersion: 1,
      submissionKey: "SUB-DEMO-DISABLE-SECURITY",
    }).admin.status).toBe("disabled");

    expect(() => disablePhase9Admin("ADM-DEMO-DISABLED-04", {
      adminId: "ADM-DEMO-DISABLED-04",
      reason: "Disabled admins are terminal for this operation.",
      revokeEligibleSessions: true,
      expectedStatus: "active",
      expectedVersion: 1,
      submissionKey: "SUB-DEMO-DISABLED-AGAIN",
    })).toThrow("ineligible_transition");
  });
});
