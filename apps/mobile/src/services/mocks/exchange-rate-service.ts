import type {
  ExchangeRateService,
  ExchangeRateResult
} from '@/services/contracts/core-finance-service';
import { exchangeRateServiceCapability } from '@/services/contracts/core-finance-service';
import type { ExchangeRateEstimate } from '@/domain/core-finance';
import type { CapabilityProviderHandle } from '@/services/contracts/capability-contract';
import { isDemoModeEnabled } from '@/config/demo-mode';

export function createMockExchangeRateService(
  rates: readonly ExchangeRateEstimate[] = []
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

export function createProductionExchangeRateService(): CapabilityProviderHandle<ExchangeRateService> {
  return {
    metadata: {
      id: 'local-exchange-rate',
      capability: exchangeRateServiceCapability.capability,
      majorVersion: exchangeRateServiceCapability.majorVersion,
      kind: 'live',
      availability: 'available'
    },
    async getRate(baseCurrencyCode, quoteCurrencyCode) {
      return baseCurrencyCode === quoteCurrencyCode
        ? { rate: 1, asOf: Date.now(), status: 'available' }
        : { rate: null, asOf: null, status: 'unavailable' };
    }
  };
}

export function createExchangeRateService() {
  return isDemoModeEnabled()
    ? createMockExchangeRateService()
    : createProductionExchangeRateService();
}

export const exchangeRateService = createExchangeRateService();
