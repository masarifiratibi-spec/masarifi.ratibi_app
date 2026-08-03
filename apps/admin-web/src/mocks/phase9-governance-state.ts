import type {
  PermissionKey,
} from "@/core/permissions/permissions";
import type {
  AssignAdminRolesRequest,
  DisableAdminRequest,
  InviteAdminRequest,
  RoleCreateRequest,
  RoleUpdateRequest,
  SettingsGroupName,
  UpdateFeatureFlagRequest,
  UpdateMaintenanceRequest,
  UpdateSettingsGroupRequest,
  RevokeAdminSessionsRequest,
} from "@/features/governance/contracts";
import {
  assignAdminRolesRequestSchema,
  disableAdminRequestSchema,
  inviteAdminRequestSchema,
  roleCreateRequestSchema,
  roleUpdateRequestSchema,
  settingsGroupNameSchema,
  settingsValueSchemas,
  updateFeatureFlagRequestSchema,
  updateMaintenanceRequestSchema,
  updateSettingsGroupRequestSchema,
  revokeAdminSessionsRequestSchema,
} from "@/features/governance/contracts";
import {
  PHASE9_FIXTURE_NOW,
  governanceAdmins,
  governanceInvitations,
  governanceFeatureFlags,
  governanceMaintenance,
  governancePermissionMetadata,
  governanceRoles,
  governanceSessions,
  governanceSettingsGroups,
} from "@/mocks/fixtures/governance";

type RoleSeed = {
  id: string;
  key: string;
  label: string;
  name: { ar: string; en: string };
  description: string;
  kind: "system" | "custom";
  status: "active" | "disabled";
  permissions: PermissionKey[];
  permissionKeys: PermissionKey[];
  assignmentCount: number;
  approval: { required: boolean; description: string };
  assignable: boolean;
  version: number;
  updatedAt: string;
};
type AdminSeed = (typeof governanceAdmins)[number];
type SessionSeed = (typeof governanceSessions)[number];
type InvitationSeed = (typeof governanceInvitations)[number] & { emailKey?: string };
type SettingsSeed = (typeof governanceSettingsGroups)[number];
type FlagSeed = (typeof governanceFeatureFlags)[number];
type MaintenanceSeed = Omit<typeof governanceMaintenance, "state" | "startsAt" | "endsAt"> & {
  state: "off" | "scheduled" | "active";
  startsAt: string | null;
  endsAt: string | null;
};

type Phase9StateSnapshot = {
  admins: AdminSeed[];
  invitations: InvitationSeed[];
  sessions: SessionSeed[];
  roles: RoleSeed[];
  settings: SettingsSeed[];
  flags: FlagSeed[];
  maintenance: MaintenanceSeed;
  version: number;
};

export const PHASE9_FIXED_NOW = PHASE9_FIXTURE_NOW;

let state: Phase9StateSnapshot = initialState();
let counters: Record<string, number> = {};

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function initialState(): Phase9StateSnapshot {
  return {
    admins: clone(governanceAdmins),
    invitations: clone(governanceInvitations),
    sessions: clone(governanceSessions),
    roles: clone(governanceRoles) as RoleSeed[],
    settings: clone(governanceSettingsGroups),
    flags: clone(governanceFeatureFlags),
    maintenance: clone(governanceMaintenance) as MaintenanceSeed,
    version: 1,
  };
}

function roleReference(roleId: string) {
  const role = state.roles.find((candidate) => candidate.id === roleId);
  if (!role || role.status !== "active") throw new Error("ineligible_transition");
  return { id: role.id, key: role.key, label: role.label };
}

function assertVersion(actual: number, expected: number) {
  if (actual !== expected) throw new Error("stale_version");
}

function maskEmail(email: string) {
  const [local] = email.split("@");
  return `${local.slice(0, 1)}***@example.test`;
}

function addDaysIso(days: number) {
  const value = new Date(PHASE9_FIXED_NOW);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().replace(".000Z", "+00:00");
}

function toSummary(admin: AdminSeed) {
  const roleSummaries = admin.roleIds.map(roleReference);
  const activeSessionCount = state.sessions.filter((session) => session.adminId === admin.id && session.state === "active").length;
  const allowedActions = admin.status === "active"
    ? ["assign_roles", "revoke_sessions", "disable"] as const
    : [] as const;
  return {
    id: admin.id,
    displayName: admin.displayName,
    maskedEmail: admin.maskedEmail,
    roleSummaries,
    department: admin.department,
    status: admin.status,
    twoFactorState: admin.twoFactorState,
    lastLoginAt: admin.lastLoginAt,
    activeSessionCount,
    createdAt: admin.createdAt,
    version: admin.version,
    allowedActions: [...allowedActions],
  };
}

function ticketReferences(admin: AdminSeed) {
  return Array.from({ length: Math.min(admin.ticketOpenCount, 2) }, (_, index) => ({
    id: `TICKET-${admin.id}-${index + 1}`,
    kind: "support_ticket",
    label: `Open ticket ${index + 1}`,
  }));
}

export function toAdminDetail(admin: AdminSeed) {
  return {
    ...toSummary(admin),
    profile: { title: admin.title, locale: admin.locale },
    assignedTickets: { openCount: admin.ticketOpenCount, references: ticketReferences(admin) },
    sessions: state.sessions.filter((session) => session.adminId === admin.id).map((session) => {
      const { updatedAt, adminId, ...safeSession } = session;
      void updatedAt;
      void adminId;
      return safeSession;
    }),
    recentActions: [{ id: `AUD-${admin.id}`, kind: "admin.action", label: "Recent safe admin action" }],
    auditReferences: [{ id: `AUD-${admin.id}-PROFILE`, kind: "audit", label: "Profile viewed" }],
  };
}

export function resetPhase9GovernanceState(): void {
  state = initialState();
  counters = {};
}

export function readPhase9GovernanceState(): Phase9StateSnapshot {
  return clone(state);
}

export function nextPhase9Id(prefix: string): string {
  counters[prefix] = (counters[prefix] ?? 0) + 1;
  return `${prefix}-DEMO-${String(counters[prefix]).padStart(4, "0")}`;
}

export function nextPhase9Version(version: number): number {
  return version + 1;
}

export function listPhase9Admins(query: { page?: number; pageSize?: 25 | 50 | 100; search?: string; status?: string } = {}) {
  const page = query.page ?? 1;
  const pageSize = query.pageSize ?? 25;
  const term = query.search?.toLocaleLowerCase();
  const items = state.admins
    .filter((admin) => !query.status || query.status === "all" || admin.status === query.status)
    .filter((admin) => !term || [admin.displayName, admin.maskedEmail, admin.department].some((value) => value.toLocaleLowerCase().includes(term)))
    .map(toSummary);
  return { items: items.slice((page - 1) * pageSize, page * pageSize), total: items.length, page, pageSize };
}

export function getPhase9Admin(adminId: string) {
  const admin = state.admins.find((candidate) => candidate.id === adminId);
  return admin ? toAdminDetail(admin) : null;
}

export function listPhase9Invitations(query: { page?: number; pageSize?: 25 | 50 | 100 } = {}) {
  const page = query.page ?? 1;
  const pageSize = query.pageSize ?? 25;
  const items = state.invitations.map((invitation) => ({
    id: invitation.id,
    maskedEmail: invitation.maskedEmail,
    name: invitation.name,
    role: roleReference(invitation.roleId),
    department: invitation.department,
    createdAt: invitation.createdAt,
    expiresAt: invitation.expiresAt,
    status: invitation.status,
    version: invitation.version,
    auditReference: { id: `AUD-${invitation.id}`, kind: "admin.invitation.created", label: "Invitation created" },
  }));
  return { items: items.slice((page - 1) * pageSize, page * pageSize), total: items.length, page, pageSize };
}

export function invitePhase9Admin(input: InviteAdminRequest) {
  const request = inviteAdminRequestSchema.parse(input);
  const maskedEmail = maskEmail(request.email);
  if (state.invitations.some((invitation) => invitation.emailKey === request.email)) {
    throw new Error("duplicate_submission");
  }
  roleReference(request.roleId);
  const invitation: InvitationSeed = {
    id: nextPhase9Id("INV"),
    maskedEmail,
    emailKey: request.email,
    name: request.name,
    roleId: request.roleId,
    department: request.department,
    createdAt: PHASE9_FIXED_NOW,
    expiresAt: addDaysIso(request.expiryDays),
    status: "pending",
    version: 1,
    updatedAt: PHASE9_FIXED_NOW,
  };
  state.invitations.unshift(invitation);
  state.version = nextPhase9Version(state.version);
  return { invitation: listPhase9Invitations().items[0], message: "Pending invitation created" };
}

export function assignPhase9AdminRoles(adminId: string, input: AssignAdminRolesRequest) {
  const request = assignAdminRolesRequestSchema.parse({ ...input, adminId });
  const admin = state.admins.find((candidate) => candidate.id === adminId);
  if (!admin || admin.status !== "active") throw new Error("ineligible_transition");
  assertVersion(admin.version, request.expectedVersion);
  request.roleIds.forEach(roleReference);
  const removingLastSuperAdmin = admin.roleIds.includes("ROLE-DEMO-SUPER")
    && !request.roleIds.includes("ROLE-DEMO-SUPER")
    && state.admins.filter((candidate) => candidate.status === "active" && candidate.roleIds.includes("ROLE-DEMO-SUPER")).length === 1;
  if (removingLastSuperAdmin) throw new Error("ineligible_transition");
  admin.roleIds = [...request.roleIds];
  admin.version = nextPhase9Version(admin.version);
  admin.updatedAt = PHASE9_FIXED_NOW;
  state.version = nextPhase9Version(state.version);
  return { admin: toAdminDetail(admin), message: "Roles updated" };
}

export function revokePhase9AdminSessions(adminId: string, input: RevokeAdminSessionsRequest) {
  const request = revokeAdminSessionsRequestSchema.parse({ ...input, adminId });
  const admin = state.admins.find((candidate) => candidate.id === adminId);
  if (!admin || admin.status !== "active") throw new Error("ineligible_transition");
  assertVersion(admin.version, request.expectedVersion);
  const selected = state.sessions.filter((session) =>
    session.adminId === adminId
    && session.state === "active"
    && !session.isCurrentSession
    && (request.revokeAllEligible || request.sessionIds.includes(session.id)));
  if (selected.length === 0) throw new Error("ineligible_transition");
  selected.forEach((session) => {
    session.state = "revoked";
    session.version = nextPhase9Version(session.version);
    session.updatedAt = PHASE9_FIXED_NOW;
  });
  admin.version = nextPhase9Version(admin.version);
  state.version = nextPhase9Version(state.version);
  return { admin: toAdminDetail(admin), revokedSessionIds: selected.map((session) => session.id), message: "Sessions revoked" };
}

export function replacementCandidatesFor(adminId: string) {
  return state.admins
    .filter((admin) => admin.id !== adminId && admin.status === "active")
    .map((admin) => ({ adminId: admin.id, label: admin.displayName }));
}

function assignmentCount(roleId: string) {
  return state.admins.filter((admin) => admin.status === "active" && admin.roleIds.includes(roleId)).length;
}

function canonicalRoleId(roleId: string) {
  return roleId === "ROLE-DEMO-CUSTOM-01" ? "ROLE-DEMO-CUSTOM-RISK" : roleId;
}

function toRole(role: RoleSeed) {
  return {
    id: role.id,
    key: role.key,
    name: role.name,
    description: role.description,
    kind: role.kind,
    status: role.status,
    permissionKeys: [...role.permissionKeys],
    assignmentCount: assignmentCount(role.id),
    approval: role.approval,
    version: role.version,
  };
}

export function listPhase9Roles(query: { page?: number; pageSize?: 25 | 50 | 100; search?: string } = {}) {
  const page = query.page ?? 1;
  const pageSize = query.pageSize ?? 25;
  const term = query.search?.toLocaleLowerCase();
  const items = state.roles
    .filter((role) => !term || [role.key, role.label, role.description].some((value) => value.toLocaleLowerCase().includes(term)))
    .map(toRole);
  return { items: items.slice((page - 1) * pageSize, page * pageSize), total: items.length, page, pageSize };
}

export function getPhase9Role(roleId: string) {
  const role = state.roles.find((candidate) => candidate.id === canonicalRoleId(roleId));
  return role ? toRole(role) : null;
}

export function getPhase9PermissionMatrix() {
  const grouped = new Map<string, typeof governancePermissionMetadata>();
  for (const permission of governancePermissionMetadata) {
    grouped.set(permission.group, [...(grouped.get(permission.group) ?? []), permission]);
  }
  const groups = Array.from(grouped, ([group, permissions]) => ({ group, permissions }));
  return { groups, roles: state.roles.map(toRole), permissionCount: governancePermissionMetadata.length };
}

export function createPhase9Role(input: RoleCreateRequest) {
  const request = roleCreateRequestSchema.parse(input);
  if (state.roles.some((role) => role.key === request.key)) throw new Error("duplicate_submission");
  const role: RoleSeed = {
    id: nextPhase9Id("ROLE"),
    key: request.key,
    label: request.name.en,
    name: request.name,
    description: request.description,
    kind: "custom",
    status: "active",
    permissions: [...request.permissionKeys],
    permissionKeys: [...request.permissionKeys],
    assignmentCount: 0,
    approval: { required: true, description: "Custom governance role changes require approval metadata." },
    assignable: true,
    version: 1,
    updatedAt: PHASE9_FIXED_NOW,
  };
  state.roles.unshift(role);
  state.version = nextPhase9Version(state.version);
  return { role: toRole(role), message: "Role created" };
}

export function updatePhase9Role(roleId: string, input: RoleUpdateRequest) {
  const request = roleUpdateRequestSchema.parse(input);
  const role = state.roles.find((candidate) => candidate.id === canonicalRoleId(roleId));
  if (!role) throw new Error("not_found");
  if (role.kind === "system") throw new Error("ineligible_transition");
  assertVersion(role.version, request.expectedVersion);
  if (request.status === "disabled" && assignmentCount(role.id) > 0) throw new Error("ineligible_transition");
  if (request.name) {
    role.name = request.name;
    role.label = request.name.en;
  }
  if (request.description) role.description = request.description;
  if (request.permissionKeys) {
    role.permissionKeys = [...request.permissionKeys];
    role.permissions = [...request.permissionKeys];
  }
  if (request.status) role.status = request.status;
  role.version = nextPhase9Version(role.version);
  role.updatedAt = PHASE9_FIXED_NOW;
  state.version = nextPhase9Version(state.version);
  return { role: toRole(role), message: "Role updated" };
}

export function getPhase9SettingsGroup(group: SettingsGroupName) {
  const parsed = settingsGroupNameSchema.parse(group);
  return clone(state.settings.find((candidate) => candidate.group === parsed) ?? null);
}

export function updatePhase9SettingsGroup(group: SettingsGroupName, input: UpdateSettingsGroupRequest) {
  const parsedGroup = settingsGroupNameSchema.parse(group);
  const request = updateSettingsGroupRequestSchema.parse(input);
  const current = state.settings.find((candidate) => candidate.group === parsedGroup);
  if (!current) throw new Error("not_found");
  assertVersion(current.version, request.expectedVersion);
  const candidateValues = { ...current.values, ...request.changes };
  const parsedValues = settingsValueSchemas[parsedGroup].safeParse(candidateValues);
  if (!parsedValues.success) throw new Error("validation_error");
  current.values = parsedValues.data as typeof current.values;
  current.version = nextPhase9Version(current.version);
  current.updatedAt = PHASE9_FIXED_NOW;
  state.version = nextPhase9Version(state.version);
  return clone(current);
}

export function listPhase9FeatureFlags(query: { page?: number; pageSize?: 25 | 50 | 100 } = {}) {
  const page = query.page ?? 1;
  const pageSize = query.pageSize ?? 25;
  const items = state.flags.map((flag) => clone(flag));
  return { items: items.slice((page - 1) * pageSize, page * pageSize), total: items.length, page, pageSize };
}

export function updatePhase9FeatureFlag(flagId: string, input: UpdateFeatureFlagRequest) {
  const request = updateFeatureFlagRequestSchema.parse(input);
  const flag = state.flags.find((candidate) => candidate.id === flagId);
  if (!flag) throw new Error("not_found");
  if (flag.status === "ended") throw new Error("ineligible_transition");
  assertVersion(flag.version, request.expectedVersion);
  if (request.audience) flag.audience = request.audience;
  if (request.rolloutPercent !== undefined) flag.rolloutPercent = request.rolloutPercent;
  if (request.status) flag.status = request.status;
  flag.version = nextPhase9Version(flag.version);
  flag.updatedAt = PHASE9_FIXED_NOW;
  state.version = nextPhase9Version(state.version);
  return { flag: clone(flag), message: "Feature flag updated" };
}

export function getPhase9Maintenance() {
  return clone(state.maintenance);
}

export function updatePhase9Maintenance(input: UpdateMaintenanceRequest) {
  const request = updateMaintenanceRequestSchema.parse(input);
  assertVersion(state.maintenance.version, request.expectedVersion);
  const current = state.maintenance.state;
  const allowed =
    (current === "off" && request.nextState === "scheduled")
    || (current === "scheduled" && (request.nextState === "active" || request.nextState === "off"))
    || (current === "active" && request.nextState === "off");
  if (!allowed) throw new Error("ineligible_transition");
  state.maintenance = {
    ...state.maintenance,
    state: request.nextState,
    message: request.message,
    startsAt: request.startsAt ?? null,
    endsAt: request.endsAt ?? null,
    version: nextPhase9Version(state.maintenance.version),
    updatedAt: PHASE9_FIXED_NOW,
  };
  state.version = nextPhase9Version(state.version);
  return { maintenance: clone(state.maintenance), message: "Maintenance updated" };
}

export function disablePhase9Admin(adminId: string, input: DisableAdminRequest, actorAdminId = "ADM-DEMO-SUPER-01") {
  const request = disableAdminRequestSchema.parse({ ...input, adminId });
  const admin = state.admins.find((candidate) => candidate.id === adminId);
  if (!admin || admin.status !== "active" || request.expectedStatus !== "active") throw new Error("ineligible_transition");
  if (admin.id === actorAdminId) throw new Error("ineligible_transition");
  assertVersion(admin.version, request.expectedVersion);
  const lastSuperAdmin = admin.roleIds.includes("ROLE-DEMO-SUPER")
    && state.admins.filter((candidate) => candidate.status === "active" && candidate.roleIds.includes("ROLE-DEMO-SUPER")).length === 1;
  if (lastSuperAdmin) throw new Error("ineligible_transition");
  if (admin.ticketOpenCount > 0 && !replacementCandidatesFor(admin.id).some((candidate) => candidate.adminId === request.replacementAdminId)) {
    throw new Error("ineligible_transition");
  }
  admin.status = "disabled";
  admin.version = nextPhase9Version(admin.version);
  admin.updatedAt = PHASE9_FIXED_NOW;
  if (request.revokeEligibleSessions) {
    state.sessions
      .filter((session) => session.adminId === adminId && session.state === "active" && !session.isCurrentSession)
      .forEach((session) => {
        session.state = "revoked";
        session.version = nextPhase9Version(session.version);
      });
  }
  state.version = nextPhase9Version(state.version);
  return { admin: toAdminDetail(admin), replacementCandidates: replacementCandidatesFor(adminId), message: "Admin disabled" };
}
