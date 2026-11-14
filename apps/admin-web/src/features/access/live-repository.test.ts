import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { http, HttpResponse } from "msw";
import { configureApiActorProvider, configureApiTokenProvider } from "@/core/api/client";
import { mockServer } from "@/mocks/server";
import { accessRepository } from "./repository";

const id = "c032d49a-e644-49d7-aeca-0a166617b04b";
const actor = "user_access_operator";
const scope = [{ resource: "account-status", actions: ["read-status"] }];
const fixture = () => ({
  id, user: { id: "user_access_customer", kind: "customer", label: "customer masked" },
  requester: { id: "user_other_operator", kind: "admin", label: "admin masked" },
  assignee: { id: actor, kind: "admin", label: "admin masked" },
  supportTicketId: "desk.case:42", scopes: scope,
  status: "pending", customerApprovalRequired: true, customerApprovedAt: null,
  expiresAt: new Date(Date.now() + 20 * 60_000).toISOString(), version: 3,
  createdAt: new Date(Date.now() - 10 * 60_000).toISOString(),
  purpose: "Review account status for a support case", requestedDurationMinutes: 30,
  approvedBy: null, decidedAt: null, grant: null,
});

describe("canonical live support access", () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_ENABLE_MOCKS = "false";
    configureApiActorProvider(() => actor);
    configureApiTokenProvider(async () => "test-clerk-session");
  });
  afterEach(() => { process.env.NEXT_PUBLIC_ENABLE_MOCKS = "true"; });

  test("reads real UUIDs through cursor pages without invented totals or client authority", async () => {
    const urls: URL[] = [];
    mockServer.use(http.get("/api/v1/admin/support-access/requests", ({ request }) => {
      const url = new URL(request.url); urls.push(url);
      return HttpResponse.json({ items: url.searchParams.has("cursor") ? [] : [fixture()], nextCursor: url.searchParams.has("cursor") ? null : "next-page" });
    }));
    const first = await accessRepository.listRequests({ status: "pending", scenario: "unsafe-response" }, "super-admin");
    expect(first.items[0]).toMatchObject({ id, requestedBy: "user_other_operator", assignee: actor, version: 3, reasonSummary: fixture().purpose });
    expect(first.pagination).toMatchObject({ totalItems: null, totalPages: null, hasNext: true });
    await expect(accessRepository.listRequests({ status: "pending", page: 2 }, "super-admin")).resolves.toMatchObject({ items: [], pagination: { hasNext: false } });
    expect(urls[0].searchParams.get("limit")).toBe("25");
    expect(urls[1].searchParams.get("cursor")).toBe("next-page");
    for (const url of urls) { expect(url.searchParams.has("role")).toBe(false); expect(url.searchParams.has("__scenario")).toBe(false); }
  });

  test("keeps legacy missing review metadata unknown rather than inventing dates or reason", async () => {
    const { createdAt, purpose, requestedDurationMinutes, approvedBy, decidedAt, grant, ...legacy } = fixture();
    void [createdAt, purpose, requestedDurationMinutes, approvedBy, decidedAt, grant];
    mockServer.use(http.get(`/api/v1/admin/support-access/requests/${id}`, () => HttpResponse.json(legacy)));
    const result = await accessRepository.getRequest(id, "super-admin");
    expect(result).toMatchObject({ createdAt: null, reason: null, requestedDurationMinutes: null, timeline: [], version: 3 });
  });

  test("posts the canonical create body with only read-only resource actions", async () => {
    let body: unknown;
    mockServer.use(http.post("/api/v1/admin/support-access/requests", async ({ request }) => { body = await request.json(); return HttpResponse.json(fixture(), { status: 201 }); }));
    await accessRepository.createRequest({ userId: "user_access_customer", supportTicketId: fixture().supportTicketId, assignee: actor,
      reason: fixture().purpose, requestedScope: ["account-status"], durationMinutes: 5, maskingRequired: true, customerApprovalRequired: true }, "super-admin");
    expect(body).toEqual({ userId: "user_access_customer", supportTicketId: fixture().supportTicketId, assignee: actor,
      purpose: fixture().purpose, resourceScopes: scope, durationMinutes: 5, customerApprovalRequired: true });
  });

  test("preserves same-version scope actions and sends optimistic version for decisions", async () => {
    const row = fixture(); row.scopes = [{ resource: "device-diagnostics", actions: ["read-status"] }];
    let body: unknown;
    mockServer.use(http.get(`/api/v1/admin/support-access/requests/${id}`, () => HttpResponse.json(row)),
      http.post(`/api/v1/admin/support-access/requests/${id}/decision`, async ({ request }) => { body = await request.json(); return HttpResponse.json(row); }));
    await accessRepository.decideRequest(id, { decision: "approve", reason: "Reviewed minimal status scope", approvedScope: ["device-diagnostics"],
      durationMinutes: 5, startsAt: new Date().toISOString(), expectedVersion: 3 } as Parameters<typeof accessRepository.decideRequest>[1], "super-admin");
    expect(body).toMatchObject({ expectedVersion: 3, decision: "approve", approvedScope: [{ resource: "device-diagnostics", actions: ["read-status"] }] });
  });

  test("retains the reviewed version when the server rejects a stale decision", async () => {
    let postedVersion: unknown;
    mockServer.use(http.get(`/api/v1/admin/support-access/requests/${id}`, () => HttpResponse.json({ ...fixture(), version: 4 })),
      http.post(`/api/v1/admin/support-access/requests/${id}/decision`, async ({ request }) => { postedVersion = (await request.json() as { expectedVersion: number }).expectedVersion; return HttpResponse.json({ code: "VERSION_CONFLICT" }, { status: 409 }); }));
    await expect(accessRepository.decideRequest(id, { decision: "reject", reason: "Request changed during review", expectedVersion: 3 } as Parameters<typeof accessRepository.decideRequest>[1], "super-admin"))
      .rejects.toMatchObject({ code: "conflict" });
    expect(postedVersion).toBe(3);
  });

  test("returns gone when a protected snapshot has expired so cached content can be purged", async () => {
    const expiresAt = new Date(Date.now() - 1000).toISOString();
    const grant = { id: "9900fe45-1387-4411-89a6-44a903e8c78f", scopes: scope, startsAt: new Date(Date.now() - 10 * 60_000).toISOString(), expiresAt, revokedAt: null };
    mockServer.use(http.get(`/api/v1/admin/support-access/requests/${id}`, () => HttpResponse.json({ ...fixture(), status: "approved", customerApprovalRequired: false, grant })),
      http.get(`/api/v1/admin/support-access/requests/${id}/workspace`, () => HttpResponse.json({ requestId: id, grantId: grant.id, expiresAt, sections: [{ resource: "account-status", projection: "status", status: "active" }] })));
    await expect(accessRepository.getWorkspace(id, "super-admin")).rejects.toMatchObject({ code: "gone" });
  });

  test("propagates revoked workspace rejection without reading a broader request endpoint", async () => {
    let detailReads = 0;
    mockServer.use(http.get(`/api/v1/admin/support-access/requests/${id}`, () => { detailReads++; return HttpResponse.json(fixture()); }),
      http.get(`/api/v1/admin/support-access/requests/${id}/workspace`, () => HttpResponse.json({ code: "FORBIDDEN" }, { status: 403 })));
    await expect(accessRepository.getWorkspace(id, "super-admin")).rejects.toMatchObject({ code: "forbidden" });
    expect(detailReads).toBe(0);
  });

  test("retains one idempotency key and reviewed version after an uncertain decision response", async () => {
    const keys: Array<string | null> = []; const versions: number[] = [];
    mockServer.use(http.get(`/api/v1/admin/support-access/requests/${id}`, () => HttpResponse.json({ ...fixture(), version: 4 })),
      http.post(`/api/v1/admin/support-access/requests/${id}/decision`, async ({ request }) => {
        keys.push(request.headers.get("Idempotency-Key")); versions.push((await request.json() as { expectedVersion: number }).expectedVersion);
        return keys.length === 1 ? HttpResponse.error() : HttpResponse.json({ ...fixture(), status: "denied", version: 4 });
      }));
    const command = { decision: "reject" as const, reason: "Reviewed minimal scope only", expectedVersion: 3 };
    await expect(accessRepository.decideRequest(id, command, "super-admin")).rejects.toBeDefined();
    await expect(accessRepository.decideRequest(id, command, "super-admin")).resolves.toMatchObject({ status: "rejected", version: 4 });
    expect(keys[0]).toBeTruthy(); expect(keys[1]).toBe(keys[0]); expect(versions).toEqual([3, 3]);
  });

  test("requires a reviewed version and rejects requester self-decisions before posting", async () => {
    let posts = 0;
    mockServer.use(http.get(`/api/v1/admin/support-access/requests/${id}`, () => HttpResponse.json({ ...fixture(), requester: { id: actor, kind: "admin", label: "admin masked" } })),
      http.post(`/api/v1/admin/support-access/requests/${id}/decision`, () => { posts++; return HttpResponse.json(fixture()); }));
    await expect(accessRepository.decideRequest(id, { decision: "reject", reason: "Independent review required" }, "super-admin")).rejects.toMatchObject({ code: "validation_error" });
    await expect(accessRepository.decideRequest(id, { decision: "reject", reason: "Independent review required", expectedVersion: 3 }, "super-admin")).rejects.toMatchObject({ code: "forbidden" });
    expect(posts).toBe(0);
  });

  test("uses only grant-authorized context and rejects raw fields, legacy context and foreign assignees", async () => {
    const expiresAt = fixture().expiresAt;
    const access = { supportTicketId: "desk.case:42", assignee: actor, startsAt: new Date(Date.now() - 60_000).toISOString(), scopes: scope, version: 3 };
    let state = "safe"; let detailReads = 0;
    mockServer.use(http.get(`/api/v1/admin/support-access/requests/${id}`, () => { detailReads++; return HttpResponse.json({ code: "FORBIDDEN" }, { status: 403 }); }),
      http.get(`/api/v1/admin/support-access/requests/${id}/workspace`, () => HttpResponse.json({ requestId: id, grantId: "9900fe45-1387-4411-89a6-44a903e8c78f", expiresAt,
        ...(state === "legacy" ? {} : { access: { ...access, ...(state === "actor" ? { assignee: "user_other_admin" } : {}) } }),
        sections: [{ resource: "account-status", projection: "status", status: "active", ...(state === "raw" ? { rawEmail: "private@example.test" } : {}) }] })));
    await expect(accessRepository.getWorkspace(id, "super-admin")).resolves.toMatchObject({ supportTicketId: "desk.case:42", version: 3, sections: [{ fields: [{ label: "status", value: "active" }] }] });
    state = "raw"; await expect(accessRepository.getWorkspace(id, "super-admin")).rejects.toMatchObject({ code: "contract_mismatch" });
    state = "legacy"; await expect(accessRepository.getWorkspace(id, "super-admin")).rejects.toMatchObject({ code: "contract_mismatch" });
    state = "actor"; await expect(accessRepository.getWorkspace(id, "super-admin")).rejects.toMatchObject({ code: "forbidden" });
    expect(detailReads).toBe(0);
  });

  test("returns actual revoke and end receipts using reviewed versions", async () => {
    const versions: number[] = [];
    for (const action of ["revoke", "end"]) mockServer.use(http.post(`/api/v1/admin/support-access/requests/${id}/${action}`, async ({ request }) => {
      versions.push((await request.json() as { expectedVersion: number }).expectedVersion); return HttpResponse.json({ ...fixture(), status: "revoked", version: 4 });
    }));
    await expect(accessRepository.revokeRequest(id, { reason: "Support case has been closed", expectedVersion: 3 }, "super-admin")).resolves.toMatchObject({ status: "revoked", version: 4 });
    await expect(accessRepository.endAccess(id, { expectedVersion: 3 }, "super-admin")).resolves.toEqual({ requestId: id, status: "revoked", version: 4 });
    expect(versions).toEqual([3, 3]);
  });

  test("reads a historical two-hour request while retaining the one-hour command policy", async () => {
    const row = { ...fixture(), requestedDurationMinutes: 120, expiresAt: new Date(Date.now() + 120 * 60_000).toISOString() };
    mockServer.use(http.get(`/api/v1/admin/support-access/requests/${id}`, () => HttpResponse.json(row)));
    await expect(accessRepository.getRequest(id, "super-admin")).resolves.toMatchObject({ requestedDurationMinutes: 120 });
    await expect(accessRepository.decideRequest(id, { decision: "approve", reason: "Review limited support scope", approvedScope: ["account-status"], durationMinutes: 120, startsAt: new Date().toISOString(), expectedVersion: 3 }, "super-admin")).rejects.toBeDefined();
  });

});
