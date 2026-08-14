import { AutomaticTrackingRepository } from '@/storage/automatic-tracking-repository';
import { makeMockEvent } from '@/test-utils/automatic-tracking-fixtures';

describe('duplicate resolution', () => {
  it('keeps the existing record as the canonical merge target', () => {
    const repository = new AutomaticTrackingRepository();
    const event = repository.createEvent(
      makeMockEvent('duplicate-new', {
        duplicateTransactionId: 'transaction-existing'
      }),
      'review_required',
      ['duplicate']
    );
    const duplicate = repository.addDuplicate(event, 'transaction-existing');
    const resolved = repository.updateDuplicate(duplicate.id, 'merge_details');

    expect(event.transactionId).toBeNull();
    expect(resolved).toMatchObject({
      existingTransactionId: 'transaction-existing',
      resolution: 'merge_details',
      status: 'resolved'
    });
  });
});
