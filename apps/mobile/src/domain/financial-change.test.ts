import {
  applyFinancialChangeTransition,
  createFinancialChange,
  type FinancialChangeSeed
} from './financial-change';
import { InvalidTransitionError } from '@/storage/errors';

const baseSeed: FinancialChangeSeed = {
  source: 'automatic',
  certainty: 'clear',
  correctionActions: ['undo', 'edit']
};

describe('createFinancialChange', () => {
  it('routes a clear automatic change straight to applied with correction actions', () => {
    const change = createFinancialChange(baseSeed);
    expect(change.status).toBe('applied');
    expect(change.correctionActions).toContain('undo');
  });

  it('forces an assistant-originated change into awaiting_confirmation', () => {
    const change = createFinancialChange({
      source: 'assistant',
      certainty: 'clear',
      confirmationRequired: true,
      correctionActions: []
    });
    expect(change.status).toBe('awaiting_confirmation');
    expect(change.confirmationRequired).toBe(true);
  });

  it('routes an uncertain change into review_required', () => {
    const change = createFinancialChange({
      source: 'automatic',
      certainty: 'review_required',
      correctionActions: []
    });
    expect(change.status).toBe('review_required');
  });

  it('keeps a rejected change rejected instead of presenting it as applied', () => {
    const change = createFinancialChange({
      source: 'automatic',
      certainty: 'rejected',
      correctionActions: ['report']
    });
    expect(change.status).toBe('rejected');
  });
});

describe('applyFinancialChangeTransition', () => {
  const applied = createFinancialChange(baseSeed);

  it('moves an applied automatic change to undone', () => {
    const undone = applyFinancialChangeTransition(applied, 'undone');
    expect(undone.status).toBe('undone');
  });

  it('moves an applied automatic change to corrected', () => {
    const corrected = applyFinancialChangeTransition(applied, 'corrected');
    expect(corrected.status).toBe('corrected');
  });

  it('confirms an assistant proposal from awaiting_confirmation to applied', () => {
    const proposal = createFinancialChange({
      source: 'assistant',
      certainty: 'clear',
      confirmationRequired: true,
      correctionActions: []
    });
    const confirmed = applyFinancialChangeTransition(proposal, 'applied');
    expect(confirmed.status).toBe('applied');
  });

  it('rejects reviewing a change to rejected', () => {
    const underReview = createFinancialChange({
      source: 'automatic',
      certainty: 'review_required',
      correctionActions: []
    });
    const rejected = applyFinancialChangeTransition(underReview, 'rejected');
    expect(rejected.status).toBe('rejected');
  });

  it.each([
    ['undone', 'applied'] as const,
    ['rejected', 'applied'] as const,
    ['applied', 'proposed'] as const
  ])('blocks invalid transition %s -> %s', (from, to) => {
    const change = { ...applied, status: from };
    expect(() => applyFinancialChangeTransition(change, to)).toThrow(
      InvalidTransitionError
    );
  });
});
