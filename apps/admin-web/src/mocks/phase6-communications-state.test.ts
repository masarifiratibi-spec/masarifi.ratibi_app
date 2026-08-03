import { beforeEach, describe, expect, test } from "vitest";
import {
  applyStateTransition,
  checkVersionConflict,
  cloneState,
  createActionResult,
  createInitialState,
  generateAuditReference,
  getCurrentTime,
  pendingActionLock,
  phase6StateManager,
  resetState,
  type VersionedState,
} from "./phase6-communications-state";

describe("Phase 6 communications state management", () => {
  beforeEach(() => {
    phase6StateManager.reset();
    pendingActionLock.clearAll();
  });

  test("uses the fixed injected Phase 6 clock", () => {
    expect(getCurrentTime()).toBe("2026-07-29T12:00:00+03:00");
  });

  test("creates immutable snapshots without shared nested references", () => {
    const originalState = { revision: 0, tickets: [{ id: "TKT-1001-A", notes: ["first"] }] };
    const clonedState = cloneState(originalState);

    clonedState.tickets[0].notes[0] = "changed";

    expect(originalState.tickets[0].notes[0]).toBe("first");
    expect(clonedState).not.toBe(originalState);
  });

  test("increments the root revision exactly once per transition", () => {
    const nextState = applyStateTransition({ revision: 4, label: "before" }, () => ({ label: "after" }));

    expect(nextState).toEqual({ revision: 5, label: "after" });
  });

  test("generates deterministic safe audit references", () => {
    expect(generateAuditReference("assign")).toBe("AUDIT-1722260400000-ASS");
    expect(createActionResult({ revision: 1 }, "TKT-1001-A", "resolve", "success", "Updated").auditReference).toBe(
      "AUDIT-1722260400000-RES",
    );
  });

  test("uses resource and action pending keys", () => {
    expect(pendingActionLock.acquireLock("TKT-1001-A", "assign")).toBe(true);
    expect(pendingActionLock.acquireLock("TKT-1001-A", "assign")).toBe(false);
    expect(pendingActionLock.acquireLock("TKT-1001-A", "reply")).toBe(true);
    expect(pendingActionLock.getPendingCount()).toBe(2);
  });

  test("clears pending locks and restores a fresh initial snapshot on reset", () => {
    pendingActionLock.acquireLock("TKT-1001-A", "assign");

    expect(resetState()).toEqual(createInitialState());
    expect(pendingActionLock.getPendingCount()).toBe(0);
  });

  test("detects stale expected revisions", () => {
    expect(checkVersionConflict(3, 3)).toBe(false);
    expect(checkVersionConflict(3, 2)).toBe(true);
  });

  test("state manager returns cloned state and tracks transitions", () => {
    const transition = phase6StateManager.tryApplyTransition(
      "missing",
      "touch",
      0,
      (currentState) => ({ revision: currentState.revision } satisfies Partial<VersionedState>),
    );

    expect(transition.success).toBe(true);
    expect(phase6StateManager.getRevision()).toBe(1);
    expect(phase6StateManager.getState()).toEqual(transition.state);
    expect(phase6StateManager.getState()).not.toBe(transition.state);
  });
});
