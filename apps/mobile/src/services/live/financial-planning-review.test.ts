import { createLiveFinancialPlanningService } from './financial-planning-service';
import { registerLiveClerkBridge } from './auth-service';
import { usePreferenceStore } from '@/state/preferences';
import { salaryProfileWireFixture } from '@/test-utils/financial-planning-api-fixtures';

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(async () => null), setItemAsync: jest.fn(), deleteItemAsync: jest.fn()
}));


beforeAll(() =>
  registerLiveClerkBridge({
    getSession: async () => ({
      id: 'review-session',
      userId: 'review-owner',
      method: 'google',
      issuedAt: 1,
      expiresAt: 9e12
    }),
    getToken: async () => 'test-only-token'
  } as never)
);

it('keeps the obligations overview due date in Riyadh at the UTC day boundary', async () => {
  const previous = usePreferenceStore.getState().timeZone;
  usePreferenceStore.setState({ timeZone: 'Asia/Riyadh' });
  const id = salaryProfileWireFixture.id;
  const service = createLiveFinancialPlanningService({
    baseUrl: 'https://api.test',
    request: async (url) => {
      if (String(url).includes('/obligations'))
        return new Response(
          JSON.stringify({
            items: [
              {
                id,
                name: 'Car',
                direction: 'payable',
                type: 'installment',
                scheduleKind: 'fixed_term',
                currencyCode: 'SAR',
                principalMinor: '10000',
                openingPaidMinor: '0',
                installmentAmountMinor: '5000',
                installmentCount: 2,
                frequency: 'monthly',
                expectedDay: 8,
                customIntervalDays: null,
                startDate: '2026-10-08',
                endDate: '2026-11-08',
                status: 'active',
                defaultAccountId: null,
                automaticMatchingEnabled: false,
                provider: null,
                providerKeywords: [],
                reminderTiming: null,
                notes: null,
                deletedAt: null,
                version: 1,
                createdAt: '2026-10-17T00:00:00.000Z',
                updatedAt: '2026-10-17T00:00:00.000Z'
              }
            ],
            nextCursor: null
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      return new Response(
        JSON.stringify({
          period: '2026-10',
          dataState: 'ready',
          ledgerVersion: 1,
          salary: null,
          budgets: [],
          savings: [],
          obligations: {
            payables: [
              {
                id,
                name: 'Car',
                direction: 'payable',
                currencyCode: 'SAR',
                scheduledMinor: '10000',
                allocatedMinor: '0',
                paidMinor: '0',
                remainingMinor: '10000',
                overdueMinor: '0',
                nextDueAt: '2026-10-07T21:00:00.000Z',
                nextDueAmountMinor: '5000',
                completedInstallmentCount: 0,
                status: 'active',
                ledgerVersion: 1
              }
            ],
            receivables: []
          }
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }
  });
  try {
    await expect(service.getObligationsOverview({})).resolves.toMatchObject({
      nextDueDate: '2026-10-08',
      nextDueAmountMinor: 5000
    });
  } finally {
    usePreferenceStore.setState({ timeZone: previous });
  }
});

it.each([true, false])(
  'uses receipt-anchored Riyadh dates and does not invent a cycle before receipt: %s',
  async (linked) => {
    const previous = usePreferenceStore.getState().timeZone;
    usePreferenceStore.setState({ timeZone: 'Asia/Riyadh' });
    const request = jest.fn<ReturnType<typeof fetch>, Parameters<typeof fetch>>(
      async () =>
        new Response(
          JSON.stringify({
            period: '2026-10',
            dataState: 'ready',
            ledgerVersion: 1,
            salary: {
              id: salaryProfileWireFixture.id,
              name: 'Employer',
              currencyCode: 'SAR',
              expectedMinor: '125000',
              actualIncomeMinor: linked ? '125000' : '0',
              actualExpenseMinor: linked ? '30000' : '0',
              reservedObligationMinor: '0',
              startReceiptId: linked ? salaryProfileWireFixture.id : null,
              startAt: linked ? '2026-09-24T21:00:00.000Z' : null,
              nextExpectedAt: '2026-10-24T21:00:00.000Z'
            },
            budgets: [],
            savings: [],
            obligations: { payables: [], receivables: [] },
            requestId: 'isolated'
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
    );
    try {
      const service = createLiveFinancialPlanningService({
        baseUrl: 'https://api.test',
        request
      });
      const cycle = await service.getSalaryOverview({
        today: '2026-10-30',
        timeZone: 'Asia/Riyadh'
      });
      expect(cycle.startDate).toBe(linked ? '2026-09-25' : null);
      expect(cycle.projectedNextSalaryDate).toBe('2026-10-25');
      expect(cycle.suggestedDaily.status).toBe('unavailable');
      expect(cycle.income).toMatchObject(
        linked
          ? { status: 'available', value: { minorUnits: 125000 } }
          : { status: 'unavailable' }
      );
      expect(String(request.mock.calls[0]?.[0])).toContain('asOf=2026-10-30');
    } finally {
      usePreferenceStore.setState({ timeZone: previous });
    }
  }
);
