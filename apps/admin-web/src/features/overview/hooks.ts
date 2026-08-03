"use client";

import { useQuery } from "@tanstack/react-query";
import {
  overviewActivityQuerySchema,
  overviewQuerySchema,
  type OverviewActivityQuery,
  type OverviewQuery,
} from "./contracts";
import { overviewRepository } from "./repository";

export const overviewQueryKeys = {
  all: ["overview"] as const,
  summary: (input: OverviewQuery) => {
    const query = overviewQuerySchema.parse(input);
    return [
      ...overviewQueryKeys.all,
      "summary",
      query.platform,
      query.period,
      query.locale,
      query.scenario ?? null,
    ] as const;
  },
  platformAnalytics: (input: OverviewQuery) => {
    const query = overviewQuerySchema.parse(input);
    return [
      ...overviewQueryKeys.all,
      "platform-analytics",
      query.platform,
      query.period,
      query.locale,
      query.scenario ?? null,
    ] as const;
  },
  activity: (input: OverviewActivityQuery) => {
    const query = overviewActivityQuerySchema.parse(input);
    return [
      ...overviewQueryKeys.all,
      "activity",
      query.platform,
      query.period,
      query.locale,
      query.page,
      query.pageSize,
      query.scenario ?? null,
    ] as const;
  },
};

export function useOverviewSummary(input: OverviewQuery) {
  const query = overviewQuerySchema.parse(input);
  return useQuery({
    queryKey: overviewQueryKeys.summary(query),
    queryFn: () => overviewRepository.getOverviewSummary(query),
  });
}

export function usePlatformAnalytics(input: OverviewQuery) {
  const query = overviewQuerySchema.parse(input);
  return useQuery({
    queryKey: overviewQueryKeys.platformAnalytics(query),
    queryFn: () => overviewRepository.getPlatformAnalytics(query),
  });
}

export function useOverviewActivity(input: OverviewActivityQuery) {
  const queryInput = overviewActivityQuerySchema.parse(input);
  const query = useQuery({
    queryKey: overviewQueryKeys.activity(queryInput),
    queryFn: () => overviewRepository.getOverviewActivity(queryInput),
  });
  return query;
}
