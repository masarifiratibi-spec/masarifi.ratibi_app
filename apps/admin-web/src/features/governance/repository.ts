import { apiClient } from "@/core/api/client";
import type { z } from "zod";
import {
  adminIdSchema,
  adminListQuerySchema,
  adminListResponseSchema,
  adminUserDetailSchema,
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
  permissionMatrixSchema,
  settingsGroupNameSchema,
  settingsGroupSchema,
  updateSettingsGroupRequestSchema,
  updateFeatureFlagRequestSchema,
  maintenanceSchema,
  maintenanceResultSchema,
  updateMaintenanceRequestSchema,
} from "./contracts";

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
  listAdminUsers(input) {
    return apiClient.get(`/api/v1/admin/admin-users?${params(input)}`, adminListResponseSchema);
  },
  getAdminUser(adminId) {
    const parsed = adminIdSchema.parse(adminId);
    return apiClient.get(`/api/v1/admin/admin-users/${encodeURIComponent(parsed)}`, adminUserDetailSchema);
  },
  listAdminInvitations(input) {
    const parsed = paginationQuerySchema.parse({ page: input.page, pageSize: input.pageSize });
    return apiClient.get(
      `/api/v1/admin/admin-invitations?page=${parsed.page}&pageSize=${parsed.pageSize}`,
      invitationListResponseSchema,
    );
  },
  inviteAdmin(input) {
    return apiClient.post("/api/v1/admin/admin-invitations", inviteAdminRequestSchema.parse(input), inviteAdminResultSchema);
  },
  disableAdmin(adminId, input) {
    const parsed = adminIdSchema.parse(adminId);
    return apiClient.post(
      `/api/v1/admin/admin-users/${encodeURIComponent(parsed)}/disable`,
      disableAdminRequestSchema.parse({ ...input, adminId: parsed }),
      disableAdminResultSchema,
    );
  },
  revokeAdminSessions(adminId, input) {
    const parsed = adminIdSchema.parse(adminId);
    return apiClient.post(
      `/api/v1/admin/admin-users/${encodeURIComponent(parsed)}/sessions/revoke`,
      revokeAdminSessionsRequestSchema.parse({ ...input, adminId: parsed }),
      revokeAdminSessionsResultSchema,
    );
  },
  assignAdminRoles(adminId, input) {
    const parsed = adminIdSchema.parse(adminId);
    return apiClient.post(
      `/api/v1/admin/admin-users/${encodeURIComponent(parsed)}/roles`,
      assignAdminRolesRequestSchema.parse({ ...input, adminId: parsed }),
      assignAdminRolesResultSchema,
    );
  },
  listRoles(input) {
    const parsed = paginationQuerySchema.parse({ page: input.page, pageSize: input.pageSize });
    const values = new URLSearchParams({ page: String(parsed.page), pageSize: String(parsed.pageSize) });
    if (input.search) values.set("search", input.search);
    return apiClient.get(`/api/v1/admin/roles?${values.toString()}`, roleListResponseSchema);
  },
  createRole(input) {
    return apiClient.post("/api/v1/admin/roles", roleCreateRequestSchema.parse(input), roleMutationResultSchema);
  },
  getRole(roleId) {
    const parsed = roleIdSchema.parse(roleId);
    return apiClient.get(`/api/v1/admin/roles/${encodeURIComponent(parsed)}`, roleSchema);
  },
  updateRole(roleId, input) {
    const parsed = roleIdSchema.parse(roleId);
    return apiClient.post(`/api/v1/admin/roles/${encodeURIComponent(parsed)}`, roleUpdateRequestSchema.parse(input), roleMutationResultSchema);
  },
  getPermissionMatrix(input) {
    paginationQuerySchema.parse({ page: input.page, pageSize: input.pageSize });
    return apiClient.get("/api/v1/admin/permissions", permissionMatrixSchema);
  },
  getSettingsGroup(group) {
    const parsed = settingsGroupNameSchema.parse(group);
    return apiClient.get(`/api/v1/admin/settings/${encodeURIComponent(parsed)}`, settingsGroupSchema);
  },
  updateSettingsGroup(group, input) {
    const parsed = settingsGroupNameSchema.parse(group);
    return apiClient.post(
      `/api/v1/admin/settings/${encodeURIComponent(parsed)}`,
      updateSettingsGroupRequestSchema.parse(input),
      settingsGroupSchema,
    );
  },
  listFeatureFlags(input) {
    const parsed = paginationQuerySchema.parse({ page: input.page, pageSize: input.pageSize });
    return apiClient.get(`/api/v1/admin/feature-flags?page=${parsed.page}&pageSize=${parsed.pageSize}`, featureFlagListResponseSchema);
  },
  updateFeatureFlag(flagId, input) {
    const parsed = flagIdSchema.parse(flagId);
    return apiClient.post(
      `/api/v1/admin/feature-flags/${encodeURIComponent(parsed)}`,
      updateFeatureFlagRequestSchema.parse(input),
      featureFlagResultSchema,
    );
  },
  getMaintenance() {
    return apiClient.get("/api/v1/admin/maintenance", maintenanceSchema);
  },
  updateMaintenance(input) {
    return apiClient.post("/api/v1/admin/maintenance", updateMaintenanceRequestSchema.parse(input), maintenanceResultSchema);
  },
};
