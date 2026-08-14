import type {
  ExchangeRateService,
  ExchangeRateResult
} from '@/services/contracts/core-finance-service';
import { exchangeRateServiceCapability } from '@/services/contracts/core-finance-service';
import type { ExchangeRateEstimate } from '@/domain/core-finance';
import { fixtureRates } from '@/test-utils/core-finance-fixtures';
import type { CapabilityProviderHandle } from '@/services/contracts/capability-contract';

export function createMockExchangeRateService(
  rates: readonly ExchangeRateEstimate[] = fixtureRates
): CapabilityProviderHandle<ExchangeRateService> {
  return {
    metadata: {
      id: 'mock-exchange-rate',
      capability: exchangeRateServiceCapability.capability,
      majorVersion: exchangeRateServiceCapability.majorVersion,
      kind: 'mock',
      availability: 'available'
    },
    async getRate(
      baseCurrencyCode,
      quoteCurrencyCode
    ): Promise<ExchangeRateResult> {
      if (baseCurrencyCode === quoteCurrencyCode)
        return { rate: 1, asOf: Date.now(), status: 'available' };
      const match = rates.find(
        (item) =>
          item.baseCurrencyCode === baseCurrencyCode &&
          item.quoteCurrencyCode === quoteCurrencyCode
      );
      return match
        ? { rate: match.rate, asOf: match.asOf, status: match.status }
        : { rate: null, asOf: null, status: 'unavailable' };
    }
  };
}

export const exchangeRateService = createMockExchangeRateService();
