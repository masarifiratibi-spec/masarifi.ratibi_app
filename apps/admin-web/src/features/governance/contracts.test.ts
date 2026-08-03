import { describe, expect, test } from "vitest";
import {
  governanceCustomRoles,
  governanceAdmins,
  governanceFeatureFlags,
  governanceInvitations,
  governanceMaintenance,
  governancePermissionMetadata,
  governanceRoles,
  governanceSessions,
  governanceSettingsGroups,
  governanceSystemRoles,
} from "@/mocks/fixtures/governance";

const validTimestamp = "2026-08-01T12:00:00+03:00";

async function governanceContracts() {
  return import("./contracts");
}

describe("Spec 010 governance shared primitives", () => {
  test("exports strict ID, pagination, safe error, text, audience, version, and timestamp schemas", async () => {
    const contracts = await governanceContracts();
    expect(contracts.adminIdSchema.safeParse("ADM-DEMO-SECURITY-02").success).toBe(true);
    expect(contracts.adminIdSchema.safeParse("USR-10482").success).toBe(false);
    expect(contracts.paginationQuerySchema.safeParse({ page: 1, pageSize: 25 }).success).toBe(true);
    expect(contracts.paginationQuerySchema.safeParse({ page: 1, pageSize: 101 }).success).toBe(false);
    expect(contracts.safeApiErrorSchema.safeParse({ code: "forbidden", message: "Access denied" }).success).toBe(true);
    expect(contracts.versionSchema.safeParse(1).success).toBe(true);
    expect(contracts.versionSchema.safeParse(0).success).toBe(false);
    expect(contracts.isoTimestampSchema.safeParse(validTimestamp).success).toBe(true);
    expect(contracts.fixedAudienceSchema.safeParse("premium_plan").success).toBe(true);
    expect(contracts.fixedAudienceSchema.safeParse("customer_ids").success).toBe(false);
  });

  test("normalizes safe text and rejects control or bidi characters", async () => {
    const contracts = await governanceContracts();
    expect(contracts.safeTextSchema.safeParse("  Valid reason text  ").success).toBe(true);
    expect(contracts.safeTextSchema.safeParse("bad\u0001text").success).toBe(false);
    expect(contracts.safeTextSchema.safeParse("bad\u202Etext").success).toBe(false);
  });

  test("shared objects reject unknown fields", async () => {
    const contracts = await governanceContracts();
    const parsed = contracts.safeApiErrorSchema.safeParse({
      code: "forbidden",
      message: "Access denied",
      stack: "hidden",
    });
    expect(parsed.success).toBe(false);
  });

  test("validates every minimal governance fixture seed", async () => {
    const contracts = await governanceContracts();
    for (const role of governanceSystemRoles) {
      expect(contracts.roleIdSchema.safeParse(role.id).success).toBe(true);
      expect(contracts.versionSchema.safeParse(role.version).success).toBe(true);
      expect(contracts.isoTimestampSchema.safeParse(role.updatedAt).success).toBe(true);
    }
    for (const admin of governanceAdmins) {
      expect(contracts.adminIdSchema.safeParse(admin.id).success).toBe(true);
      expect(contracts.versionSchema.safeParse(admin.version).success).toBe(true);
      expect(contracts.isoTimestampSchema.safeParse(admin.updatedAt).success).toBe(true);
    }
    for (const session of governanceSessions) {
      expect(contracts.sessionReferenceSchema.safeParse(session.id).success).toBe(true);
      expect(contracts.adminIdSchema.safeParse(session.adminId).success).toBe(true);
    }
    for (const invitation of governanceInvitations) {
      expect(contracts.invitationIdSchema.safeParse(invitation.id).success).toBe(true);
      expect(contracts.roleIdSchema.safeParse(invitation.roleId).success).toBe(true);
    }
    for (const group of governanceSettingsGroups) {
      expect(contracts.versionSchema.safeParse(group.version).success).toBe(true);
      expect(contracts.isoTimestampSchema.safeParse(group.updatedAt).success).toBe(true);
    }
    for (const flag of governanceFeatureFlags) {
      expect(contracts.flagIdSchema.safeParse(flag.id).success).toBe(true);
      expect(contracts.fixedAudienceSchema.safeParse(flag.audience).success).toBe(true);
    }
    expect(contracts.versionSchema.safeParse(governanceMaintenance.version).success).toBe(true);
    expect(contracts.isoTimestampSchema.safeParse(governanceMaintenance.updatedAt).success).toBe(true);
  });
});

describe("US2 role and permission contracts", () => {
  test("validates role key, bilingual names, approval metadata, assignments, and permissions", async () => {
    const contracts = await governanceContracts();
    expect(contracts.roleSchema.safeParse({
      id: "ROLE-DEMO-CUSTOM-01",
      key: "custom-risk-reviewer",
      name: { ar: "Risk Reviewer", en: "Risk Reviewer" },
      description: "Least privilege risk reviewer role.",
      kind: "custom",
      status: "active",
      permissionKeys: ["admin-team.read"],
      assignmentCount: 0,
      approval: { required: true, description: "Approval metadata explains why this role exists." },
      version: 1,
    }).success).toBe(true);
    expect(contracts.roleSchema.safeParse({
      id: "ROLE-DEMO-CUSTOM-01",
      key: "Bad Key",
      name: { ar: "", en: "Risk Reviewer" },
      description: "short",
      kind: "custom",
      status: "active",
      permissionKeys: [],
      assignmentCount: -1,
      approval: { required: true, description: "short" },
      version: 1,
    }).success).toBe(false);
  });

  test("validates exhaustive permission metadata and fixed role fixtures", async () => {
    const contracts = await governanceContracts();
    expect(governanceSystemRoles).toHaveLength(7);
    expect(governancePermissionMetadata.length).toBeGreaterThan(100);
    for (const permission of governancePermissionMetadata) {
      expect(contracts.permissionMetadataSchema.safeParse(permission).success).toBe(true);
    }
    for (const role of governanceRoles) {
      expect(contracts.roleSchema.safeParse({
        id: role.id,
        key: role.key,
        name: role.name,
        description: role.description,
        kind: role.kind,
        status: role.status,
        permissionKeys: role.permissionKeys,
        assignmentCount: role.assignmentCount,
        approval: role.approval,
        version: role.version,
      }).success).toBe(true);
    }
    expect(governanceCustomRoles[0].kind).toBe("custom");
  });
});

describe("US3 settings contracts", () => {
  test("validates all six exact settings groups and rejects invalid boundaries", async () => {
    const contracts = await governanceContracts();
    for (const group of governanceSettingsGroups) {
      expect(contracts.settingsGroupSchema.safeParse(group).success).toBe(true);
    }
    expect(contracts.mobileSettingsValuesSchema.safeParse({
      iosMinBuild: 0,
      androidMinBuild: 118,
      forceUpdate: false,
      storeUrls: { ios: "https://apps.example.test/ios", android: "https://apps.example.test/android" },
    }).success).toBe(false);
    expect(contracts.importsSettingsValuesSchema.safeParse({
      maxFileMb: 20,
      duplicateWindowDays: 14,
      priorityOrder: ["csv", "csv", "email"],
    }).success).toBe(false);
    expect(contracts.securitySettingsValuesSchema.safeParse({
      sessionMinutes: 60,
      mfaRequired: true,
      riskThresholds: { low: 60, medium: 50, high: 80 },
    }).success).toBe(false);
  });
});

describe("US4 flags and maintenance contracts", () => {
  test("validates fixed-audience feature flags and maintenance transitions", async () => {
    const contracts = await governanceContracts();
    for (const flag of governanceFeatureFlags) {
      expect(contracts.featureFlagSchema.safeParse(flag).success).toBe(true);
    }
    expect(contracts.updateFeatureFlagRequestSchema.safeParse({
      audience: "customer_ids",
      rolloutPercent: 101,
      expectedVersion: 1,
      reason: "Invalid flag update should fail.",
      submissionKey: "SUB-DEMO-FLAG-BAD",
    }).success).toBe(false);
    expect(contracts.maintenanceSchema.safeParse(governanceMaintenance).success).toBe(true);
    expect(contracts.updateMaintenanceRequestSchema.safeParse({
      nextState: "scheduled",
      message: { ar: "Scheduled maintenance", en: "Scheduled maintenance" },
      startsAt: "2026-08-02T12:00:00+03:00",
      endsAt: "2026-08-02T13:00:00+03:00",
      expectedVersion: 1,
      reason: "Schedule maintenance safely.",
      submissionKey: "SUB-DEMO-MAINTENANCE",
    }).success).toBe(true);
  });
});

describe("US1 admin team contracts", () => {
  test("validates admin, session, invitation, and mutation schemas strictly", async () => {
    const contracts = await governanceContracts();
    const role = { id: "ROLE-DEMO-SUPPORT", key: "support-agent", label: "Support Agent" };
    const admin = {
      id: "ADM-DEMO-SUPPORT-03",
      displayName: "Salem Support",
      maskedEmail: "s***@example.test",
      roleSummaries: [role],
      department: "Support",
      status: "active",
      twoFactorState: "optional_enabled",
      lastLoginAt: validTimestamp,
      activeSessionCount: 1,
      createdAt: validTimestamp,
      version: 1,
      allowedActions: ["assign_roles", "revoke_sessions", "disable"],
    };
    expect(contracts.adminUserSummarySchema.safeParse(admin).success).toBe(true);
    expect(contracts.adminUserSummarySchema.safeParse({ ...admin, extra: true }).success).toBe(false);
    expect(contracts.adminUserSummarySchema.safeParse({ ...admin, displayName: "" }).success).toBe(false);
    expect(contracts.adminUserSummarySchema.safeParse({ ...admin, displayName: "x".repeat(121) }).success).toBe(false);

    expect(contracts.adminSessionSchema.safeParse({
      id: "ASES-DEMO-SUPPORT-03",
      deviceLabel: "Support tablet",
      broadRegion: "Bahrain",
      startedAt: "2026-08-01T09:00:00+03:00",
      lastActivityAt: "2026-08-01T10:00:00+03:00",
      isCurrentSession: false,
      riskLabel: "low",
      state: "active",
      version: 1,
    }).success).toBe(true);

    expect(contracts.adminInvitationSchema.safeParse({
      id: "INV-DEMO-PENDING-02",
      maskedEmail: "p***@example.test",
      name: "Pending Admin",
      role,
      department: "Security",
      createdAt: "2026-08-01T12:00:00+03:00",
      expiresAt: "2026-08-08T12:00:00+03:00",
      status: "pending",
      version: 1,
      auditReference: { id: "AUD-DEMO-INVITE-01", kind: "admin.invitation.created", label: "Invitation created" },
    }).success).toBe(true);
  });

  test("normalizes invite email and bounds expiry/message/version fields", async () => {
    const contracts = await governanceContracts();
    const parsed = contracts.inviteAdminRequestSchema.parse({
      email: "  NEW.ADMIN@Example.Test  ",
      name: "New Admin",
      roleId: "ROLE-DEMO-SUPPORT",
      department: "Support",
      expiryDays: 7,
      message: "Welcome ".repeat(10),
      submissionKey: "SUB-DEMO-INVITE-0001",
    });
    expect(parsed.email).toBe("new.admin@example.test");
    expect(contracts.inviteAdminRequestSchema.safeParse({ ...parsed, expiryDays: 0 }).success).toBe(false);
    expect(contracts.inviteAdminRequestSchema.safeParse({ ...parsed, expiryDays: 31 }).success).toBe(false);
    expect(contracts.inviteAdminRequestSchema.safeParse({ ...parsed, message: "x".repeat(1001) }).success).toBe(false);
    expect(contracts.assignAdminRolesRequestSchema.safeParse({
      adminId: "ADM-DEMO-SUPPORT-03",
      roleIds: ["ROLE-DEMO-SUPPORT"],
      reason: "Approved least privilege role update.",
      expectedVersion: 1,
      submissionKey: "SUB-DEMO-ASSIGN-0001",
    }).success).toBe(true);
    expect(contracts.assignAdminRolesRequestSchema.safeParse({
      adminId: "ADM-DEMO-SUPPORT-03",
      roleIds: ["ROLE-DEMO-SUPPORT"],
      reason: "short",
      expectedVersion: 0,
      submissionKey: "SUB-DEMO-ASSIGN-0001",
    }).success).toBe(false);
  });

  test("validates every US1 fixture projection", async () => {
    const contracts = await governanceContracts();
    for (const admin of governanceAdmins) {
      expect(contracts.adminUserSummarySchema.safeParse({
        id: admin.id,
        displayName: admin.displayName,
        maskedEmail: admin.maskedEmail,
        roleSummaries: admin.roleIds.map((roleId) => {
          const role = governanceSystemRoles.find((candidate) => candidate.id === roleId)!;
          return { id: role.id, key: role.key, label: role.label };
        }),
        department: admin.department,
        status: admin.status,
        twoFactorState: admin.twoFactorState,
        lastLoginAt: admin.lastLoginAt,
        activeSessionCount: governanceSessions.filter((session) => session.adminId === admin.id && session.state === "active").length,
        createdAt: admin.createdAt,
        version: admin.version,
        allowedActions: admin.status === "active" ? ["assign_roles", "revoke_sessions", "disable"] : [],
      }).success).toBe(true);
    }
  });
});
