import { http, HttpResponse } from "msw";
import { ZodError, z } from "zod";
import { ApiError } from "@/core/api/errors";
import { ADMIN_ROLES, type AdminRole, type PermissionKey } from "@/core/permissions/permissions";
import { hasPermission } from "@/core/permissions/role-map";
import {
  adminUserListItemSchema,
  adminUsersQuerySchema,
  userDetailRequestSchema,
  userDevicesResponseSchema,
  userSessionsResponseSchema,
  suspendUserRequestSchema,
  reactivateUserRequestSchema,
  updateVerificationRequestSchema,
  revokeDeviceRequestSchema,
  revokeSessionsRequestSchema,
  userBulkActionRequestSchema,
  type AdminUserListItem,
} from "@/features/users/contracts";
import { filterUsers, paginate, sortUsers } from "@/lib/admin-utils";
import type { UserFixture } from "@/mocks/fixtures/users";
import { readScenario } from "@/mocks/scenarios/foundation";
import { scenarioResponse } from "./shared";
import {
  getPhase2MockState,
  reactivatePhase2User,
  revokePhase2Device,
  revokePhase2Sessions,
  runPhase2BulkAction,
  suspendPhase2User,
  updatePhase2Verification,
} from "@/mocks/phase2-state";

const roleSchema = z.enum(ADMIN_ROLES);

function actionRole(request: Request): AdminRole {
  return roleSchema.parse(new URL(request.url).searchParams.get("role") ?? "super-admin");
}

function requireActionPermission(role: AdminRole, permission: PermissionKey): void {
  if (!hasPermission(role, permission)) throw new ApiError("forbidden", "غير مصرح بهذا الإجراء.", 403);
}

async function safeActionResponse(
  request: Request,
  operation: () => object | Promise<object>,
): Promise<Response> {
  try {
    const scenario = request.headers.get("x-mock-scenario") ?? new URL(request.url).searchParams.get("__scenario");
    if (scenario === "rate-limited") {
      throw new ApiError("rate_limited", "حاول لاحقاً.", 429);
    }
    const scenarioResult = await scenarioResponse(readScenario(request));
    if (scenarioResult) return scenarioResult;
    return HttpResponse.json(await operation());
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

function publicUser(user: UserFixture): AdminUserListItem {
  const { appVersion, ...projection } = user;
  void appVersion;
  return adminUserListItemSchema.parse(projection);
}

function platformTotals(source: UserFixture[]) {
  return {
    uniqueCustomersTotal: source.length,
    iosCustomers: source.filter(({ registeredPlatforms }) => registeredPlatforms.includes("ios")).length,
    androidCustomers: source.filter(({ registeredPlatforms }) => registeredPlatforms.includes("android")).length,
    multiPlatformCustomers: source.filter(({ registeredPlatforms }) => registeredPlatforms.length === 2).length,
  };
}

function detailQuery(request: Request, userId: string) {
  const url = new URL(request.url);
  return {
    userId,
    role: url.searchParams.get("role") ?? undefined,
    scenario: readScenario(request),
  };
}

function unavailableRegion(scenario: string) {
  return scenario === "partial"
    ? { availability: "partial" as const, message: "بعض بيانات هذه المنطقة غير مكتملة." }
    : { availability: "available" as const };
}

export const usersHandlers = [
  http.get("/api/v1/admin/users", async ({ request }) => {
    const url = new URL(request.url);
    if (url.searchParams.get("__scenario") === "rate-limited") {
      return HttpResponse.json({ code: "rate_limited" }, { status: 429 });
    }
    const scenario = readScenario(request);
    const response = await scenarioResponse(scenario);
    if (response) return response;
    const queryValues = Object.fromEntries(url.searchParams);
    delete queryValues.__scenario;
    const query = adminUsersQuerySchema.parse({
      ...queryValues,
      scenario,
    });
    if (!hasPermission(query.role ?? "super-admin", "users.read")) {
      return HttpResponse.json({ code: "forbidden" }, { status: 403 });
    }

    const currentUsers = getPhase2MockState().users;
    const source = scenario === "large"
      ? Array.from({ length: 120 }, (_, index): UserFixture => ({
        ...currentUsers[index % currentUsers.length],
        id: `USR-DEMO-${String(index + 1).padStart(4, "0")}`,
      }))
      : currentUsers;
    const available = scenario === "empty" ? [] : source;
    const filtered = sortUsers(filterUsers(available, query), query.sort, query.order);
    const items = paginate(filtered, query.page, query.pageSize).map(publicUser);
    const totals = platformTotals(available);

    return HttpResponse.json({
      items,
      pagination: {
        page: query.page,
        pageSize: query.pageSize,
        totalItems: filtered.length,
        totalPages: filtered.length ? Math.ceil(filtered.length / query.pageSize) : 0,
      },
      ...totals,
      region: {
        availability: items.length ? "available" : "empty",
        ...(items.length ? {} : { message: "لا توجد نتائج مطابقة." }),
      },
    });
  }),
  http.get("/api/v1/admin/users/:userId", async ({ params, request }) => {
    const scenario = readScenario(request);
    const query = userDetailRequestSchema.parse(detailQuery(request, String(params.userId)));
    const scenarioResult = await scenarioResponse(scenario);
    if (scenarioResult) return scenarioResult;
    if (!hasPermission(query.role ?? "super-admin", "users.read")) {
      return HttpResponse.json({ code: "forbidden" }, { status: 403 });
    }
    const profile = getPhase2MockState().profiles.find(({ id }) => id === query.userId);
    if (!profile) return HttpResponse.json({ code: "not_found" }, { status: 404 });
    return HttpResponse.json({ ...profile, region: unavailableRegion(scenario) });
  }),
  http.get("/api/v1/admin/users/:userId/devices", async ({ params, request }) => {
    const scenario = readScenario(request);
    const query = userDetailRequestSchema.parse(detailQuery(request, String(params.userId)));
    const scenarioResult = await scenarioResponse(scenario);
    if (scenarioResult) return scenarioResult;
    if (!hasPermission(query.role ?? "super-admin", "devices.read")) {
      return HttpResponse.json({ code: "forbidden" }, { status: 403 });
    }
    const state = getPhase2MockState();
    if (!state.profiles.some(({ id }) => id === query.userId)) {
      return HttpResponse.json({ code: "not_found" }, { status: 404 });
    }
    const items = scenario === "empty"
      ? []
      : state.devices.filter(({ userId }) => userId === query.userId);
    return HttpResponse.json(userDevicesResponseSchema.parse({
      items,
      iosDeviceCount: items.filter(({ platform }) => platform === "ios").length,
      androidDeviceCount: items.filter(({ platform }) => platform === "android").length,
      totalDeviceCount: items.length,
      activeDeviceCount: items.filter(({ state }) => state === "active").length,
      revokedDeviceCount: items.filter(({ state }) => state === "revoked").length,
      region: items.length
        ? unavailableRegion(scenario)
        : { availability: "empty", message: "لا توجد أجهزة مسجلة." },
    }));
  }),
  http.get("/api/v1/admin/users/:userId/sessions", async ({ params, request }) => {
    const scenario = readScenario(request);
    const query = userDetailRequestSchema.parse(detailQuery(request, String(params.userId)));
    const scenarioResult = await scenarioResponse(scenario);
    if (scenarioResult) return scenarioResult;
    if (!hasPermission(query.role ?? "super-admin", "sessions.read")) {
      return HttpResponse.json({ code: "forbidden" }, { status: 403 });
    }
    const state = getPhase2MockState();
    if (!state.profiles.some(({ id }) => id === query.userId)) {
      return HttpResponse.json({ code: "not_found" }, { status: 404 });
    }
    const items = scenario === "empty"
      ? []
      : state.sessions.filter(({ userId }) => userId === query.userId);
    return HttpResponse.json(userSessionsResponseSchema.parse({
      items,
      activeCount: items.filter(({ state }) => state === "active").length,
      expiredCount: items.filter(({ state }) => state === "expired").length,
      revokedCount: items.filter(({ state }) => state === "revoked").length,
      region: items.length
        ? unavailableRegion(scenario)
        : { availability: "empty", message: "لا توجد جلسات." },
    }));
  }),
  http.post("/api/v1/admin/users/:userId/suspend", ({ params, request }) => safeActionResponse(request, async () => {
    requireActionPermission(actionRole(request), "users.status.manage");
    return suspendPhase2User(String(params.userId), suspendUserRequestSchema.parse(await request.json()));
  })),
  http.post("/api/v1/admin/users/:userId/reactivate", ({ params, request }) => safeActionResponse(request, async () => {
    requireActionPermission(actionRole(request), "users.status.manage");
    return reactivatePhase2User(String(params.userId), reactivateUserRequestSchema.parse(await request.json()));
  })),
  http.post("/api/v1/admin/users/:userId/verification", ({ params, request }) => safeActionResponse(request, async () => {
    requireActionPermission(actionRole(request), "users.verification.manage");
    return updatePhase2Verification(String(params.userId), updateVerificationRequestSchema.parse(await request.json()));
  })),
  http.post("/api/v1/admin/users/:userId/devices/:deviceId/revoke", ({ params, request }) => safeActionResponse(request, async () => {
    requireActionPermission(actionRole(request), "devices.revoke");
    return revokePhase2Device(String(params.userId), String(params.deviceId), revokeDeviceRequestSchema.parse(await request.json()));
  })),
  http.post("/api/v1/admin/users/:userId/sessions/revoke", ({ params, request }) => safeActionResponse(request, async () => {
    requireActionPermission(actionRole(request), "sessions.revoke");
    return revokePhase2Sessions(String(params.userId), revokeSessionsRequestSchema.parse(await request.json()));
  })),
  http.post("/api/v1/admin/users/bulk-actions", ({ request }) => safeActionResponse(request, async () => {
    const role = actionRole(request);
    const body = userBulkActionRequestSchema.parse(await request.json());
    const action = body.action;
    const permission: PermissionKey = action === "export-summary"
      ? "users.export_summary"
      : action === "force-logout"
        ? "sessions.revoke"
        : "users.status.manage";
    requireActionPermission(role, permission);
    return runPhase2BulkAction(body);
  })),
];
