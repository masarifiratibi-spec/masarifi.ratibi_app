import { AutomaticTrackingRepository } from '@/storage/automatic-tracking-repository';
import { makeMockEvent, trackingFixtureNow } from '@/test-utils/automatic-tracking-fixtures';

describe('automatic tracking privacy', () => {
  it('suppresses private notifications and removes source text without removing extracted fields', () => {
    const repository = new AutomaticTrackingRepository();
    const event = repository.createEvent(
      makeMockEvent('privacy'),
      'review_required',
      ['low_confidence'],
      trackingFixtureNow
    );
    repository.clearHistory();

    const cleared = repository.requireEvent(event.id);
    expect(cleared.sourceText).toBeNull();
    expect(cleared.amountMinor).toBe(12_500);
  });
});
