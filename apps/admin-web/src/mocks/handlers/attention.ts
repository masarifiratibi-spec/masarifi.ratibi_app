import { http, HttpResponse } from "msw";
import { ADMIN_ROLES, type AdminRole } from "@/core/permissions/permissions";
import { attentionFixture } from "@/mocks/fixtures/foundation";
import { readScenario } from "@/mocks/scenarios/foundation";
import { scenarioResponse } from "./shared";
import type { AttentionItem } from "@/features/foundation/contracts";

const SEVERITY_ORDER: Record<string, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
  info: 4,
};

function ordered(items: AttentionItem[]): AttentionItem[] {
  return [...items].sort((a, b) => {
    const severityDiff = (SEVERITY_ORDER[a.severity] ?? 99) - (SEVERITY_ORDER[b.severity] ?? 99);
    if (severityDiff !== 0) return severityDiff;
    const timeDiff = Date.parse(b.occurredAt) - Date.parse(a.occurredAt);
    if (timeDiff !== 0) return timeDiff;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });
}

function paginate<T>(items: T[], page: number, pageSize: number) {
  const start = (page - 1) * pageSize;
  const slice = items.slice(start, start + pageSize);
  return {
    items: slice,
    page,
    pageSize,
    totalItems: items.length,
    totalPages: Math.max(items.length ? 1 : 0, Math.ceil(items.length / pageSize)),
  };
}

export const attentionHandlers = [
  http.get("/api/v1/admin/attention", async ({ request }) => {
    const scenario = readScenario(request);
    const response = await scenarioResponse(scenario);
    if (response) return response;
    const url = new URL(request.url);
    const roleCandidate = url.searchParams.get("role");
    const role: AdminRole = ADMIN_ROLES.includes(roleCandidate as AdminRole)
      ? (roleCandidate as AdminRole)
      : "super-admin";
    const platform = url.searchParams.get("platform") ?? "all";
    const page = Number(url.searchParams.get("page") ?? "1") || 1;
    const pageSize = Math.min(25, Number(url.searchParams.get("pageSize") ?? "10") || 10);

    const scoped = attentionFixture.filter((item) => {
      if (platform === "all") return true;
      if (platform === "ios") return item.platformScope === "ios" || item.platformScope === "global" || item.platformScope === "all";
      return item.platformScope === "android" || item.platformScope === "global" || item.platformScope === "all";
    });
    void role;

    if (scenario === "empty") {
      return HttpResponse.json({
        ...paginate([], page, pageSize),
        region: { region: "attention", availability: "empty", retryable: true, message: "لا توجد تنبيهات للمنصة والفترة المحددة." },
      });
    }
    const sorted = ordered(scoped);
    return HttpResponse.json({
      ...paginate(sorted, page, pageSize),
      region: { region: "attention", availability: "available", retryable: true },
    });
  }),
];
