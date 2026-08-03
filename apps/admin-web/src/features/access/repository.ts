import { apiClient } from "@/core/api/client";
import type { AdminRole } from "@/core/permissions/permissions";
import {
  accessDecisionInputSchema,
  accessRequestDetailSchema,
  accessRequestIdSchema,
  accessRequestsPageSchema,
  accessRequestsQuerySchema,
  createAccessRequestSchema,
  endTemporaryAccessRequestSchema,
  endTemporaryAccessResultSchema,
  revokeAccessRequestSchema,
  temporaryWorkspaceSchema,
  type AccessDecisionRequest,
  type AccessRequestDetail,
  type AccessRequestsPage,
  type AccessRequestsQuery,
  type CreateAccessRequest,
  type EndTemporaryAccessRequest,
  type EndTemporaryAccessResult,
  type RevokeAccessRequest,
  type TemporaryWorkspace,
} from "./contracts";

function roleQuery(role: AdminRole, scenario?: string): string {
  const params = new URLSearchParams({ role });
  const normalizedScenario = accessRequestsQuerySchema.shape.scenario.parse(scenario);
  if (normalizedScenario) params.set("__scenario", normalizedScenario);
  return params.toString();
}

export const accessRepository = {
  listRequests(input: Partial<AccessRequestsQuery>, role: AdminRole): Promise<AccessRequestsPage> {
    const query = accessRequestsQuerySchema.parse(input);
    const params = new URLSearchParams({ role });
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== "") params.set(key === "scenario" ? "__scenario" : key, String(value));
    }
    return apiClient.get(`/api/v1/admin/access-requests?${params}`, accessRequestsPageSchema);
  },

  getRequest(requestId: string, role: AdminRole, scenario?: string): Promise<AccessRequestDetail> {
    const id = accessRequestIdSchema.parse(requestId);
    return apiClient.get(
      `/api/v1/admin/access-requests/${encodeURIComponent(id)}?${roleQuery(role, scenario)}`,
      accessRequestDetailSchema,
    );
  },

  createRequest(input: CreateAccessRequest, role: AdminRole): Promise<AccessRequestDetail> {
    return apiClient.post(
      `/api/v1/admin/access-requests?${roleQuery(role)}`,
      createAccessRequestSchema.parse(input),
      accessRequestDetailSchema,
    );
  },

  decideRequest(
    requestId: string,
    input: AccessDecisionRequest,
    role: AdminRole,
  ): Promise<AccessRequestDetail> {
    const id = accessRequestIdSchema.parse(requestId);
    return apiClient.post(
      `/api/v1/admin/access-requests/${encodeURIComponent(id)}/decision?${roleQuery(role)}`,
      accessDecisionInputSchema.parse(input),
      accessRequestDetailSchema,
    );
  },

  revokeRequest(requestId: string, input: RevokeAccessRequest, role: AdminRole): Promise<AccessRequestDetail> {
    const id = accessRequestIdSchema.parse(requestId);
    return apiClient.post(
      `/api/v1/admin/access-requests/${encodeURIComponent(id)}/revoke?${roleQuery(role)}`,
      revokeAccessRequestSchema.parse(input),
      accessRequestDetailSchema,
    );
  },

  getWorkspace(requestId: string, role: AdminRole, scenario?: string): Promise<TemporaryWorkspace> {
    const id = accessRequestIdSchema.parse(requestId);
    return apiClient.get(
      `/api/v1/admin/access-requests/${encodeURIComponent(id)}/workspace?${roleQuery(role, scenario)}`,
      temporaryWorkspaceSchema,
    );
  },

  endAccess(
    requestId: string,
    input: EndTemporaryAccessRequest,
    role: AdminRole,
  ): Promise<EndTemporaryAccessResult> {
    const id = accessRequestIdSchema.parse(requestId);
    return apiClient.post(
      `/api/v1/admin/access-requests/${encodeURIComponent(id)}/end?${roleQuery(role)}`,
      endTemporaryAccessRequestSchema.parse(input),
      endTemporaryAccessResultSchema,
    );
  },
};
