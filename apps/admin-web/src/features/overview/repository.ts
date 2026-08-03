import { apiClient } from "@/core/api/client";
import {
  overviewActivityQuerySchema,
  overviewActivityResponseSchema,
  overviewAnalyticsQueryNormalizer,
  overviewQuerySchema,
  overviewSummaryResponseSchema,
  platformAnalyticsResponseSchema,
  type OverviewActivityQuery,
  type OverviewActivityResponse,
  type OverviewAnalyticsInput,
  type OverviewQuery,
  type OverviewSummaryResponse,
  type PlatformAnalyticsResponse,
} from "./contracts";

function buildOverviewParams(values: OverviewAnalyticsInput): URLSearchParams {
  const params = new URLSearchParams();
  params.set("platform", values.platform);
  params.set("period", values.period);
  params.set("locale", values.locale);
  if (values.scenario) params.set("__scenario", values.scenario);
  if (values.page !== undefined) params.set("page", String(values.page));
  if (values.pageSize !== undefined) params.set("pageSize", String(values.pageSize));
  return params;
}

export interface OverviewRepository {
  getOverviewSummary(input: OverviewQuery): Promise<OverviewSummaryResponse>;
  getPlatformAnalytics(input: OverviewQuery): Promise<PlatformAnalyticsResponse>;
  getOverviewActivity(input: OverviewActivityQuery): Promise<OverviewActivityResponse>;
}

export const overviewRepository: OverviewRepository = {
  async getOverviewSummary(input) {
    const query = overviewQuerySchema.parse(input);
    const params = buildOverviewParams(overviewAnalyticsQueryNormalizer(query));
    return apiClient.get(`/api/v1/admin/overview?${params}`, overviewSummaryResponseSchema);
  },
  async getPlatformAnalytics(input) {
    const query = overviewQuerySchema.parse(input);
    const params = buildOverviewParams(overviewAnalyticsQueryNormalizer(query));
    return apiClient.get(
      `/api/v1/admin/overview/platform-analytics?${params}`,
      platformAnalyticsResponseSchema,
    );
  },
  async getOverviewActivity(input) {
    const query = overviewActivityQuerySchema.parse(input);
    const params = buildOverviewParams({
      platform: query.platform,
      period: query.period,
      locale: query.locale,
      scenario: query.scenario,
      page: query.page,
      pageSize: query.pageSize,
    });
    return apiClient.get(
      `/api/v1/admin/overview/activity?${params}`,
      overviewActivityResponseSchema,
    );
  },
};
