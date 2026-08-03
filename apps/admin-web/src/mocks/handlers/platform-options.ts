import { http, HttpResponse } from "msw";
import { platformOptionsFixture } from "@/mocks/fixtures/foundation";
import { readScenario } from "@/mocks/scenarios/foundation";
import { scenarioResponse } from "./shared";

export const platformOptionHandlers = [
  http.get("/api/v1/admin/platform-options", async ({ request }) => {
    const response = await scenarioResponse(readScenario(request));
    return response ?? HttpResponse.json({ options: platformOptionsFixture });
  }),
];
