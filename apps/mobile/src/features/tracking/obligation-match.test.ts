import { decideAutomaticTracking } from './automatic-tracking-policy';
import { makeMockEvent } from '@/test-utils/automatic-tracking-fixtures';

describe('obligation matching', () => {
  it('requires review when more than one obligation can match', () => {
    expect(
      decideAutomaticTracking(
        'automatic_clear',
        makeMockEvent('multi-obligation', {
          eventType: 'installment',
          obligationCandidateCount: 2
        })
      )
    ).toMatchObject({
      status: 'review',
      reasonCodes: ['multiple_obligations']
    });
  });
});
