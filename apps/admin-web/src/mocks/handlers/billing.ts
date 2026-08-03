import { http, HttpResponse } from "msw";
import { z } from "zod";
import { ADMIN_ROLES, type AdminRole, type PermissionKey } from "@/core/permissions/permissions";
import { hasPermission } from "@/core/permissions/role-map";
import { billingFixtures } from "@/mocks/fixtures/billing";
import {
  apiErrorSchema,
  billingActionResultSchema,
  failedPaymentActionRequestSchema,
  failedPaymentsPageSchema,
  failedPaymentsQuerySchema,
  paymentEventDetailSchema,
  paymentEventsPageSchema,
  paymentEventsQuerySchema,
  paymentsOverviewQuerySchema,
  paymentsOverviewSchema,
  planDetailSchema,
  planMutationRequestSchema,
  promotionalCodeDetailSchema,
  promotionalCodeMutationRequestSchema,
  promotionalCodesPageSchema,
  promotionalCodesQuerySchema,
  reconciliationActionRequestSchema,
  reconciliationPageSchema,
  reconciliationQuerySchema,
  safeIdSchema,
  subscriptionActionRequestSchema,
  subscriptionDetailSchema,
  subscriptionOverviewQuerySchema,
  subscriptionOverviewSchema,
  subscriptionsPageSchema,
  subscriptionsQuerySchema,
} from "@/features/billing/contracts";
import {
  getAllFailedPayments,
  getAllPlans,
  getAllPromotionalCodes,
  getAllReconciliationIssues,
  getAllSubscriptions,
  getSubscriptionDetail,
  updateFailedPayment,
  updatePlan,
  updatePromotionalCode,
  updateReconciliationIssue,
  updateSubscription,
} from "@/mocks/phase3-billing-state";
import { readScenario } from "@/mocks/scenarios/foundation";
import { scenarioResponse } from "./shared";

const MOCK_UPDATED_AT = "2026-07-28T12:00:00+03:00";

function simulatedRole(request: Request): AdminRole | null {
  const candidate = request.headers.get("x-admin-simulated-role");
  if (candidate === null) return "super-admin";
  return ADMIN_ROLES.find((role) => role === candidate) ?? null;
}

function denied(request: Request, permission: PermissionKey): Response | null {
  const role = simulatedRole(request);
  return role && hasPermission(role, permission)
    ? null
    : error(403, "forbidden", "غير مصرح بهذا الإجراء.");
}

function parseQuery<T>(request: Request, schema: z.ZodType<T>): T | Response {
  const url = new URL(request.url);
  const values: Record<string, string> = {};
  for (const [key, value] of url.searchParams) {
    values[key === "__scenario" ? "scenario" : key] = value;
  }
  const parsed = schema.safeParse(values);
  return parsed.success
    ? parsed.data
    : error(400, "validation_error", "تحقق من بيانات الطلب.");
}

async function parseBody<T>(request: Request, schema: z.ZodType<T>): Promise<T | Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return error(400, "validation_error", "تحقق من بيانات الطلب.");
  }
  const parsed = schema.safeParse(body);
  return parsed.success
    ? parsed.data
    : error(400, "validation_error", "تحقق من بيانات الطلب.");
}

function page<T>(items: T[], pageNumber: number, pageSize: 25 | 50 | 100) {
  const start = (pageNumber - 1) * pageSize;
  return {
    items: items.slice(start, start + pageSize),
    meta: {
      page: pageNumber,
      pageSize,
      total: items.length,
      totalPages: Math.ceil(items.length / pageSize),
    },
    region: {
      availability: items.length === 0 ? "empty" : "available",
      retryable: false,
      updatedAt: MOCK_UPDATED_AT,
    },
  };
}

function error(status: number, code: string, message: string) {
  return HttpResponse.json(apiErrorSchema.parse({ status, code, message }), { status });
}

function paramId(value: string | readonly string[] | undefined): string {
  return safeIdSchema.parse(Array.isArray(value) ? value[0] : value);
}

function promotionalCodeDetail(
  input: z.infer<typeof promotionalCodeMutationRequestSchema>,
): z.infer<typeof promotionalCodeDetailSchema> {
  return {
    id: input.id,
    code: input.code,
    discountKind: input.discountKind,
    discountValue: input.discountValue,
    duration: input.duration,
    redemptionCount: input.redemptionCount,
    redemptionLimit: input.redemptionLimit,
    expiresAt: input.expiresAt,
    status: input.status,
    eligiblePlanIds: input.eligiblePlanIds,
  };
}

async function scenarioGuard(request: Request): Promise<Response | null> {
  return scenarioResponse(readScenario(request));
}

export const billingHandlers = [
  http.get("/api/v1/admin/billing/subscriptions/overview", async ({ request }) => {
    const permissionError = denied(request, "subscriptions.read");
    if (permissionError) return permissionError;
    const blocked = await scenarioGuard(request);
    if (blocked) return blocked;
    const query = parseQuery(request, subscriptionOverviewQuerySchema);
    if (query instanceof Response) return query;
    return HttpResponse.json(subscriptionOverviewSchema.parse(billingFixtures.subscriptionOverview));
  }),

  http.get("/api/v1/admin/billing/subscriptions", async ({ request }) => {
    const permissionError = denied(request, "subscriptions.read");
    if (permissionError) return permissionError;
    const blocked = await scenarioGuard(request);
    if (blocked) return blocked;
    const query = parseQuery(request, subscriptionsQuerySchema);
    if (query instanceof Response) return query;
    let items = getAllSubscriptions();
    if (query.search) {
      const search = query.search.toLocaleLowerCase();
      items = items.filter((item) =>
        item.customer.displayName.toLocaleLowerCase().includes(search) ||
        item.customer.maskedEmail.toLocaleLowerCase().includes(search),
      );
    }
    if (query.platform !== "all") items = items.filter((item) => item.customer.platform === query.platform);
    if (query.status) items = items.filter((item) => item.status === query.status);
    if (query.plan) items = items.filter((item) => item.plan === query.plan);
    return HttpResponse.json(subscriptionsPageSchema.parse(page(items, query.page, query.pageSize)));
  }),

  http.get("/api/v1/admin/billing/subscriptions/:subscriptionId", async ({ request, params }) => {
    const permissionError = denied(request, "subscriptions.detail.read");
    if (permissionError) return permissionError;
    const blocked = await scenarioGuard(request);
    if (blocked) return blocked;
    const id = paramId(params.subscriptionId);
    const detail = getSubscriptionDetail(id);
    return detail
      ? HttpResponse.json(subscriptionDetailSchema.parse(detail))
      : error(404, "not_found", "الاشتراك غير موجود");
  }),

  http.post("/api/v1/admin/billing/subscriptions/:subscriptionId/action", async ({ request, params }) => {
    const permissionError = denied(request, "subscriptions.manage");
    if (permissionError) return permissionError;
    const blocked = await scenarioGuard(request);
    if (blocked) return blocked;
    const id = paramId(params.subscriptionId);
    const body = await parseBody(request, subscriptionActionRequestSchema);
    if (body instanceof Response) return body;
    const nextStatus = body.action === "set_cancel_at_period_end" ? "cancel_at_period_end" : "active";
    const updated = updateSubscription(id, { status: nextStatus, cancelAtPeriodEnd: nextStatus === "cancel_at_period_end" });
    if (!updated) return error(404, "not_found", "الاشتراك غير موجود");
    return HttpResponse.json(billingActionResultSchema.parse({
      id,
      previousState: body.expectedCurrentState,
      currentState: updated.status,
      outcome: "simulated_success",
      timestamp: MOCK_UPDATED_AT,
      message: "تم تسجيل إجراء تجريبي فقط دون تنفيذ مالي حقيقي.",
      plannedAuditReference: `AUD-${id}`,
    }));
  }),

  http.get("/api/v1/admin/billing/plans", async ({ request }) => {
    const permissionError = denied(request, "plans.read");
    if (permissionError) return permissionError;
    const blocked = await scenarioGuard(request);
    if (blocked) return blocked;
    return HttpResponse.json(z.array(planDetailSchema).parse(getAllPlans()));
  }),

  http.post("/api/v1/admin/billing/plans/:planId", async ({ request, params }) => {
    const permissionError = denied(request, "plans.manage");
    if (permissionError) return permissionError;
    const blocked = await scenarioGuard(request);
    if (blocked) return blocked;
    const id = paramId(params.planId);
    const body = await parseBody(request, planMutationRequestSchema);
    if (body instanceof Response) return body;
    const updated = updatePlan(id, {
      price: body.price,
      interval: body.interval,
      limits: body.limits,
      active: body.active,
      providerPriceLabel: body.providerPriceLabel,
    });
    return updated ? HttpResponse.json(planDetailSchema.parse(updated)) : error(404, "not_found", "الخطة غير موجودة");
  }),

  http.get("/api/v1/admin/billing/promotional-codes", async ({ request }) => {
    const permissionError = denied(request, "promotions.read");
    if (permissionError) return permissionError;
    const blocked = await scenarioGuard(request);
    if (blocked) return blocked;
    const query = parseQuery(request, promotionalCodesQuerySchema);
    if (query instanceof Response) return query;
    let items = getAllPromotionalCodes();
    if (query.status) items = items.filter((item) => item.status === query.status);
    if (query.search) items = items.filter((item) => item.code.includes(query.search?.toUpperCase() ?? ""));
    if (query.planId) items = items.filter((item) => item.eligiblePlanIds.includes(query.planId ?? ""));
    return HttpResponse.json(promotionalCodesPageSchema.parse(page(items, query.page, query.pageSize)));
  }),

  http.post("/api/v1/admin/billing/promotional-codes", async ({ request }) => {
    const permissionError = denied(request, "promotions.manage");
    if (permissionError) return permissionError;
    const blocked = await scenarioGuard(request);
    if (blocked) return blocked;
    const body = await parseBody(request, promotionalCodeMutationRequestSchema);
    if (body instanceof Response) return body;
    const detail = promotionalCodeDetail({ ...body, id: `PROMO-${body.code}` });
    return HttpResponse.json(promotionalCodeDetailSchema.parse(detail));
  }),

  http.post("/api/v1/admin/billing/promotional-codes/:codeId", async ({ request, params }) => {
    const permissionError = denied(request, "promotions.manage");
    if (permissionError) return permissionError;
    const blocked = await scenarioGuard(request);
    if (blocked) return blocked;
    const id = paramId(params.codeId);
    const body = await parseBody(request, promotionalCodeMutationRequestSchema);
    if (body instanceof Response) return body;
    const updated = updatePromotionalCode(id, promotionalCodeDetail(body));
    return updated ? HttpResponse.json(promotionalCodeDetailSchema.parse(updated)) : error(404, "not_found", "الرمز الترويجي غير موجود");
  }),

  http.get("/api/v1/admin/billing/payments/overview", async ({ request }) => {
    const permissionError = denied(request, "payments.read");
    if (permissionError) return permissionError;
    const blocked = await scenarioGuard(request);
    if (blocked) return blocked;
    const query = parseQuery(request, paymentsOverviewQuerySchema);
    if (query instanceof Response) return query;
    return HttpResponse.json(paymentsOverviewSchema.parse(billingFixtures.paymentsOverview));
  }),

  http.get("/api/v1/admin/billing/payment-events", async ({ request }) => {
    const permissionError = denied(request, "payments.read");
    if (permissionError) return permissionError;
    const blocked = await scenarioGuard(request);
    if (blocked) return blocked;
    const query = parseQuery(request, paymentEventsQuerySchema);
    if (query instanceof Response) return query;
    let items = billingFixtures.paymentEventListItems;
    if (query.search) {
      const search = query.search.toLocaleLowerCase();
      items = items.filter((item) =>
        item.customer.displayName.toLocaleLowerCase().includes(search) ||
        item.customer.maskedEmail.toLocaleLowerCase().includes(search),
      );
    }
    if (query.platform !== "all") items = items.filter((item) => item.customer.platform === query.platform);
    if (query.status) items = items.filter((item) => item.status === query.status);
    if (query.eventType) items = items.filter((item) => item.eventType === query.eventType);
    return HttpResponse.json(paymentEventsPageSchema.parse(page(items, query.page, query.pageSize)));
  }),

  http.get("/api/v1/admin/billing/payment-events/:eventId", async ({ request, params }) => {
    const permissionError = denied(request, "payments.detail.read");
    if (permissionError) return permissionError;
    const blocked = await scenarioGuard(request);
    if (blocked) return blocked;
    const id = paramId(params.eventId);
    const event = billingFixtures.paymentEventDetail;
    return event.id === id
      ? HttpResponse.json(paymentEventDetailSchema.parse(event))
      : error(404, "not_found", "حدث الدفع غير موجود");
  }),

  http.get("/api/v1/admin/billing/failed-payments", async ({ request }) => {
    const permissionError = denied(request, "payment_failures.manage");
    if (permissionError) return permissionError;
    const blocked = await scenarioGuard(request);
    if (blocked) return blocked;
    const query = parseQuery(request, failedPaymentsQuerySchema);
    if (query instanceof Response) return query;
    let items = getAllFailedPayments();
    if (query.platform !== "all") items = items.filter((item) => item.customer.platform === query.platform);
    if (query.status) items = items.filter((item) => item.status === query.status);
    return HttpResponse.json(failedPaymentsPageSchema.parse(page(items, query.page, query.pageSize)));
  }),

  http.post("/api/v1/admin/billing/failed-payments/:failureId/action", async ({ request, params }) => {
    const permissionError = denied(request, "payment_failures.manage");
    if (permissionError) return permissionError;
    const blocked = await scenarioGuard(request);
    if (blocked) return blocked;
    const id = paramId(params.failureId);
    const body = await parseBody(request, failedPaymentActionRequestSchema);
    if (body instanceof Response) return body;
    const updated = updateFailedPayment(id, { status: "reviewed", expectedState: "reviewed" });
    if (!updated) return error(404, "not_found", "فشل الدفع غير موجود");
    return HttpResponse.json(billingActionResultSchema.parse({
      id,
      previousState: body.expectedCurrentState,
      currentState: updated.status,
      outcome: "simulated_success",
      timestamp: MOCK_UPDATED_AT,
      message: "تم تسجيل نتيجة تجريبية فقط دون retry أو charge أو إشعار.",
      plannedAuditReference: `AUD-${id}`,
    }));
  }),

  http.get("/api/v1/admin/billing/reconciliation", async ({ request }) => {
    const permissionError = denied(request, "billing_reconciliation.read");
    if (permissionError) return permissionError;
    const blocked = await scenarioGuard(request);
    if (blocked) return blocked;
    const query = parseQuery(request, reconciliationQuerySchema);
    if (query instanceof Response) return query;
    let items = getAllReconciliationIssues();
    if (query.severity) items = items.filter((item) => item.severity === query.severity);
    if (query.status) items = items.filter((item) => item.status === query.status);
    return HttpResponse.json(reconciliationPageSchema.parse(page(items, query.page, query.pageSize)));
  }),

  http.post("/api/v1/admin/billing/reconciliation/:issueId/action", async ({ request, params }) => {
    const permissionError = denied(request, "billing_reconciliation.manage");
    if (permissionError) return permissionError;
    const blocked = await scenarioGuard(request);
    if (blocked) return blocked;
    const id = paramId(params.issueId);
    const body = await parseBody(request, reconciliationActionRequestSchema);
    if (body instanceof Response) return body;
    if (body.providerFreshness !== "fresh") return error(409, "stale_provider_state", "حالة المزود غير حديثة ولا يمكن تسجيل نجاح وهمي.");
    const updated = updateReconciliationIssue(id, { status: "reviewing", expectedState: "reviewing" });
    if (!updated) return error(404, "not_found", "مشكلة المطابقة غير موجودة");
    return HttpResponse.json(billingActionResultSchema.parse({
      id,
      previousState: body.expectedIssueState,
      currentState: updated.status,
      outcome: "simulated_success",
      timestamp: MOCK_UPDATED_AT,
      message: "تم تسجيل قرار مطابقة تجريبي دون تعديل مزود أو قاعدة بيانات.",
      plannedAuditReference: `AUD-${id}`,
    }));
  }),
];
