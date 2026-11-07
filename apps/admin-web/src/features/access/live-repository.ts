import { ApiError } from "@/core/api/errors";
import { apiActorCacheKey, apiClient, liveCursor, rememberLiveCursor } from "@/core/api/client";
import {
  accessDecisionInputSchema, accessRequestDetailSchema, accessRequestIdSchema, accessRequestSummarySchema,
  accessRequestsQuerySchema, createAccessRequestSchema, endTemporaryAccessRequestSchema, revokeAccessRequestSchema,
  temporaryWorkspaceSchema, type AccessDecisionRequest, type AccessRequestsQuery, type AccessScope, type AccessStatus,
  type CreateAccessRequest, type EndTemporaryAccessRequest, type RevokeAccessRequest,
} from "./contracts";
import { liveAccessPageSchema, liveAccessRequestSchema, liveWorkspaceSchema, type LiveAccessRequest } from "./live-contracts";

const path = "/api/v1/admin/support-access/requests";
const invalid = () => new ApiError("validation_error", "Invalid support-access command.", 400);
const mismatch = () => new ApiError("contract_mismatch", "Invalid support-access response.", 502);
const endpoint = (id: string) => `${path}/${encodeURIComponent(accessRequestIdSchema.parse(id))}`;

const actions: Record<AccessScope, Array<"read-masked" | "read-status" | "read-aggregate">> = {
  "profile-contact": ["read-masked"], "account-status": ["read-status"],
  "device-diagnostics": ["read-aggregate", "read-status"], "session-diagnostics": ["read-aggregate"],
  "subscription-summary": ["read-status"], "import-summary": ["read-aggregate"],
};

function displayStatus(row: LiveAccessRequest): AccessStatus {
  if (row.status === "denied") return "rejected";
  if (row.status !== "approved") return row.status;
  if (row.grant?.revokedAt) return "revoked";
  if (Date.parse(row.grant?.expiresAt ?? row.expiresAt) <= Date.now()) return "expired";
  if (row.grant && Date.parse(row.grant.startsAt) <= Date.now() && (!row.customerApprovalRequired || row.customerApprovedAt)) return "active";
  return "approved";
}

function summary(row: LiveAccessRequest) {
  return accessRequestSummarySchema.parse({
    id: row.id, userId: row.user.id, maskedCustomerLabel: row.user.label, supportTicketId: row.supportTicketId,
    requestedBy: row.requester.id, assignee: row.assignee.id, requestedScope: row.scopes.map(scope => scope.resource),
    approvedScope: row.grant?.scopes.map(scope => scope.resource) ?? null, requestedScopeActions: row.scopes, approvedScopeActions: row.grant?.scopes ?? null, reasonSummary: row.purpose?.slice(0, 160) ?? null,
    status: displayStatus(row), createdAt: row.createdAt ?? null, startsAt: row.grant?.startsAt ?? null,
    expiresAt: row.grant?.expiresAt ?? row.expiresAt, approvedBy: row.approvedBy?.id ?? null, version: row.version,
  });
}
function detail(row: LiveAccessRequest) {
  return accessRequestDetailSchema.parse({ ...summary(row), ticketSummary: null, customerSummary: null,
    reason: row.purpose ?? null, requestedDurationMinutes: row.requestedDurationMinutes ?? null,
    approvedDurationMinutes: row.grant ? Math.ceil((Date.parse(row.grant.expiresAt) - Date.parse(row.grant.startsAt)) / 60_000) : null,
    maskingRules: ["Server-authorized masked, status and aggregate fields only"], customerApprovalRequired: row.customerApprovalRequired,
    customerApprovalState: !row.customerApprovalRequired ? "not-required" : row.customerApprovedAt ? "received" : "pending",
    timeline: [], region: { availability: "available" },
  });
}
function version(value: number | undefined): number {
  if (!value || !Number.isSafeInteger(value)) throw invalid();
  return value;
}

export const liveAccessRepository = {
  async listRequests(input: Partial<AccessRequestsQuery>) {
    const query = accessRequestsQuerySchema.parse(input);
    if (query.status === "active") throw invalid(); // Canonical status approved includes timed grants; do not post-filter cursor pages.
    const filters = new URLSearchParams();
    if (query.status) filters.set("status", query.status === "rejected" ? "denied" : query.status);
    if (query.query) filters.set("search", query.query);
    if (query.assignee) filters.set("assignee", query.assignee);
    const scope = `${path}:${query.pageSize}:${filters.toString()}`;
    const cursor = liveCursor(scope, query.page);
    if (query.page > 1 && !cursor) throw invalid();
    const params = new URLSearchParams(filters); params.set("limit", String(query.pageSize));
    if (cursor) params.set("cursor", cursor);
    const response = await apiClient.get(`${path}?${params}`, liveAccessPageSchema);
    rememberLiveCursor(scope, query.page, response.nextCursor);
    return { items: response.items.map(summary), pagination: { page: query.page, pageSize: query.pageSize, totalItems: null, totalPages: null, hasNext: response.nextCursor !== null },
      region: { availability: response.items.length ? "available" as const : "empty" as const } };
  },
  async getRequest(id: string) { return detail(await apiClient.get(endpoint(id), liveAccessRequestSchema)); },
  async createRequest(input: CreateAccessRequest) {
    const value = createAccessRequestSchema.parse(input);
    const row = await apiClient.post(path, { userId: value.userId, supportTicketId: value.supportTicketId, assignee: value.assignee,
      purpose: value.reason, resourceScopes: value.requestedScope.map(resource => ({ resource, actions: actions[resource] })),
      durationMinutes: value.durationMinutes, customerApprovalRequired: value.customerApprovalRequired }, liveAccessRequestSchema);
    return detail(row);
  },
  async decideRequest(id: string, input: AccessDecisionRequest) {
    const value = accessDecisionInputSchema.parse(input);
    const expectedVersion = version(value.expectedVersion);
    const current = await apiClient.get(endpoint(id), liveAccessRequestSchema);
    // Keep the version the operator reviewed. The server rejects stale commands
    // and can replay an earlier immutable receipt after a lost response.
    if (current.requester.id === apiActorCacheKey()) throw new ApiError("forbidden", "Requester cannot decide own request.", 403);
    const approvedScope = value.approvedScope?.map(resource => {
      const scope = current.scopes.find(entry => entry.resource === resource);
      if (!scope) throw invalid();
      return scope; // Preserve the actions of this exact version, never reconstruct wider defaults.
    });
    if (value.decision === "approve" && (!current.purpose || !current.requestedDurationMinutes || !approvedScope?.length || !value.durationMinutes || value.durationMinutes > current.requestedDurationMinutes)) throw invalid();
    return detail(await apiClient.post(`${endpoint(id)}/decision`, { decision: value.decision === "reject" ? "deny" : "approve", reason: value.reason, expectedVersion,
      ...(value.decision === "approve" ? { approvedScope, durationMinutes: value.durationMinutes, startsAt: value.startsAt } : {}) }, liveAccessRequestSchema));
  },
  async revokeRequest(id: string, input: RevokeAccessRequest) {
    const value = revokeAccessRequestSchema.parse(input);
    return detail(await apiClient.post(`${endpoint(id)}/revoke`, { reason: value.reason, expectedVersion: version(value.expectedVersion) }, liveAccessRequestSchema));
  },
  async getWorkspace(id: string) {
    const raw = await apiClient.get(`${endpoint(id)}/workspace`, liveWorkspaceSchema);
    if (raw.requestId !== id) throw mismatch();
    if (Date.parse(raw.expiresAt) <= Date.now()) throw new ApiError("gone", "Support access is no longer active.", 410);
    // The authorized workspace carries only the context needed to use/end this
    // exact grant. It must not require the broader request-read permission.
    const access = raw.access;
    if (!access) throw mismatch(); // Older servers cannot prove this projection; fail closed.
    if (access.assignee !== apiActorCacheKey()) throw new ApiError("forbidden", "Workspace belongs to another operator.", 403);
    if (Date.parse(access.startsAt) > Date.now() || Date.parse(access.startsAt) >= Date.parse(raw.expiresAt)) throw mismatch();
    const authorized = access.scopes;
    if (raw.sections.length !== authorized.length) throw mismatch();
    const sections = raw.sections.map(section => {
      const allowed = authorized.find(scope => scope.resource === section.resource);
      if (!allowed) throw mismatch();
      const fields = Object.entries(section).flatMap(([key, value]) => {
        if (key === "resource" || key === "projection") return [];
        const needed = key === "emailMasked" || key === "phoneMasked" ? "read-masked" : key === "total" || key === "active" ? "read-aggregate" : "read-status";
        if (key !== "available" && !allowed.actions.includes(needed) && !(section.resource === "session-diagnostics" && key === "active" && allowed.actions.includes("read-status"))) throw mismatch();
        return [{ label: key, value: key === "available" ? null : value as string | number, classification: section.projection }];
      });
      return { scope: section.resource, title: section.resource, fields: fields.length ? fields : [{ label: "Unavailable", value: null, classification: section.projection }] };
    });
    return temporaryWorkspaceSchema.parse({ requestId: id, supportTicketId: access.supportTicketId, assignee: access.assignee,
      status: "active", approvedScope: raw.sections.map(section => section.resource), startsAt: access.startsAt,
      expiresAt: raw.expiresAt, accessNotice: "Time-limited server-authorized support access", auditIndicator: raw.grantId,
      sections, version: access.version, region: { availability: "available" } });
  },
  async endAccess(id: string, input: EndTemporaryAccessRequest) {
    const value = endTemporaryAccessRequestSchema.parse(input);
    const row = await apiClient.post(`${endpoint(id)}/end`, { reason: value.reason, expectedVersion: version(value.expectedVersion) }, liveAccessRequestSchema);
    if (row.status !== "revoked") throw mismatch();
    // The canonical receipt has no invented endedAt/audit event ID. Return the actual request receipt.
    return { requestId: row.id, status: "revoked" as const, version: row.version };
  },
};
