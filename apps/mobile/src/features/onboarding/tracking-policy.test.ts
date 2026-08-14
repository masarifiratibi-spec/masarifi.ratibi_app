import { decideTrackingOutcome } from './tracking-policy';

describe('tracking policy', () => {
  it('keeps unsafe fixtures out under all modes', () => {
    const unsafe = ['failed', 'otp', 'marketing', 'duplicate', 'conflicting', 'low_confidence'] as const;

    for (const classification of unsafe) {
      expect(decideTrackingOutcome('automatic_clear', classification)).not.toBe('add');
      expect(decideTrackingOutcome('review_all', classification)).not.toBe('add');
      expect(decideTrackingOutcome('paused', classification)).toBe('ignore');
    }
  });

  it('adds only clear eligible items automatically and reviews uncertain ones', () => {
    expect(decideTrackingOutcome('automatic_clear', 'clear_eligible')).toBe('add');
    expect(decideTrackingOutcome('automatic_clear', 'uncertain')).toBe('review');
    expect(decideTrackingOutcome('review_all', 'clear_eligible')).toBe('review');
    expect(decideTrackingOutcome('paused', 'clear_eligible')).toBe('ignore');
  });
});
