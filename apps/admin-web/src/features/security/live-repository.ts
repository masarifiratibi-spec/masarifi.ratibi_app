import { z } from "zod";
import { apiClient, liveCursor, rememberLiveCursor, unavailableClientOperation } from "@/core/api/client";
import { ApiError, safeApiMessage } from "@/core/api/errors";
import { be3AdminPageSchema } from "../governance/contracts";
import { auditEventDetailSchema, auditEventSummarySchema, authenticationEventSchema, adminSecuritySchema, exportActionSchema, exportRequestDetailSchema, listQuerySchema, overviewQuerySchema, retentionPolicyDetailSchema, retentionUpdateSchema, safeReferenceSchema, safeMetadataEntrySchema, securityOverviewSchema, supportAccessGrantSchema, supportAccessRevokeSchema, type ListQuery, type OverviewQuery } from "./contracts";

const base = "/api/v1/admin";
const instant = z.iso.datetime({ offset: true });
const reference = safeReferenceSchema.nullable();
const metadata = z.array(z.object({ key: z.string(), label: z.string(), value: z.union([z.string(), z.number(), z.boolean(), z.null()]) }).strict()).max(40);
const auditSchema = z.object({ id: z.uuid(), actor: reference, actorType: z.string(), action: z.string(), resourceType: z.string(), resourceId: z.string().nullable(), requestId: z.string().nullable(), occurredAt: instant, result: z.enum(["success", "failure", "blocked"]), safeMetadata: metadata }).strict();
const supportSchema = z.object({ id: z.uuid(), user: safeReferenceSchema, requester: safeReferenceSchema, assignee: safeReferenceSchema, supportTicketId: z.string(), scopes: z.array(z.object({ resource: z.string(), actions: z.array(z.string()) }).strict()), status: z.enum(["pending", "approved", "denied", "expired", "revoked"]), customerApprovalRequired: z.boolean(), customerApprovedAt: instant.nullable(), expiresAt: instant.nullable(), version: z.number().int().positive() }).strict();
const exportSchema = z.object({ id: z.uuid(), status: z.enum(["requested", "verified", "processing", "ready", "expired", "failed"]), scope: z.array(z.string()), requestedAt: instant, expiresAt: instant.nullable(), version: z.number().int().positive() }).strict();
const retentionSchema = z.object({ id: z.uuid(), resourceType: z.string(), retentionDays: z.number().int().nonnegative(), deletionMode: z.string(), legalBasis: z.string(), enabled: z.boolean(), version: z.number().int().positive() }).strict();
const eventSchema = z.object({ id: z.uuid(), eventType: z.string(), severity: z.enum(["info", "low", "medium", "high", "critical"]), occurredAt: instant, safeMetadata: metadata }).strict();
const pageSchema = <T extends z.ZodType>(item: T) => z.object({ items: z.array(item).max(100), nextCursor: z.string().max(512).nullable() }).strict();
const invalid = () => new ApiError("validation_error", safeApiMessage("validation_error"), 400);
export function liveSecurityId(id: string): string { if (!z.uuid().safeParse(id).success) throw invalid(); return encodeURIComponent(id); }

async function list<T, U>(path: string, input: ListQuery, schema: z.ZodType<T>, map: (row: T) => U, filters: URLSearchParams) {
  const { page, pageSize } = listQuerySchema.parse(input);
  const params = new URLSearchParams({ limit: String(pageSize), ...Object.fromEntries(filters) });
  const scope = `${path}:${params.toString()}`;
  const cursor = liveCursor(scope, page);
  if (cursor) params.set("cursor", cursor);
  const response = await apiClient.get(`${base}${path}?${params}`, pageSchema(schema));
  rememberLiveCursor(scope, page, response.nextCursor);
  return { items: response.items.map(map), pagination: { page, pageSize, totalItems: (page - 1) * pageSize + response.items.length + (response.nextCursor ? 1 : 0), totalPages: page + (response.nextCursor ? 1 : 0) }, region: { availability: response.items.length ? "available" as const : "empty" as const } };
}

function filters(input: ListQuery, supported: readonly string[], stateMap?: Readonly<Record<string, string>>) {
  const parsed = listQuerySchema.parse(input);
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(parsed)) {
    if (key === "page" || key === "pageSize" || value === undefined || value === "all") continue;
    if (!supported.includes(key)) throw invalid();
    const mapped = key === "state" ? stateMap?.[String(value)] ?? value : key === "risk" && value === "informational" ? "info" : value;
    params.set(key === "state" ? "status" : key === "risk" ? "severity" : key, String(mapped));
  }
  return params;
}
async function detail<T>(path: string, id: string, schema: z.ZodType<T>): Promise<T> {
  const response = await apiClient.get(`${base}${path}?limit=1&id=${liveSecurityId(id)}`, pageSchema(schema));
  if (!response.items[0]) throw new ApiError("not_found", safeApiMessage("not_found"), 404);
  return response.items[0];
}
function audit(row: z.infer<typeof auditSchema>) {
  return auditEventSummarySchema.parse({ id: row.id, occurredAt: row.occurredAt, actor: row.actor, action: row.action, resource: row.resourceType, target: row.resourceId ? { id: row.resourceId, kind: "resource", label: row.resourceType } : null, result: row.result, severity: null, correlationId: row.requestId });
}
function support(row: z.infer<typeof supportSchema>) {
  return supportAccessGrantSchema.parse({ id: row.id, agent: row.assignee, customer: row.user, ticket: { id: row.supportTicketId, kind: "ticket", label: row.supportTicketId }, scopes: row.scopes.map(scope => `${scope.resource}: ${scope.actions.join(", ")}`), startedAt: null, expiresAt: row.expiresAt, state: row.status, revision: row.version, timeline: [] });
}
const exportStates = { requested: "Requested", verified: "Validating", processing: "Processing", ready: "Ready", expired: "Expired", failed: "Failed" } as const;
function privacyExport(row: z.infer<typeof exportSchema>) {
  const actions = { requested: ["validate", "fail"], verified: ["fail"], processing: ["fail"], ready: ["expire"], expired: [], failed: ["retry"] };
  return exportRequestDetailSchema.parse({ id: row.id, customer: null, scopes: row.scope, state: exportStates[row.status], requestedAt: row.requestedAt, expiresAt: row.expiresAt, timeline: [], revision: row.version, allowedActions: actions[row.status], auditReferences: [] });
}
function retention(row: z.infer<typeof retentionSchema>) {
  return retentionPolicyDetailSchema.parse({ id: row.id, dataCategory: row.resourceType, storageCategory: null, retentionDays: row.retentionDays, minimumDays: null, maximumDays: null, cleanupProcess: null, state: row.enabled ? "active" : "suspended", effectiveCleanupState: null, legalHold: null, protectedAuditPolicy: null, revision: row.version, changeHistory: [], allowedActions: ["update"] });
}

export const liveSecurityRepository = {
  async getSecurityOverview(input: OverviewQuery) {
    const query = overviewQuerySchema.parse(input);
    if (query.period === "90d") return unavailableClientOperation();
    const params = new URLSearchParams({ period: query.period });
    if (query.platform !== "all") params.set("platform", query.platform);
    const response = await apiClient.get(`${base}/security/overview?${params}`, z.object({ freshness: instant, partial: z.boolean(), metrics: z.array(z.object({ key: z.string(), label: z.string(), value: z.number().int().nonnegative() }).strict()) }).strict());
    return securityOverviewSchema.parse({ ...response, query, metrics: response.metrics.map(metric => ({ ...metric, unit: "events", entitySemantic: "security_events", freshness: response.freshness })) });
  },
  listAuthenticationEvents(input: ListQuery) {
    return list("/security/events", input, eventSchema, row => authenticationEventSchema.parse({ id: row.id, actor: null, actorType: null, eventType: row.eventType, deviceLabel: null, broadRegion: null, platform: "unknown", risk: row.severity === "info" ? "informational" : row.severity, result: null, occurredAt: row.occurredAt, correlationId: null }), filters(input, ["risk"]));
  },
  async listAdminSecurity(input: ListQuery) {
    return list("/access/admins", input, be3AdminPageSchema.shape.items.element, row => adminSecuritySchema.parse({ id: row.id, admin: { id: row.id, kind: "admin", label: row.displayName }, roleSummary: row.roleKeys.join(", ") || "Unassigned", twoFactorState: row.mfaStatus === "enabled" ? "enabled" : "unknown", lastLoginAt: null, activeSessionCount: row.activeSessionCount, risk: null }), filters(input, ["search", "state"]));
  },
  listSupportAccess(input: ListQuery) { return list("/support-access/requests", input, supportSchema, support, filters(input, ["search", "state"])); },
  async revokeSupportAccess(id: string, input: unknown) {
    const { context } = supportAccessRevokeSchema.parse(input);
    return support(await apiClient.post(`${base}/support-access/requests/${liveSecurityId(id)}/revoke`, { reason: context.reason, expectedVersion: context.expectedRevision }, supportSchema));
  },
  listAuditEvents(input: ListQuery) { return list("/audit/events", input, auditSchema, audit, filters(input, ["risk", "result"])); },
  async getAuditEvent(id: string) {
    const row = await apiClient.get(`${base}/audit/events/${liveSecurityId(id)}`, auditSchema);
    const safe = row.safeMetadata.flatMap(entry => { const parsed = safeMetadataEntrySchema.safeParse(entry); return parsed.success ? [parsed.data] : []; });
    return auditEventDetailSchema.parse({ ...audit(row), region: null, metadata: safe, before: [], after: [], related: [] });
  },
  listPermissionChanges(input: ListQuery) {
    const params = filters(input, ["result"]); params.set("resource", "admin_assignment");
    return list("/audit/events", input, auditSchema, audit, params);
  },
  listExportRequests(input: ListQuery) { return list("/privacy/exports", input, exportSchema, privacyExport, filters(input, ["state"], Object.fromEntries(Object.entries(exportStates).map(([key, value]) => [value, key])))); },
  async getExportRequest(id: string) { return privacyExport(await detail("/privacy/exports", id, exportSchema)); },
  async actOnExportRequest(id: string, input: unknown) {
    const request = exportActionSchema.parse(input);
    const action = ({ validate: "verify", retry: "retry", expire: "expire", fail: "fail" } as Record<string, string>)[request.action];
    if (!action) return unavailableClientOperation();
    return privacyExport(await apiClient.post(`${base}/privacy/exports/${liveSecurityId(id)}/actions`, { action, reason: request.context.reason, expectedVersion: request.context.expectedRevision }, exportSchema));
  },
  listRetentionPolicies(input: ListQuery) { return list("/retention/policies", input, retentionSchema, retention, filters(input, ["state"], { active: "enabled", suspended: "disabled" })); },
  async getRetentionPolicy(id: string) { return retention(await detail("/retention/policies", id, retentionSchema)); },
  async updateRetentionPolicy(id: string, input: unknown) {
    const request = retentionUpdateSchema.parse(input);
    return retention(await apiClient.patch(`${base}/retention/policies/${liveSecurityId(id)}`, { retentionDays: request.retentionDays, reason: request.reason, expectedVersion: request.expectedRevision }, retentionSchema));
  },
};
