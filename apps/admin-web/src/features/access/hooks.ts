"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiError } from "@/core/api/errors";
import type { AdminRole } from "@/core/permissions/permissions";
import { SIMULATED_ACTORS } from "@/core/permissions/role-map";
import { useLockedMutation } from "@/features/foundation/useLockedMutation";
import {
  accessRequestsQuerySchema,
  type AccessDecisionRequest,
  type AccessRequestsQuery,
  type CreateAccessRequest,
  type EndTemporaryAccessRequest,
  type RevokeAccessRequest,
} from "./contracts";
import { accessRepository } from "./repository";

export const accessQueryKeys = {
  all: ["access"] as const,
  list: (input: Partial<AccessRequestsQuery>, role: AdminRole = "super-admin") =>
    [...accessQueryKeys.all, "list", accessRequestsQuerySchema.parse(input), role] as const,
  detail: (requestId: string, role: AdminRole) =>
    [...accessQueryKeys.all, "detail", requestId, role] as const,
  workspaces: () => [...accessQueryKeys.all, "workspace"] as const,
  workspace: (requestId: string, actor: string, scenario?: string) =>
    [...accessQueryKeys.workspaces(), requestId, actor, scenario ?? "default"] as const,
};

export function millisecondsUntilExpiry(expiresAt: string, now = new Date()): number {
  return Math.max(0, new Date(expiresAt).getTime() - now.getTime());
}

export function isTerminalWorkspaceError(error: unknown): boolean {
  return error instanceof ApiError
    && ["forbidden", "session_expired", "gone", "conflict", "not_found"].includes(error.code);
}

export function useAccessRequests(input: Partial<AccessRequestsQuery>, role: AdminRole) {
  const query = accessRequestsQuerySchema.parse(input);
  return useQuery({
    queryKey: accessQueryKeys.list(query, role),
    queryFn: () => accessRepository.listRequests(query, role),
  });
}

export function useAccessRequest(requestId: string, role: AdminRole) {
  return useQuery({
    queryKey: accessQueryKeys.detail(requestId, role),
    queryFn: () => accessRepository.getRequest(requestId, role),
  });
}

export function useCreateAccessRequest(role: AdminRole) {
  const client = useQueryClient();
  return useLockedMutation({
    lockKey: (request: CreateAccessRequest) => `create-access:${request.userId}:${request.supportTicketId}:${request.assignee}`,
    mutationFn: (request: CreateAccessRequest) => accessRepository.createRequest(request, role),
    onSuccess: () => client.invalidateQueries({ queryKey: accessQueryKeys.all }),
  });
}

export function useDecideAccessRequest(requestId: string, role: AdminRole) {
  const client = useQueryClient();
  return useLockedMutation({
    lockKey: () => `decide-access:${requestId}`,
    mutationFn: (request: AccessDecisionRequest) => accessRepository.decideRequest(requestId, request, role),
    onSuccess: () => client.invalidateQueries({ queryKey: accessQueryKeys.all }),
  });
}

export function useRevokeAccessRequest(requestId: string, role: AdminRole) {
  const client = useQueryClient();
  return useLockedMutation({
    lockKey: () => `revoke-access:${requestId}`,
    mutationFn: (request: RevokeAccessRequest) => accessRepository.revokeRequest(requestId, request, role),
    onSuccess: async () => {
      await client.cancelQueries({ queryKey: accessQueryKeys.workspaces() });
      client.removeQueries({ queryKey: accessQueryKeys.workspaces() });
      await client.invalidateQueries({ queryKey: accessQueryKeys.all });
    },
  });
}

export function useTemporaryWorkspace(requestId: string, role: AdminRole, scenario?: string) {
  const client = useQueryClient();
  const actor = SIMULATED_ACTORS[role];
  const key = useMemo(() => accessQueryKeys.workspace(requestId, actor, scenario), [actor, requestId, scenario]);
  const [expired, setExpired] = useState(false);
  const query = useQuery({
    queryKey: key,
    queryFn: () => accessRepository.getWorkspace(requestId, role, scenario),
    enabled: !expired,
    retry: false,
    refetchOnWindowFocus: true,
  });
  const terminalError = isTerminalWorkspaceError(query.error);
  const workspace = query.data;
  const refetchWorkspace = query.refetch;

  useEffect(() => {
    if (!workspace) return;
    const expire = () => {
      setExpired(true);
      void client.cancelQueries({ queryKey: key });
      client.removeQueries({ queryKey: key });
    };
    const timeout = window.setTimeout(expire, millisecondsUntilExpiry(workspace.expiresAt));
    const recheck = () => {
      if (millisecondsUntilExpiry(workspace.expiresAt) === 0) expire();
      else void refetchWorkspace();
    };
    window.addEventListener("focus", recheck);
    document.addEventListener("visibilitychange", recheck);
    return () => {
      window.clearTimeout(timeout);
      window.removeEventListener("focus", recheck);
      document.removeEventListener("visibilitychange", recheck);
      void client.cancelQueries({ queryKey: key });
      client.removeQueries({ queryKey: key });
    };
  }, [client, key, refetchWorkspace, workspace]);

  useEffect(() => {
    if (!terminalError) return;
    void client.cancelQueries({ queryKey: key });
    client.removeQueries({ queryKey: key });
  }, [client, key, terminalError]);

  return { ...query, data: expired || terminalError ? undefined : query.data, expired };
}

export function useEndTemporaryAccess(requestId: string, role: AdminRole) {
  const client = useQueryClient();
  return useLockedMutation({
    lockKey: () => `end-access:${requestId}`,
    mutationFn: (request: EndTemporaryAccessRequest) => accessRepository.endAccess(requestId, request, role),
    onSuccess: async () => {
      await client.cancelQueries({ queryKey: accessQueryKeys.workspaces() });
      client.removeQueries({ queryKey: accessQueryKeys.workspaces() });
      await client.invalidateQueries({ queryKey: accessQueryKeys.all });
    },
  });
}
