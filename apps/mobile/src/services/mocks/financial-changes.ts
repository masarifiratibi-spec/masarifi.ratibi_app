/**
 * Deterministic financial-change scenarios.
 *
 * Each scenario exercises one FinancialChange acceptance path from UI Contract
 * §4: clear (applied with correction), ambiguous (review), duplicate (review +
 * comparison), failed (recovery action), assistant (awaiting confirmation).
 */

import { createFinancialChange } from '@/domain/financial-change';
import type { FinancialChange } from '@/domain/foundation';
import type { FinancialChangeScenario } from '@/services/contracts/foundation-service';

export function buildFinancialChange(
  scenario: FinancialChangeScenario
): FinancialChange {
  switch (scenario) {
    case 'clear':
      return createFinancialChange({
        source: 'automatic',
        certainty: 'clear',
        sourceReference: 'bank-sms-001',
        correctionActions: ['undo', 'edit', 'report']
      });
    case 'ambiguous':
      return createFinancialChange({
        source: 'automatic',
        certainty: 'review_required',
        sourceReference: 'bank-sms-002',
        correctionActions: ['edit', 'report']
      });
    case 'duplicate':
      return createFinancialChange({
        source: 'automatic',
        certainty: 'review_required',
        sourceReference: 'bank-sms-003',
        correctionActions: ['edit', 'report']
      });
    case 'failed':
      return createFinancialChange({
        source: 'automatic',
        certainty: 'rejected',
        sourceReference: null,
        correctionActions: ['report']
      });
    case 'assistant':
      return createFinancialChange({
        source: 'assistant',
        certainty: 'clear',
        confirmationRequired: true,
        sourceReference: 'assistant-proposal-001',
        correctionActions: []
      });
    default: {
      const exhaustive: never = scenario;
      throw new Error(
        `Unhandled financial-change scenario: ${String(exhaustive)}`
      );
    }
  }
}

export const FINANCIAL_CHANGE_SCENARIOS: readonly FinancialChangeScenario[] = [
  'clear',
  'ambiguous',
  'duplicate',
  'failed',
  'assistant'
];
