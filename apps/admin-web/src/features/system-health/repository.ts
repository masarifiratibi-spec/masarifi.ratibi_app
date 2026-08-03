import { apiClient } from "@/core/api/client";
import {
  apiMonitoringSchema,
  databaseMonitoringSchema,
  healthOverviewSchema,
  jobRunDetailSchema,
  jobRunIdSchema,
  jobRunsQuerySchema,
  cancelJobResultSchema,
  jobActionRequestSchema,
  paginatedJobRunsSchema,
  providerHealthPageSchema,
  providerHealthQuerySchema,
  queueHealthPageSchema,
  queueHealthQuerySchema,
  refreshHealthResponseSchema,
  retryJobResultSchema,
  scheduledJobsPageSchema,
  scheduledJobsQuerySchema,
  storageMonitoringSchema,
  systemHealthResponseSchema,
  operationalRangeSchema,
  platformScopeSchema,
  type ApiMonitoring,
  type DatabaseMonitoring,
  type HealthOverview,
  type JobRunDetail,
  type JobRunsQuery,
  type JobActionRequest,
  type CancelJobResult,
  type OperationalRange,
  type PaginatedJobRuns,
  type ProviderHealthPage,
  type ProviderHealthQuery,
  type QueueHealthPage,
  type QueueHealthQuery,
  type RetryJobResult,
  type ScheduledJobsPage,
  type ScheduledJobsQuery,
  type StorageMonitoring,
  type SystemHealthResponse,
} from "./contracts";

export interface HealthOverviewQuery {
  range: OperationalRange;
  platform: "all" | "ios" | "android";
  scenario?: string;
}

export type MonitoringQuery = HealthOverviewQuery;

export interface SystemHealthRepository {
  getSystemHealth(scenario?: string): Promise<SystemHealthResponse>;
  getHealthOverview(query: HealthOverviewQuery): Promise<HealthOverview>;
  getApiMonitoring(query: MonitoringQuery): Promise<ApiMonitoring>;
  getDatabaseMonitoring(query: MonitoringQuery): Promise<DatabaseMonitoring>;
  getStorageMonitoring(query: MonitoringQuery): Promise<StorageMonitoring>;
  listProviderHealth(query: ProviderHealthQuery): Promise<ProviderHealthPage>;
  listQueueHealth(query: QueueHealthQuery): Promise<QueueHealthPage>;
  listJobRuns(query: JobRunsQuery): Promise<PaginatedJobRuns>;
  getJobRun(jobRunId: string): Promise<JobRunDetail>;
  retryJobRun(jobRunId: string, request: JobActionRequest): Promise<RetryJobResult>;
  cancelJobRun(jobRunId: string, request: JobActionRequest): Promise<CancelJobResult>;
  listScheduledJobs(query: ScheduledJobsQuery): Promise<ScheduledJobsPage>;
  refresh(): Promise<{ status: "scheduled"; checkedAt: string }>;
}

function monitoringParams(query: MonitoringQuery): string {
  const range = operationalRangeSchema.parse(query.range);
  const platform = platformScopeSchema.extract(["all", "ios", "android"]).parse(query.platform);
  const params = new URLSearchParams({ range, platform });
  if (query.scenario) params.set("__scenario", query.scenario);
  return params.toString();
}

export const systemHealthRepository: SystemHealthRepository = {
  getSystemHealth(scenario) {
    const suffix = scenario ? `?__scenario=${encodeURIComponent(scenario)}` : "";
    return apiClient.get(`/api/v1/admin/system-health${suffix}`, systemHealthResponseSchema);
  },
  getHealthOverview(query) {
    return apiClient.get(`/api/v1/admin/system-health/overview?${monitoringParams(query)}`, healthOverviewSchema);
  },
  getApiMonitoring(query) {
    return apiClient.get(`/api/v1/admin/system-health/api?${monitoringParams(query)}`, apiMonitoringSchema);
  },
  getDatabaseMonitoring(query) {
    return apiClient.get(`/api/v1/admin/system-health/database?${monitoringParams(query)}`, databaseMonitoringSchema);
  },
  getStorageMonitoring(query) {
    return apiClient.get(`/api/v1/admin/system-health/storage?${monitoringParams(query)}`, storageMonitoringSchema);
  },
  listProviderHealth(query) {
    const parsed = providerHealthQuerySchema.parse(query);
    const params = new URLSearchParams({
      category: parsed.category,
      status: parsed.status,
      platform: parsed.platform,
      page: String(parsed.page),
      pageSize: String(parsed.pageSize),
      sort: parsed.sort,
    });
    if (parsed.scenario) params.set("__scenario", parsed.scenario);
    return apiClient.get(`/api/v1/admin/system-health/providers?${params.toString()}`, providerHealthPageSchema);
  },
  listQueueHealth(query) {
    const parsed = queueHealthQuerySchema.parse(query);
    const params = new URLSearchParams({ range: parsed.range, platform: parsed.platform });
    return apiClient.get(`/api/v1/admin/jobs/queues?${params.toString()}`, queueHealthPageSchema);
  },
  listJobRuns(query) {
    const parsed = jobRunsQuerySchema.parse(query);
    const params = new URLSearchParams({
      queue: parsed.queue,
      state: parsed.state,
      page: String(parsed.page),
      pageSize: String(parsed.pageSize),
    });
    if (parsed.search) params.set("search", parsed.search);
    return apiClient.get(`/api/v1/admin/jobs/runs?${params.toString()}`, paginatedJobRunsSchema);
  },
  getJobRun(jobRunId) {
    const parsed = jobRunIdSchema.parse(jobRunId);
    return apiClient.get(`/api/v1/admin/jobs/runs/${encodeURIComponent(parsed)}`, jobRunDetailSchema);
  },
  retryJobRun(jobRunId, request) {
    const parsed = jobRunIdSchema.parse(jobRunId);
    const body = jobActionRequestSchema.parse(request);
    return apiClient.post(`/api/v1/admin/jobs/runs/${encodeURIComponent(parsed)}/retry`, body, retryJobResultSchema);
  },
  cancelJobRun(jobRunId, request) {
    const parsed = jobRunIdSchema.parse(jobRunId);
    const body = jobActionRequestSchema.parse(request);
    return apiClient.post(`/api/v1/admin/jobs/runs/${encodeURIComponent(parsed)}/cancel`, body, cancelJobResultSchema);
  },
  listScheduledJobs(query) {
    const parsed = scheduledJobsQuerySchema.parse(query);
    const params = new URLSearchParams({
      queue: parsed.queue,
      page: String(parsed.page),
      pageSize: String(parsed.pageSize),
    });
    if (parsed.search) params.set("search", parsed.search);
    return apiClient.get(`/api/v1/admin/jobs/scheduled?${params.toString()}`, scheduledJobsPageSchema);
  },
  refresh() {
    return apiClient.post("/api/v1/admin/system-health/refresh", {}, refreshHealthResponseSchema);
  },
};
