"use client";

import { useQuery } from "@tanstack/react-query";
import type { AdminRole } from "@/core/permissions/permissions";
import type { AttentionQuery, GlobalSearchQuery } from "./contracts";
import { foundationRepository } from "./repository";
import { ApiError, safeApiMessage } from "@/core/api/errors";
import { isSessionExpired } from "@/core/auth/session";

export const foundationQueryKeys = {
  all: ["foundation"] as const,
  session: () => [...foundationQueryKeys.all, "session"] as const,
  navigation: (role: AdminRole) => [...foundationQueryKeys.all, "navigation", role] as const,
  attention: (role: AdminRole, input: AttentionQuery) =>
    [...foundationQueryKeys.all, "attention", role, input] as const,
  search: (role: AdminRole, input: GlobalSearchQuery) =>
    [...foundationQueryKeys.all, "search", role, input] as const,
  platformOptions: () => [...foundationQueryKeys.all, "platform-options"] as const,
};

export function useAdminSession() {
  return useQuery({
    queryKey: foundationQueryKeys.session(),
    queryFn: () => foundationRepository.getSession(),
    select: (session) => {
      if (isSessionExpired(session.expiresAt)) {
        throw new ApiError("session_expired", safeApiMessage("session_expired"), 401);
      }
      return session;
    },
  });
}

export function useAdminNavigation(role: AdminRole) {
  return useQuery({
    queryKey: foundationQueryKeys.navigation(role),
    queryFn: () => foundationRepository.getNavigation(role),
  });
}

export function useAttention(role: AdminRole, input: AttentionQuery = { page: 1, pageSize: 10 }) {
  return useQuery({
    queryKey: foundationQueryKeys.attention(role, input),
    queryFn: () => foundationRepository.getAttention(role, input),
  });
}

export function useGlobalSearch(role: AdminRole, input: GlobalSearchQuery, enabled = true) {
  return useQuery({
    queryKey: foundationQueryKeys.search(role, input),
    queryFn: () => foundationRepository.search(role, input),
    enabled,
  });
}

export function usePlatformOptions() {
  return useQuery({
    queryKey: foundationQueryKeys.platformOptions(),
    queryFn: () => foundationRepository.getPlatformOptions(),
    staleTime: Infinity,
  });
}
