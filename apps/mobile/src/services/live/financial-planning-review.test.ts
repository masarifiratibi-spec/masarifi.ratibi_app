import { createLiveFinancialPlanningService } from './financial-planning-service';
import { registerLiveClerkBridge } from './auth-service';
import { usePreferenceStore } from '@/state/preferences';
import { salaryProfileWireFixture } from '@/test-utils/financial-planning-api-fixtures';

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
