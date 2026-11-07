import { captureTrackingAdmission } from '@/state/tracking-admission';

const financialResets = new Set<(owner: string) => void>();
export function registerFinancialProjectionReset(reset: (owner:string)=>void) {
  financialResets.add(reset);
}
export function resetFinancialProjections(owner:string) {
  for(const reset of financialResets) reset(owner);
}

const resets = new Set<() => void | Promise<void>>();
export type IdentityResetContext =
  { restoringOwnerId: string } | { kind: 'restore-unavailable' | 'signed-out-preserve' };
const identityResets = new Set<
  (context?: IdentityResetContext) => void | Promise<void>
>();

export function registerRuntimeUserDataReset(
  reset: () => void | Promise<void>
): () => void {
  resets.add(reset);
  return () => resets.delete(reset);
}

export async function resetRuntimeUserData(): Promise<void> {
  const assertCurrent = captureTrackingAdmission();
  const outcomes = await Promise.allSettled(
    Array.from(resets, async (reset) => { assertCurrent(); await reset(); })
  );
  const failure = outcomes.find(
    (outcome): outcome is PromiseRejectedResult => outcome.status === 'rejected'
  );
  if (failure) throw failure.reason;
}

export function registerRuntimeIdentityReset(
  reset: (context?: IdentityResetContext) => void | Promise<void>
): () => void {
  identityResets.add(reset);
  return () => identityResets.delete(reset);
}

export async function resetRuntimeIdentityData(
  context?: IdentityResetContext
): Promise<void> {
  const assertCurrent = context ? () => undefined : captureTrackingAdmission();
  const outcomes = await Promise.allSettled(
    Array.from(identityResets, async (reset) => { assertCurrent(); await reset(context); })
  );
  const failure = outcomes.find(
    (outcome): outcome is PromiseRejectedResult => outcome.status === 'rejected'
  );
  if (failure) throw failure.reason;
}
