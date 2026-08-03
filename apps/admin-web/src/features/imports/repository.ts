import { apiClient } from "@/core/api/client";
import {
  buildListQuery,
  importOverviewSchema,
  importSessionDetailSchema,
  importsQuerySchema,
  importsResponseSchema,
  listQuerySchema,
  operationalListSchema,
  operationalRecordSchema,
  phase4ActionRequestSchema,
  phase4ActionResultSchema,
  retryImportResponseSchema,
  safeIdSchema,
  type ImportOverview,
  type ImportSessionDetail,
  type ImportsQuery,
  type ImportsResponse,
  type ListQuery,
  type OperationalList,
  type OperationalRecord,
  type Phase4ActionRequest,
  type Phase4ActionResult,
  type Phase4Resource,
  type PlatformScope,
} from "./contracts";

export interface ImportsRepository {
  getImports(input: ImportsQuery): Promise<ImportsResponse>;
  retryImport(id: string, scenario?: string): Promise<{ id: string; status: "scheduled"; auditEvent: "admin.import.retry.requested" }>;
}

const resourcePaths: Record<Phase4Resource, string> = {
  sessions: "/api/v1/admin/imports/sessions",
  failures: "/api/v1/admin/imports/failures",
  "low-confidence": "/api/v1/admin/imports/low-confidence",
  duplicates: "/api/v1/admin/imports/duplicates",
  unsupported: "/api/v1/admin/imports/unsupported-formats",
  banks: "/api/v1/admin/parsers/banks",
  senders: "/api/v1/admin/parsers/senders",
  "parser-rules": "/api/v1/admin/parsers/rules",
  "test-cases": "/api/v1/admin/parsers/test-cases",
  versions: "/api/v1/admin/parsers/versions",
  "merchant-rules": "/api/v1/admin/parsers/merchant-rules",
  "category-rules": "/api/v1/admin/parsers/category-rules",
};

function actionPath(
  resource: Phase4Resource,
  id: string,
  action: Phase4ActionRequest["action"],
): string {
  const encodedId = encodeURIComponent(safeIdSchema.parse(id));
  if (resource === "sessions") return `${resourcePaths.sessions}/${encodedId}/retry-handoff`;
  if (resource === "low-confidence") return `${resourcePaths[resource]}/${encodedId}/review`;
  if (resource === "duplicates") return `${resourcePaths[resource]}/${encodedId}/resolve`;
  if (resource === "parser-rules" && action === "test") {
    return `${resourcePaths[resource]}/${encodedId}/test-preview`;
  }
  return `${resourcePaths[resource]}/${encodedId}/action`;
}

export const importsRepository: ImportsRepository = {
  getImports(input) {
    const query = importsQuerySchema.parse(input);
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== "") params.set(key === "scenario" ? "__scenario" : key, String(value));
    }
    return apiClient.get(`/api/v1/admin/imports?${params}`, importsResponseSchema);
  },
  retryImport(id, scenario) {
    const params = scenario ? `?__scenario=${encodeURIComponent(scenario)}` : "";
    return apiClient.post(
      `/api/v1/admin/imports/${encodeURIComponent(safeIdSchema.parse(id))}/retry${params}`,
      phase4ActionRequestSchema.parse({
        action: "retry_handoff",
        expectedState: "failed",
        expectedRevision: 1,
        reason: "إعادة محاولة مؤكدة من واجهة الإدارة التجريبية",
        confirmationToken: "CONFIRM-SPEC-005",
      }),
      retryImportResponseSchema,
    );
  },
};

export const phase4Repository = {
  getOverview(platform: PlatformScope): Promise<ImportOverview> {
    const parsedPlatform = platform === "unknown" ? "all" : platform;
    return apiClient.get(
      `/api/v1/admin/imports/overview?platform=${encodeURIComponent(parsedPlatform)}`,
      importOverviewSchema,
    );
  },

  list(resource: Phase4Resource, input: ListQuery): Promise<OperationalList> {
    const params = buildListQuery(listQuerySchema, input);
    return apiClient.get(`${resourcePaths[resource]}?${params}`, operationalListSchema);
  },

  getDetail(
    resource: Extract<Phase4Resource, "sessions" | "banks" | "parser-rules">,
    id: string,
  ): Promise<ImportSessionDetail | OperationalRecord> {
    const encodedId = encodeURIComponent(safeIdSchema.parse(id));
    const schema = resource === "sessions" ? importSessionDetailSchema : operationalRecordSchema;
    return apiClient.get(`${resourcePaths[resource]}/${encodedId}`, schema);
  },

  act(
    resource: Phase4Resource,
    id: string,
    input: Phase4ActionRequest,
  ): Promise<Phase4ActionResult> {
    const request = phase4ActionRequestSchema.parse(input);
    return apiClient.post(
      actionPath(resource, id, request.action),
      request,
      phase4ActionResultSchema,
    );
  },
};
