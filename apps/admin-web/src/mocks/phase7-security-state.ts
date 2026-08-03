import { ApiError, safeApiMessage } from "@/core/api/errors";
import type {
  ActionResult,
  DeletionRequestDetail,
  ExportRequestDetail,
  IncidentDetail,
  RetentionPolicyDetail,
  SupportAccessGrant,
  SuspiciousActivity,
} from "@/features/security/contracts";
import type {
  deletionActionSchema,
  exportActionSchema,
  exportDownloadRequestSchema,
  incidentActionSchema,
  retentionUpdateSchema,
  supportAccessRevokeSchema,
  suspiciousActionSchema,
} from "@/features/security/contracts";
import {
  PHASE7_NOW,
  deletionRequestFixture,
  exportRequestFixture,
  incidentFixture,
  retentionPolicyFixture,
  supportAccessFixture,
  suspiciousActivityFixture,
} from "@/mocks/fixtures/security";
import type { z } from "zod";

let auditCounter = 0;
let suspiciousActivities: SuspiciousActivity[] = [];
let incidents: IncidentDetail[] = [];
let supportAccess: SupportAccessGrant[] = [];
let exportRequests: ExportRequestDetail[] = [];
let deletionRequests: DeletionRequestDetail[] = [];
let retentionPolicies: RetentionPolicyDetail[] = [];

function copy<T>(value: T): T {
  return structuredClone(value);
}

export function resetPhase7SecurityState(): void {
  auditCounter = 0;
  suspiciousActivities = copy(suspiciousActivityFixture);
  incidents = copy(incidentFixture);
  supportAccess = copy(supportAccessFixture);
  exportRequests = copy(exportRequestFixture);
  deletionRequests = copy(deletionRequestFixture);
  retentionPolicies = copy(retentionPolicyFixture);
}

resetPhase7SecurityState();

function fail(code: "validation_error" | "conflict" | "not_found" | "gone"): never {
  throw new ApiError(code, safeApiMessage(code), code === "not_found" ? 404 : code === "gone" ? 410 : code === "conflict" ? 409 : 400);
}

function audit(eventName: string) {
  auditCounter += 1;
  return {
    eventId: `AUD-P7-${String(auditCounter).padStart(4, "0")}`,
    eventName,
    timestamp: PHASE7_NOW,
  };
}

function result(id: string, previousState: string, currentState: string, revision: number, eventName: string): ActionResult {
  return {
    affectedId: id,
    previousState,
    currentState,
    outcome: "success",
    timestamp: PHASE7_NOW,
    message: "Mock state updated. Future backend authorization remains required.",
    currentRevision: revision,
    auditReference: audit(eventName),
  };
}

function assertRevision(current: { revision: number }, expectedState: string, actualState: string, expectedRevision: number) {
  if (expectedState !== actualState || current.revision !== expectedRevision) fail("conflict");
}

function appendTimeline<T extends { timeline: { at: string; label: string }[] }>(record: T, label: string): T {
  record.timeline = [...record.timeline, { at: PHASE7_NOW, label }];
  return record;
}

export const phase7State = {
  suspiciousActivities: () => copy(suspiciousActivities),
  incidents: () => copy(incidents),
  supportAccess: () => copy(supportAccess),
  exportRequests: () => copy(exportRequests),
  deletionRequests: () => copy(deletionRequests),
  retentionPolicies: () => copy(retentionPolicies),
  suspiciousActivity: (id: string) => copy(suspiciousActivities.find((item) => item.id === id)),
  incident: (id: string) => copy(incidents.find((item) => item.id === id)),
  exportRequest: (id: string) => copy(exportRequests.find((item) => item.id === id)),
  deletionRequest: (id: string) => copy(deletionRequests.find((item) => item.id === id)),
  retentionPolicy: (id: string) => copy(retentionPolicies.find((item) => item.id === id)),
};

export function actOnSuspiciousActivity(id: string, input: z.infer<typeof suspiciousActionSchema>): ActionResult {
  const record = suspiciousActivities.find((item) => item.id === id);
  if (!record) fail("not_found");
  assertRevision(record, input.context.expectedState, record.state, input.context.expectedRevision);
  const previous = record.state;
  if (record.state === "Resolved" || record.state === "Dismissed") fail("gone");
  if (input.action === "assign_reviewer" && record.state === "New") {
    record.state = "Investigating";
    record.reviewer = { id: "ADM-1001", kind: "admin", label: "Security Administrator" };
    record.allowedActions = ["escalate", "resolve", "dismiss"];
  } else if (input.action === "escalate" && record.state === "Investigating") {
    if (!input.incidentId || !incidents.some((incident) => incident.id === input.incidentId)) fail("validation_error");
    record.state = "Escalated";
    record.incident = { id: input.incidentId, kind: "incident", label: `Incident ${input.incidentId}` };
    record.allowedActions = ["resolve", "dismiss"];
  } else if (input.action === "resolve" && ["Investigating", "Escalated"].includes(record.state)) {
    record.state = "Resolved";
    record.allowedActions = [];
  } else if (input.action === "dismiss" && ["Investigating", "Escalated"].includes(record.state)) {
    record.state = "Dismissed";
    record.allowedActions = [];
  } else {
    fail("validation_error");
  }
  record.revision += 1;
  appendTimeline(record, `${input.action} confirmed`);
  return result(record.id, previous, record.state, record.revision, `security.suspicious_activity.${input.action}`);
}

export function actOnIncident(id: string, input: z.infer<typeof incidentActionSchema>): ActionResult {
  const record = incidents.find((item) => item.id === id);
  if (!record) fail("not_found");
  assertRevision(record, input.context.expectedState, record.state, input.context.expectedRevision);
  const previous = record.state;
  const nextByAction = {
    contain: "Contained",
    monitor: "Monitoring",
    resolve: "Resolved",
    close: "Closed",
    reopen_monitoring: "Monitoring",
    note: record.state,
  } as const;
  const next = nextByAction[input.action];
  const allowed = (record.state === "Open" && next === "Contained")
    || (record.state === "Contained" && next === "Monitoring")
    || (record.state === "Monitoring" && next === "Resolved")
    || (record.state === "Resolved" && (next === "Monitoring" || next === "Closed"))
    || (input.action === "note" && record.state !== "Closed");
  if (!allowed) fail(record.state === "Closed" ? "gone" : "validation_error");
  record.state = next;
  record.revision += 1;
  record.allowedActions = next === "Contained" ? ["monitor", "note"] : next === "Monitoring" ? ["resolve", "note"] : next === "Resolved" ? ["reopen_monitoring", "close"] : [];
  appendTimeline(record, `${input.action} confirmed`);
  return result(record.id, previous, record.state, record.revision, "security.incident.updated");
}

export function revokeSupportAccess(id: string, input: z.infer<typeof supportAccessRevokeSchema>): ActionResult {
  const record = supportAccess.find((item) => item.id === id);
  if (!record) fail("not_found");
  assertRevision(record, input.context.expectedState, record.state, input.context.expectedRevision);
  if (record.state !== "active") fail("gone");
  const previous = record.state;
  record.state = "revoked";
  record.revision += 1;
  appendTimeline(record, "Support access revoked");
  return result(record.id, previous, record.state, record.revision, "security.support_access.revoked");
}

export function actOnExportRequest(id: string, input: z.infer<typeof exportActionSchema>): ActionResult {
  const record = exportRequests.find((item) => item.id === id);
  if (!record) fail("not_found");
  assertRevision(record, input.context.expectedState, record.state, input.context.expectedRevision);
  const previous = record.state;
  const next: Record<typeof input.action, ExportRequestDetail["state"]> = {
    validate: "Validating",
    process: "Processing",
    mark_ready: "Ready",
    fail: "Failed",
    cancel: "Cancelled",
    retry: "Processing",
    expire: "Expired",
  };
  const allowed = (record.state === "Requested" && ["validate", "fail", "cancel"].includes(input.action))
    || (record.state === "Validating" && ["process", "fail", "cancel"].includes(input.action))
    || (record.state === "Processing" && ["mark_ready", "fail"].includes(input.action))
    || (record.state === "Ready" && input.action === "expire")
    || (record.state === "Failed" && input.action === "retry");
  if (!allowed) fail(["Expired", "Cancelled"].includes(record.state) ? "gone" : "validation_error");
  record.state = next[input.action];
  record.revision += 1;
  record.allowedActions = record.state === "Ready" ? ["simulate_download", "expire"] : record.state === "Failed" ? ["retry"] : [];
  if (record.state === "Ready") {
    record.expiresAt = "2026-07-30T15:00:00+03:00";
    record.file = { basename: `masarifi-export-${record.id}.zip`, mediaType: "application/zip", sizeBytes: 2048, checksumLabel: "mock-checksum", state: "ready" };
  }
  appendTimeline(record, `${input.action} confirmed`);
  return result(record.id, previous, record.state, record.revision, `data_export.${input.action}`);
}

export function simulateExportDownload(id: string, input: z.infer<typeof exportDownloadRequestSchema>) {
  const record = exportRequests.find((item) => item.id === id);
  if (!record) fail("not_found");
  if (record.revision !== input.expectedRevision) fail("conflict");
  if (record.state !== "Ready" || !record.expiresAt || record.expiresAt <= PHASE7_NOW) fail("gone");
  return {
    requestId: record.id,
    allowed: true,
    expiresAt: record.expiresAt,
    message: "Mock-only simulation. No customer archive, URL, token, Blob, or file was generated.",
  };
}

export function actOnDeletionRequest(id: string, input: z.infer<typeof deletionActionSchema>): ActionResult {
  const record = deletionRequests.find((item) => item.id === id);
  if (!record) fail("not_found");
  assertRevision(record, input.context.expectedState, record.state, input.context.expectedRevision);
  const previous = record.state;
  const next: Record<typeof input.action, DeletionRequestDetail["state"]> = {
    review: "Review Required",
    schedule: "Scheduled",
    start: "In Progress",
    complete: "Completed",
    block: "Blocked",
    retry: "In Progress",
    cancel: "Cancelled",
  };
  const allResolved = record.checklist.every((item) => item.state === "completed" || item.state === "preserved");
  if ((input.action === "schedule" || input.action === "complete") && record.legalHold) fail("conflict");
  if (input.action === "complete" && !allResolved) fail("conflict");
  const allowed = (record.state === "Requested" && ["review", "cancel"].includes(input.action))
    || (record.state === "Review Required" && ["schedule", "cancel"].includes(input.action))
    || (record.state === "Scheduled" && ["start", "cancel"].includes(input.action))
    || (record.state === "In Progress" && ["complete", "block"].includes(input.action))
    || (record.state === "Blocked" && input.action === "retry");
  if (!allowed) fail(["Completed", "Cancelled"].includes(record.state) ? "gone" : "validation_error");
  record.state = next[input.action];
  if (record.state === "Completed") record.completedAt = PHASE7_NOW;
  record.revision += 1;
  return result(record.id, previous, record.state, record.revision, `account_deletion.${input.action}`);
}

export function updateRetentionPolicy(id: string, input: z.infer<typeof retentionUpdateSchema>): ActionResult {
  const record = retentionPolicies.find((item) => item.id === id);
  if (!record) fail("not_found");
  if (record.revision !== input.expectedRevision) fail("conflict");
  if (input.retentionDays < record.minimumDays || input.retentionDays > record.maximumDays) fail("validation_error");
  const previous = record.state;
  record.retentionDays = input.retentionDays;
  record.effectiveCleanupState = record.legalHold ? "suspended" : "active";
  record.state = record.legalHold ? "suspended" : "active";
  record.revision += 1;
  record.changeHistory = [...record.changeHistory, { at: PHASE7_NOW, label: "Retention policy mock update confirmed" }];
  return result(record.id, previous, record.state, record.revision, "retention_policy.updated");
}
