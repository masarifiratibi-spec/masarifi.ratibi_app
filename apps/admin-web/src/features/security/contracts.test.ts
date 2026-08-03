import { describe, expect, test } from "vitest";
import {
  actionContextSchema,
  adminSecurityPageSchema,
  auditEventDetailSchema,
  authenticationEventsPageSchema,
  deletionRequestDetailSchema,
  exportScopeSchema,
  exportDownloadResultSchema,
  exportRequestDetailSchema,
  listQuerySchema,
  retentionPolicyDetailSchema,
  safeMetadataEntrySchema,
  securityIdSchema,
  securityOverviewSchema,
  supportAccessPageSchema,
} from "./contracts";
import {
  adminSecurityFixture,
  authenticationEventsFixture,
  deletionRequestFixture,
  retentionPolicyFixture,
  securityOverviewFixture,
  supportAccessFixture,
} from "@/mocks/fixtures/security";

describe("Phase 7 contracts", () => {
  test("accepts only approved prefixed identifiers", () => {
    expect(securityIdSchema.parse("INC-1001")).toBe("INC-1001");
    expect(() => securityIdSchema.parse("USR-1001")).toThrow();
  });

  test("rejects unknown fields and unsafe metadata values", () => {
    expect(() => safeMetadataEntrySchema.parse({ key: "token", label: "Token", value: "secret" })).toThrow();
    expect(() => auditEventDetailSchema.parse({
      id: "AUD-1001",
      occurredAt: "2026-07-30T12:00:00+03:00",
      actor: { id: "ADM-1001", kind: "admin", label: "Security Admin" },
      action: "security.incident.updated",
      resource: "incident",
      target: { id: "INC-1001", kind: "incident", label: "Incident INC-1001" },
      result: "success",
      severity: "high",
      region: "GCC",
      correlationId: "COR-1001",
      metadata: [],
      before: [],
      after: [],
      unexpected: true,
    })).toThrow();
  });

  test("normalizes safe text and rejects bidi controls, URLs, and invalid paging", () => {
    expect(listQuerySchema.parse({ search: "Cafe\u0301", page: "2", pageSize: "50" }).search).toBe("Café");
    expect(() => listQuerySchema.parse({ search: "safe\u202Eunsafe", page: 1, pageSize: 25 })).toThrow();
    expect(() => listQuerySchema.parse({ search: "https://example.test", page: 1, pageSize: 25 })).toThrow();
    expect(() => listQuerySchema.parse({ page: 0, pageSize: 25 })).toThrow();
    expect(() => listQuerySchema.parse({ page: 1, pageSize: 10 })).toThrow();
  });

  test("parses the consolidated US1 and US2 pages without raw credential fields", () => {
    expect(securityOverviewSchema.parse(securityOverviewFixture).metrics[0].entitySemantic).toBe("events");
    expect(authenticationEventsPageSchema.parse({
      items: authenticationEventsFixture,
      pagination: { page: 1, pageSize: 25, totalItems: authenticationEventsFixture.length, totalPages: 1 },
      region: { availability: "available" },
    }).items[0].platform).toBe("ios");
    expect(adminSecurityPageSchema.parse({
      items: adminSecurityFixture,
      pagination: { page: 1, pageSize: 25, totalItems: adminSecurityFixture.length, totalPages: 1 },
      region: { availability: "available" },
    }).items[0]).not.toHaveProperty("credential");
    expect(supportAccessPageSchema.parse({
      items: supportAccessFixture,
      pagination: { page: 1, pageSize: 25, totalItems: supportAccessFixture.length, totalPages: 1 },
      region: { availability: "available" },
    }).items[0].customer.label).toContain("***");
  });

  test("export download simulation cannot carry URLs, tokens, or content", () => {
    expect(exportDownloadResultSchema.parse({
      requestId: "EXP-1001",
      allowed: true,
      expiresAt: "2026-07-30T15:00:00+03:00",
      message: "Mock-only simulation. No archive was generated.",
    }).allowed).toBe(true);
    expect(() => exportDownloadResultSchema.parse({
      requestId: "EXP-1001",
      allowed: true,
      expiresAt: "2026-07-30T15:00:00+03:00",
      message: "Mock-only",
      url: "https://example.test/archive.zip",
    })).toThrow();
  });

  test("action context requires expected state, revision, reason, and confirmation", () => {
    expect(actionContextSchema.parse({
      expectedState: "New",
      expectedRevision: 1,
      reason: "Investigating suspicious activity",
      confirmationToken: "CONFIRM-SPEC-008",
    }).expectedRevision).toBe(1);
  });

  test("export detail contains scope labels only", () => {
    const detail = exportRequestDetailSchema.parse({
      id: "EXP-1001",
      customer: { id: "CUS-1001", kind: "customer", label: "n***@example.test" },
      scopes: ["profile", "files"],
      state: "Ready",
      requestedAt: "2026-07-30T09:00:00+03:00",
      expiresAt: "2026-07-30T15:00:00+03:00",
      file: { basename: "masarifi-export-EXP-1001.zip", mediaType: "application/zip", sizeBytes: 2048, checksumLabel: "mock-checksum", state: "ready" },
      timeline: [],
      revision: 2,
      allowedActions: ["simulate_download", "expire"],
      auditReferences: [],
    });
    expect(detail.scopes).toEqual(["profile", "files"]);
  });

  test("covers all export scope labels, nine deletion checklist entries, and bounded retention policies", () => {
    expect(exportScopeSchema.options).toEqual([
      "profile",
      "devices_sessions",
      "financial_records",
      "imports",
      "ai_data",
      "support_feedback",
      "notifications",
      "files",
    ]);
    expect(deletionRequestDetailSchema.parse(deletionRequestFixture[0]).checklist).toHaveLength(9);
    expect(retentionPolicyDetailSchema.parse(retentionPolicyFixture[0])).toMatchObject({
      id: "RET-1001",
      effectiveCleanupState: "active",
    });
    expect(() => retentionPolicyDetailSchema.parse({
      ...retentionPolicyFixture[0],
      retentionDays: retentionPolicyFixture[0].maximumDays + 1,
    })).toThrow();
  });
});
