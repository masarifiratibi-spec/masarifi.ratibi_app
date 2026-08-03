import { HttpResponse, http } from "msw";
import { ZodError, z } from "zod";
import { ApiError } from "@/core/api/errors";
import { ADMIN_ROLES, type AdminRole, type PermissionKey } from "@/core/permissions/permissions";
import { SIMULATED_ACTORS, hasPermission } from "@/core/permissions/role-map";
import {
  accessDecisionInputSchema,
  accessRequestSummarySchema,
  accessRequestIdSchema,
  accessRequestsQuerySchema,
  createAccessRequestSchema,
  endTemporaryAccessRequestSchema,
  revokeAccessRequestSchema,
} from "@/features/access/contracts";
import {
  createPhase2AccessRequest,
  decidePhase2AccessRequest,
  endPhase2TemporaryAccess,
  getPhase2AccessRequest,
  getPhase2AccessRequests,
  getPhase2TemporaryWorkspace,
  revokePhase2AccessRequest,
  setPhase2NearExpiry,
} from "@/mocks/phase2-state";
import { readScenario } from "@/mocks/scenarios/foundation";
import { scenarioResponse } from "./shared";

const roleSchema = z.enum(ADMIN_ROLES);

function requestContext(request: Request): { role: AdminRole; actor: string; scenario?: string } {
  const url = new URL(request.url);
  const role = roleSchema.parse(url.searchParams.get("role") ?? "super-admin");
  return {
    role,
    actor: SIMULATED_ACTORS[role],
    scenario: url.searchParams.get("__scenario") ?? request.headers.get("x-mock-scenario") ?? undefined,
  };
}

function requirePermission(role: AdminRole, permission: PermissionKey): void {
  if (!hasPermission(role, permission)) throw new ApiError("forbidden", "غير مصرح بهذا الإجراء.", 403);
}

function visibleTo(role: AdminRole, actor: string, request: { requestedBy: string; assignee: string }): boolean {
  return role !== "support-agent" || request.requestedBy === actor || request.assignee === actor;
}

async function safeResponse(operation: () => Response | Promise<Response>): Promise<Response> {
  try {
    return await operation();
  } catch (error) {
    if (error instanceof ApiError) {
      return HttpResponse.json({ code: error.code, message: error.message }, { status: error.status });
    }
    if (error instanceof ZodError) {
      return HttpResponse.json({ code: "validation_error", message: "تحقق من البيانات المدخلة." }, { status: 400 });
    }
    throw error;
  }
}

function requestId(params: Record<string, string | readonly string[] | undefined>): string {
  return accessRequestIdSchema.parse(params.requestId);
}

function isRepeatBrowserNavigation(): boolean {
  if (typeof performance === "undefined") return false;
  const navigation = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
  return navigation?.type === "reload" || navigation?.type === "back_forward";
}

export const accessHandlers = [
  http.get("/api/v1/admin/access-requests", ({ request }) => safeResponse(async () => {
    const { role, actor, scenario } = requestContext(request);
    requirePermission(role, "support.access.read");
    if (scenario === "forbidden") throw new ApiError("forbidden", "غير مصرح.", 403);
    if (scenario === "rate-limit") throw new ApiError("rate_limited", "حاول لاحقاً.", 429);
    if (scenario === "unsafe-response") {
      return HttpResponse.json({ items: [{ rawEmail: "unsafe@example.test" }] });
    }
    const scenarioResult = await scenarioResponse(readScenario(request));
    if (scenarioResult) return scenarioResult;
    const url = new URL(request.url);
    const query = accessRequestsQuerySchema.parse(Object.fromEntries(
      [...url.searchParams.entries()].filter(([key]) => !["role", "__scenario"].includes(key)),
    ));
    let items = getPhase2AccessRequests()
      .filter((entry) => visibleTo(role, actor, entry))
      .filter((entry) => !query.status || entry.status === query.status)
      .filter((entry) => !query.assignee || entry.assignee === query.assignee)
      .filter((entry) => {
        if (!query.query) return true;
        const needle = query.query.toLocaleLowerCase();
        return [entry.id, entry.maskedCustomerLabel, entry.supportTicketId]
          .some((field) => field.toLocaleLowerCase().includes(needle));
      })
      .map((entry) => accessRequestSummarySchema.parse({
        id: entry.id,
        userId: entry.userId,
        maskedCustomerLabel: entry.maskedCustomerLabel,
        supportTicketId: entry.supportTicketId,
        requestedBy: entry.requestedBy,
        assignee: entry.assignee,
        requestedScope: entry.requestedScope,
        approvedScope: entry.approvedScope,
        reasonSummary: entry.reasonSummary,
        status: entry.status,
        createdAt: entry.createdAt,
        startsAt: entry.startsAt,
        expiresAt: entry.expiresAt,
        approvedBy: entry.approvedBy,
      }));
    if (scenario === "empty") items = [];
    if (scenario === "large" && items.length > 0) {
      items = Array.from({ length: 120 }, (_, index) => ({
        ...items[index % items.length],
        id: `ACC-LARGE-${String(index + 1).padStart(3, "0")}`,
      }));
    }
    const start = (query.page - 1) * query.pageSize;
    return HttpResponse.json({
      items: items.slice(start, start + query.pageSize),
      pagination: {
        page: query.page,
        pageSize: query.pageSize,
        totalItems: items.length,
        totalPages: Math.ceil(items.length / query.pageSize),
      },
      region: {
        availability: scenario === "partial" ? "partial" : items.length ? "available" : "empty",
        ...(scenario === "partial" ? { message: "بعض بيانات الطلبات غير مكتملة." } : {}),
      },
    });
  })),

  http.post("/api/v1/admin/access-requests", ({ request }) => safeResponse(async () => {
    const { role, actor } = requestContext(request);
    requirePermission(role, "support.request_access");
    return HttpResponse.json(createPhase2AccessRequest(createAccessRequestSchema.parse(await request.json()), actor), { status: 201 });
  })),

  http.get("/api/v1/admin/access-requests/:requestId", ({ request, params }) => safeResponse(() => {
    const { role, actor } = requestContext(request);
    requirePermission(role, "support.access.read");
    const detail = getPhase2AccessRequest(requestId(params));
    if (!visibleTo(role, actor, detail)) throw new ApiError("forbidden", "غير مصرح.", 403);
    return HttpResponse.json(detail);
  })),

  http.post("/api/v1/admin/access-requests/:requestId/decision", ({ request, params }) => safeResponse(async () => {
    const { role, actor } = requestContext(request);
    requirePermission(role, "support.access.approve");
    return HttpResponse.json(decidePhase2AccessRequest(
      requestId(params),
      accessDecisionInputSchema.parse(await request.json()),
      actor,
    ));
  })),

  http.post("/api/v1/admin/access-requests/:requestId/revoke", ({ request, params }) => safeResponse(async () => {
    const { role, actor } = requestContext(request);
    requirePermission(role, "support.access.revoke");
    return HttpResponse.json(revokePhase2AccessRequest(
      requestId(params),
      revokeAccessRequestSchema.parse(await request.json()),
      actor,
    ));
  })),

  http.get("/api/v1/admin/access-requests/:requestId/workspace", ({ request, params }) => safeResponse(() => {
    const { role, actor, scenario } = requestContext(request);
    requirePermission(role, "support.access.use");
    const id = requestId(params);
    if (scenario === "near-expiry") {
      if (isRepeatBrowserNavigation()) throw new ApiError("gone", "انتهت صلاحية الوصول المؤقت.", 410);
      const record = getPhase2AccessRequests().find((entry) => entry.id === id);
      if (record?.status === "active" && record.expiresAt && new Date(record.expiresAt).getTime() > Date.now() + 5_000) {
        setPhase2NearExpiry(id, new Date(Date.now() + 3_000).toISOString());
      }
    }
    return HttpResponse.json(getPhase2TemporaryWorkspace(id, actor));
  })),

  http.post("/api/v1/admin/access-requests/:requestId/end", ({ request, params }) => safeResponse(async () => {
    const { role, actor } = requestContext(request);
    requirePermission(role, "support.access.revoke");
    const id = requestId(params);
    return HttpResponse.json(endPhase2TemporaryAccess(
      id,
      endTemporaryAccessRequestSchema.parse(await request.json()),
      actor,
    ));
  })),
];
