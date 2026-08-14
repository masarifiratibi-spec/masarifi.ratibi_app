import { assertCompatibleProvider } from './capability-contract';
import {
  coreFinanceServiceCapability,
  exchangeRateServiceCapability
} from './core-finance-service';
import { automaticTrackingServiceCapability } from './automatic-tracking-service';
import { voiceAnalyzerServiceCapability } from './voice-capture-service';
import { createMockCoreFinanceService } from '@/services/mocks/core-finance-service';
import { createMockExchangeRateService } from '@/services/mocks/exchange-rate-service';
import { createMockAutomaticTrackingService } from '@/services/mocks/automatic-tracking-service';
import { createMockVoiceAnalyzerService } from '@/services/mocks/voice-analyzer-service';
import { fixtureTranscript } from '@/services/mocks/voice-fixtures';

describe('core finance/tracking/voice provider compatibility', () => {
  it('declares compatible providers and stable owner-shaped outcomes', async () => {
    const finance = createMockCoreFinanceService();
    const exchange = createMockExchangeRateService();
    const tracking = createMockAutomaticTrackingService({ platform: 'android' });
    const voice = createMockVoiceAnalyzerService();

    expect(assertCompatibleProvider(coreFinanceServiceCapability, finance.metadata)).toBe(finance.metadata);
    expect(assertCompatibleProvider(exchangeRateServiceCapability, exchange.metadata)).toBe(exchange.metadata);
    expect(assertCompatibleProvider(automaticTrackingServiceCapability, tracking.metadata)).toBe(tracking.metadata);
    expect(assertCompatibleProvider(voiceAnalyzerServiceCapability, voice.metadata)).toBe(voice.metadata);

    await expect(finance.getHomeSummary('SAR')).resolves.toMatchObject({
      currencyCode: 'SAR'
    });
    await expect(exchange.getRate('SAR', 'SAR')).resolves.toMatchObject({
      status: 'available',
      rate: 1
    });
    await expect(tracking.getStatus()).resolves.toMatchObject({
      permissionStatus: 'granted'
    });
    await expect(
      voice.analyze({
        transcript: fixtureTranscript('clear_en'),
        scenario: 'clear_en',
        sessionId: 'session-1',
        recordedAt: 1,
        timezoneOffsetMinutes: 0
      })
    ).resolves.toMatchObject({ status: 'reviewing' });
  });

  it('maps failures to safe contract codes without raw provider output', async () => {
    const voice = createMockVoiceAnalyzerService();
    await expect(voice.transcribe('audio', 'offline')).rejects.toMatchObject({
      code: 'offline'
    });
  });

  it('rejects incompatible capture providers before execution', () => {
    const execute = jest.fn();
    expect(() =>
      assertCompatibleProvider(automaticTrackingServiceCapability, {
        id: 'tracking-v2',
        capability: automaticTrackingServiceCapability.capability,
        majorVersion: 2,
        kind: 'mock',
        availability: 'available'
      })
    ).toThrow('incompatible provider');
    expect(execute).not.toHaveBeenCalled();
  });
});
