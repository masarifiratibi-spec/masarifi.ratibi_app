import { describe, expect, test } from "vitest";
import {
  actOnDeletionRequest,
  actOnExportRequest,
  actOnIncident,
  actOnSuspiciousActivity,
  resetPhase7SecurityState,
  revokeSupportAccess,
  simulateExportDownload,
  updateRetentionPolicy,
} from "./phase7-security-state";

const context = {
  expectedState: "New",
  expectedRevision: 1,
  reason: "Review required",
  confirmationToken: "CONFIRM-SPEC-008" as const,
};

describe("Phase 7 deterministic mock state", () => {
  test("moves suspicious activity through the clarified lifecycle", () => {
    resetPhase7SecurityState();
    const assigned = actOnSuspiciousActivity("SUS-1001", { action: "assign_reviewer", context });
    expect(assigned.currentState).toBe("Investigating");
    expect(assigned.auditReference.eventId).toBe("AUD-P7-0001");
    expect(actOnSuspiciousActivity("SUS-1001", {
      action: "escalate",
      incidentId: "INC-1001",
      context: { ...context, expectedState: "Investigating", expectedRevision: 2 },
    }).currentState).toBe("Escalated");
    expect(() => actOnSuspiciousActivity("SUS-1001", {
      action: "escalate",
      incidentId: "INC-404",
      context: { ...context, expectedState: "Investigating", expectedRevision: 3 },
    })).toThrow();
  });

  test("incident closed state is terminal", () => {
    resetPhase7SecurityState();
    actOnIncident("INC-1002", { action: "close", context: { ...context, expectedState: "Resolved" } });
    expect(() => actOnIncident("INC-1002", { action: "reopen_monitoring", context: { ...context, expectedState: "Closed", expectedRevision: 2 } })).toThrow();
  });

  test("support access revokes active grants once", () => {
    resetPhase7SecurityState();
    expect(revokeSupportAccess("SAC-1001", { context: { ...context, expectedState: "active" } }).currentState).toBe("revoked");
    expect(() => revokeSupportAccess("SAC-1001", { context: { ...context, expectedState: "active", expectedRevision: 2 } })).toThrow();
  });

  test("export ready request simulates only an allowed result", () => {
    resetPhase7SecurityState();
    expect(simulateExportDownload("EXP-1001", { expectedRevision: 1 }).allowed).toBe(true);
    expect(actOnExportRequest("EXP-1001", { action: "expire", context: { ...context, expectedState: "Ready" } }).currentState).toBe("Expired");
    expect(() => simulateExportDownload("EXP-1001", { expectedRevision: 2 })).toThrow();
  });

  test("deletion completion requires checklist resolution and legal-hold clearance", () => {
    resetPhase7SecurityState();
    expect(() => actOnDeletionRequest("DEL-1002", { action: "complete", context: { ...context, expectedState: "In Progress" } })).toThrow();
    expect(actOnDeletionRequest("DEL-1001", { action: "start", context: { ...context, expectedState: "Scheduled" } }).currentState).toBe("In Progress");
    expect(actOnDeletionRequest("DEL-1001", {
      action: "complete",
      context: { ...context, expectedState: "In Progress", expectedRevision: 2 },
    }).currentState).toBe("Completed");
  });

  test("retention update enforces integer bounds and legal-hold suspension", () => {
    resetPhase7SecurityState();
    expect(updateRetentionPolicy("RET-1001", {
      retentionDays: 400,
      reason: "Regulatory evidence period",
      impactAcknowledged: true,
      expectedRevision: 1,
      confirmationToken: "CONFIRM-SPEC-008",
    }).currentState).toBe("active");
    expect(() => updateRetentionPolicy("RET-1001", {
      retentionDays: 0,
      reason: "Invalid",
      impactAcknowledged: true,
      expectedRevision: 2,
      confirmationToken: "CONFIRM-SPEC-008",
    })).toThrow();
  });
});
