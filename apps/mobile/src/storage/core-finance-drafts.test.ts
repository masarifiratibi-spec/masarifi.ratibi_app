import type { TransactionDraft } from '@/domain/core-finance';
import { CoreFinanceRepository } from './core-finance-repository';

const draft: TransactionDraft = {
  id: 'manual-entry',
  transactionType: 'expense',
  amountText: '10',
  accountId: 'account-bank',
  destinationAccountId: null,
  categoryId: 'food',
  merchant: 'Lunch',
  notes: null,
  occurredAt: 1,
  status: 'editing',
  updatedAt: 1
};

it('updates, resumes, and discards only the requested durable draft', () => {
  const repo = new CoreFinanceRepository();
  repo.saveDraft(draft);
  repo.saveDraft({ ...draft, amountText: '12' });
  expect(repo.loadDraft(draft.id)?.amountText).toBe('12');
  repo.discardDraft(draft.id);
  expect(repo.loadDraft(draft.id)).toBeNull();
});
