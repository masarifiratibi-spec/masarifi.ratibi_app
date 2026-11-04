import { classifyFinancialMessage } from '@masarifi/transaction-parser';
import { normalizeNormalizedImport } from '../../../src/tracking/tracking.dto';

const deviceId = 'aaaaaaaa-1111-4111-8111-111111111111';
const generation = 'bbbbbbbb-2222-4222-8222-222222222222';
function command(proof: Record<string, unknown>) {
  const { providerReference, ...classification } = classifyFinancialMessage({
    text: 'تم خصم 50، الرصيد 950',
    receivedAt: Date.parse('2026-11-04T16:01:00Z'),
  });
  void providerReference;
  return {
    schemaVersion: 3,
    sourceType: 'sms',
    sourceChannel: 'android_sms',
    events: [
      {
        accountingPolicy: 'default_account_nominal_v1',
        sourceAmountDecimal: '50',
        activatedAt: '2026-11-04T16:00:00Z',
        sourceItemKey: 'stable-native-operation',
        sender: 'BANK',
        classification,
        receivedAt: '2026-11-04T16:01:00Z',
        transport: {
          deviceId,
          channel: 'android_sms',
          nativeIdDigest: 'c'.repeat(64),
          revisionDigest: 'd'.repeat(64),
          ...proof,
        },
      },
    ],
  };
}

describe('production installation transport proof', () => {
  it('preserves complete generation/version proof and the original source identity', () => {
    expect(
      normalizeNormalizedImport(
        command({ installationGeneration: generation, installationVersion: 1 }),
      ).events[0],
    ).toMatchObject({
      sourceItemKey: 'stable-native-operation',
      transport: {
        deviceId,
        installationGeneration: generation,
        installationVersion: 1,
        nativeIdDigest: 'c'.repeat(64),
        revisionDigest: 'd'.repeat(64),
      },
    });
  });
  it('preserves legacy DEV transport shape without manufacturing a production proof', () => {
    const event = normalizeNormalizedImport(command({})).events[0];
    expect(event).toBeDefined();
    if (!event) throw new Error('Expected normalized event');
    expect(event.transport).not.toHaveProperty('installationGeneration');
    expect(event.transport).not.toHaveProperty('installationVersion');
  });
  it.each([
    { installationGeneration: generation },
    { installationVersion: 1 },
    { installationGeneration: 'arbitrary', installationVersion: 1 },
    { installationGeneration: generation, installationVersion: 0 },
    { installationGeneration: generation, installationVersion: 1.5 },
    { installationGeneration: generation, installationVersion: 2147483648 },
    { installationGeneration: generation, installationVersion: 1, ownerId: 'foreign-owner' },
    {
      installationGeneration: generation,
      installationVersion: 1,
      deviceId: 'unregistered-device-text',
    },
  ])('rejects incomplete or forged authority shape: %p', (proof) => {
    expect(() => normalizeNormalizedImport(command(proof))).toThrow('VALIDATION_FAILED');
  });
});
