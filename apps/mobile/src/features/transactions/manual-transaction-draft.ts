import type { TransactionDraft } from '@/domain/core-finance';
import { coreFinanceService } from '@/services/mocks/core-finance-service';

export const MANUAL_TRANSACTION_DRAFT_ID = 'manual-entry';

export async function patchManualTransactionDraft(
  patch: Partial<TransactionDraft>
) {
  const current = await coreFinanceService.loadDraft(
    MANUAL_TRANSACTION_DRAFT_ID
  );
  if (!current) return null;

  const next = {
    ...current,
    ...patch,
    updatedAt: Date.now()
  };
  if (patch.accountId && patch.accountId !== current.accountId)
    next.destinationAccountId = null;
  return coreFinanceService.saveDraft(next);
}
