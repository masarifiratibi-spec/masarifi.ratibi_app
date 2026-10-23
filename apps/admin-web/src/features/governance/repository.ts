import { apiActorCacheKey, apiClient, liveCursor, rememberLiveCursor, mocksEnabled } from "@/core/api/client";
import { z } from "zod";
import {
  adminIdSchema,
  adminListQuerySchema,
  adminListResponseSchema,
  adminUserDetailSchema,
  be3AdminDetailSchema,
  be3AdminPageSchema,
  be3AdminSchema,
  be3AssignmentSchema,
  be3InvitationPageSchema,
  be3InvitationSchema,
  be3PermissionPageSchema,
  be3RolePageSchema,
  be3RoleSchema,
  be3SessionRevokeResultSchema,
  acceptAdminInvitationRequestSchema,
  acceptAdminInvitationResultSchema,
  assignAdminRolesRequestSchema,
  assignAdminRolesResultSchema,
  disableAdminRequestSchema,
  disableAdminResultSchema,
  flagIdSchema,
  featureFlagListResponseSchema,
  featureFlagResultSchema,
  invitationListResponseSchema,
  inviteAdminRequestSchema,
  inviteAdminResultSchema,
  paginationQuerySchema,
  revokeAdminSessionsRequestSchema,
  revokeAdminSessionsResultSchema,
  roleIdSchema,
  roleCreateRequestSchema,
  roleListResponseSchema,
  roleMutationResultSchema,
  roleSchema,
  roleUpdateRequestSchema,
  revokeAdminRoleRequestSchema,
  permissionMatrixSchema,
  settingsGroupNameSchema,
  settingsGroupSchema,
  updateSettingsGroupRequestSchema,
  updateFeatureFlagRequestSchema,
  maintenanceSchema,
  maintenanceResultSchema,
  phase13FeatureFlagPageSchema,
  phase13MaintenancePageSchema,
  phase13MutationResultSchema,
  phase13SettingSchema,
  updateMaintenanceRequestSchema,
} from "./contracts";

const operationsSettingByGroup = {
  general: "operations.history.retention_days",
  mobile: "operations.performance.series_limit",
  imports: "operations.provider.timeout_ms",
  ai: "operations.ai.allowance",
} as const;

type Phase13Flag = z.infer<typeof phase13FeatureFlagPageSchema>["items"][number];
type Phase13Maintenance = z.infer<typeof phase13MaintenancePageSchema>["items"][number];
const maintenanceWindows = new Map<string, Phase13Maintenance>();

const percentageCohort = /^percent-(?:0\d|[1-9]\d)$/u;

function isPercentageRule(rule: Pick<Phase13Flag["rules"][number], "audience">): boolean {
  return Object.keys(rule.audience).length === 1 &&
    typeof rule.audience.cohort === "string" &&
    percentageCohort.test(rule.audience.cohort);
}

function percentageRules(percent: number) {
  return Array.from({ length: percent }, (_, bucket) => ({
    priority: 800 + bucket,
    audience: { cohort: `percent-${String(bucket).padStart(2, "0")}` },
    enabled: true,
  }));
}

async function loadCursorPage<T>(
  path: string,
  schema: z.ZodType<{ items: T[]; nextCursor: string | null }>,
  input: GovernanceListQuery,
  filters = new URLSearchParams(),
) {
  const { page, pageSize } = paginationQuerySchema.parse(input);
  const scope = `${path}:${pageSize}:${filters.toString()}`;
  const cursor = liveCursor(scope, page);
  const query = new URLSearchParams(filters);
  query.set("limit", String(pageSize));
  if (cursor) query.set("cursor", cursor);
  const response = await apiClient.get(`${path}?${query.toString()}`, schema);
  rememberLiveCursor(scope, page, response.nextCursor);
  return { ...response, total: (page - 1) * pageSize + response.items.length + (response.nextCursor ? 1 : 0), page, pageSize };
}

type AdminId = z.infer<typeof adminIdSchema>;
type RoleId = z.infer<typeof roleIdSchema>;
type FlagId = z.infer<typeof flagIdSchema>;
type GovernanceListQuery = z.input<typeof paginationQuerySchema> & { search?: string; status?: string };
type GovernanceReadModel = Record<string, unknown>;
type GovernanceMutationRequest = Record<string, unknown>;
type GovernanceMutationResult = Record<string, unknown>;

export interface GovernanceRepository {
  listAdminUsers(input: GovernanceListQuery): Promise<GovernanceReadModel>;
  getAdminUser(adminId: AdminId): Promise<GovernanceReadModel>;
  listAdminInvitations(input: GovernanceListQuery): Promise<GovernanceReadModel>;
  inviteAdmin(input: GovernanceMutationRequest): Promise<GovernanceMutationResult>;
  disableAdmin(adminId: AdminId, input: GovernanceMutationRequest): Promise<GovernanceMutationResult>;
  revokeAdminSessions(adminId: AdminId, input: GovernanceMutationRequest): Promise<GovernanceMutationResult>;
  assignAdminRoles(adminId: AdminId, input: GovernanceMutationRequest): Promise<GovernanceMutationResult>;
  revokeAdminRole(assignmentId: string, input: GovernanceMutationRequest): Promise<void>;
  acceptAdminInvitation(token: string): Promise<GovernanceMutationResult>;
  listRoles(input: GovernanceListQuery): Promise<GovernanceReadModel>;
  createRole(input: GovernanceMutationRequest): Promise<GovernanceMutationResult>;
  getRole(roleId: RoleId): Promise<GovernanceReadModel>;
  updateRole(roleId: RoleId, input: GovernanceMutationRequest): Promise<GovernanceMutationResult>;
  getPermissionMatrix(input: GovernanceListQuery): Promise<GovernanceReadModel>;
  getSettingsGroup(group: string): Promise<GovernanceReadModel>;
  updateSettingsGroup(group: string, input: GovernanceMutationRequest): Promise<GovernanceMutationResult>;
  listFeatureFlags(input: GovernanceListQuery): Promise<GovernanceReadModel>;
  updateFeatureFlag(flagId: FlagId, input: GovernanceMutationRequest): Promise<GovernanceMutationResult>;
  getMaintenance(): Promise<GovernanceReadModel>;
  updateMaintenance(input: GovernanceMutationRequest): Promise<GovernanceMutationResult>;
}

function params(input: GovernanceListQuery): string {
  const parsed = adminListQuerySchema.parse({
    page: input.page,
    pageSize: input.pageSize,
    search: input.search,
    status: input.status,
  });
  const values = new URLSearchParams({
    page: String(parsed.page),
    pageSize: String(parsed.pageSize),
    status: parsed.status,
  });
  if (parsed.search) values.set("search", parsed.search);
  return values.toString();
}

export const governanceRepository: GovernanceRepository = {
  async listAdminUsers(input) {
    if (mocksEnabled()) return apiClient.get(`/api/v1/admin/admin-users?${params(input)}`, adminListResponseSchema);
    const parsed = paginationQuerySchema.parse({ page: input.page, pageSize: input.pageSize });
    const filters = new URLSearchParams();
    if (input.search) filters.set("search", input.search);
    if (input.status && input.status !== "all") filters.set("status", input.status);
    return loadCursorPage("/api/v1/admin/access/admins", be3AdminPageSchema, parsed, filters);
  },
  getAdminUser(adminId) {
    const parsed = adminIdSchema.parse(adminId);
    return mocksEnabled()
      ? apiClient.get(`/api/v1/admin/admin-users/${encodeURIComponent(parsed)}`, adminUserDetailSchema)
      : apiClient.get(`/api/v1/admin/access/admins/${encodeURIComponent(parsed)}`, be3AdminDetailSchema);
  },
  async listAdminInvitations(input) {
    const parsed = paginationQuerySchema.parse({ page: input.page, pageSize: input.pageSize });
    if (mocksEnabled()) return apiClient.get(`/api/v1/admin/admin-invitations?page=${parsed.page}&pageSize=${parsed.pageSize}`, invitationListResponseSchema);
    return loadCursorPage("/api/v1/admin/access/invitations", be3InvitationPageSchema, parsed);
  },
  inviteAdmin(input) {
    const request = inviteAdminRequestSchema.parse(input);
    if (mocksEnabled()) return apiClient.post("/api/v1/admin/admin-invitations", request, inviteAdminResultSchema);
    return apiClient.post("/api/v1/admin/access/invitations", {
      email: request.email,
      name: request.name,
      roleId: request.roleId,
      department: request.department,
      expiresInHours: request.expiryDays * 24,
      ...(request.message === undefined ? {} : { message: request.message }),
    }, be3InvitationSchema);
  },
  disableAdmin(adminId, input) {
    const parsed = adminIdSchema.parse(adminId);
    const request = disableAdminRequestSchema.parse({ ...input, adminId: parsed });
    if (mocksEnabled()) return apiClient.post(`/api/v1/admin/admin-users/${encodeURIComponent(parsed)}/disable`, request, disableAdminResultSchema);
    return apiClient.post(`/api/v1/admin/access/admins/${encodeURIComponent(parsed)}/disable`, {
      reason: request.reason, revokeEligibleSessions: request.revokeEligibleSessions,
      ...(request.replacementAdminId ? { replacementAdminId: request.replacementAdminId } : {}), expectedVersion: request.expectedVersion,
    }, be3AdminSchema);
  },
  revokeAdminSessions(adminId, input) {
    const parsed = adminIdSchema.parse(adminId);
    const request = revokeAdminSessionsRequestSchema.parse({ ...input, adminId: parsed });
    if (mocksEnabled()) return apiClient.post(`/api/v1/admin/admin-users/${encodeURIComponent(parsed)}/sessions/revoke`, request, revokeAdminSessionsResultSchema);
    return apiClient.post(`/api/v1/admin/access/admins/${encodeURIComponent(parsed)}/sessions/revoke`, {
      sessionIds: request.sessionIds, revokeAllEligible: request.revokeAllEligible,
      reason: request.reason, expectedVersion: request.expectedVersion,
    }, be3SessionRevokeResultSchema);
  },
  async assignAdminRoles(adminId, input) {
    const parsed = adminIdSchema.parse(adminId);
    const request = assignAdminRolesRequestSchema.parse({ ...input, adminId: parsed });
    if (mocksEnabled()) return apiClient.post(`/api/v1/admin/admin-users/${encodeURIComponent(parsed)}/roles`, request, assignAdminRolesResultSchema);
    if (request.roleIds.length !== 1) throw new Error("ONE_ROLE_ASSIGNMENT_PER_REQUEST_REQUIRED");
    return apiClient.post("/api/v1/admin/access/assignments", {
      userId: parsed, roleId: request.roleIds[0], reason: request.reason,
    }, be3AssignmentSchema);
  },
  async revokeAdminRole(assignmentId, input) {
    const id = z.uuid().parse(assignmentId);
    const request = revokeAdminRoleRequestSchema.parse(input);
    await apiClient.delete(
      `/api/v1/admin/access/assignments/${encodeURIComponent(id)}`,
      request,
      z.null(),
      null,
    );
  },
  acceptAdminInvitation(token) {
    const request = acceptAdminInvitationRequestSchema.parse({ token });
    return apiClient.post(
      "/api/v1/admin/access/invitations/accept",
      request,
      acceptAdminInvitationResultSchema,
    );
  },
  async listRoles(input) {
    const parsed = paginationQuerySchema.parse({ page: input.page, pageSize: input.pageSize });
    const values = new URLSearchParams({ page: String(parsed.page), pageSize: String(parsed.pageSize) });
    if (input.search) values.set("search", input.search);
    if (mocksEnabled()) return apiClient.get(`/api/v1/admin/roles?${values.toString()}`, roleListResponseSchema);
    const filters = new URLSearchParams();
    if (input.search) filters.set("search", input.search);
    return loadCursorPage("/api/v1/admin/access/roles", be3RolePageSchema, parsed, filters);
  },
  createRole(input) {
    const request = roleCreateRequestSchema.parse(input);
    if (mocksEnabled()) return apiClient.post("/api/v1/admin/roles", request, roleMutationResultSchema);
    return apiClient.post("/api/v1/admin/access/roles", { key: request.key, name: request.name.en, description: request.description, permissionKeys: request.permissionKeys, reason: request.reason }, be3RoleSchema);
  },
  getRole(roleId) {
    const parsed = roleIdSchema.parse(roleId);
    return mocksEnabled()
      ? apiClient.get(`/api/v1/admin/roles/${encodeURIComponent(parsed)}`, roleSchema)
      : apiClient.get(`/api/v1/admin/access/roles/${encodeURIComponent(parsed)}`, be3RoleSchema);
  },
  updateRole(roleId, input) {
    const parsed = roleIdSchema.parse(roleId);
    const request = roleUpdateRequestSchema.parse(input);
    if (mocksEnabled()) return apiClient.post(`/api/v1/admin/roles/${encodeURIComponent(parsed)}`, request, roleMutationResultSchema);
    return apiClient.patch(`/api/v1/admin/access/roles/${encodeURIComponent(parsed)}`, {
      ...(request.name ? { name: request.name.en } : {}),
      ...(request.description !== undefined ? { description: request.description } : {}),
      ...(request.permissionKeys ? { permissionKeys: request.permissionKeys } : {}),
      ...(request.status ? { enabled: request.status === "active" } : {}),
      reason: request.reason, expectedVersion: request.expectedVersion,
    }, be3RoleSchema);
  },
  async getPermissionMatrix(input) {
    const parsed = paginationQuerySchema.parse({ page: input.page, pageSize: input.pageSize });
    if (mocksEnabled()) return apiClient.get("/api/v1/admin/permissions", permissionMatrixSchema);
    return loadCursorPage("/api/v1/admin/access/permissions", be3PermissionPageSchema, parsed);
  },
  getSettingsGroup(group) {
    const parsed = settingsGroupNameSchema.parse(group);
    if (mocksEnabled())
      return apiClient.get(`/api/v1/admin/settings/${encodeURIComponent(parsed)}`, settingsGroupSchema);
    const key = operationsSettingByGroup[parsed as keyof typeof operationsSettingByGroup];
    if (!key) throw new Error("SETTING_NOT_AVAILABLE_IN_FREE_RELEASE");
    return apiClient.get(`/api/v1/admin/settings/${encodeURIComponent(key)}`, phase13SettingSchema).then((setting) => ({ group: parsed, operationsSetting: true, values: { settingKey: setting.key, value: setting.value ?? null, sensitivity: setting.sensitivity, redacted: setting.redacted }, version: setting.version, updatedAt: setting.updatedAt }));
  },
  async updateSettingsGroup(group, input) {
    const parsed = settingsGroupNameSchema.parse(group);
    const request = updateSettingsGroupRequestSchema.parse(input);
    if (mocksEnabled())
      return apiClient.post(`/api/v1/admin/settings/${encodeURIComponent(parsed)}`, request, settingsGroupSchema);
    const key = operationsSettingByGroup[parsed as keyof typeof operationsSettingByGroup];
    if (!key) throw new Error("SETTING_NOT_AVAILABLE_IN_FREE_RELEASE");
    const changeKeys = Object.keys(request.changes);
    if (changeKeys.length === 0) throw new Error("SETTING_CHANGE_REQUIRED");
    const value = changeKeys.length === 1 && changeKeys[0] === "value"
      ? request.changes.value
      : request.changes;
    const result = await apiClient.patch(`/api/v1/admin/settings/${encodeURIComponent(key)}`, { value, expectedVersion: request.expectedVersion, reason: request.reason }, phase13MutationResultSchema);
    return { ...result, group: parsed };
  },
  async listFeatureFlags(input) {
    const parsed = paginationQuerySchema.parse({ page: input.page, pageSize: input.pageSize });
    if (mocksEnabled())
      return apiClient.get(`/api/v1/admin/feature-flags?page=${parsed.page}&pageSize=${parsed.pageSize}`, featureFlagListResponseSchema);
    const filters = new URLSearchParams();
    if (input.search) filters.set("search", input.search);
    if (input.status && input.status !== "all") filters.set("status", input.status === "disabled" ? "draft" : input.status === "ended" ? "retired" : input.status);
    const result = await loadCursorPage("/api/v1/admin/feature-flags", phase13FeatureFlagPageSchema, parsed, filters);
    return featureFlagListResponseSchema.parse({
      items: result.items.map((flag) => ({
        id: flag.key,
        key: flag.key,
        label: { ar: flag.description, en: flag.description },
        platform: "shared",
        audience: flag.rules.some((rule) => rule.audience.cohort === "internal") ? "internal_testers" : "all_customers",
        rolloutPercent: flag.defaultEnabled ? 100 : flag.rules.some(isPercentageRule) ? new Set(flag.rules.filter((rule) => rule.enabled && isPercentageRule(rule)).map((rule) => rule.audience.cohort)).size : flag.rules.some((rule) => rule.enabled) ? 100 : 0,
        targetingRules: flag.rules.map(({ priority, audience, enabled }) => ({ priority, audience, enabled })),
        status: flag.status === "draft" ? "disabled" : flag.status === "active" ? "active" : "ended",
        startsAt: null,
        endsAt: null,
        version: flag.version,
        updatedAt: null,
      })),
      total: result.total,
      page: parsed.page,
      pageSize: parsed.pageSize,
    });
  },
  async updateFeatureFlag(flagId, input) {
    const parsed = flagIdSchema.parse(flagId);
    const request = updateFeatureFlagRequestSchema.parse(input);
    if (mocksEnabled())
      return apiClient.post(`/api/v1/admin/feature-flags/${encodeURIComponent(parsed)}`, request, featureFlagResultSchema);
    if (request.status === "scheduled") throw new Error("FLAG_SCHEDULE_UNSUPPORTED");
    if (request.audience && !["all_customers", "internal_testers"].includes(request.audience))
      throw new Error("FLAG_AUDIENCE_UNSUPPORTED");
    const response = await apiClient.get(`/api/v1/admin/feature-flags?limit=1&key=${encodeURIComponent(parsed)}`, phase13FeatureFlagPageSchema);
    const current = response.items.find((flag) => flag.key === parsed);
    if (!current) throw new Error("FLAG_NOT_FOUND");
    const rawRules = current.rules.map(({ priority, audience, enabled }) => ({ priority, audience, enabled }));
    const globalRollout = current.defaultEnabled || rawRules.length === 0 || rawRules.some(isPercentageRule);
    const currentAudience = rawRules.some((rule) => rule.audience.cohort === "internal") ? "internal_testers" : "all_customers";
    if (request.audience !== undefined && request.audience !== currentAudience) throw new Error("FLAG_AUDIENCE_CHANGE_UNSUPPORTED");
    const percent = request.rolloutPercent ?? (current.defaultEnabled ? 100 : rawRules.some(isPercentageRule)
      ? rawRules.filter((rule) => rule.enabled && isPercentageRule(rule)).length
      : rawRules.some((rule) => rule.enabled) ? 100 : 0);
    let rules = rawRules;
    let defaultEnabled = current.defaultEnabled;
    if (request.rolloutPercent !== undefined) {
      if ((current.defaultEnabled && rawRules.length > 0) ||
          (currentAudience === "internal_testers" && rawRules.some(isPercentageRule)) ||
          (!globalRollout && new Set(rawRules.map(rule => rule.enabled)).size > 1)) {
        throw new Error("FLAG_ROLLOUT_SHAPE_UNSUPPORTED");
      }
      if (globalRollout) {
        const retained = rawRules.filter((rule) => !isPercentageRule(rule));
        defaultEnabled = percent === 100 && retained.length === 0;
        rules = defaultEnabled ? [] : [...retained, ...percentageRules(percent)];
      } else {
        // Cohort is a single context value; internal AND percentage cannot be represented.
        if (percent !== 0 && percent !== 100) throw new Error("FLAG_ROLLOUT_SHAPE_UNSUPPORTED");
        rules = rawRules.map((rule) => ({ ...rule, enabled: percent === 100 }));
        defaultEnabled = false;
      }
    }
    if (rules.length > 100) throw new Error("FLAG_RULE_LIMIT_EXCEEDED");
    return apiClient.patch(`/api/v1/admin/feature-flags/${encodeURIComponent(parsed)}`, {
      defaultEnabled,
      rules,
      ...(request.status ? { status: request.status === "disabled" ? "draft" : "active" } : {}),
      expectedVersion: request.expectedVersion,
      reason: request.reason,
    }, phase13MutationResultSchema);
  },
  async getMaintenance() {
    if (mocksEnabled()) return apiClient.get("/api/v1/admin/maintenance", maintenanceSchema);
    const page = await apiClient.get("/api/v1/admin/maintenance?limit=1&current=true", phase13MaintenancePageSchema);
    const item = page.items.find(({ status }) => status === "active") ?? page.items.find(({ status }) => status === "scheduled");
    if (item) maintenanceWindows.set(apiActorCacheKey(), item);
    else maintenanceWindows.delete(apiActorCacheKey());
    return maintenanceSchema.parse(item
      ? { state: item.status === "active" ? "active" : "scheduled", message: item.message, startsAt: item.startsAt, endsAt: item.endsAt, version: item.version, updatedAt: null, mockOnly: false }
      : { state: "off", message: null, startsAt: null, endsAt: null, version: null, updatedAt: null, mockOnly: false });
  },
  async updateMaintenance(input) {
    const request = updateMaintenanceRequestSchema.parse(input);
    if (mocksEnabled()) return apiClient.post("/api/v1/admin/maintenance", request, maintenanceResultSchema);
    const maintenanceWindow = maintenanceWindows.get(apiActorCacheKey());
    const startsAt = request.startsAt ?? maintenanceWindow?.startsAt ?? null;
    const endsAt = request.endsAt ?? maintenanceWindow?.endsAt ?? null;
    if (request.nextState !== "off" && (!startsAt || !endsAt)) throw new Error("MAINTENANCE_WINDOW_REQUIRED");
    const body = maintenanceWindow
      ? {
          status: request.nextState === "active" ? "active" : maintenanceWindow.status === "active" ? "completed" : "canceled",
          ...(request.startsAt ? { startsAt: request.startsAt } : {}),
          ...(request.endsAt ? { endsAt: request.endsAt } : {}),
          message: request.message,
          expectedVersion: request.expectedVersion,
          reason: request.reason,
        }
      : { startsAt: request.startsAt, endsAt: request.endsAt, scopes: ["api"], message: request.message, reason: request.reason };
    const result = maintenanceWindow
      ? await apiClient.patch(`/api/v1/admin/maintenance/${maintenanceWindow.id}`, body, phase13MutationResultSchema)
      : await apiClient.post("/api/v1/admin/maintenance", body, phase13MutationResultSchema);
    if (request.nextState === "off") maintenanceWindows.delete(apiActorCacheKey());
    else maintenanceWindows.set(apiActorCacheKey(), {
        id: result.resourceId,
        startsAt: startsAt!,
        endsAt: endsAt!,
        scopes: maintenanceWindow?.scopes ?? ["api"],
        message: request.message,
        status: request.nextState === "active" ? "active" : "scheduled",
        version: result.version,
      });
    return { ...result, maintenance: { state: request.nextState, message: request.message, startsAt, endsAt, version: result.version, updatedAt: null, mockOnly: false } };
  },
};
