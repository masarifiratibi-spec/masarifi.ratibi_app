/**
 * Guarded FinancialChange state machine.
 *
 * Every transition is validated against the allowed table. Automatic clear
 * changes may apply directly; uncertain changes enter review; assistant changes
 * require explicit confirmation before applying. An applied automatic change
 * always exposes correction actions. UI Contract §4, Constitution Principle I.
 */

import {
  FINANCIAL_CHANGE_TRANSITIONS,
  type CorrectionAction,
  type FinancialChange,
  type FinancialChangeCertainty,
  type FinancialChangeSource,
  type FinancialChangeStatus
} from './foundation';
import { InvalidTransitionError } from '@/storage/errors';

export interface FinancialChangeSeed {
  source: FinancialChangeSource;
  certainty: FinancialChangeCertainty;
  confirmationRequired?: boolean;
  correctionActions: readonly CorrectionAction[];
  sourceReference?: string | null;
}

let nextChangeId = 0;

export function createFinancialChange(
  seed: FinancialChangeSeed
): FinancialChange {
  const id = `change-${nextChangeId++}`;
  const now = Date.now();
  const sourceReference = seed.sourceReference ?? null;
  const correctionActions = new Set(seed.correctionActions);

  if (seed.source === 'assistant') {
    return {
      id,
      source: seed.source,
      certainty: seed.certainty,
      status: 'awaiting_confirmation',
      sourceReference,
      confirmationRequired: true,
      correctionActions,
      createdAt: now
    };
  }

  if (seed.certainty === 'review_required') {
    return {
      id,
      source: seed.source,
      certainty: seed.certainty,
      status: 'review_required',
      sourceReference,
      confirmationRequired: seed.confirmationRequired ?? false,
      correctionActions,
      createdAt: now
    };
  }

  if (seed.certainty === 'rejected') {
    return {
      id,
      source: seed.source,
      certainty: seed.certainty,
      status: 'rejected',
      sourceReference,
      confirmationRequired: false,
      correctionActions,
      createdAt: now
    };
  }

  // Clear, non-assistant: apply directly with correction actions.
  return {
    id,
    source: seed.source,
    certainty: seed.certainty,
    status: 'applied',
    sourceReference,
    confirmationRequired: false,
    correctionActions,
    createdAt: now
  };
}

export function applyFinancialChangeTransition(
  change: FinancialChange,
  next: FinancialChangeStatus
): FinancialChange {
  if (!isAllowedTransition(change.status, next)) {
    throw new InvalidTransitionError(change.status, next);
  }
  return { ...change, status: next };
}

function isAllowedTransition(
  from: FinancialChangeStatus,
  to: FinancialChangeStatus
): boolean {
  const allowed = FINANCIAL_CHANGE_TRANSITIONS.get(from);
  return allowed ? allowed.has(to) : false;
}
