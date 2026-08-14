import { useInfiniteQuery, useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';

import type { PrivacyRequest, UserProfileInput } from '@/domain/settings';
import { invalidateAssistantScopes } from '@/features/assistant/assistant-queries';
import { invalidateNotificationScopes } from '@/features/notifications/notification-queries';
import { notificationPreferenceKeys } from '@/features/notifications/notification-preferences-queries';
import { invalidateReportScopes } from '@/features/reports/report-queries';
import { settingsService } from '@/services/mocks/subscription-settings-service';

export const settingsKeys = {
  profile: () => ['settings', 'profile'] as const,
  sessions: () => ['settings', 'sessions'] as const,
  securityEvents: (cursor?: string) => cursor ? ['settings', 'security-events', cursor] as const : ['settings', 'security-events'] as const,
  privacyRequest: (kind: PrivacyRequest['kind']) => ['settings', 'privacy-request', kind] as const,
  localData: () => ['settings', 'local-data'] as const
};

export function useSettingsProfile() {
  return useQuery({ queryKey: settingsKeys.profile(), queryFn: () => settingsService.getProfile() });
}

export function useSettingsSessions() {
  return useQuery({ queryKey: settingsKeys.sessions(), queryFn: () => settingsService.listSessions() });
}

export function useSecurityEvents(cursor?: string) {
  return useInfiniteQuery({
    queryKey: settingsKeys.securityEvents(),
    initialPageParam: cursor,
    queryFn: ({ pageParam }) => settingsService.listSecurityEvents(pageParam),
    getNextPageParam: (page) => page.nextCursor ?? undefined
  });
}

export function useSaveSettingsProfile() {
  return useSettingsMutation(({ input, expectedVersion, operationId }: { input: UserProfileInput; expectedVersion: number; operationId: string }) =>
    settingsService.saveProfile(input, expectedVersion, operationId)
  );
}

export function useRevokeSession() {
  return useSettingsMutation(({ sessionId, operationId }: { sessionId: string; operationId: string }) =>
    settingsService.revokeSession(sessionId, operationId)
  );
}

export function useRevokeAllSessions() {
  return useSettingsMutation(({ operationId }: { operationId: string }) => settingsService.revokeAllSessions(operationId));
}

export function usePrivacyRequest() {
  return useSettingsMutation(({ kind, operationId }: { kind: PrivacyRequest['kind']; operationId: string }) =>
    settingsService.requestPrivacyAction(kind, operationId)
  );
}

export function useDeleteLocalData() {
  return useSettingsMutation(({ operationId }: { operationId: string }) => settingsService.deleteLocalData(operationId));
}

function useSettingsMutation<TVariables, TValue>(mutationFn: (variables: TVariables) => Promise<{ value: TValue; affectedScopes: readonly string[] }>) {
  const client = useQueryClient();
  return useMutation({ mutationFn, onSuccess: (result) => invalidateSettingsScopes(client, result.affectedScopes) });
}

export async function invalidateSettingsScopes(client: QueryClient, scopes: readonly string[]) {
  await Promise.all(scopes.map((scope) => invalidateOne(client, scope)));
}

function invalidateOne(client: QueryClient, scope: string) {
  if (scope === 'settings.profile') return client.invalidateQueries({ queryKey: settingsKeys.profile() });
  if (scope === 'settings.sessions') return client.invalidateQueries({ queryKey: settingsKeys.sessions() });
  if (scope === 'settings.local-data') return client.invalidateQueries({ queryKey: settingsKeys.localData() });
  if (scope.startsWith('settings.security-events')) return client.invalidateQueries({ queryKey: ['settings', 'security-events'] });
  if (scope.startsWith('settings.privacy-request.')) return client.invalidateQueries({ queryKey: settingsKeys.privacyRequest(scope.slice('settings.privacy-request.'.length) as PrivacyRequest['kind']) });
  if (scope.startsWith('reports.')) return invalidateReportScopes(client, [scope]);
  if (scope.startsWith('assistant.')) return invalidateAssistantScopes(client, [scope]);
  if (scope.startsWith('notifications.policy')) return client.invalidateQueries({ queryKey: notificationPreferenceKeys.policyProjection() });
  if (scope.startsWith('notifications.')) return invalidateNotificationScopes(client, [scope]);
  return Promise.resolve();
}
