import { describe, expect, test } from "vitest";
import { ApiError } from "@/core/api/errors";
import { setSimulatedRole } from "@/core/auth/use-simulated-role";
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
