"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLockedMutation } from "@/features/foundation/useLockedMutation";
import type { AiListQuery, AiOperationalResource, AiOverviewQuery, PlatformScope } from "./contracts";
import { aiRepository } from "./repository";

export type AiResource =
  | "providers"
  | "models"
  | "prompts"
  | "usage"
  | "failures"
  | "reports"
  | "safety-rules";

export const aiQueryKeys = {
  all: ["phase5-ai"] as const,
  overview: (input: { platform?: PlatformScope; period?: "7d" | "30d" | "90d" }) =>
    [...aiQueryKeys.all, "overview", input] as const,
  list: (resource: AiResource, input: AiListQuery) =>
    [...aiQueryKeys.all, resource, input] as const,
  detail: (resource: Extract<AiResource, "providers" | "prompts">, id: string) =>
    [...aiQueryKeys.all, resource, "detail", id] as const,
};

export function aiActionLockKey(resource: AiResource, id: string, action: string): string {
  return `${resource}:${id}:${action}`;
}

export function useAiOverview(input: AiOverviewQuery) {
  return useQuery({
    queryKey: aiQueryKeys.overview(input),
    queryFn: () => aiRepository.getOverview(input),
    placeholderData: (previous) => previous,
    retry: 1,
  });
}

export function useAiProviders(input: AiListQuery) {
  return useQuery({
    queryKey: aiQueryKeys.list("providers", input),
    queryFn: () => aiRepository.listProviders(input),
    placeholderData: (previous) => previous,
  });
}

export function useAiProvider(id: string) {
  return useQuery({
    queryKey: aiQueryKeys.detail("providers", id),
    queryFn: () => aiRepository.getProvider(id),
    enabled: id.length > 0,
  });
}

export function useAiModels(input: AiListQuery) {
  return useQuery({
    queryKey: aiQueryKeys.list("models", input),
    queryFn: () => aiRepository.listModels(input),
    placeholderData: (previous) => previous,
  });
}

export function useAiOperational(resource: AiOperationalResource, input: AiListQuery) {
  return useQuery({
    queryKey: aiQueryKeys.list(resource, input),
    queryFn: () => aiRepository.listOperational(resource, input),
    placeholderData: (previous) => previous,
  });
}

export function useAiPrompt(id: string) {
  return useQuery({
    queryKey: aiQueryKeys.detail("prompts", id),
    queryFn: () => aiRepository.getPrompt(id),
    enabled: id.length > 0,
  });
}

export interface AiActionVariables {
  resource: AiResource;
  id: string;
  action: string;
  run: () => Promise<unknown>;
}

export function useAiLockedAction() {
  const client = useQueryClient();
  return useLockedMutation({
    lockKey: ({ resource, id, action }: AiActionVariables) => aiActionLockKey(resource, id, action),
    mutationFn: ({ run }: AiActionVariables) => run(),
    onSuccess: (_response, variables) =>
      client.invalidateQueries({ queryKey: [...aiQueryKeys.all, variables.resource] }),
  });
}
