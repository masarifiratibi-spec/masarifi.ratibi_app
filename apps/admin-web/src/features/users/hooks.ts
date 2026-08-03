"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { AdminRole } from "@/core/permissions/permissions";
import { useLockedMutation } from "@/features/foundation/useLockedMutation";
import {
  adminUsersQuerySchema,
  userDetailRequestSchema,
  userDevicesQuerySchema,
  userSessionsQuerySchema,
  type AdminUsersQuery,
  type UserDetailRequest,
  type UserDevicesQuery,
  type UserSessionsQuery,
  type SuspendUserRequest,
  type ReactivateUserRequest,
  type UpdateVerificationRequest,
  type RevokeDeviceRequest,
  type RevokeSessionsRequest,
  type UserBulkActionRequest,
} from "./contracts";
import { usersRepository } from "./repository";

function listScope(query: AdminUsersQuery) {
  const { page, ...scope } = query;
  void page;
  return JSON.stringify(scope);
}

export const usersQueryKeys = {
  all: ["users"] as const,
  list: (input: Partial<AdminUsersQuery>) => [
    ...usersQueryKeys.all,
    "list",
    adminUsersQuerySchema.parse(input),
  ] as const,
  detail: (input: UserDetailRequest) => [
    ...usersQueryKeys.all,
    "detail",
    userDetailRequestSchema.parse(input),
  ] as const,
  devices: (input: UserDevicesQuery) => [
    ...usersQueryKeys.all,
    "devices",
    userDevicesQuerySchema.parse(input),
  ] as const,
  sessions: (input: UserSessionsQuery) => [
    ...usersQueryKeys.all,
    "sessions",
    userSessionsQuerySchema.parse(input),
  ] as const,
};

export const userMutationLockKeys = {
  suspend: (userId: string) => `user:suspend:${userId}`,
  reactivate: (userId: string) => `user:reactivate:${userId}`,
  verification: (userId: string) => `user:verification:${userId}`,
  device: (userId: string, deviceId: string) => `user:device:${userId}:${deviceId}`,
  sessions: (userId: string) => `user:sessions:${userId}`,
  bulk: (action: UserBulkActionRequest["action"], userIds: string[]) =>
    `users:bulk:${action}:${[...userIds].sort().join(",")}`,
};

function useUserInvalidation(userId: string, role: AdminRole) {
  const client = useQueryClient();
  return async () => {
    await Promise.all([
      client.invalidateQueries({ queryKey: [...usersQueryKeys.all, "list"] }),
      client.invalidateQueries({ queryKey: usersQueryKeys.detail({ userId, role }), exact: true }),
      client.invalidateQueries({ queryKey: usersQueryKeys.devices({ userId, role }), exact: true }),
      client.invalidateQueries({ queryKey: usersQueryKeys.sessions({ userId, role }), exact: true }),
    ]);
  };
}

export function useUsers(input: Partial<AdminUsersQuery>) {
  const query = adminUsersQuerySchema.parse(input);
  return useQuery({
    queryKey: usersQueryKeys.list(query),
    queryFn: () => usersRepository.getUsers(query),
    placeholderData: (previous, previousQuery) => {
      const previousInput = previousQuery?.queryKey.at(-1);
      return previousInput && listScope(previousInput as AdminUsersQuery) === listScope(query)
        ? previous
        : undefined;
    },
  });
}

export function useUser(input: UserDetailRequest) {
  const request = userDetailRequestSchema.parse(input);
  return useQuery({
    queryKey: usersQueryKeys.detail(request),
    queryFn: () => usersRepository.getUser(request),
  });
}

export function useUserDevices(input: UserDevicesQuery) {
  const request = userDevicesQuerySchema.parse(input);
  return useQuery({
    queryKey: usersQueryKeys.devices(request),
    queryFn: () => usersRepository.getDevices(request),
  });
}

export function useUserSessions(input: UserSessionsQuery) {
  const request = userSessionsQuerySchema.parse(input);
  return useQuery({
    queryKey: usersQueryKeys.sessions(request),
    queryFn: () => usersRepository.getSessions(request),
  });
}

export function useSuspendUser(userId: string, role: AdminRole) {
  const invalidate = useUserInvalidation(userId, role);
  return useLockedMutation({
    lockKey: () => userMutationLockKeys.suspend(userId),
    mutationFn: (request: SuspendUserRequest) => usersRepository.suspendUser(userId, request, role),
    onSuccess: invalidate,
  });
}

export function useReactivateUser(userId: string, role: AdminRole) {
  const invalidate = useUserInvalidation(userId, role);
  return useLockedMutation({
    lockKey: () => userMutationLockKeys.reactivate(userId),
    mutationFn: (request: ReactivateUserRequest) => usersRepository.reactivateUser(userId, request, role),
    onSuccess: invalidate,
  });
}

export function useUpdateVerification(userId: string, role: AdminRole) {
  const invalidate = useUserInvalidation(userId, role);
  return useLockedMutation({
    lockKey: () => userMutationLockKeys.verification(userId),
    mutationFn: (request: UpdateVerificationRequest) =>
      usersRepository.updateVerification(userId, request, role),
    onSuccess: invalidate,
  });
}

export function useRevokeDevice(userId: string, deviceId: string, role: AdminRole) {
  const invalidate = useUserInvalidation(userId, role);
  return useLockedMutation({
    lockKey: () => userMutationLockKeys.device(userId, deviceId),
    mutationFn: (request: RevokeDeviceRequest) =>
      usersRepository.revokeDevice(userId, deviceId, request, role),
    onSuccess: invalidate,
  });
}

export function useRevokeSessions(userId: string, role: AdminRole) {
  const invalidate = useUserInvalidation(userId, role);
  return useLockedMutation({
    lockKey: () => userMutationLockKeys.sessions(userId),
    mutationFn: (request: RevokeSessionsRequest) =>
      usersRepository.revokeSessions(userId, request, role),
    onSuccess: invalidate,
  });
}

export function useUserBulkAction(role: AdminRole) {
  const client = useQueryClient();
  return useLockedMutation({
    lockKey: (request: UserBulkActionRequest) =>
      userMutationLockKeys.bulk(request.action, request.userIds),
    mutationFn: (request: UserBulkActionRequest) => usersRepository.runBulkAction(request, role),
    onSuccess: async (_result, request) => {
      await client.invalidateQueries({ queryKey: [...usersQueryKeys.all, "list"] });
      await Promise.all(request.userIds.map((userId) =>
        client.invalidateQueries({ queryKey: usersQueryKeys.detail({ userId, role }), exact: true })));
    },
  });
}
