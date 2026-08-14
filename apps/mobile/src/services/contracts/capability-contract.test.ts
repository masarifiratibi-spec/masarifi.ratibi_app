import {
  assertCompatibleProvider,
  type CapabilityContractMetadata,
  type CapabilityProviderMetadata
} from './capability-contract';

const contract: CapabilityContractMetadata = {
  capability: 'core.finance',
  majorVersion: 1,
  owner: 'core-finance',
  providerKinds: ['mock'],
  unavailableOutcome: 'unavailable'
};

describe('capability contract compatibility', () => {
  it('accepts positive matching major providers and additive output fields', () => {
    const provider: CapabilityProviderMetadata = {
      id: 'mock-core-finance',
      capability: 'core.finance',
      majorVersion: 1,
      kind: 'mock',
      availability: 'available'
    };

    expect(assertCompatibleProvider(contract, provider)).toBe(provider);
    expect({ status: 'ok', id: 'tx-1', additive: 'ignored' }).toMatchObject({
      status: 'ok',
      id: 'tx-1'
    });
  });

  it('rejects invalid contract metadata before provider execution', () => {
    expect(() =>
      assertCompatibleProvider({ ...contract, majorVersion: 0 }, {
        id: 'bad',
        capability: 'core.finance',
        majorVersion: 1,
        kind: 'mock',
        availability: 'available'
      })
    ).toThrow('positive major version');
  });

  it('rejects incompatible major versions before provider execution', () => {
    const execute = jest.fn();
    expect(() =>
      assertCompatibleProvider(contract, {
        id: 'v2',
        capability: 'core.finance',
        majorVersion: 2,
        kind: 'mock',
        availability: 'available'
      })
    ).toThrow('incompatible provider');
    expect(execute).not.toHaveBeenCalled();
  });

  it('requires explicit unavailable outcomes for unavailable providers', () => {
    expect(() =>
      assertCompatibleProvider(
        { ...contract, unavailableOutcome: undefined },
        {
          id: 'offline',
          capability: 'core.finance',
          majorVersion: 1,
          kind: 'mock',
          availability: 'unavailable'
        }
      )
    ).toThrow('unavailable outcome');
  });
});
