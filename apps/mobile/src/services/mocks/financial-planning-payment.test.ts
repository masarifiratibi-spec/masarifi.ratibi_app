import { deriveMatchForTransaction } from './financial-planning-service';
import { fixtureObligation, fixturePayment, fixtureSalaryTransaction } from './financial-planning-fixtures';

it('requires explicit review for duplicate payment matches', async () => {
  const match = await deriveMatchForTransaction(
    fixtureSalaryTransaction,
    [fixtureObligation],
    [{ ...fixturePayment, transactionId: fixtureSalaryTransaction.id }]
  );
  expect(match.status).toBe('review_required');
  expect(match.duplicatePaymentIds).toContain(fixturePayment.id);
});
