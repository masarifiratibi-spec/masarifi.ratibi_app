import type { CapabilityContractMetadata } from './capability-contract';
import {
  appShellStorageCapability,
  authServiceCapability,
  biometricServiceCapability,
  onboardingServiceCapability,
  trackingPermissionServiceCapability
} from './app-shell-service';
import {
  automaticTrackingServiceCapability
} from './automatic-tracking-service';
import {
  coreFinanceServiceCapability,
  exchangeRateServiceCapability
} from './core-finance-service';
import {
  financialPlanningServiceCapability
} from './financial-planning-service';
import {
  reportsServiceCapability
} from './reports-service';
import {
  assistantServiceCapability,
  notificationServiceCapability,
  phoneNotificationServiceCapability,
  settingsServiceCapability,
  subscriptionServiceCapability,
  supportServiceCapability
} from './assistant-notifications-service';
import {
  capabilityCatalogServiceCapability,
  financialChangeServiceCapability,
  financialSummaryServiceCapability,
  offlineEntryRepositoryCapability,
  platformCapabilityServiceCapability
} from './foundation-service';
import {
  voiceAnalyzerServiceCapability,
  voiceRecorderServiceCapability
} from './voice-capture-service';

const capabilities: readonly CapabilityContractMetadata[] = [
  appShellStorageCapability,
  authServiceCapability,
  biometricServiceCapability,
  onboardingServiceCapability,
  trackingPermissionServiceCapability,
  automaticTrackingServiceCapability,
  coreFinanceServiceCapability,
  exchangeRateServiceCapability,
  financialPlanningServiceCapability,
  reportsServiceCapability,
  assistantServiceCapability,
  notificationServiceCapability,
  phoneNotificationServiceCapability,
  settingsServiceCapability,
  subscriptionServiceCapability,
  supportServiceCapability,
  capabilityCatalogServiceCapability,
  financialChangeServiceCapability,
  financialSummaryServiceCapability,
  offlineEntryRepositoryCapability,
  platformCapabilityServiceCapability,
  voiceAnalyzerServiceCapability,
  voiceRecorderServiceCapability
];

describe('SPEC-010 capability metadata', () => {
  it('uses unique positive capability names', () => {
    expect(new Set(capabilities.map((item) => item.capability)).size).toBe(capabilities.length);
    expect(capabilities.every((item) => item.majorVersion > 0)).toBe(true);
  });

  it('declares deterministic mock or explicit platform providers', () => {
    expect(capabilities.every((item) => item.providerKinds.length > 0)).toBe(true);
    expect(capabilities.every((item) => item.providerKinds.includes('mock') || item.providerKinds.includes('platform'))).toBe(true);
  });

  it('declares unavailable outcomes for platform capabilities', () => {
    const platformCapabilities = capabilities.filter((item) => item.providerKinds.includes('platform'));
    expect(platformCapabilities.length).toBeGreaterThan(0);
    expect(platformCapabilities.every((item) => Boolean(item.unavailableOutcome))).toBe(true);
  });
});
