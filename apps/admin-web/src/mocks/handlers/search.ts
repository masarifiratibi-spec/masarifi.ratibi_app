import { http, HttpResponse } from "msw";
import { hasPermission } from "@/core/permissions/role-map";
import { ADMIN_ROLES, type AdminRole } from "@/core/permissions/permissions";
import { searchFixture } from "@/mocks/fixtures/foundation";
import { readScenario } from "@/mocks/scenarios/foundation";
import { scenarioResponse } from "./shared";

export const searchHandlers = [
  http.get("/api/v1/admin/search", async ({ request }) => {
    const scenario = readScenario(request);
    const response = await scenarioResponse(scenario);
    if (response) return response;
    const url = new URL(request.url);
    const candidate = url.searchParams.get("role");
    const role = ADMIN_ROLES.includes(candidate as AdminRole) ? candidate as AdminRole : "super-admin";
    const query = (url.searchParams.get("query") ?? "").toLocaleLowerCase("ar");
    const items = searchFixture.filter(
      (item) => hasPermission(role, item.permission)
        && (!query || `${item.primaryLabel} ${item.secondaryLabel ?? ""}`.toLocaleLowerCase("ar").includes(query)),
    );
    return HttpResponse.json({
      items: scenario === "empty" ? [] : items,
      page: 1,
      pageSize: 25,
      totalItems: items.length,
      totalPages: items.length ? 1 : 0,
    });
  }),
];
