import { assertCompatibleProvider } from './capability-contract';
import { financialPlanningServiceCapability } from './financial-planning-service';
import { reportsServiceCapability } from './reports-service';
import {
  createMockFinancialPlanningService,
  createSeededFinancialPlanningService
} from '@/services/mocks/financial-planning-service';
import { fixtureSalaryProfile } from '@/services/mocks/financial-planning-fixtures';
import { createMockReportsService } from '@/services/mocks/reports-service';

describe('planning/reports provider compatibility', () => {
  afterEach(() => jest.restoreAllMocks());

  it('declares compatible providers with versioned mutation outcomes', async () => {
    const planning = createMockFinancialPlanningService();
    const reports = createMockReportsService();

    expect(
      assertCompatibleProvider(
        financialPlanningServiceCapability,
        planning.metadata
      )
    ).toBe(planning.metadata);
    expect(
      assertCompatibleProvider(reportsServiceCapability, reports.metadata)
    ).toBe(reports.metadata);

    await expect(
      reports.verifyRecipient('reviewer@example.com', 'op-recipient-1')
    ).resolves.toMatchObject({
      affectedScopes: expect.arrayContaining(['reports.schedule'])
    });
    await expect(
      planning.getPlanningOverview({
        today: '2026-08-13',
        currencyCode: 'SAR',
        timeZone: 'Asia/Riyadh'
      })
    ).resolves.toMatchObject({ dataState: 'ready' });
  });

  it('keeps unavailable report delivery safe and contract-shaped', async () => {
    const reports = createMockReportsService(undefined, {
      outputFailures: { 'op-output-1': 'configuration' }
    });
    expect(
      assertCompatibleProvider(reportsServiceCapability, reports.metadata)
    ).toBe(reports.metadata);
    const preview = await reports.previewOutput({
      kind: 'monthly',
      anchorDate: '2026-08-13',
      currencyCode: 'SAR',
      timeZone: 'Asia/Riyadh',
      language: 'en',
      detailLevel: 'summary'
    });
    await expect(
      reports.requestOutput(
        { kind: 'download', previewId: preview.previewId },
        'op-output-1'
      )
    ).resolves.toMatchObject({
      value: { status: 'failed', failureCategory: 'configuration' }
    });
  });

  it('executes capability v1 planning inputs without time-zone additions', async () => {
    const deviceOptions = new Intl.DateTimeFormat().resolvedOptions();
    jest
      .spyOn(Intl.DateTimeFormat.prototype, 'resolvedOptions')
      .mockReturnValue({
        ...deviceOptions,
        timeZone: 'America/Los_Angeles'
      });
    jest.spyOn(Date, 'now').mockReturnValue(Date.UTC(2026, 0, 1, 0, 30));
    const planning = createSeededFinancialPlanningService();

    await expect(
      planning.getPlanningOverview({
        today: '2025-12-31',
        currencyCode: 'SAR'
      })
    ).resolves.toMatchObject({ dataState: 'ready' });
    await expect(
      planning.getSalaryOverview({ today: '2025-12-31' })
    ).resolves.toMatchObject({ profileId: fixtureSalaryProfile.id });

    const confirmation = await planning.confirmSalaryReceipt(
      {
        salaryProfileId: fixtureSalaryProfile.id,
        transactionId: 'salary-v1-boundary',
        expectedOccurrenceDate: '2025-12-31',
        receivedDate: '2025-12-31'
      },
      'salary-v1-confirm'
    );
    expect(confirmation.value.cycle.daysRemaining).toBe(31);

    const undo = await planning.undoSalaryReceipt(
      confirmation.value.receipt.id,
      'salary-v1-undo'
    );
    expect(undo.value.cycle.daysRemaining).toBe(31);
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
