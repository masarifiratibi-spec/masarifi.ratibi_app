export interface IdentityConflict {
  selectedMethod: 'google';
  existingMethod: 'phone' | 'google';
  status:
    | 'detected'
    | 'reverification_required'
    | 'linking'
    | 'linked'
    | 'cancelled'
    | 'failed';
  accountUnchanged: boolean;
}

export function createIdentityConflict({
  selectedMethod,
  existingMethod
}: Pick<IdentityConflict, 'selectedMethod' | 'existingMethod'>): IdentityConflict {
  return {
    selectedMethod,
    existingMethod,
    status: 'detected',
    accountUnchanged: true
  };
}

export function transitionIdentityConflict(
  conflict: IdentityConflict,
  next: IdentityConflict['status']
): IdentityConflict {
  if (next === 'reverification_required' && conflict.status === 'detected') {
    return { ...conflict, status: next };
  }
  if (next === 'linked' && conflict.status === 'reverification_required') {
    return { ...conflict, status: next, accountUnchanged: false };
  }
  if (
    (next === 'cancelled' || next === 'failed') &&
    conflict.status === 'reverification_required'
  ) {
    return { ...conflict, status: next, accountUnchanged: true };
  }
  return { ...conflict, status: 'failed', accountUnchanged: true };
}
