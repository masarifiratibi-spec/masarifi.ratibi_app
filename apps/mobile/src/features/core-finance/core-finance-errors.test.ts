import { CoreFinanceError } from '@/services/contracts/core-finance-service';
import { mapCoreFinanceError } from './core-finance-errors';

it.each([
  ['validation', 'keep_editing'],
  ['conflict', 'review_conflict'],
  ['offline', 'save_local'],
  ['not_found', 'back']
] as const)('maps %s without exposing raw details', (code, action) => {
  const result = mapCoreFinanceError(new CoreFinanceError(code));
  expect(result.action).toBe(action);
  expect(JSON.stringify(result)).not.toContain('amount');
});

it('maps unknown errors to a safe retry', () => {
  expect(mapCoreFinanceError(new Error('database amount=900'))).toEqual({
    messageKey: 'coreFinance.error.unknown',
    action: 'retry'
  });
});
