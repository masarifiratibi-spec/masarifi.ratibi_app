/**
 * Typed service contracts for the Masarifi mobile foundation.
 *
 * These interfaces define the boundary between UI components and the mock
 * services/storage that back them. Production adapters will implement the same
 * shapes; the UI never talks to providers, databases, or AI directly
 * (Constitution Principle V).
 */

import type {
  CaptureMethod,
  FinancialChange,
  FrontendState,
  OfflineEntry,
  OfflineEntryPayload,
  PermissionState,
  Platform,
  PlatformCapability,
  ProductCapability,
  ReportingCurrency,
  UserPreferences
} from '@/domain/foundation';
import type { CapabilityContractMetadata } from './capability-contract';

export const platformCapabilityServiceCapability: CapabilityContractMetadata = {
  capability: 'foundation.platform-capabilities',
  majorVersion: 1,
  owner: 'foundation',
  providerKinds: ['mock'],
  unavailableOutcome: 'foundation.capability.unavailable'
};

export const financialSummaryServiceCapability: CapabilityContractMetadata = {
  capability: 'foundation.financial-summary',
  majorVersion: 1,
  owner: 'foundation',
  providerKinds: ['mock'],
  unavailableOutcome: 'foundation.summary.unavailable'
};

export const financialChangeServiceCapability: CapabilityContractMetadata = {
  capability: 'foundation.financial-change',
  majorVersion: 1,
  owner: 'foundation',
  providerKinds: ['mock'],
  unavailableOutcome: 'foundation.change.unavailable'
};

export const offlineEntryRepositoryCapability: CapabilityContractMetadata = {
  capability: 'foundation.offline-entry',
  majorVersion: 1,
  owner: 'foundation',
  providerKinds: ['mock'],
  unavailableOutcome: 'foundation.offline.unavailable'
};

export const capabilityCatalogServiceCapability: CapabilityContractMetadata = {
  capability: 'foundation.capability-catalog',
  majorVersion: 1,
  owner: 'foundation',
  providerKinds: ['mock'],
  unavailableOutcome: 'foundation.catalog.unavailable'
};

// ─── Platform capability service ─────────────────────────────────────────────

export interface PlatformCapabilityService {
  listCapabilities(platform: Platform): readonly PlatformCapability[];
  listPermissions(platform: Platform): readonly PermissionState[];
  listCaptureMethods(platform: Platform): readonly CaptureMethod[];
}

// ─── Financial summary (User Story 1) ────────────────────────────────────────

export interface FinancialSummary {
  balance: ReportingCurrency;
  recentSpending: ReportingCurrency;
  nextObligation: {
    labelKey: string;
    amount: ReportingCurrency;
    dueLabelKey: string;
  } | null;
  reviewItemCount: number;
  dataComplete: boolean;
  nextActionKey: string;
}

export interface FinancialSummaryService {
  getSummary(preferences: UserPreferences): Promise<FinancialSummary>;
}

// ─── Financial change (User Story 3) ─────────────────────────────────────────

export type FinancialChangeScenario =
  'clear' | 'ambiguous' | 'duplicate' | 'failed' | 'assistant';

export interface FinancialChangeService {
  listScenarios(): readonly FinancialChangeScenario[];
  proposeChange(scenario: FinancialChangeScenario): FinancialChange;
}

// ─── Offline entry repository (User Story 2) ─────────────────────────────────

export interface OfflineEntryRepository {
  insert(payload: OfflineEntryPayload): Promise<OfflineEntry>;
  update(localId: string, payload: OfflineEntryPayload): Promise<OfflineEntry>;
  delete(localId: string): Promise<void>;
  list(): Promise<readonly OfflineEntry[]>;
  transition(
    localId: string,
    next: OfflineEntry['syncStatus'] | 'deleted'
  ): Promise<OfflineEntry>;
}

// ─── Capability catalog ──────────────────────────────────────────────────────

export interface CapabilityCatalogService {
  listProductCapabilities(): readonly ProductCapability[];
}

// ─── Frontend state factory ──────────────────────────────────────────────────

export type FrontendStateInput = Pick<FrontendState, 'kind' | 'messageKey'> & {
  recoveryAction?: FrontendState['recoveryAction'];
  isDataComplete?: boolean;
};

export function buildFrontendState(input: FrontendStateInput): FrontendState {
  return {
    kind: input.kind,
    messageKey: input.messageKey,
    recoveryAction: input.recoveryAction ?? null,
    isDataComplete: input.isDataComplete ?? true
  };
}
