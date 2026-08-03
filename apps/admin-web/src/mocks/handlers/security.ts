import { http, HttpResponse } from "msw";
import { ADMIN_ROLES, type AdminRole, type PermissionKey } from "@/core/permissions/permissions";
import { hasPermission } from "@/core/permissions/role-map";
import {
  actionResultSchema,
  adminSecurityPageSchema,
  auditEventDetailSchema,
  auditEventsPageSchema,
  authenticationEventsPageSchema,
  deletionActionSchema,
  deletionRequestDetailSchema,
  deletionRequestsPageSchema,
  exportActionSchema,
  exportDownloadRequestSchema,
  exportDownloadResultSchema,
  exportRequestDetailSchema,
  exportRequestsPageSchema,
  incidentActionSchema,
  incidentDetailSchema,
  listQuerySchema,
  overviewQuerySchema,
  permissionChangePageSchema,
  retentionPoliciesPageSchema,
  retentionPolicyDetailSchema,
  retentionUpdateSchema,
  securityIdSchema,
  securityOverviewSchema,
  supportAccessPageSchema,
  supportAccessRevokeSchema,
  suspiciousActionSchema,
  suspiciousActivityPageSchema,
  type ListQuery,
} from "@/features/security/contracts";
import {
  adminSecurityFixture,
  auditEventFixture,
  authenticationEventsFixture,
  permissionChangeFixture,
  securityOverviewFixture,
} from "@/mocks/fixtures/security";
import {
  actOnDeletionRequest,
  actOnExportRequest,
  actOnIncident,
  actOnSuspiciousActivity,
  phase7State,
  revokeSupportAccess,
  simulateExportDownload,
  updateRetentionPolicy,
} from "@/mocks/phase7-security-state";

const auditSummaries = auditEventFixture.map((event) => ({
  id: event.id,
  occurredAt: event.occurredAt,
  actor: event.actor,
  action: event.action,
  resource: event.resource,
  target: event.target,
  result: event.result,
  severity: event.severity,
  correlationId: event.correlationId,
}));

function role(request: Request): AdminRole | null {
  const candidate = request.headers.get("x-admin-simulated-role");
  if (candidate === null) return "super-admin";
  return ADMIN_ROLES.find((item) => item === candidate) ?? null;
}

function forbidden(request: Request, permission: PermissionKey): Response | null {
  const current = role(request);
  return current && hasPermission(current, permission) ? null : safeSecurityError("forbidden", 403);
}

function safeSecurityError(code: string, status: number): Response {
  return HttpResponse.json({ code }, { status });
}

function queryValues(request: Request): Record<string, string> {
  return Object.fromEntries(new URL(request.url).searchParams.entries());
}

function page<T>(items: T[], query: ListQuery) {
  const pageNumber = Number(query.page ?? 1);
  const pageSize = Number(query.pageSize ?? 25) as 25 | 50 | 100;
  const start = (pageNumber - 1) * pageSize;
  return {
    items: items.slice(start, start + pageSize),
    pagination: {
      page: pageNumber,
      pageSize,
      totalItems: items.length,
      totalPages: items.length === 0 ? 0 : Math.ceil(items.length / pageSize),
    },
    region: { availability: items.length ? "available" as const : "empty" as const },
  };
}

function parseId(value: unknown, prefix: string): string | null {
  const parsed = securityIdSchema.safeParse(String(value));
  return parsed.success && parsed.data.startsWith(prefix) ? parsed.data : null;
}

async function body(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return undefined;
  }
}

function safeMutation(run: () => unknown): Response {
  try {
    return HttpResponse.json(actionResultSchema.parse(run()));
  } catch (error) {
    const status = typeof error === "object" && error !== null && "status" in error ? Number(error.status) : 400;
    const code = typeof error === "object" && error !== null && "code" in error ? String(error.code) : "validation_error";
    return safeSecurityError(code, status);
  }
}

export const securityHandlers = [
  http.get("/api/v1/admin/security/overview", ({ request }) => {
    const denied = forbidden(request, "security.events.read");
    if (denied) return denied;
    const parsed = overviewQuerySchema.safeParse(queryValues(request));
    if (!parsed.success) return safeSecurityError("validation_error", 400);
    return HttpResponse.json(securityOverviewSchema.parse({ ...securityOverviewFixture, query: parsed.data }));
  }),
  http.get("/api/v1/admin/security/authentication-events", ({ request }) => {
    const denied = forbidden(request, "security.events.read");
    if (denied) return denied;
    const parsed = listQuerySchema.safeParse(queryValues(request));
    if (!parsed.success) return safeSecurityError("validation_error", 400);
    return HttpResponse.json(authenticationEventsPageSchema.parse(page(authenticationEventsFixture, parsed.data)));
  }),
  http.get("/api/v1/admin/security/suspicious-activity", ({ request }) => {
    const denied = forbidden(request, "security.incidents.manage");
    if (denied) return denied;
    const parsed = listQuerySchema.safeParse(queryValues(request));
    if (!parsed.success) return safeSecurityError("validation_error", 400);
    return HttpResponse.json(suspiciousActivityPageSchema.parse(page(phase7State.suspiciousActivities(), parsed.data)));
  }),
  http.post("/api/v1/admin/security/suspicious-activity/:activityId/actions", async ({ params, request }) => {
    const denied = forbidden(request, "security.incidents.manage");
    if (denied) return denied;
    const id = parseId(params.activityId, "SUS-");
    const parsed = suspiciousActionSchema.safeParse(await body(request));
    if (!id || !parsed.success) return safeSecurityError("validation_error", 400);
    return safeMutation(() => actOnSuspiciousActivity(id, parsed.data));
  }),
  http.get("/api/v1/admin/security/admins", ({ request }) => {
    const denied = forbidden(request, "security.admins.read");
    if (denied) return denied;
    const parsed = listQuerySchema.safeParse(queryValues(request));
    if (!parsed.success) return safeSecurityError("validation_error", 400);
    return HttpResponse.json(adminSecurityPageSchema.parse(page(adminSecurityFixture, parsed.data)));
  }),
  http.get("/api/v1/admin/security/permission-changes", ({ request }) => {
    const denied = forbidden(request, "security.permissions.read");
    if (denied) return denied;
    const parsed = listQuerySchema.safeParse(queryValues(request));
    if (!parsed.success) return safeSecurityError("validation_error", 400);
    return HttpResponse.json(permissionChangePageSchema.parse(page(permissionChangeFixture, parsed.data)));
  }),
  http.get("/api/v1/admin/security/support-access", ({ request }) => {
    const denied = forbidden(request, "security.support_access.read");
    if (denied) return denied;
    const parsed = listQuerySchema.safeParse(queryValues(request));
    if (!parsed.success) return safeSecurityError("validation_error", 400);
    return HttpResponse.json(supportAccessPageSchema.parse(page(phase7State.supportAccess(), parsed.data)));
  }),
  http.post("/api/v1/admin/security/support-access/:accessId/revoke", async ({ params, request }) => {
    const denied = forbidden(request, "security.support_access.revoke");
    if (denied) return denied;
    const id = parseId(params.accessId, "SAC-");
    const parsed = supportAccessRevokeSchema.safeParse(await body(request));
    if (!id || !parsed.success) return safeSecurityError("validation_error", 400);
    return safeMutation(() => revokeSupportAccess(id, parsed.data));
  }),
  http.get("/api/v1/admin/security/incidents/:incidentId", ({ params, request }) => {
    const denied = forbidden(request, "security.incidents.manage");
    if (denied) return denied;
    const id = parseId(params.incidentId, "INC-");
    const incident = id ? phase7State.incident(id) : undefined;
    return incident ? HttpResponse.json(incidentDetailSchema.parse(incident)) : safeSecurityError(id ? "not_found" : "validation_error", id ? 404 : 400);
  }),
  http.post("/api/v1/admin/security/incidents/:incidentId/actions", async ({ params, request }) => {
    const denied = forbidden(request, "security.incidents.manage");
    if (denied) return denied;
    const id = parseId(params.incidentId, "INC-");
    const parsed = incidentActionSchema.safeParse(await body(request));
    if (!id || !parsed.success) return safeSecurityError("validation_error", 400);
    return safeMutation(() => actOnIncident(id, parsed.data));
  }),
  http.get("/api/v1/admin/audit-events", ({ request }) => {
    const denied = forbidden(request, "audit.logs.read");
    if (denied) return denied;
    const parsed = listQuerySchema.safeParse(queryValues(request));
    if (!parsed.success) return safeSecurityError("validation_error", 400);
    return HttpResponse.json(auditEventsPageSchema.parse(page(auditSummaries, parsed.data)));
  }),
  http.get("/api/v1/admin/audit-events/:eventId", ({ params, request }) => {
    const denied = forbidden(request, "audit.logs.read");
    if (denied) return denied;
    const id = parseId(params.eventId, "AUD-");
    const event = auditEventFixture.find((item) => item.id === id);
    return event ? HttpResponse.json(auditEventDetailSchema.parse(event)) : safeSecurityError(id ? "not_found" : "validation_error", id ? 404 : 400);
  }),
  http.get("/api/v1/admin/data-requests/exports", ({ request }) => {
    const denied = forbidden(request, "data_requests.exports.read");
    if (denied) return denied;
    const parsed = listQuerySchema.safeParse(queryValues(request));
    if (!parsed.success) return safeSecurityError("validation_error", 400);
    return HttpResponse.json(exportRequestsPageSchema.parse(page(phase7State.exportRequests(), parsed.data)));
  }),
  http.get("/api/v1/admin/data-requests/exports/:requestId", ({ params, request }) => {
    const denied = forbidden(request, "data_requests.exports.read");
    if (denied) return denied;
    const id = parseId(params.requestId, "EXP-");
    const exportRequest = id ? phase7State.exportRequest(id) : undefined;
    return exportRequest ? HttpResponse.json(exportRequestDetailSchema.parse(exportRequest)) : safeSecurityError(id ? "not_found" : "validation_error", id ? 404 : 400);
  }),
  http.post("/api/v1/admin/data-requests/exports/:requestId/actions", async ({ params, request }) => {
    const denied = forbidden(request, "data_requests.exports.manage");
    if (denied) return denied;
    const id = parseId(params.requestId, "EXP-");
    const parsed = exportActionSchema.safeParse(await body(request));
    if (!id || !parsed.success) return safeSecurityError("validation_error", 400);
    return safeMutation(() => actOnExportRequest(id, parsed.data));
  }),
  http.post("/api/v1/admin/data-requests/exports/:requestId/simulate-download", async ({ params, request }) => {
    const denied = forbidden(request, "data_requests.exports.manage");
    if (denied) return denied;
    const id = parseId(params.requestId, "EXP-");
    const parsed = exportDownloadRequestSchema.safeParse(await body(request));
    if (!id || !parsed.success) return safeSecurityError("validation_error", 400);
    try {
      return HttpResponse.json(exportDownloadResultSchema.parse(simulateExportDownload(id, parsed.data)));
    } catch (error) {
      const status = typeof error === "object" && error !== null && "status" in error ? Number(error.status) : 400;
      const code = typeof error === "object" && error !== null && "code" in error ? String(error.code) : "validation_error";
      return safeSecurityError(code, status);
    }
  }),
  http.get("/api/v1/admin/data-requests/deletions", ({ request }) => {
    const denied = forbidden(request, "data_requests.deletions.read");
    if (denied) return denied;
    const parsed = listQuerySchema.safeParse(queryValues(request));
    if (!parsed.success) return safeSecurityError("validation_error", 400);
    return HttpResponse.json(deletionRequestsPageSchema.parse(page(phase7State.deletionRequests(), parsed.data)));
  }),
  http.get("/api/v1/admin/data-requests/deletions/:requestId", ({ params, request }) => {
    const denied = forbidden(request, "data_requests.deletions.read");
    if (denied) return denied;
    const id = parseId(params.requestId, "DEL-");
    const deletionRequest = id ? phase7State.deletionRequest(id) : undefined;
    return deletionRequest ? HttpResponse.json(deletionRequestDetailSchema.parse(deletionRequest)) : safeSecurityError(id ? "not_found" : "validation_error", id ? 404 : 400);
  }),
  http.post("/api/v1/admin/data-requests/deletions/:requestId/actions", async ({ params, request }) => {
    const denied = forbidden(request, "data_requests.deletions.manage");
    if (denied) return denied;
    const id = parseId(params.requestId, "DEL-");
    const parsed = deletionActionSchema.safeParse(await body(request));
    if (!id || !parsed.success) return safeSecurityError("validation_error", 400);
    return safeMutation(() => actOnDeletionRequest(id, parsed.data));
  }),
  http.get("/api/v1/admin/data-retention/policies", ({ request }) => {
    const denied = forbidden(request, "data_retention.read");
    if (denied) return denied;
    const parsed = listQuerySchema.safeParse(queryValues(request));
    if (!parsed.success) return safeSecurityError("validation_error", 400);
    return HttpResponse.json(retentionPoliciesPageSchema.parse(page(phase7State.retentionPolicies(), parsed.data)));
  }),
  http.get("/api/v1/admin/data-retention/policies/:policyId", ({ params, request }) => {
    const denied = forbidden(request, "data_retention.read");
    if (denied) return denied;
    const id = parseId(params.policyId, "RET-");
    const policy = id ? phase7State.retentionPolicy(id) : undefined;
    return policy ? HttpResponse.json(retentionPolicyDetailSchema.parse(policy)) : safeSecurityError(id ? "not_found" : "validation_error", id ? 404 : 400);
  }),
  http.patch("/api/v1/admin/data-retention/policies/:policyId", async ({ params, request }) => {
    const denied = forbidden(request, "data_retention.manage");
    if (denied) return denied;
    const id = parseId(params.policyId, "RET-");
    const parsed = retentionUpdateSchema.safeParse(await body(request));
    if (!id || !parsed.success) return safeSecurityError("validation_error", 400);
    return safeMutation(() => updateRetentionPolicy(id, parsed.data));
  }),
];
