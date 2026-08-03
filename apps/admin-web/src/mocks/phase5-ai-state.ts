import { ApiError, safeApiMessage } from "@/core/api/errors";
import type { z } from "zod";
import {
  aiActionResultSchema,
  auditReferenceSchema,
  fallbackRoutesSchema,
  providerActionRequestSchema,
  aiOperationalActionRequestSchema,
  type AiOperationalActionRequest,
  type FallbackRoute,
  type ProviderActionRequest,
} from "@/features/ai/contracts";

interface Phase5State {
  auditSequence: number;
  rollbackSequence: number;
  rollbackDraftIds: string[];
  providerFallbackRoutes: FallbackRoute[];
  records: Record<string, { status: string; revision: number }>;
}

const initialState: Phase5State = {
  auditSequence: 1,
  rollbackSequence: 1,
  rollbackDraftIds: [],
  providerFallbackRoutes: [
    {
      feature: "receipt_analysis", locale: "ar", priority: 1,
      providerId: "AIP-OPENAI", modelId: "AIM-GPT-4O",
      compatible: true, terminalEligible: true, enabled: true,
    },
    {
      feature: "receipt_analysis", locale: "ar", priority: 2,
      providerId: "AIP-OPENAI", modelId: "AIM-GPT-4O-MINI",
      compatible: true, terminalEligible: true, enabled: true,
    },
  ],
  records: {
    "AIP-OPENAI": { status: "healthy", revision: 1 },
    "AIM-GPT-4O": { status: "active", revision: 1 },
    "AIPR-RECEIPT-AR-V3": { status: "active", revision: 3 },
    "AIPR-CAT-EN-V2": { status: "testing", revision: 2 },
    "AIPR-VOICE-AR-V4": { status: "testing", revision: 4 },
    "AIF-0001": { status: "open", revision: 1 },
    "AIR-0001": { status: "pending_review", revision: 1 },
    "AIS-0001": { status: "active", revision: 5 },
    "AIS-0002": { status: "draft", revision: 1 },
  },
};

function initialSnapshot(): Phase5State {
  return {
    auditSequence: initialState.auditSequence,
    rollbackSequence: initialState.rollbackSequence,
    rollbackDraftIds: [],
    providerFallbackRoutes: structuredClone(initialState.providerFallbackRoutes),
    records: structuredClone(initialState.records),
  };
}

let phase5State: Phase5State = initialSnapshot();

export function resetPhase5AiState(): void {
  phase5State = initialSnapshot();
}

export function phase5Snapshot(): Phase5State {
  return structuredClone(phase5State);
}

export function phase5Record(id: string): { status: string; revision: number } | null {
  return phase5State.records[id] ? { ...phase5State.records[id] } : null;
}

export function phase5RollbackDraftIds(): string[] {
  return [...phase5State.rollbackDraftIds];
}

export function phase5ProviderFallbackRoutes(): FallbackRoute[] {
  return structuredClone(phase5State.providerFallbackRoutes);
}

export function safeAuditReference(eventName: string): z.infer<typeof auditReferenceSchema> {
  const eventId = `AIA-${String(phase5State.auditSequence).padStart(4, "0")}`;
  phase5State.auditSequence += 1;
  return auditReferenceSchema.parse({
    eventId,
    eventName,
    timestamp: "2026-07-29T10:00:00.000Z",
  });
}

export function phase5Conflict(
  currentState: string,
  currentRevision: number,
  expectedState: string,
  expectedRevision: number,
): ApiError | null {
  if (currentState === expectedState && currentRevision === expectedRevision) return null;
  return new ApiError("conflict", safeApiMessage("conflict"), 409);
}

export function applyProviderAction(id: string, input: ProviderActionRequest): z.infer<typeof aiActionResultSchema> {
  const parsedRequest = providerActionRequestSchema.safeParse(input);
  if (!parsedRequest.success) {
    return aiActionResultSchema.parse({
      affectedId: id,
      previousState: "healthy",
      currentState: "healthy",
      outcome: "rejected",
      timestamp: "2026-07-29T10:00:00.000Z",
      message: "Invalid provider action request.",
      auditReference: safeAuditReference("admin.ai.provider.rejected"),
    });
  }
  const request = parsedRequest.data;
  const current = phase5Record(id) ?? { status: "healthy", revision: 1 };
  const conflict = phase5Conflict(current.status, current.revision, request.context.expectedState, request.context.expectedRevision);
  if (conflict) {
    return aiActionResultSchema.parse({
      affectedId: id,
      previousState: current.status,
      currentState: current.status,
      outcome: "conflict",
      timestamp: "2026-07-29T10:00:00.000Z",
      message: safeApiMessage("conflict"),
      auditReference: safeAuditReference("admin.ai.provider.conflict"),
    });
  }
  if (request.action === "update_fallback" && !fallbackRoutesSchema.safeParse(request.fallbackRoutes).success) {
    return aiActionResultSchema.parse({
      affectedId: id,
      previousState: current.status,
      currentState: current.status,
      outcome: "rejected",
      timestamp: "2026-07-29T10:00:00.000Z",
      message: "Invalid feature/locale fallback coverage.",
      auditReference: safeAuditReference("admin.ai.provider.rejected"),
    });
  }
  if (request.action === "update_fallback" && request.fallbackRoutes) {
    phase5State.providerFallbackRoutes = structuredClone(request.fallbackRoutes);
  }
  const nextState = request.action === "deactivate" ? "unavailable" : "healthy";
  phase5State.records[id] = { status: nextState, revision: current.revision + 1 };
  return aiActionResultSchema.parse({
    affectedId: id,
    previousState: current.status,
    currentState: nextState,
    outcome: "success",
    timestamp: "2026-07-29T10:00:00.000Z",
    message: "Mock provider action recorded.",
    auditReference: safeAuditReference("admin.ai.provider.action"),
  });
}

const nextStateByAction: Record<AiOperationalActionRequest["action"], string> = {
  activate: "active",
  deactivate: "inactive",
  assign: "active",
  unassign: "inactive",
  test: "testing",
  retire: "retired",
  rollback: "draft",
  acknowledge: "acknowledged",
  resolve: "resolved",
  reopen: "open",
  escalate: "escalated",
  confirmed_issue: "confirmed_issue",
  no_issue: "no_issue",
  duplicate: "duplicate",
};

export function applyAiRecordAction(
  id: string,
  input: AiOperationalActionRequest,
): z.infer<typeof aiActionResultSchema> {
  const request = aiOperationalActionRequestSchema.parse(input);
  const current = phase5Record(id);
  if (!current) throw new ApiError("not_found", safeApiMessage("not_found"), 404);
  const conflict = phase5Conflict(
    current.status,
    current.revision,
    request.context.expectedState,
    request.context.expectedRevision,
  );
  if (conflict) throw conflict;
  const nextState = id.startsWith("AIF-") && request.action === "assign"
    ? "assigned"
    : nextStateByAction[request.action];
  let affectedId = id;
  if (request.action === "rollback") {
    affectedId = `AIPR-ROLLBACK-${String(phase5State.rollbackSequence).padStart(4, "0")}`;
    phase5State.rollbackSequence += 1;
    phase5State.rollbackDraftIds.push(affectedId);
    phase5State.records[affectedId] = { status: "draft", revision: 1 };
  } else {
    phase5State.records[id] = { status: nextState, revision: current.revision + 1 };
  }
  return aiActionResultSchema.parse({
    affectedId,
    previousState: current.status,
    currentState: nextState,
    outcome: "success",
    timestamp: "2026-07-29T10:00:00.000Z",
    message: "Mock AI action recorded.",
    auditReference: safeAuditReference("admin.ai.record.action"),
  });
}
