import { delay, HttpResponse } from "msw";
import type { FoundationScenario } from "@/mocks/scenarios/foundation";

export async function scenarioResponse(scenario: FoundationScenario): Promise<Response | null> {
  if (scenario === "loading" || scenario === "slow") await delay(1_000);
  if (scenario === "validation") {
    return HttpResponse.json({ code: "validation_error" }, { status: 400 });
  }
  if (scenario === "unauthorized" || scenario === "expired") {
    return HttpResponse.json({ code: "session_expired" }, { status: 401 });
  }
  if (scenario === "forbidden") {
    return HttpResponse.json({ code: "forbidden" }, { status: 403 });
  }
  if (scenario === "not-found") {
    return HttpResponse.json({ code: "not_found" }, { status: 404 });
  }
  if (scenario === "gone") {
    return HttpResponse.json({ code: "gone" }, { status: 410 });
  }
  if (scenario === "conflict") {
    return HttpResponse.json({ code: "conflict" }, { status: 409 });
  }
  if (scenario === "rate-limited") {
    return HttpResponse.json({ code: "rate_limited" }, { status: 429 });
  }
  if (scenario === "unavailable") {
    return HttpResponse.json({ code: "provider_unavailable" }, { status: 503 });
  }
  if (scenario === "internal-error") {
    return HttpResponse.json({ code: "internal_error" }, { status: 500 });
  }
  if (scenario === "duplicate-pending") {
    return HttpResponse.json({ code: "conflict" }, { status: 409 });
  }
  return null;
}
