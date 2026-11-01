import { useSyncExternalStore } from 'react';
import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient
} from '@tanstack/react-query';

import type {
  MockFinancialEventInput,
  TrackingMode
} from '@/domain/automatic-tracking';
import { automaticTrackingService } from '@/services/automatic-tracking-service';
import {
  getAutomaticTrackingSyncState,
  subscribeAutomaticTrackingSyncState
} from '@/services/automatic-tracking-coordinator';
import { createTrackingPermissionService } from '@/services/platform/tracking-permission-service';
import { bankNotificationService } from '@/services/platform/bank-notification-service';
import { trackingSourcePreferences } from '@/services/tracking-source-preferences';
import {
  automaticTrackingKeys,
  automaticTrackingReadKey
} from '@/state/automatic-tracking-view-state';
import { useAppShellStore } from '@/state/app-shell';
import { TrackingError } from '@/services/contracts/automatic-tracking-service';
import { withReadContext } from '@/services/live/read-context';

function useTrackingRead<T>({
  queryKey,
  queryFn,
  enabled = true,
  refetchOnMount
}: {
  queryKey: readonly unknown[];
  queryFn: () => Promise<T>;
  enabled?: boolean;
  refetchOnMount?: 'always';
}) {
  const ownerId = useAppShellStore((state) => state.session?.userId ?? null);
  const assertOwner = () => {
    if ((useAppShellStore.getState().session?.userId ?? null) !== ownerId)
      throw new TrackingError('permission_required');
  };
  return useQuery({
    queryKey: automaticTrackingReadKey(queryKey, ownerId),
    enabled,
    refetchOnMount,
    queryFn: () =>
      withReadContext(undefined, async () => {
        assertOwner();
        const data = await queryFn();
        assertOwner();
        return data;
      })
  });
}

export function useTrackingStatus() {
  return useTrackingRead({
    queryKey: automaticTrackingKeys.status,
    queryFn: () =>
      withReadContext(undefined, async () => {
        const [status, permission, notificationAccess, sources] =
          await Promise.all([
            automaticTrackingService.getStatus(),
            createTrackingPermissionService().getState(),
            bankNotificationService.getAccessState(),
            trackingSourcePreferences.load()
          ]);
        if (status.platform !== 'android') return status;
        const sourceGranted =
          permission.status === 'granted' || notificationAccess === 'granted';
        const sourcesUnavailable =
          permission.status === 'unavailable' &&
          notificationAccess === 'unavailable';
        return {
          ...status,
          permissionStatus: sourceGranted
            ? ('granted' as const)
            : permission.status === 'unavailable'
              ? notificationAccess
              : permission.status,
          smsPermissionStatus: permission.status,
          notificationAccessStatus: notificationAccess,
          smsTrackingEnabled: sources.smsEnabled,
          notificationTrackingEnabled: sources.notificationEnabled,
          serviceState: sourcesUnavailable
            ? ('unavailable' as const)
            : status.serviceState
        };
      }),
    refetchOnMount: 'always'
  });
}

export function useAutomaticTrackingSyncState() {
  return useSyncExternalStore(
    subscribeAutomaticTrackingSyncState,
    getAutomaticTrackingSyncState,
    getAutomaticTrackingSyncState
  );
}

export function useTrackingHistory() {
  return useTrackingRead({
    queryKey: automaticTrackingKeys.history(),
    queryFn: () => automaticTrackingService.listHistory()
  });
}

export function useReviewItems() {
  return useTrackingRead({
    queryKey: automaticTrackingKeys.review(),
    queryFn: () => automaticTrackingService.listReviewItems()
  });
}

export function useReviewItem(id: string) {
  return useTrackingRead({
    queryKey: automaticTrackingKeys.reviewItem(id),
    queryFn: () => automaticTrackingService.getReviewItem(id),
    enabled: Boolean(id)
  });
}

export function useDuplicateCandidate(id: string) {
  return useTrackingRead({
    queryKey: automaticTrackingKeys.duplicate(id),
    queryFn: () => automaticTrackingService.getDuplicate(id),
    enabled: Boolean(id)
  });
}

export function useDuplicateCandidates() {
  return useTrackingRead({
    queryKey: automaticTrackingKeys.duplicates(),
    queryFn: () => automaticTrackingService.listDuplicates()
  });
}

export function useKeywordRules() {
  return useTrackingRead({
    queryKey: automaticTrackingKeys.keywords(),
    queryFn: () => automaticTrackingService.listKeywordRules()
  });
}

export function useSenderRules(search = '') {
  return useTrackingRead({
    queryKey: automaticTrackingKeys.senders({ search }),
    queryFn: () => automaticTrackingService.listSenderRules({ search })
  });
}

export function useTrackingMutation<TVariables, TResult>(
  mutationFn: (
    variables: TVariables
  ) => Promise<{ value: TResult; affectedScopes: readonly string[] }>
) {
  const client = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: async (result) => {
      await invalidateTrackingScopes(client, result.affectedScopes);
    }
  });
}

export function useProcessMockEvent() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: MockFinancialEventInput) =>
      automaticTrackingService.processMockEvent(input),
    onSuccess: async (result) => {
      await invalidateTrackingScopes(client, result.affectedScopes);
    }
  });
}

export function useSetTrackingMode() {
  return useTrackingMutation((mode: TrackingMode) =>
    automaticTrackingService.setMode(mode).then((value) => ({
      value,
      affectedScopes: ['tracking.status']
    }))
  );
}

export function scopeToKey(scope: string): readonly unknown[] {
  const [, kind, id] = scope.split('.');
  if (scope.startsWith('tracking.status')) return automaticTrackingKeys.status;
  if (scope.startsWith('tracking.history'))
    return automaticTrackingKeys.history();
  if (scope.startsWith('tracking.review'))
    return automaticTrackingKeys.review();
  if (scope.startsWith('tracking.keywords'))
    return automaticTrackingKeys.keywords();
  if (scope.startsWith('tracking.senders'))
    return automaticTrackingKeys.senders();
  if (scope.startsWith('home')) return ['core-finance', 'home'];
  if (scope.startsWith('transactions.detail') && kind === 'detail' && id)
    return ['core-finance', 'transaction', id];
  if (scope.startsWith('transactions')) return ['core-finance', 'transactions'];
  return ['automatic-tracking'];
}

export async function invalidateTrackingScopes(
  client: QueryClient,
  scopes: readonly string[]
): Promise<void> {
  await Promise.all(
    scopes.map((scope) =>
      client.invalidateQueries({ queryKey: scopeToKey(scope) })
    )
  );
}
