import type { AssistantResponse } from '@/domain/assistant';
import type { Transaction } from '@/domain/core-finance';
import { supportContextSchema, type SupportContext } from '@/domain/support';

export function buildTransactionSupportContext(transaction: Transaction, { appVersion }: { appVersion: string }): SupportContext {
  return supportContextSchema.parse({
    itemId: transaction.id,
    itemKind: 'transaction',
    category: transaction.categoryId ?? 'uncategorized',
    status: transaction.status,
    appVersion,
    diagnosticCategory: 'transaction'
  });
}

export function buildAssistantSupportContext(response: AssistantResponse, { appVersion }: { appVersion: string }): SupportContext {
  return supportContextSchema.parse({
    itemId: response.id,
    itemKind: 'assistant_response',
    category: 'assistant',
    status: 'answered',
    appVersion,
    diagnosticCategory: 'assistant'
  });
}
