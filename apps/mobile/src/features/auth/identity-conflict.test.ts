import {
  createIdentityConflict,
  transitionIdentityConflict
} from './identity-conflict';

describe('identity conflict transitions', () => {
  it('requires re-verification before linking and keeps the account unchanged', () => {
    const conflict = createIdentityConflict({
      selectedMethod: 'google',
      existingMethod: 'phone'
    });

    expect(conflict).toMatchObject({
      status: 'detected',
      accountUnchanged: true
    });
    expect(transitionIdentityConflict(conflict, 'linked')).toMatchObject({
      status: 'failed',
      accountUnchanged: true
    });
    expect(
      transitionIdentityConflict(
        transitionIdentityConflict(conflict, 'reverification_required'),
        'linked'
      )
    ).toMatchObject({ status: 'linked', accountUnchanged: false });
  });

  it('leaves the account unchanged on cancellation or failure', () => {
    const ready = transitionIdentityConflict(
      createIdentityConflict({ selectedMethod: 'google', existingMethod: 'phone' }),
      'reverification_required'
    );

    expect(transitionIdentityConflict(ready, 'cancelled')).toMatchObject({
      status: 'cancelled',
      accountUnchanged: true
    });
    expect(transitionIdentityConflict(ready, 'failed')).toMatchObject({
      status: 'failed',
      accountUnchanged: true
    });
  });
});
