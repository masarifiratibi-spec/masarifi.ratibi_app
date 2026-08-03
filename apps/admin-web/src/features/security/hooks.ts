"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSimulatedRole } from "@/core/auth/use-simulated-role";
import { useLockedMutation } from "@/features/foundation/useLockedMutation";
import type { ListQuery, OverviewQuery } from "./contracts";
import { securityRepository } from "./repository";

interface SecurityPageData {
  items: unknown[];
  pagination: {
    page: number;
    pageSize: 25 | 50 | 100;
    totalItems: number;
    totalPages: number;
  };
  region: {
    availability: "available" | "empty" | "partial" | "unavailable" | "forbidden";
    message?: string;
  };
}

export const securityQueryKeys = {
  all: ["phase7-security"] as const,
  overview: (role: string, input: OverviewQuery) => [...securityQueryKeys.all, role, "overview", input] as const,
  list: (role: string, resource: string, input: ListQuery) => [...securityQueryKeys.all, role, resource, input] as const,
  detail: (role: string, resource: string, id: string) => [...securityQueryKeys.all, role, resource, id] as const,
};

export function securityActionLockKey(resource: string, id: string, action: string): string {
  return `phase7:${resource}:${id}:${action}`;
}

export function useSecurityOverview(input: OverviewQuery) {
  const role = useSimulatedRole();
  return useQuery({ queryKey: securityQueryKeys.overview(role, input), queryFn: () => securityRepository.getSecurityOverview(input) });
}

export function useSecurityList(resource: string, input: ListQuery) {
  const role = useSimulatedRole();
  const query = {
    authentication: () => securityRepository.listAuthenticationEvents(input),
    suspicious: () => securityRepository.listSuspiciousActivity(input),
    admins: () => securityRepository.listAdminSecurity(input),
    permissions: () => securityRepository.listPermissionChanges(input),
    supportAccess: () => securityRepository.listSupportAccess(input),
    audit: () => securityRepository.listAuditEvents(input),
    exports: () => securityRepository.listExportRequests(input),
    deletions: () => securityRepository.listDeletionRequests(input),
    retention: () => securityRepository.listRetentionPolicies(input),
  }[resource];
  return useQuery<SecurityPageData>({
    queryKey: securityQueryKeys.list(role, resource, input),
    queryFn: async () => {
      if (!query) throw new Error("unknown security resource");
      return query() as Promise<SecurityPageData>;
    },
    placeholderData: (previous: SecurityPageData | undefined) => previous,
  });
}

export function useSecurityIncident(id: string) {
  const role = useSimulatedRole();
  return useQuery({ queryKey: securityQueryKeys.detail(role, "incident", id), queryFn: () => securityRepository.getSecurityIncident(id), enabled: id.length > 0 });
}

export function useAuditEvent(id: string) {
  const role = useSimulatedRole();
  return useQuery({ queryKey: securityQueryKeys.detail(role, "audit", id), queryFn: () => securityRepository.getAuditEvent(id), enabled: id.length > 0 });
}

export function useExportRequest(id: string) {
  const role = useSimulatedRole();
  return useQuery({ queryKey: securityQueryKeys.detail(role, "export", id), queryFn: () => securityRepository.getExportRequest(id), enabled: id.length > 0 });
}

export function useDeletionRequest(id: string) {
  const role = useSimulatedRole();
  return useQuery({ queryKey: securityQueryKeys.detail(role, "deletion", id), queryFn: () => securityRepository.getDeletionRequest(id), enabled: id.length > 0 });
}

export function useRetentionPolicy(id: string) {
  const role = useSimulatedRole();
  return useQuery({ queryKey: securityQueryKeys.detail(role, "retention", id), queryFn: () => securityRepository.getRetentionPolicy(id), enabled: id.length > 0 });
}

export function useSecurityAction() {
  const client = useQueryClient();
  return useLockedMutation({
    lockKey: ({ resource, id, action }: { resource: string; id: string; action: string; run: () => Promise<unknown> }) =>
      securityActionLockKey(resource, id, action),
    mutationFn: ({ run }) => run(),
    onSuccess: () => client.invalidateQueries({ queryKey: securityQueryKeys.all }),
  });
}
