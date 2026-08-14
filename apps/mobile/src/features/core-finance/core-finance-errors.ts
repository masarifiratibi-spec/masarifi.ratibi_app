import { CoreFinanceError } from '@/services/contracts/core-finance-service';

export type CoreFinanceErrorAction =
  'retry' | 'keep_editing' | 'save_local' | 'review_conflict' | 'back';

export interface SafeCoreFinanceError {
  messageKey: string;
  action: CoreFinanceErrorAction;
}

export function mapCoreFinanceError(error: unknown): SafeCoreFinanceError {
  if (error instanceof CoreFinanceError) {
    switch (error.code) {
      case 'validation':
        return {
          messageKey: 'coreFinance.error.validation',
          action: 'keep_editing'
        };
      case 'conflict':
        return {
          messageKey: 'coreFinance.error.conflict',
          action: 'review_conflict'
        };
      case 'offline':
        return {
          messageKey: 'coreFinance.error.offline',
          action: 'save_local'
        };
      case 'not_found':
        return { messageKey: 'coreFinance.error.notFound', action: 'back' };
      case 'archived':
        return { messageKey: 'coreFinance.error.archived', action: 'back' };
      case 'expired':
        return { messageKey: 'coreFinance.error.expired', action: 'back' };
      default:
        return { messageKey: 'coreFinance.error.unknown', action: 'retry' };
    }
  }
  return { messageKey: 'coreFinance.error.unknown', action: 'retry' };
}
