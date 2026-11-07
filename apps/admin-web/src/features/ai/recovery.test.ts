import { afterEach, expect, test } from "vitest";
import { http, HttpResponse } from "msw";
import { mockServer } from "@/mocks/server";
import { aiRepository } from "./repository";
afterEach(() => {
  delete process.env.NEXT_PUBLIC_ENABLE_MOCKS;
});
test("overview sends selected scope and preserves unavailable attempt measurements", async () => {
  process.env.NEXT_PUBLIC_ENABLE_MOCKS = "false";
  const scopes: string[] = [];
  mockServer.use(
    http.get("/api/v1/admin/ai/overview", ({ request }) => {
      const params = new URL(request.url).searchParams;
      scopes.push(`${params.get("platform")}:${params.get("period")}`);
      return HttpResponse.json({
        id: "99000000-0000-4000-8000-000000000001",
        kind: "overview",
        version: 1,
        data: {
          providers: 1,
          models: 1,
          enabledRoutes: 1,
          requests: params.get("platform") === "ios" ? 2 : 9,
          failures: 1,
          estimatedCost: "0.2",
          totalAttempts: null,
          fallbackAttempts: null,
          observedAt: "2026-10-23T00:00:00Z",
          collectionStartedAt: "2026-10-23T00:00:00Z",
          attribution: "event_native_session",
          coverage: "partial",
        },
      });
    }),
  );
  const ios = await aiRepository.getOverview({ platform: "ios", period: "7d" });
  const android = await aiRepository.getOverview({
    platform: "android",
    period: "90d",
  });
  expect(scopes).toEqual(["ios:7d", "android:90d"]);
  expect([ios.totalOriginalRequests, android.totalOriginalRequests]).toEqual([
    2, 9,
  ]);
  expect(ios.totalAttempts).toBeNull();
  expect(ios.fallbackAttempts).toBeNull();
  expect(ios.metrics[0].freshness).toBe("2026-10-23T00:00:00Z");
});
test("list filters reach the server and changing filters resets cursors", async () => {
  process.env.NEXT_PUBLIC_ENABLE_MOCKS = "false";
  const requests: URLSearchParams[] = [];
  mockServer.use(
    http.get("/api/v1/admin/ai/providers", ({ request }) => {
      requests.push(new URL(request.url).searchParams);
      return HttpResponse.json({
        items: [],
        nextCursor: requests.length === 1 ? "old-cursor" : null,
      });
    }),
  );
  await aiRepository.listProviders({ page: 1, pageSize: 25, search: "first" });
  await aiRepository.listProviders({
    page: 1,
    pageSize: 25,
    search: "second",
    status: "healthy",
  });
  expect(requests.map((q) => q.get("search"))).toEqual(["first", "second"]);
  expect(requests[1].get("status")).toBe("healthy");
  expect(requests[1].get("cursor")).toBeNull();
});

test("publishing an evaluated prompt accepts the actual governed receipt", async () => {
  process.env.NEXT_PUBLIC_ENABLE_MOCKS = "false";
  const id = "99000000-0000-4000-8000-000000000002";
  mockServer.use(
    http.post(`/api/v1/admin/ai/prompts/${id}/publish`, () =>
      HttpResponse.json({
        id,
        workload: "financial_assistant",
        status: "approved",
        versionNo: 2,
      }),
    ),
  );
  await expect(
    aiRepository.actOnOperational("prompts", `AIPR-${id}`, {
      action: "activate",
      context: {
        expectedRevision: 2,
        expectedState: "testing",
        reason: "Publish after passing required tests",
      },
    }),
  ).resolves.toMatchObject({ id, status: "approved", versionNo: 2 });
});
