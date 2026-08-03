import { apiClient } from "@/core/api/client";
import {
  aiListQuerySchema,
  aiOverviewQuerySchema,
  aiOverviewSchema,
  aiProvidersPageSchema,
  aiProviderDetailSchema,
  aiModelsPageSchema,
  aiActionResultSchema,
  providerActionRequestSchema,
  aiOperationalPageSchema,
  aiPromptDetailSchema,
  aiOperationalActionRequestSchema,
  apiErrorSchema,
  buildAiQuery,
  safeAiIdSchema,
  type AiListQuery,
  type AiOverviewData,
  type AiOverviewQuery,
  type AiModelSummary,
  type AiProviderDetail,
  type AiProviderSummary,
  type ProviderActionRequest,
  type AiOperationalActionRequest,
  type AiOperationalRecord,
  type AiOperationalResource,
  type AiPromptDetail,
  type AiPagination,
  type AiRegionState,
} from "./contracts";

export { buildAiQuery };

export const AI_BASE_PATH = "/api/v1/admin/ai";

export function encodeAiId(id: string): string {
  return encodeURIComponent(safeAiIdSchema.parse(id));
}

export interface AiRepository {
  probe(): Promise<unknown>;
  getOverview(input: AiOverviewQuery): Promise<AiOverviewData>;
  listProviders(input: AiListQuery): Promise<{ items: AiProviderSummary[]; pagination: AiPagination; region: AiRegionState }>;
  getProvider(id: string): Promise<AiProviderDetail>;
  listModels(input: AiListQuery): Promise<{ items: AiModelSummary[]; pagination: AiPagination; region: AiRegionState }>;
  actOnProvider(id: string, input: ProviderActionRequest): Promise<unknown>;
  actOnModel(id: string, input: AiOperationalActionRequest): Promise<unknown>;
  listOperational(resource: AiOperationalResource, input: AiListQuery): Promise<{ items: AiOperationalRecord[]; pagination: AiPagination; region: AiRegionState }>;
  getPrompt(id: string): Promise<AiPromptDetail>;
  actOnOperational(resource: Exclude<AiOperationalResource, "usage">, id: string, input: AiOperationalActionRequest): Promise<unknown>;
}

export const aiRepository: AiRepository = {
  probe() {
    return apiClient.get(`${AI_BASE_PATH}/probe`, apiErrorSchema);
  },
  getOverview(input) {
    const params = buildAiQuery(aiOverviewQuerySchema, input);
    return apiClient.get(`${AI_BASE_PATH}/overview?${params}`, aiOverviewSchema);
  },
  listProviders(input) {
    const params = buildAiQuery(aiListQuerySchema, input);
    return apiClient.get(`${AI_BASE_PATH}/providers?${params}`, aiProvidersPageSchema);
  },
  getProvider(id) {
    return apiClient.get(`${AI_BASE_PATH}/providers/${encodeAiId(id)}`, aiProviderDetailSchema);
  },
  listModels(input) {
    const params = buildAiQuery(aiListQuerySchema, input);
    return apiClient.get(`${AI_BASE_PATH}/models?${params}`, aiModelsPageSchema);
  },
  actOnProvider(id, input) {
    const request = providerActionRequestSchema.parse(input);
    return apiClient.post(`${AI_BASE_PATH}/providers/${encodeAiId(id)}/actions`, request, aiActionResultSchema);
  },
  actOnModel(id, input) {
    const request = aiOperationalActionRequestSchema.parse(input);
    return apiClient.post(`${AI_BASE_PATH}/models/${encodeAiId(id)}/actions`, request, aiActionResultSchema);
  },
  listOperational(resource, input) {
    const params = buildAiQuery(aiListQuerySchema, input);
    return apiClient.get(`${AI_BASE_PATH}/${resource}?${params}`, aiOperationalPageSchema);
  },
  getPrompt(id) {
    return apiClient.get(`${AI_BASE_PATH}/prompts/${encodeAiId(id)}`, aiPromptDetailSchema);
  },
  actOnOperational(resource, id, input) {
    const request = aiOperationalActionRequestSchema.parse(input);
    return apiClient.post(`${AI_BASE_PATH}/${resource}/${encodeAiId(id)}/actions`, request, aiActionResultSchema);
  },
};

export function aiQuery(input: AiListQuery): URLSearchParams {
  return buildAiQuery(aiListQuerySchema, input);
}
