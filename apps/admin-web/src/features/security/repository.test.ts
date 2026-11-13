import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { http, HttpResponse } from "msw";
import { ApiError } from "@/core/api/errors";
import { setSimulatedRole } from "@/core/auth/use-simulated-role";
import { mockServer } from "@/mocks/server";
import { securityRepository } from "./repository";

describe("Phase 7 repository and MSW boundary", () => {
  test("loads the primary security, audit, export, deletion, and retention resources", async () => {
    await expect(securityRepository.getSecurityOverview({ platform: "all", period: "30d" })).resolves.toMatchObject({ query: { platform: "all" } });
    await expect(securityRepository.listAuthenticationEvents({ page: 1, pageSize: 25 })).resolves.toMatchObject({ items: expect.any(Array) });
    await expect(securityRepository.listSuspiciousActivity({ page: 1, pageSize: 25 })).resolves.toMatchObject({ items: expect.any(Array) });
    await expect(securityRepository.getSecurityIncident("INC-1001")).resolves.toMatchObject({ id: "INC-1001" });
    await expect(securityRepository.listAdminSecurity({ page: 1, pageSize: 25 })).resolves.toMatchObject({ items: expect.any(Array) });
    await expect(securityRepository.listPermissionChanges({ page: 1, pageSize: 25 })).resolves.toMatchObject({ items: expect.any(Array) });
    await expect(securityRepository.listSupportAccess({ page: 1, pageSize: 25 })).resolves.toMatchObject({ items: expect.any(Array) });
    await expect(securityRepository.listAuditEvents({ page: 1, pageSize: 25 })).resolves.toMatchObject({ items: expect.any(Array) });
    await expect(securityRepository.getAuditEvent("AUD-1001")).resolves.toMatchObject({ id: "AUD-1001" });
    await expect(securityRepository.listExportRequests({ page: 1, pageSize: 25 })).resolves.toMatchObject({ items: expect.any(Array) });
    await expect(securityRepository.getExportRequest("EXP-1001")).resolves.toMatchObject({ id: "EXP-1001" });
    await expect(securityRepository.listDeletionRequests({ page: 1, pageSize: 25 })).resolves.toMatchObject({ items: expect.any(Array) });
    await expect(securityRepository.getDeletionRequest("DEL-1001")).resolves.toMatchObject({ id: "DEL-1001" });
    await expect(securityRepository.listRetentionPolicies({ page: 1, pageSize: 25 })).resolves.toMatchObject({ items: expect.any(Array) });
    await expect(securityRepository.getRetentionPolicy("RET-1001")).resolves.toMatchObject({ id: "RET-1001" });
  });

  test("persists safe mock mutations and never returns export carriers", async () => {
    await expect(securityRepository.actOnSuspiciousActivity("SUS-1001", {
      action: "assign_reviewer",
      context: {
        expectedState: "New",
        expectedRevision: 1,
        reason: "Review required",
        confirmationToken: "CONFIRM-SPEC-008",
      },
    })).resolves.toMatchObject({ currentState: "Investigating", auditReference: { eventId: "AUD-P7-0001" } });

    const download = await securityRepository.simulateExportDownload("EXP-1001", { expectedRevision: 1 });
    expect(download).toEqual({
      requestId: "EXP-1001",
      allowed: true,
      expiresAt: "2026-07-30T15:00:00+03:00",
      message: "Mock-only simulation. No customer archive, URL, token, Blob, or file was generated.",
    });
    expect(download).not.toHaveProperty("url");
    expect(download).not.toHaveProperty("token");
  });

  test("keeps audit read-only and retention updates PATCH-only through the repository surface", async () => {
    expect("actOnAuditEvent" in securityRepository).toBe(false);
    await expect(securityRepository.updateRetentionPolicy("RET-1001", {
      retentionDays: 400,
      reason: "Regulatory evidence period",
      impactAcknowledged: true,
      expectedRevision: 1,
      confirmationToken: "CONFIRM-SPEC-008",
    })).resolves.toMatchObject({ affectedId: "RET-1001", currentRevision: 2, currentState: "active" });
  });

  test("denied roles receive safe forbidden responses", async () => {
    setSimulatedRole("support-agent");
    await expect(securityRepository.listAuditEvents({ page: 1, pageSize: 25 })).rejects.toBeInstanceOf(ApiError);
  });

  test("validates identifiers before route interpolation", async () => {
    await expect(Promise.resolve().then(() => securityRepository.getAuditEvent("USR-1001"))).rejects.toBeInstanceOf(ApiError);
  });
});

describe("Live security incident mapping", () => {
  const incidentId = "13000000-0000-4000-8000-000000000001";
  const endpoint = `/api/v1/admin/security/incidents/${incidentId}`;
  const incident = {
    id: incidentId,
    title: "Suspicious session investigated",
    severity: "high",
    status: "contained",
    detectedAt: "2026-09-10T08:00:00.000Z",
    owner: null,
    summaryRedacted: null,
    version: 3,
    timeline: [{
      id: "13000000-0000-4000-8000-000000000002",
      eventType: "incident_contain",
      detailsRedacted: "Internal case note",
      occurredAt: "2026-09-10T08:30:00.000Z",
    }],
  };

  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_ENABLE_MOCKS", "false");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  test("reads the security incident by its UUID and projects only timeline labels", async () => {
    mockServer.use(http.get(endpoint, () => HttpResponse.json(incident)));
    await expect(securityRepository.getSecurityIncident(incidentId)).resolves.toMatchObject({
      id: incidentId,
      severity: "high",
      state: "Contained",
      affectedCustomerCount: null,
      affectedServices: [],
      timeline: [{ at: "2026-09-10T08:30:00.000Z", label: "incident_contain" }],
      revision: 3,
      allowedActions: ["resolve"],
    });
  });

  test("accepts an investigating security incident", async () => {
    mockServer.use(http.get(endpoint, () => HttpResponse.json({ ...incident, status: "investigating" })));
    await expect(securityRepository.getSecurityIncident(incidentId)).resolves.toMatchObject({
      state: "Investigating",
      allowedActions: ["contain"],
    });
  });

  test("sends the selected transition and displayed version to the security endpoint", async () => {
    let body: unknown;
    mockServer.use(
      http.patch(endpoint, async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({ ...incident, status: "resolved", version: 4, timeline: undefined });
      }),
    );
    const context = {
      expectedState: "Contained",
      expectedRevision: 3,
      reason: "Resolve the security incident after review.",
      confirmationToken: "CONFIRM-SPEC-008",
    };

    await expect(securityRepository.actOnSecurityIncident(incidentId, { action: "resolve", context }))
      .resolves.toMatchObject({ id: incidentId, status: "resolved", version: 4 });
    expect(body).toEqual({ action: "resolve", expectedVersion: 3, reason: context.reason });
    await expect(securityRepository.actOnSecurityIncident(incidentId, { action: "monitor", context }))
      .rejects.toMatchObject({ code: "provider_unavailable" });
  });
});

describe("BE003 live deletion workflow mapping", () => {
  const deletionId = "13000000-0000-4000-8000-000000000021";

  beforeEach(() => {
    process.env.NEXT_PUBLIC_ENABLE_MOCKS = "false";
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    process.env.NEXT_PUBLIC_ENABLE_MOCKS = "true";
  });

  test("loads the real deletion page without inventing customer or checklist data", async () => {
    mockServer.use(
      http.get("/api/v1/admin/privacy/deletions", ({ request }) => {
        const url = new URL(request.url);
        expect(url.searchParams.get("limit")).toBe("25");
        expect(url.searchParams.has("page")).toBe(false);
        return HttpResponse.json({
          items: [{
            id: deletionId,
            status: "verified",
            requestedAt: "2026-09-12T10:00:00.000Z",
            coolingOffEndsAt: "2026-09-13T10:00:00.000Z",
            completedAt: null,
            version: 2,
          }],
          nextCursor: null,
        });
      }),
    );

    await expect(
      securityRepository.listDeletionRequests({ page: 1, pageSize: 25 }),
    ).resolves.toMatchObject({
      items: [{
        id: deletionId,
        state: "Scheduled",
        requestedAt: "2026-09-12T10:00:00.000Z",
        coolingOffEndsAt: "2026-09-13T10:00:00.000Z",
        completedAt: null,
        legalHold: null,
        checklist: [],
        revision: 2,
        allowedActions: ["cancel"],
        auditReferences: [],
      }],
      pagination: { page: 1, pageSize: 25, totalItems: 1, totalPages: 1 },
      region: { availability: "available" },
    });
  });

  test("translates the Admin workflow state to the backend status filter", async () => {
    mockServer.use(
      http.get("/api/v1/admin/privacy/deletions", ({ request }) => {
        expect(new URL(request.url).searchParams.get("status")).toBe("verified");
        return HttpResponse.json({ items: [], nextCursor: null });
      }),
    );

    await expect(securityRepository.listDeletionRequests({
      state: "Scheduled",
      page: 1,
      pageSize: 25,
    })).resolves.toMatchObject({ region: { availability: "empty" } });
  });

  test("finds a deletion detail through one bounded id lookup", async () => {
    mockServer.use(
      http.get("/api/v1/admin/privacy/deletions", ({ request }) => {
        const requestedId = new URL(request.url).searchParams.get("id");
        return HttpResponse.json(requestedId === deletionId
          ? {
              items: [{
                id: deletionId,
                status: "failed",
                requestedAt: "2026-09-12T10:00:00.000Z",
                coolingOffEndsAt: "2026-09-13T10:00:00.000Z",
                completedAt: null,
                version: 3,
              }],
              nextCursor: null,
            }
          : { items: [], nextCursor: "deletion-page-2" });
      }),
    );

    await expect(securityRepository.getDeletionRequest(deletionId)).resolves.toMatchObject({
      id: deletionId,
      state: "Blocked",
      revision: 3,
      allowedActions: ["retry"],
    });
  });

  test("maps the reviewed UI action to the exact backend action contract", async () => {
    let body: unknown;
    mockServer.use(
      http.post(`/api/v1/admin/privacy/deletions/${deletionId}/actions`, async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({
          id: deletionId,
          status: "verified",
          requestedAt: "2026-09-12T10:00:00.000Z",
          coolingOffEndsAt: "2026-09-13T10:00:00.000Z",
          completedAt: null,
          version: 2,
        });
      }),
    );

    await expect(securityRepository.actOnDeletionRequest(deletionId, {
      action: "review",
      context: {
        expectedState: "Requested",
        expectedRevision: 1,
        reason: "Deletion request reviewed against the retention policy.",
        confirmationToken: "CONFIRM-SPEC-008",
      },
    })).resolves.toMatchObject({
      id: deletionId,
      state: "Scheduled",
      revision: 2,
    });
    expect(body).toEqual({
      action: "verify",
      reason: "Deletion request reviewed against the retention policy.",
      expectedVersion: 1,
    });
  });
});
