import { apiClient, mocksEnabled } from "@/core/api/client";
import { liveAccessRepository } from "./live-repository";
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
  const params = new URLSearchParams();
  if (mocksEnabled()) params.set("role", role);
  const normalizedScenario = accessRequestsQuerySchema.shape.scenario.parse(scenario);
  if (mocksEnabled() && normalizedScenario) params.set("__scenario", normalizedScenario);
  return params.toString();
}

function withQuery(path: string, query: string): string {
  return query ? `${path}?${query}` : path;
}

export const accessRepository = {
  listRequests(input: Partial<AccessRequestsQuery>, role: AdminRole): Promise<AccessRequestsPage> {
    if (!mocksEnabled()) return liveAccessRepository.listRequests(input);
    const query = accessRequestsQuerySchema.parse(input);
    const params = new URLSearchParams();
    if (mocksEnabled()) params.set("role", role);
    for (const [key, value] of Object.entries(query)) {
      if (!mocksEnabled() && key === "scenario") continue;
      if (value !== undefined && value !== "") params.set(key === "scenario" ? "__scenario" : key, String(value));
    }
    return apiClient.get(withQuery("/api/v1/admin/access-requests", params.toString()), accessRequestsPageSchema);
  },

  getRequest(requestId: string, role: AdminRole, scenario?: string): Promise<AccessRequestDetail> {
    if (!mocksEnabled()) return liveAccessRepository.getRequest(requestId);
    const id = accessRequestIdSchema.parse(requestId);
    return apiClient.get(
      withQuery(`/api/v1/admin/access-requests/${encodeURIComponent(id)}`, roleQuery(role, scenario)),
      accessRequestDetailSchema,
    );
  },

  createRequest(input: CreateAccessRequest, role: AdminRole): Promise<AccessRequestDetail> {
    if (!mocksEnabled()) return liveAccessRepository.createRequest(input);
    return apiClient.post(
      withQuery("/api/v1/admin/access-requests", roleQuery(role)),
      createAccessRequestSchema.parse(input),
      accessRequestDetailSchema,
    );
  },

  decideRequest(
    requestId: string,
    input: AccessDecisionRequest,
    role: AdminRole,
  ): Promise<AccessRequestDetail> {
    if (!mocksEnabled()) return liveAccessRepository.decideRequest(requestId, input);
    const id = accessRequestIdSchema.parse(requestId);
    return apiClient.post(
      withQuery(`/api/v1/admin/access-requests/${encodeURIComponent(id)}/decision`, roleQuery(role)),
      accessDecisionInputSchema.parse(input),
      accessRequestDetailSchema,
    );
  },

  revokeRequest(requestId: string, input: RevokeAccessRequest, role: AdminRole): Promise<AccessRequestDetail> {
    if (!mocksEnabled()) return liveAccessRepository.revokeRequest(requestId, input);
    const id = accessRequestIdSchema.parse(requestId);
    return apiClient.post(
      withQuery(`/api/v1/admin/access-requests/${encodeURIComponent(id)}/revoke`, roleQuery(role)),
      revokeAccessRequestSchema.parse(input),
      accessRequestDetailSchema,
    );
  },

  getWorkspace(requestId: string, role: AdminRole, scenario?: string): Promise<TemporaryWorkspace> {
    if (!mocksEnabled()) return liveAccessRepository.getWorkspace(requestId);
    const id = accessRequestIdSchema.parse(requestId);
    return apiClient.get(
      withQuery(`/api/v1/admin/access-requests/${encodeURIComponent(id)}/workspace`, roleQuery(role, scenario)),
      temporaryWorkspaceSchema,
    );
  },

  endAccess(
    requestId: string,
    input: EndTemporaryAccessRequest,
    role: AdminRole,
  ): Promise<EndTemporaryAccessResult> {
    if (!mocksEnabled()) return liveAccessRepository.endAccess(requestId, input);
    const id = accessRequestIdSchema.parse(requestId);
    return apiClient.post(
      withQuery(`/api/v1/admin/access-requests/${encodeURIComponent(id)}/end`, roleQuery(role)),
      endTemporaryAccessRequestSchema.parse(input),
      endTemporaryAccessResultSchema,
    );
  },
};
