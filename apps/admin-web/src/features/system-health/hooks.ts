"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { AdminRole } from "@/core/permissions/permissions";
import type { HealthStatus, JobActionRequest, JobState, OperationalRange, PlatformScope, ProviderCategory, QueueKey } from "./contracts";
import { systemHealthRepository } from "./repository";

export const phase8SystemHealthQueryKeys = {
  all: ["phase8-system-health"] as const,
  overview: ({
    role,
    range,
    platform,
  }: {
    role: AdminRole;
    range: OperationalRange;
    platform: Extract<PlatformScope, "all" | "ios" | "android">;
  }) => [...phase8SystemHealthQueryKeys.all, role, "overview", range, platform] as const,
  api: (query: { role: AdminRole; range: OperationalRange; platform: Extract<PlatformScope, "all" | "ios" | "android"> }) =>
    [...phase8SystemHealthQueryKeys.all, query.role, "api", query.range, query.platform] as const,
  database: (query: { role: AdminRole; range: OperationalRange; platform: Extract<PlatformScope, "all" | "ios" | "android"> }) =>
    [...phase8SystemHealthQueryKeys.all, query.role, "database", query.range, query.platform] as const,
  storage: (query: { role: AdminRole; range: OperationalRange; platform: Extract<PlatformScope, "all" | "ios" | "android"> }) =>
    [...phase8SystemHealthQueryKeys.all, query.role, "storage", query.range, query.platform] as const,
  providers: (query: {
    role: AdminRole;
    category: ProviderCategory | "all";
    status: HealthStatus | "all";
    platform: Extract<PlatformScope, "all" | "ios" | "android">;
  }) => [...phase8SystemHealthQueryKeys.all, query.role, "providers", query.category, query.status, query.platform] as const,
  queues: (query: { role: AdminRole; range: OperationalRange; platform: Extract<PlatformScope, "all" | "ios" | "android"> }) =>
    [...phase8SystemHealthQueryKeys.all, query.role, "queues", query.range, query.platform] as const,
  runs: (query: { role: AdminRole; queue: QueueKey | "all"; state: JobState | "all"; page: number }) =>
    [...phase8SystemHealthQueryKeys.all, query.role, "runs", query.queue, query.state, query.page] as const,
  run: (query: { role: AdminRole; jobRunId: string }) =>
    [...phase8SystemHealthQueryKeys.all, query.role, "run", query.jobRunId] as const,
  schedules: (query: { role: AdminRole; queue: QueueKey | "all"; page: number }) =>
    [...phase8SystemHealthQueryKeys.all, query.role, "schedules", query.queue, query.page] as const,
};

export function phase8RefetchPolicy({
  documentHidden,
  online,
  actionPending,
}: {
  documentHidden: boolean;
  online: boolean;
  actionPending: boolean;
}) {
  return {
    refetchInterval: documentHidden || !online || actionPending ? false : 60_000,
    refetchIntervalInBackground: false,
  } as const;
}

export function useSystemHealth(role: AdminRole = "super-admin") {
  return useHealthOverview({ role, range: "24h", platform: "all" });
}

export function useHealthOverview({
  role = "super-admin",
  range = "24h",
  platform = "all",
  actionPending = false,
}: {
  role?: AdminRole;
  range?: OperationalRange;
  platform?: "all" | "ios" | "android";
  actionPending?: boolean;
} = {}) {
  return useQuery({
    queryKey: phase8SystemHealthQueryKeys.overview({ role, range, platform }),
    queryFn: () => systemHealthRepository.getHealthOverview({ range, platform }),
    ...phase8RefetchPolicy({
      documentHidden: typeof document === "undefined" ? false : document.hidden,
      online: typeof navigator === "undefined" ? true : navigator.onLine,
      actionPending,
    }),
  });
}

export function useApiMonitoring({
  role = "super-admin",
  range = "24h",
  platform = "all",
  actionPending = false,
}: {
  role?: AdminRole;
  range?: OperationalRange;
  platform?: "all" | "ios" | "android";
  actionPending?: boolean;
} = {}) {
  return useQuery({
    queryKey: phase8SystemHealthQueryKeys.api({ role, range, platform }),
    queryFn: () => systemHealthRepository.getApiMonitoring({ range, platform }),
    ...phase8RefetchPolicy({
      documentHidden: typeof document === "undefined" ? false : document.hidden,
      online: typeof navigator === "undefined" ? true : navigator.onLine,
      actionPending,
    }),
  });
}

export function useDatabaseMonitoring({
  role = "super-admin",
  range = "24h",
  platform = "all",
  actionPending = false,
}: {
  role?: AdminRole;
  range?: OperationalRange;
  platform?: "all" | "ios" | "android";
  actionPending?: boolean;
} = {}) {
  return useQuery({
    queryKey: phase8SystemHealthQueryKeys.database({ role, range, platform }),
    queryFn: () => systemHealthRepository.getDatabaseMonitoring({ range, platform }),
    ...phase8RefetchPolicy({
      documentHidden: typeof document === "undefined" ? false : document.hidden,
      online: typeof navigator === "undefined" ? true : navigator.onLine,
      actionPending,
    }),
  });
}

export function useStorageMonitoring({
  role = "super-admin",
  range = "24h",
  platform = "all",
  actionPending = false,
}: {
  role?: AdminRole;
  range?: OperationalRange;
  platform?: "all" | "ios" | "android";
  actionPending?: boolean;
} = {}) {
  return useQuery({
    queryKey: phase8SystemHealthQueryKeys.storage({ role, range, platform }),
    queryFn: () => systemHealthRepository.getStorageMonitoring({ range, platform }),
    ...phase8RefetchPolicy({
      documentHidden: typeof document === "undefined" ? false : document.hidden,
      online: typeof navigator === "undefined" ? true : navigator.onLine,
      actionPending,
    }),
  });
}

export function useProviderHealth({
  role = "super-admin",
  category = "all",
  status = "all",
  platform = "all",
  actionPending = false,
}: {
  role?: AdminRole;
  category?: ProviderCategory | "all";
  status?: HealthStatus | "all";
  platform?: "all" | "ios" | "android";
  actionPending?: boolean;
} = {}) {
  return useQuery({
    queryKey: phase8SystemHealthQueryKeys.providers({ role, category, status, platform }),
    queryFn: () => systemHealthRepository.listProviderHealth({ category, status, platform }),
    ...phase8RefetchPolicy({
      documentHidden: typeof document === "undefined" ? false : document.hidden,
      online: typeof navigator === "undefined" ? true : navigator.onLine,
      actionPending,
    }),
  });
}

export function useQueueHealth({
  role = "super-admin",
  range = "24h",
  platform = "all",
}: {
  role?: AdminRole;
  range?: OperationalRange;
  platform?: "all" | "ios" | "android";
} = {}) {
  return useQuery({
    queryKey: phase8SystemHealthQueryKeys.queues({ role, range, platform }),
    queryFn: () => systemHealthRepository.listQueueHealth({ range, platform }),
    ...phase8RefetchPolicy({ documentHidden: typeof document === "undefined" ? false : document.hidden, online: typeof navigator === "undefined" ? true : navigator.onLine, actionPending: false }),
  });
}

export function useJobRuns({
  role = "super-admin",
  queue = "all",
  state = "all",
  page = 1,
}: {
  role?: AdminRole;
  queue?: QueueKey | "all";
  state?: JobState | "all";
  page?: number;
} = {}) {
  return useQuery({
    queryKey: phase8SystemHealthQueryKeys.runs({ role, queue, state, page }),
    queryFn: () => systemHealthRepository.listJobRuns({ queue, state, page, pageSize: 25 }),
    ...phase8RefetchPolicy({ documentHidden: typeof document === "undefined" ? false : document.hidden, online: typeof navigator === "undefined" ? true : navigator.onLine, actionPending: false }),
  });
}

export function useJobRun(jobRunId: string, role: AdminRole = "super-admin") {
  return useQuery({
    queryKey: phase8SystemHealthQueryKeys.run({ role, jobRunId }),
    queryFn: () => systemHealthRepository.getJobRun(jobRunId),
    ...phase8RefetchPolicy({ documentHidden: typeof document === "undefined" ? false : document.hidden, online: typeof navigator === "undefined" ? true : navigator.onLine, actionPending: false }),
  });
}

export function useRetryJobRun(jobRunId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationKey: [...phase8SystemHealthQueryKeys.all, "retry", jobRunId],
    mutationFn: (request: JobActionRequest) => systemHealthRepository.retryJobRun(jobRunId, request),
    onSuccess: () => void client.invalidateQueries({ queryKey: phase8SystemHealthQueryKeys.all }),
  });
}

export function useCancelJobRun(jobRunId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationKey: [...phase8SystemHealthQueryKeys.all, "cancel", jobRunId],
    mutationFn: (request: JobActionRequest) => systemHealthRepository.cancelJobRun(jobRunId, request),
    onSuccess: () => void client.invalidateQueries({ queryKey: phase8SystemHealthQueryKeys.all }),
  });
}

export function useScheduledJobs({
  role = "super-admin",
  queue = "all",
  page = 1,
}: {
  role?: AdminRole;
  queue?: QueueKey | "all";
  page?: number;
} = {}) {
  return useQuery({
    queryKey: phase8SystemHealthQueryKeys.schedules({ role, queue, page }),
    queryFn: () => systemHealthRepository.listScheduledJobs({ queue, page, pageSize: 25 }),
    ...phase8RefetchPolicy({ documentHidden: typeof document === "undefined" ? false : document.hidden, online: typeof navigator === "undefined" ? true : navigator.onLine, actionPending: false }),
  });
}

export function useRefreshSystemHealth() {
  const client = useQueryClient();
  return {
    isPending: client.isFetching({ queryKey: phase8SystemHealthQueryKeys.all }) > 0,
    mutate: (_value?: undefined, options?: { onSuccess?: () => void }) => {
      void client.invalidateQueries({ queryKey: phase8SystemHealthQueryKeys.all }).then(() => options?.onSuccess?.());
    },
  };
}
