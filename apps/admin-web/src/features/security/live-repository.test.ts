import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { http, HttpResponse } from "msw";
import { configureApiActorProvider } from "@/core/api/client";
import { mockServer } from "@/mocks/server";
import { securityRepository } from "./repository";

const id = "13000000-0000-4000-8000-000000000011";
const date = "2026-10-23T10:00:00.000Z";
describe("live security and privacy projections", () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_ENABLE_MOCKS = "false";
    configureApiActorProvider(() => "admin_live");
  });
  afterEach(() => {
    process.env.NEXT_PUBLIC_ENABLE_MOCKS = "true";
  });
  test("reads bounded audit pages and leaves unavailable evidence unknown", async () => {
    const seen: string[] = [];
    mockServer.use(
      http.get("/api/v1/admin/audit/events", ({ request }) => {
        seen.push(new URL(request.url).search);
        return HttpResponse.json({
          items: [
            {
              id,
              actor: { id: "user_clerk_admin", kind: "admin", label: "Admin" },
              actorType: "admin",
              action: "security.createRole",
              resourceType: "role",
              resourceId: id,
              requestId: "request-live",
              occurredAt: date,
              result: "success",
              safeMetadata: [],
            },
          ],
          nextCursor: seen.length === 1 ? "MjU" : null,
        });
      }),
    );
    const first = await securityRepository.listAuditEvents({
      page: 1,
      pageSize: 25,
    });
    expect(first.items[0]).toMatchObject({
      id,
      severity: null,
      correlationId: "request-live",
    });
    await securityRepository.listAuditEvents({ page: 2, pageSize: 25 });
    expect(seen).toEqual(["?limit=25", "?limit=25&cursor=MjU"]);
  });
  test("shows pending support requests without presenting a usable grant", async () => {
    mockServer.use(
      http.get("/api/v1/admin/support-access/requests", () =>
        HttpResponse.json({
          items: [
            {
              id,
              user: { id: "customer_1", kind: "customer", label: "Customer" },
              requester: { id: "admin_1", kind: "admin", label: "Admin" },
              assignee: { id: "admin_1", kind: "admin", label: "Admin" },
              supportTicketId: "ticket_1",
              scopes: [
                { resource: "account-status", actions: ["read-status"] },
              ],
              status: "pending",
              customerApprovalRequired: true,
              customerApprovedAt: null,
              expiresAt: date,
              version: 1,
            },
          ],
          nextCursor: null,
        }),
      ),
    );
    const page = await securityRepository.listSupportAccess({
      page: 1,
      pageSize: 25,
    });
    expect(page.items[0]).toMatchObject({
      id,
      state: "pending",
      startedAt: null,
      scopes: ["account-status: read-status"],
    });
  });
  test("fetches one export by server id and offers only implemented actions", async () => {
    let query = "";
    mockServer.use(
      http.get("/api/v1/admin/privacy/exports", ({ request }) => {
        query = new URL(request.url).search;
        return HttpResponse.json({
          items: [
            {
              id,
              status: "ready",
              scope: ["identity@1"],
              requestedAt: date,
              expiresAt: date,
              version: 2,
            },
          ],
          nextCursor: null,
        });
      }),
    );
    const result = await securityRepository.getExportRequest(id);
    expect(query).toBe(`?limit=1&id=${id}`);
    expect(result).toMatchObject({
      customer: null,
      state: "Ready",
      allowedActions: ["expire"],
    });
    expect(result).not.toHaveProperty("file");
  });
  test("maps supported export actions and rejects simulated completion", async () => {
    let command: unknown;
    mockServer.use(
      http.post(
        `/api/v1/admin/privacy/exports/${id}/actions`,
        async ({ request }) => {
          command = await request.json();
          return HttpResponse.json({
            id,
            status: "verified",
            scope: ["identity@1"],
            requestedAt: date,
            expiresAt: null,
            version: 2,
          });
        },
      ),
    );
    const context = {
      expectedState: "Requested",
      expectedRevision: 1,
      reason: "Verify requested privacy export",
      confirmationToken: "CONFIRM-SPEC-008",
    };
    await expect(
      securityRepository.actOnExportRequest(id, {
        action: "validate",
        context,
      }),
    ).resolves.toMatchObject({ state: "Validating", revision: 2 });
    expect(command).toEqual({
      action: "verify",
      reason: context.reason,
      expectedVersion: 1,
    });
    await expect(
      securityRepository.actOnExportRequest(id, {
        action: "mark_ready",
        context,
      }),
    ).rejects.toBeDefined();
  });
  test("reads retention policy without inventing cleanup or hold state", async () => {
    mockServer.use(
      http.get("/api/v1/admin/retention/policies", () =>
        HttpResponse.json({
          items: [
            {
              id,
              resourceType: "audit",
              retentionDays: 400,
              deletionMode: "delete",
              legalBasis: "Operational retention",
              enabled: true,
              version: 1,
            },
          ],
          nextCursor: null,
        }),
      ),
    );
    await expect(
      securityRepository.getRetentionPolicy(id),
    ).resolves.toMatchObject({
      id,
      retentionDays: 400,
      minimumDays: null,
      maximumDays: null,
      legalHold: null,
      effectiveCleanupState: null,
    });
  });
  test("preserves forbidden support-access responses without exposing rows", async () => {
    mockServer.use(
      http.get("/api/v1/admin/support-access/requests", () =>
        HttpResponse.json({ code: "FORBIDDEN" }, { status: 403 }),
      ),
    );
    await expect(
      securityRepository.listSupportAccess({ page: 1, pageSize: 25 }),
    ).rejects.toMatchObject({ status: 403 });
  });
  test.each(["user", "provider"])(
    "accepts canonical %s audit actors without inventing an admin",
    async (kind) => {
      mockServer.use(
        http.get(`/api/v1/admin/audit/events/${id}`, () =>
          HttpResponse.json({
            id,
            actor: { id: "actor_1", kind, label: "Actor" },
            actorType: kind,
            action: "privacy.requested",
            resourceType: "privacy_export",
            resourceId: id,
            requestId: null,
            occurredAt: date,
            result: "success",
            safeMetadata: [],
          }),
        ),
      );
      await expect(securityRepository.getAuditEvent(id)).resolves.toMatchObject(
        { actor: { kind }, correlationId: null },
      );
    },
  );
});
