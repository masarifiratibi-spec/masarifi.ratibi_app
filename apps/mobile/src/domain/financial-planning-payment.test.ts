import { applyPaymentEarliestFirst } from './financial-planning';
import { fixturePayment, fixtureSchedule, planningToday } from '@/test-utils/financial-planning-fixtures';

it('allocates partial, full, over, and later payments earliest unpaid first', () => {
  expect(
    applyPaymentEarliestFirst({
      amountMinor: 4_500_00,
      schedule: fixtureSchedule,
      payments: [fixturePayment],
      paidDate: planningToday
    })
  ).toEqual([{ scheduleItemId: 'schedule-car-2', amountMinor: 2_000_00 }]);
});
