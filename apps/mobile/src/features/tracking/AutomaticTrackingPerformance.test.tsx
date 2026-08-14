import { AutomaticTrackingRepository } from '@/storage/automatic-tracking-repository';
import { makeMockEvent, trackingFixtureNow } from '@/test-utils/automatic-tracking-fixtures';

describe('automatic tracking performance', () => {
  it('keeps 1,000 history entries in stable newest-first order', () => {
    const repository = new AutomaticTrackingRepository();
    for (let index = 0; index < 1_000; index += 1) {
      repository.createEvent(
        makeMockEvent(`event-${index}`, {
          occurredAt: trackingFixtureNow + index
        }),
        'ignored',
        ['low_confidence'],
        trackingFixtureNow + index
      );
    }

    const history = repository.listHistory();
    expect(history).toHaveLength(1_000);
    expect(history[0].occurredAt).toBeGreaterThan(history[999].occurredAt);
  });
});
