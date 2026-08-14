import { assertCompatibleProvider } from './capability-contract';
import { financialPlanningServiceCapability } from './financial-planning-service';
import { reportsServiceCapability } from './reports-service';
import { createMockFinancialPlanningService } from '@/services/mocks/financial-planning-service';
import { createMockReportsService } from '@/services/mocks/reports-service';

describe('planning/reports provider compatibility', () => {
  it('declares compatible providers with versioned mutation outcomes', async () => {
    const planning = createMockFinancialPlanningService();
    const reports = createMockReportsService();

    expect(assertCompatibleProvider(financialPlanningServiceCapability, planning.metadata)).toBe(planning.metadata);
    expect(assertCompatibleProvider(reportsServiceCapability, reports.metadata)).toBe(reports.metadata);

    await expect(
      reports.verifyRecipient('reviewer@example.com', 'op-recipient-1')
    ).resolves.toMatchObject({
      affectedScopes: expect.arrayContaining(['reports.schedule'])
    });
    await expect(
      planning.getPlanningOverview({
        today: '2026-08-13',
        currencyCode: 'SAR'
      })
    ).resolves.toMatchObject({ dataState: 'ready' });
  });

  it('keeps unavailable report delivery safe and contract-shaped', async () => {
    const reports = createMockReportsService(undefined, {
      outputFailures: { 'op-output-1': 'configuration' }
    });
    expect(assertCompatibleProvider(reportsServiceCapability, reports.metadata)).toBe(reports.metadata);
    const preview = await reports.previewOutput({
      kind: 'monthly',
      anchorDate: '2026-08-13',
      currencyCode: 'SAR',
      timeZone: 'Asia/Riyadh',
      language: 'en',
      detailLevel: 'summary'
    });
    await expect(
      reports.requestOutput({ kind: 'download', previewId: preview.previewId }, 'op-output-1')
    ).resolves.toMatchObject({
      value: { status: 'failed', failureCategory: 'configuration' }
    });
  });

  it('rejects incompatible reports providers before execution', () => {
    const execute = jest.fn();
    expect(() =>
      assertCompatibleProvider(reportsServiceCapability, {
        id: 'reports-v2',
        capability: reportsServiceCapability.capability,
        majorVersion: 2,
        kind: 'mock',
        availability: 'available'
      })
    ).toThrow('incompatible provider');
    expect(execute).not.toHaveBeenCalled();
  });
});
