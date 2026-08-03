/**
 * Phase 6 Communications Mock State Management
 * 
 * This module provides deterministic, versioned state management for
 * support tickets, feedback, content, and notification campaigns.
 * All operations use an injected fixed clock for predictable testing.
 */

// Fixed clock for deterministic testing (2026-07-29T12:00:00+03:00)
const FIXED_CLOCK_ISO = "2026-07-29T12:00:00+03:00";
const FIXED_CLOCK_MS = 1722260400000;

/**
 * Gets the current time from the fixed clock
 */
export function getCurrentTime(): string {
  return FIXED_CLOCK_ISO;
}

/**
 * Gets the current time in milliseconds from the fixed clock
 */
export function getCurrentTimeMs(): number {
  return FIXED_CLOCK_MS;
}

/**
 * Creates a deep clone of the given state
 */
export function cloneState<T>(state: T): T {
  return JSON.parse(JSON.stringify(state));
}

/**
 * Generates a unique audit reference
 */
export function generateAuditReference(actionType: string): string {
  const actionCode = actionType.toUpperCase().slice(0, 3);
  const timestamp = getCurrentTimeMs().toString();
  return `AUDIT-${timestamp}-${actionCode}`;
}

/**
 * Pending action lock manager
 */
class PendingActionLock {
  private pendingActions = new Set<string>();

  /**
   * Attempts to acquire a lock for the given resource and action
   * @returns true if lock was acquired, false if already pending
   */
  acquireLock(resourceId: string, action: string): boolean {
    const key = `${resourceId}:${action}`;
    if (this.pendingActions.has(key)) {
      return false;
    }
    this.pendingActions.add(key);
    return true;
  }

  /**
   * Releases a lock for the given resource and action
   */
  releaseLock(resourceId: string, action: string): void {
    const key = `${resourceId}:${action}`;
    this.pendingActions.delete(key);
  }

  /**
   * Checks if an action is pending for the given resource
   */
  isPending(resourceId: string, action: string): boolean {
    const key = `${resourceId}:${action}`;
    return this.pendingActions.has(key);
  }

  /**
   * Clears all pending locks
   */
  clearAll(): void {
    this.pendingActions.clear();
  }

  /**
   * Gets the count of pending actions
   */
  getPendingCount(): number {
    return this.pendingActions.size;
  }
}

// Singleton instance
export const pendingActionLock = new PendingActionLock();

/**
 * Base state interface with revision tracking
 */
export interface VersionedState {
  revision: number;
}

/**
 * Creates an action result with audit reference
 */
export function createActionResult<T extends VersionedState>(
  state: T,
  resourceId: string,
  actionType: string,
  outcome: "success" | "conflict" | "forbidden" | "not_found" | "validation_error",
  message: string,
  previousState?: string
): {
  resourceId: string;
  previousState?: string;
  currentState: string;
  outcome: typeof outcome;
  message: string;
  timestamp: string;
  auditReference: string;
} {
  return {
    resourceId,
    previousState,
    currentState: JSON.stringify(state),
    outcome,
    message,
    timestamp: getCurrentTime(),
    auditReference: generateAuditReference(actionType),
  };
}

/**
 * Checks if the expected version matches the current version
 */
export function checkVersionConflict(
  currentVersion: number,
  expectedVersion: number
): boolean {
  return currentVersion !== expectedVersion;
}

/**
 * Applies a state transition with version increment
 */
export function applyStateTransition<T extends VersionedState>(
  state: T,
  updater: (state: T) => Partial<T>
): T {
  const updates = updater(state);
  const newState = {
    ...state,
    ...updates,
    revision: state.revision + 1,
  };
  return newState;
}

/**
 * Initial state template for Phase 6 communications
 */
export const INITIAL_STATE_TEMPLATE = {
  revision: 0,
  // Support tickets
  tickets: [] as Array<{
    id: string;
    status: string;
    priority: string;
    version: number;
    createdAt: string;
    updatedAt: string;
  }>,
  // Feedback items
  feedback: [] as Array<{
    id: string;
    type: string;
    state: string;
    version: number;
    createdAt: string;
    updatedAt: string;
  }>,
  // Content items
  content: [] as Array<{
    id: string;
    collection: string;
    status: string;
    version: number;
    createdAt: string;
    updatedAt: string;
  }>,
  // Notification campaigns
  campaigns: [] as Array<{
    id: string;
    state: string;
    version: number;
    createdAt: string;
    updatedAt: string;
  }>,
} as const;

/**
 * Type for the full Phase 6 state
 */
export type Phase6CommunicationsState = typeof INITIAL_STATE_TEMPLATE;

/**
 * Creates a new initial state
 */
export function createInitialState(): Phase6CommunicationsState {
  return cloneState(INITIAL_STATE_TEMPLATE);
}

/**
 * Resets state to initial values and clears all pending actions
 */
export function resetState(): Phase6CommunicationsState {
  pendingActionLock.clearAll();
  return createInitialState();
}

/**
 * State manager for Phase 6 communications
 */
export class Phase6StateManager {
  private state: Phase6CommunicationsState;

  constructor() {
    this.state = createInitialState();
  }

  /**
   * Gets the current state (immutable)
   */
  getState(): Phase6CommunicationsState {
    return cloneState(this.state);
  }

  /**
   * Gets the current revision number
   */
  getRevision(): number {
    return this.state.revision;
  }

  /**
   * Attempts to apply a state transition
   */
  tryApplyTransition(
    resourceId: string,
    action: string,
    expectedVersion: number,
    updater: (state: Phase6CommunicationsState) => Partial<Phase6CommunicationsState>
  ): {
    success: boolean;
    state?: Phase6CommunicationsState;
    error?: string;
  } {
    // Check if action is already pending
    if (pendingActionLock.isPending(resourceId, action)) {
      return {
        success: false,
        error: "Action already pending for this resource",
      };
    }

    // Acquire lock
    if (!pendingActionLock.acquireLock(resourceId, action)) {
      return {
        success: false,
        error: "Failed to acquire action lock",
      };
    }

    try {
      // Check version conflict
      const currentVersion = this.getResourceVersion(resourceId);
      if (currentVersion !== null && checkVersionConflict(currentVersion, expectedVersion)) {
        pendingActionLock.releaseLock(resourceId, action);
        return {
          success: false,
          error: "Version conflict - resource has been modified",
        };
      }

      // Apply transition
      const updates = updater(this.state);
      this.state = applyStateTransition(this.state, () => updates);

      // Release lock
      pendingActionLock.releaseLock(resourceId, action);

      return {
        success: true,
        state: this.getState(),
      };
    } catch (error) {
      pendingActionLock.releaseLock(resourceId, action);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Gets the version of a resource by ID
   */
  private getResourceVersion(resourceId: string): number | null {
    // Check tickets
    const ticket = this.state.tickets.find(t => t.id === resourceId);
    if (ticket) return ticket.version;

    // Check feedback
    const feedback = this.state.feedback.find(f => f.id === resourceId);
    if (feedback) return feedback.version;

    // Check content
    const content = this.state.content.find(c => c.id === resourceId);
    if (content) return content.version;

    // Check campaigns
    const campaign = this.state.campaigns.find(c => c.id === resourceId);
    if (campaign) return campaign.version;

    return null;
  }

  /**
   * Resets the state manager to initial state
   */
  reset(): void {
    this.state = resetState();
  }
}

// Singleton state manager instance
export const phase6StateManager = new Phase6StateManager();