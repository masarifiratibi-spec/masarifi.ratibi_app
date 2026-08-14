import { AutomaticTrackingRepository } from './automatic-tracking-repository';
import { makeMockEvent, trackingFixtureNow } from '@/test-utils/automatic-tracking-fixtures';

describe('automatic tracking retention', () => {
  it('clears history without deleting posted transaction links and purges source text by expiry', () => {
    const repository = new AutomaticTrackingRepository();
    const event = repository.createEvent(
      makeMockEvent('retention'),
      'review_required',
      ['clear_success'],
      trackingFixtureNow
    );
    repository.updateEvent(event.id, { transactionId: 'transaction-auto' });

    expect(repository.clearHistory()).toBe(1);
    expect(repository.requireEvent(event.id).transactionId).toBe('transaction-auto');
    expect(repository.requireEvent(event.id).sourceText).toBeNull();
  });
});
