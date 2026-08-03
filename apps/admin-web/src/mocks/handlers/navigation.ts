import { http, HttpResponse } from "msw";
import { hasPermission } from "@/core/permissions/role-map";
import { ADMIN_ROLES, type AdminRole } from "@/core/permissions/permissions";
import { navigationFixture } from "@/mocks/fixtures/foundation";
import { readScenario } from "@/mocks/scenarios/foundation";
import { scenarioResponse } from "./shared";

function requestedRole(request: Request): AdminRole {
  const role = new URL(request.url).searchParams.get("role");
  return ADMIN_ROLES.includes(role as AdminRole) ? role as AdminRole : "super-admin";
}

export const navigationHandlers = [
  http.get("/api/v1/admin/navigation", async ({ request }) => {
    const scenario = readScenario(request);
    const response = await scenarioResponse(scenario);
    if (response) return response;
    const role = requestedRole(request);
    const groups = navigationFixture.map((group) => ({
      ...group,
      items: group.items.filter(
        (item) => !item.permission || hasPermission(role, item.permission),
      ),
    }));
    return HttpResponse.json({ groups: scenario === "empty" ? [] : groups });
  }),
];
