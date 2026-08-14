import type { TrackingPreference } from '@/domain/app-shell';

export type TrackingClassification =
  | 'clear_eligible'
  | 'uncertain'
  | 'failed'
  | 'otp'
  | 'marketing'
  | 'duplicate'
  | 'conflicting'
  | 'low_confidence';

export type TrackingOutcome = 'add' | 'review' | 'reject' | 'ignore';

export function decideTrackingOutcome(
  mode: TrackingPreference['mode'],
  classification: TrackingClassification
): TrackingOutcome {
  if (mode === 'paused') return 'ignore';
  if (classification === 'clear_eligible') {
    return mode === 'automatic_clear' ? 'add' : 'review';
  }
  if (classification === 'uncertain') return 'review';
  return 'reject';
}
