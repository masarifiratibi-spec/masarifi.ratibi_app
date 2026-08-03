import type { OperationalRecord, Phase4ActionRequest } from "@/features/imports/contracts";

export type ImportState = "received" | "processing" | "succeeded" | "partial" | "pending_review" | "failed" | "unsupported";

interface ImportSessionState {
  state: ImportState;
  revision: number;
  pendingLocks: Set<string>;
  lastModified: string;
}

interface FailedImportState {
  state: ImportState;
  revision: number;
  resolution: string | null;
  pendingLocks: Set<string>;
}

interface LowConfidenceItemState {
  state: "pending" | "accepted" | "corrected" | "deferred" | "unsupported";
  revision: number;
  pendingLocks: Set<string>;
}

interface DuplicateCandidateState {
  state: "pending" | "confirmed_duplicate" | "rejected_match" | "deferred";
  revision: number;
  pendingLocks: Set<string>;
}

interface UnsupportedFormatState {
  state: "detected" | "assigned" | "unsupported" | "rule_draft_handoff" | "deferred";
  revision: number;
  pendingLocks: Set<string>;
}

interface AuditEvent {
  eventId: string;
  eventName: string;
  timestamp: string;
  actor: string;
  scope: string;
}

interface Phase4Snapshot {
  importSessions: Map<string, ImportSessionState>;
  failedImports: Map<string, FailedImportState>;
  lowConfidenceItems: Map<string, LowConfidenceItemState>;
  duplicateCandidates: Map<string, DuplicateCandidateState>;
  unsupportedFormats: Map<string, UnsupportedFormatState>;
  auditEvents: AuditEvent[];
  operationalRecords: Map<string, { status: string; revision: number; requiredTestsPassed?: boolean }>;
}

let auditEventCounter = 0;
let draftCounter = 0;
const fixedTimestamp = "2026-07-29T10:00:00.000Z";

class Phase4ImportState {
  private snapshot: Phase4Snapshot;
  private scenario: string = "default";

  constructor() {
    this.snapshot = {
      importSessions: new Map(),
      failedImports: new Map(),
      lowConfidenceItems: new Map(),
      duplicateCandidates: new Map(),
      unsupportedFormats: new Map(),
      auditEvents: [],
      operationalRecords: new Map(),
    };
  }

  getSnapshot(): Readonly<Phase4Snapshot> {
    return structuredClone(this.snapshot);
  }

  setScenario(scenario: string): void {
    this.scenario = scenario;
  }

  getScenario(): string {
    return this.scenario;
  }

  reset(): void {
    this.snapshot = {
      importSessions: new Map(),
      failedImports: new Map(),
      lowConfidenceItems: new Map(),
      duplicateCandidates: new Map(),
      unsupportedFormats: new Map(),
      auditEvents: [],
      operationalRecords: new Map(),
    };
    auditEventCounter = 0;
    draftCounter = 0;
    this.scenario = "default";
  }

  getImportSession(id: string): ImportSessionState | undefined {
    const session = this.snapshot.importSessions.get(id);
    return session ? structuredClone(session) : undefined;
  }

  setImportSession(id: string, data: ImportSessionState): void {
    this.snapshot.importSessions.set(id, structuredClone(data));
  }

  hasImportSessionPendingLock(id: string, lockKey: string): boolean {
    return this.snapshot.importSessions.get(id)?.pendingLocks.has(lockKey) ?? false;
  }

  acquireImportSessionLock(id: string, lockKey: string): boolean {
    const session = this.snapshot.importSessions.get(id);
    if (!session || session.pendingLocks.has(lockKey)) return false;
    session.pendingLocks.add(lockKey);
    return true;
  }

  releaseImportSessionLock(id: string, lockKey: string): void {
    this.snapshot.importSessions.get(id)?.pendingLocks.delete(lockKey);
  }

  getFailedImport(id: string): FailedImportState | undefined {
    const item = this.snapshot.failedImports.get(id);
    return item ? structuredClone(item) : undefined;
  }

  setFailedImport(id: string, data: FailedImportState): void {
    this.snapshot.failedImports.set(id, structuredClone(data));
  }

  getLowConfidenceItem(id: string): LowConfidenceItemState | undefined {
    const item = this.snapshot.lowConfidenceItems.get(id);
    return item ? structuredClone(item) : undefined;
  }

  setLowConfidenceItem(id: string, data: LowConfidenceItemState): void {
    this.snapshot.lowConfidenceItems.set(id, structuredClone(data));
  }

  getDuplicateCandidate(id: string): DuplicateCandidateState | undefined {
    const item = this.snapshot.duplicateCandidates.get(id);
    return item ? structuredClone(item) : undefined;
  }

  setDuplicateCandidate(id: string, data: DuplicateCandidateState): void {
    this.snapshot.duplicateCandidates.set(id, structuredClone(data));
  }

  getUnsupportedFormat(id: string): UnsupportedFormatState | undefined {
    const item = this.snapshot.unsupportedFormats.get(id);
    return item ? structuredClone(item) : undefined;
  }

  setUnsupportedFormat(id: string, data: UnsupportedFormatState): void {
    this.snapshot.unsupportedFormats.set(id, structuredClone(data));
  }

  applyRuntimeState(record: OperationalRecord): OperationalRecord {
    const runtime = this.snapshot.operationalRecords.get(record.id);
    return runtime ? { ...record, ...runtime } : record;
  }

  acquireRecordLock(id: string, action: string): boolean {
    const lockId = `${id}:${action}`;
    const session = this.snapshot.importSessions.get(id);
    if (!session) {
      this.snapshot.importSessions.set(id, {
        state: "received",
        revision: 1,
        pendingLocks: new Set(),
        lastModified: fixedTimestamp,
      });
    }
    return this.acquireImportSessionLock(id, lockId);
  }

  releaseRecordLock(id: string, action: string): void {
    this.releaseImportSessionLock(id, `${id}:${action}`);
  }

  transitionRecord(
    record: OperationalRecord,
    request: Phase4ActionRequest,
  ): { previousState: string; currentState: string; createdDraftId?: string } {
    const current = this.applyRuntimeState(record);
    if (current.status !== request.expectedState || current.revision !== request.expectedRevision) {
      throw new Error("conflict");
    }

    if (record.kind === "versions" && request.action === "release" && !current.requiredTestsPassed) {
      throw new Error("required_tests_failed");
    }

    const nextStatus: Partial<Record<Phase4ActionRequest["action"], string>> = {
      retry_handoff: "processing",
      assign_parser_issue: "assigned",
      mark_unsupported: "unsupported",
      create_rule_draft_handoff: "rule_draft_handoff",
      accept_suggestion: "accepted",
      correct_merchant: "corrected",
      correct_category: "corrected",
      defer: "deferred",
      confirm_duplicate: "confirmed_duplicate",
      reject_match: "rejected_match",
      activate: "active",
      deactivate: "inactive",
      test: "testing",
      release: "active",
      retire: "retired",
      save: current.status,
    };

    let createdDraftId: string | undefined;
    if (request.action === "rollback") {
      draftCounter += 1;
      createdDraftId = `PV-RB-${draftCounter.toString().padStart(3, "0")}`;
      this.snapshot.operationalRecords.set(createdDraftId, {
        status: "draft",
        revision: 1,
        requiredTestsPassed: false,
      });
    } else {
      this.snapshot.operationalRecords.set(record.id, {
        status: nextStatus[request.action] ?? current.status,
        revision: current.revision + 1,
        requiredTestsPassed: request.action === "test" ? true : current.requiredTestsPassed,
      });
    }

    return {
      previousState: current.status,
      currentState: request.action === "rollback" ? current.status : nextStatus[request.action] ?? current.status,
      ...(createdDraftId ? { createdDraftId } : {}),
    };
  }

  recordAuditEvent(event: {
    eventName: string;
    actor: string;
    scope: string;
  }): string {
    auditEventCounter += 1;
    const eventId = `AUD-FIXED-${auditEventCounter.toString().padStart(6, "0")}`;
    const timestamp = fixedTimestamp;
    const auditEvent: AuditEvent = {
      eventId,
      eventName: event.eventName,
      timestamp,
      actor: event.actor,
      scope: event.scope,
    };
    this.snapshot.auditEvents.push(auditEvent);
    return eventId;
  }

  getAuditEvents(): ReadonlyArray<AuditEvent> {
    return [...this.snapshot.auditEvents];
  }
}

export const phase4ImportState = new Phase4ImportState();

export function resetPhase4State(): void {
  phase4ImportState.reset();
}

export function checkStateConflict(
  currentState: string,
  expectedState: string,
  currentRevision: number,
  expectedRevision: number
): { conflict: boolean; reason?: string } {
  if (currentState !== expectedState) {
    return { conflict: true, reason: `state_mismatch: expected ${expectedState}, got ${currentState}` };
  }
  if (currentRevision !== expectedRevision) {
    return { conflict: true, reason: `revision_mismatch: expected ${expectedRevision}, got ${currentRevision}` };
  }
  return { conflict: false };
}

export function incrementRevision(currentRevision: number): number {
  return currentRevision + 1;
}
