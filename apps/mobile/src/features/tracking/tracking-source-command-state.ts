import { useCallback, useSyncExternalStore } from 'react';
import { useTrackingAdmission } from '@/state/tracking-admission';

type Source = 'sms' | 'notification';
type Snapshot = {
  intents: Partial<Record<Source, boolean>>;
  failed: boolean;
};
interface CommandScope {
  ownerId: string | null;
  admissionRevision: number;
  requests: Record<Source, number>;
  configurationRequest: number;
  tail: Promise<void>;
  snapshot: Snapshot;
  listeners: Set<() => void>;
}

// Navigation must not create a second command queue for the same admitted owner.
// A new identity scope replaces this volatile view state; durable consent stays
// exclusively in the existing consent service and is never restored from here.
let activeScope: CommandScope | undefined;
function scopeFor(ownerId: string | null, admissionRevision: number) {
  if (
    !activeScope ||
    activeScope.ownerId !== ownerId ||
    activeScope.admissionRevision !== admissionRevision
  ) {
    activeScope = {
      ownerId,
      admissionRevision,
      requests: { sms: 0, notification: 0 },
      configurationRequest: 0,
      tail: Promise.resolve(),
      snapshot: { intents: {}, failed: false },
      listeners: new Set()
    };
  }
  return activeScope;
}
function publish(scope: CommandScope, snapshot: Snapshot) {
  scope.snapshot = snapshot;
  scope.listeners.forEach((listener) => listener());
}
export function setTrackingSourceIntent(
  scope: CommandScope,
  source: Source,
  enabled: boolean | undefined
) {
  const intents = { ...scope.snapshot.intents };
  if (enabled === undefined) delete intents[source];
  else intents[source] = enabled;
  publish(scope, {
    intents,
    failed: enabled === undefined ? scope.snapshot.failed : false
  });
}
export function setTrackingSourceFailure(scope: CommandScope, failed: boolean) {
  publish(scope, { ...scope.snapshot, failed });
}
export function useTrackingSourceCommands(ownerId: string | null) {
  const revision = useTrackingAdmission((state) => state.revision);
  const scope = scopeFor(ownerId, revision);
  const subscribe = useCallback(
    (listener: () => void) => {
      scope.listeners.add(listener);
      return () => {
        scope.listeners.delete(listener);
      };
    },
    [scope]
  );
  const snapshot = useCallback(() => scope.snapshot, [scope]);
  return {
    scope,
    snapshot: useSyncExternalStore(subscribe, snapshot, snapshot)
  };
}
