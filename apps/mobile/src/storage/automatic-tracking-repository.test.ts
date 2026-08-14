import { AutomaticTrackingRepository } from './automatic-tracking-repository';
import { makeMockEvent, trackingFixtureNow } from '@/test-utils/automatic-tracking-fixtures';

describe('AutomaticTrackingRepository', () => {
  it('keeps fingerprints unique, pages history, and purges source text', () => {
    const repository = new AutomaticTrackingRepository();
    const event = repository.createEvent(
      makeMockEvent('clear'),
      'ignored',
      ['low_confidence'],
      trackingFixtureNow
    );

    expect(repository.findByFingerprint('sms:clear')?.id).toBe(event.id);
    expect(repository.listHistory()).toHaveLength(1);

    const purged = repository.purgeExpiredSourceText(
      trackingFixtureNow + 31 * 24 * 60 * 60 * 1000
    );

    expect(purged).toBe(1);
    expect(repository.requireEvent(event.id).sourceText).toBeNull();
    expect(repository.listHistory()[0].action).toBe('source_purged');
  });
});
