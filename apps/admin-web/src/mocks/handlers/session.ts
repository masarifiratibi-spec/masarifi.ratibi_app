import { http, HttpResponse } from "msw";
import { adminSessionFixture } from "@/mocks/fixtures/foundation";
import { readScenario } from "@/mocks/scenarios/foundation";
import { scenarioResponse } from "./shared";

export const sessionHandlers = [
  http.get("/api/v1/admin/session", async ({ request }) => {
    const scenario = readScenario(request);
    const response = await scenarioResponse(scenario);
    if (response) return response;
    if (scenario === "expired") {
      return HttpResponse.json({ ...adminSessionFixture, expiresAt: "2020-01-01T00:00:00+00:00" });
    }
    return HttpResponse.json(adminSessionFixture);
  }),
];
