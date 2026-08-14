import { makeMockEvent } from '@/test-utils/automatic-tracking-fixtures';
import { decideAutomaticTracking } from './automatic-tracking-policy';

describe('automatic tracking policy', () => {
  it('uses 90 auto-add, 60-89 review, below 60 ignore, and safety overrides', () => {
    expect(decideAutomaticTracking('automatic_clear', makeMockEvent('90', { confidenceBasisPoints: 9_000 })).status).toBe('auto_add');
    expect(decideAutomaticTracking('automatic_clear', makeMockEvent('89', { confidenceBasisPoints: 8_900 })).status).toBe('review');
    expect(decideAutomaticTracking('automatic_clear', makeMockEvent('60', { confidenceBasisPoints: 6_000 })).status).toBe('review');
    expect(decideAutomaticTracking('automatic_clear', makeMockEvent('59', { confidenceBasisPoints: 5_900 })).status).toBe('ignore');
    expect(decideAutomaticTracking('review_all', makeMockEvent('review-all')).status).toBe('review');
    expect(decideAutomaticTracking('paused', makeMockEvent('paused')).status).toBe('ignore');
    expect(decideAutomaticTracking('automatic_clear', makeMockEvent('otp', { hasOtpSignal: true })).status).toBe('reject');
  });
});
