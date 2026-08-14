export type CapabilityProviderKind = 'mock' | 'platform' | 'live';
export type CapabilityAvailability = 'available' | 'unavailable';

export interface CapabilityContractMetadata {
  capability: string;
  majorVersion: number;
  owner: string;
  providerKinds: readonly CapabilityProviderKind[];
  unavailableOutcome?: string;
}

export interface CapabilityProviderMetadata {
  id: string;
  capability: string;
  majorVersion: number;
  kind: CapabilityProviderKind;
  availability: CapabilityAvailability;
}

export type CapabilityProviderHandle<T> = T & {
  metadata: CapabilityProviderMetadata;
};

export function assertCompatibleProvider<T extends CapabilityProviderMetadata>(
  contract: CapabilityContractMetadata,
  provider: T
): T {
  if (!Number.isInteger(contract.majorVersion) || contract.majorVersion <= 0) {
    throw new Error('capability contract requires a positive major version');
  }
  if (!Number.isInteger(provider.majorVersion) || provider.majorVersion <= 0) {
    throw new Error('capability provider requires a positive major version');
  }
  if (contract.capability !== provider.capability || contract.majorVersion !== provider.majorVersion) {
    throw new Error('incompatible provider');
  }
  if (!contract.providerKinds.includes(provider.kind)) {
    throw new Error('incompatible provider kind');
  }
  if (provider.availability === 'unavailable' && !contract.unavailableOutcome) {
    throw new Error('unavailable outcome required');
  }
  return provider;
}
