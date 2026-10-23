import { afterEach, expect, test } from "vitest";
import { http, HttpResponse } from "msw";
import { mockServer } from "@/mocks/server";
import { importsRepository, phase4Repository } from "./repository";
afterEach(() => {
  delete process.env.NEXT_PUBLIC_ENABLE_MOCKS;
});
test("landing forwards filters and requests only one bounded page", async () => {
  process.env.NEXT_PUBLIC_ENABLE_MOCKS = "false";
  const requests: URLSearchParams[] = [];
  mockServer.use(
    http.get("/api/v1/admin/imports/overview", () =>
      HttpResponse.json({
        totalSessions: 0,
        uniqueCustomers: 0,
        totalItems: 0,
        failedSessions: 0,
        reviewSessions: 0,
        highestFailureSource: "manual",
      }),
    ),
    http.get("/api/v1/admin/imports/sessions", ({ request }) => {
      const q = new URL(request.url).searchParams;
      requests.push(q);
      return HttpResponse.json({
        items: [],
        nextCursor: q.has("cursor") ? null : "next-page",
      });
    }),
  );
  await importsRepository.getImports({
    page: 1,
    pageSize: 25,
    query: "bank",
    source: "file",
    severity: "high",
  });
  expect(requests).toHaveLength(1);
  expect(Object.fromEntries(requests[0])).toMatchObject({
    limit: "25",
    search: "bank",
    sourceType: "file",
    severity: "high",
  });
});
test("failure lists work and parser actions use parent revision", async () => {
  process.env.NEXT_PUBLIC_ENABLE_MOCKS = "false";
  mockServer.use(
    http.get("/api/v1/admin/imports/failures", () =>
      HttpResponse.json({ items: [], nextCursor: null }),
    ),
    http.get("/api/v1/admin/parsers/versions", () =>
      HttpResponse.json({
        items: [
          {
            id: "99000000-0000-4000-8000-000000000001",
            versionNo: 1,
            parentRuleVersion: 7,
            status: "published",
            corpusStatus: "passed",
            createdAt: "2026-10-23T00:00:00Z",
          },
        ],
        nextCursor: null,
      }),
    ),
  );
  await expect(
    phase4Repository.list("failures", { page: 1, pageSize: 25 }),
  ).resolves.toMatchObject({ items: [] });
  await expect(
    phase4Repository.list("versions", { page: 1, pageSize: 25 }),
  ).resolves.toMatchObject({
    items: [{ revision: 7, parentRuleVersion: 7, version: "1" }],
  });
});
