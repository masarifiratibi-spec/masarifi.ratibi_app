import { z } from "zod";
import type {
  Pagination,
  SafeError,
  ActionResult,
  Platform,
  TicketPriority,
  TicketState,
  ApiError as CommunicationsApiError,
  CommunicationPage,
  CommunicationDetail,
  CommunicationOverview,
  AudiencePreview,
} from "./contracts";

export type { ActionResult } from "./contracts";

export type QueryPrimitive = string | number | boolean | undefined | null;
export type CommunicationsQuery = Record<string, QueryPrimitive>;
type RawApiError = {
  status?: number | string;
  code?: string;
  message?: string;
  correlationId?: string;
  fieldErrors?: Record<string, string[]>;
};

const supportTicketResponseSchema = z.object({
  id: z.string().min(1),
  subject: z.string().min(1),
  status: z.enum(["new", "open", "awaiting_customer", "awaiting_agent", "resolved", "closed"]),
  priority: z.enum(["low", "medium", "high", "urgent"]),
  version: z.number().int().min(1),
  createdAt: z.iso.datetime({ offset: true }),
  updatedAt: z.iso.datetime({ offset: true }),
}).passthrough();

const responseSchemas = {
  supportTicket: supportTicketResponseSchema,
} as const;

export interface SupportTicketQuery extends Pagination {
  search?: string;
  platform?: Platform;
  status?: TicketState;
  priority?: TicketPriority;
  assignedAgent?: string;
  type?: string;
  categoryId?: string;
  appVersion?: string;
  dateFrom?: string;
  dateTo?: string;
  sort?: string;
  sortOrder?: "asc" | "desc";
}

export interface SupportTicketPage {
  tickets: CommunicationDetail[];
  items?: CommunicationDetail[];
  pagination: CommunicationPage["pagination"];
}

export type SupportTicketDetail = CommunicationDetail;

export interface TicketActionRequest {
  action: "assign" | "priority" | "reply" | "note" | "status" | "link" | "resolve" | "dismiss" | "escalate" | "publish" | "retire" | "schedule";
  expectedVersion: number;
  reason?: string;
  assignTo?: string;
  priority?: TicketPriority;
  status?: TicketState;
  message?: string;
  isInternal?: boolean;
}

export class CommunicationsRepository {
  private readonly baseUrl = "/api/v1/admin";

  encodeSearchParams(params: object): string {
    const searchParams = new URLSearchParams();
    
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null && value !== "") {
        searchParams.append(key, String(value));
      }
    }
    
    return searchParams.toString();
  }

  getSupportTicketsQueryKey(params: SupportTicketQuery) {
    return ["phase6-communications", "support-tickets", params];
  }

  getSupportTicketDetailKey(ticketId: string) {
    return ["phase6-communications", "support-tickets", ticketId];
  }

  getFeedbackQueryKey(params: CommunicationsQuery) {
    return ["phase6-communications", "feedback", params];
  }

  getFeedbackDetailKey(feedbackId: string) {
    return ["phase6-communications", "feedback", feedbackId];
  }

  getContentQueryKey(collection: string, params: CommunicationsQuery) {
    return ["phase6-communications", "content", collection, params];
  }

  getContentDetailKey(collection: string, itemId: string) {
    return ["phase6-communications", "content", collection, itemId];
  }

  getCampaignsQueryKey(params: CommunicationsQuery) {
    return ["phase6-communications", "campaigns", params];
  }

  getCampaignDetailKey(campaignId: string) {
    return ["phase6-communications", "campaigns", campaignId];
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const headers = {
      "Content-Type": "application/json",
      ...options.headers,
    };

    try {
      const response = await fetch(url, {
        ...options,
        headers,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({
          status: response.status.toString(),
          code: "UNKNOWN_ERROR",
          message: "Request failed",
          correlationId: "",
        }));
        throw this.parseApiError(errorData);
      }

      return await response.json();
    } catch (error) {
      if (error instanceof Error && "status" in error) {
        throw error;
      }
      throw {
        status: "500",
        code: "NETWORK_ERROR",
        message: "Network request failed",
        correlationId: "",
      } as SafeError;
    }
  }

  parseApiError(errorData: RawApiError): CommunicationsApiError {
    // Sanitize error message to prevent information leakage
    let sanitizedMessage = errorData.message || "An error occurred";
    
    // Remove sensitive information from error messages
    sanitizedMessage = sanitizedMessage
      .replace(/postgresql:\/\/[^@]+@[^\/]+/g, "***DATABASE***")
      .replace(/mongodb:\/\/[^@]+@[^\/]+/g, "***DATABASE***")
      .replace(/password[:=][\s]*[^\s,}]+/gi, "password=***")
      .replace(/secret[:=][\s]*[^\s,}]+/gi, "secret=***")
      .replace(/token[:=][\s]*[^\s,}]+/gi, "token=***")
      .replace(/api[_-]?key[:=][\s]*[^\s,}]+/gi, "api_key=***");

    return {
      status: String(errorData.status || "500") as CommunicationsApiError["status"],
      code: errorData.code || "UNKNOWN_ERROR",
      message: sanitizedMessage,
      correlationId: errorData.correlationId || "",
      fieldErrors: errorData.fieldErrors,
    };
  }

  async validateResponse<TSchemaName extends keyof typeof responseSchemas>(
    payload: unknown,
    schemaName: TSchemaName,
  ): Promise<z.infer<(typeof responseSchemas)[TSchemaName]>> {
    return responseSchemas[schemaName].parse(payload);
  }

  invalidateSupportTicketList(queryClient: { invalidateQueries: (options: { queryKey: readonly unknown[] }) => void }): void {
    queryClient.invalidateQueries({
      queryKey: ["phase6-communications", "support-tickets"],
    });
  }

  invalidateSupportTicketDetail(queryClient: { invalidateQueries: (options: { queryKey: readonly unknown[] }) => void }, ticketId: string): void {
    queryClient.invalidateQueries({
      queryKey: ["phase6-communications", "support-tickets", ticketId],
    });
  }

  invalidateFeedbackList(queryClient: { invalidateQueries: (options: { queryKey: readonly unknown[] }) => void }): void {
    queryClient.invalidateQueries({
      queryKey: ["phase6-communications", "feedback"],
    });
  }

  invalidateContentCollection(queryClient: { invalidateQueries: (options: { queryKey: readonly unknown[] }) => void }, collection: string): void {
    queryClient.invalidateQueries({
      queryKey: ["phase6-communications", "content", collection],
    });
  }

  invalidateCampaigns(queryClient: { invalidateQueries: (options: { queryKey: readonly unknown[] }) => void }): void {
    queryClient.invalidateQueries({
      queryKey: ["phase6-communications", "campaigns"],
    });
  }

  async getSupportTickets(params: SupportTicketQuery): Promise<SupportTicketPage> {
    const queryString = this.encodeSearchParams(params);
    const endpoint = `/support/tickets${queryString ? `?${queryString}` : ""}`;
    
    return this.request(endpoint);
  }

  async getSupportTicket(ticketId: string): Promise<SupportTicketDetail> {
    return this.request(`/support/tickets/${ticketId}`);
  }

  async actOnSupportTicket(
    ticketId: string,
    actionRequest: TicketActionRequest
  ): Promise<ActionResult> {
    return this.request(`/support/tickets/${ticketId}/actions`, {
      method: "POST",
      body: JSON.stringify(actionRequest),
    });
  }

  async getSupportOverview(params: CommunicationsQuery): Promise<CommunicationOverview> {
    const queryString = this.encodeSearchParams(params);
    const endpoint = `/support/overview${queryString ? `?${queryString}` : ""}`;
    
    return this.request(endpoint);
  }

  async getFeedback(params: CommunicationsQuery): Promise<CommunicationPage> {
    const queryString = this.encodeSearchParams(params);
    const endpoint = `/feedback${queryString ? `?${queryString}` : ""}`;
    
    return this.request(endpoint);
  }

  async getFeedbackDetail(feedbackId: string): Promise<CommunicationDetail> {
    return this.request(`/feedback/${feedbackId}`);
  }

  async actOnFeedback(feedbackId: string, actionRequest: TicketActionRequest): Promise<ActionResult> {
    return this.request(`/feedback/${feedbackId}/actions`, {
      method: "POST",
      body: JSON.stringify(actionRequest),
    });
  }

  async getAbuseReports(params: CommunicationsQuery): Promise<CommunicationPage> {
    const queryString = this.encodeSearchParams(params);
    const endpoint = `/feedback/abuse-reports${queryString ? `?${queryString}` : ""}`;
    
    return this.request(endpoint);
  }

  async actOnAbuseReport(reportId: string, actionRequest: TicketActionRequest): Promise<ActionResult> {
    return this.request(`/feedback/abuse-reports/${reportId}/actions`, {
      method: "POST",
      body: JSON.stringify(actionRequest),
    });
  }

  async getContent(collection: string, params: CommunicationsQuery): Promise<CommunicationPage> {
    const queryString = this.encodeSearchParams(params);
    const endpoint = `/content/${collection}${queryString ? `?${queryString}` : ""}`;
    
    return this.request(endpoint);
  }

  async getContentItem(collection: string, itemId: string): Promise<CommunicationDetail> {
    return this.request(`/content/${collection}/${itemId}`);
  }

  async createContent(collection: string, contentDraft: CommunicationsQuery): Promise<ActionResult> {
    return this.request(`/content/${collection}`, {
      method: "POST",
      body: JSON.stringify(contentDraft),
    });
  }

  async actOnContent(collection: string, itemId: string, actionRequest: TicketActionRequest): Promise<ActionResult> {
    return this.request(`/content/${collection}/${itemId}/actions`, {
      method: "POST",
      body: JSON.stringify(actionRequest),
    });
  }

  async getNotificationOverview(params: CommunicationsQuery): Promise<CommunicationOverview> {
    const queryString = this.encodeSearchParams(params);
    const endpoint = `/notifications/overview${queryString ? `?${queryString}` : ""}`;
    
    return this.request(endpoint);
  }

  async getCampaigns(params: CommunicationsQuery): Promise<CommunicationPage> {
    const queryString = this.encodeSearchParams(params);
    const endpoint = `/notifications/campaigns${queryString ? `?${queryString}` : ""}`;
    
    return this.request(endpoint);
  }

  async getCampaign(campaignId: string): Promise<CommunicationDetail> {
    return this.request(`/notifications/campaigns/${campaignId}`);
  }

  async createCampaignDraft(campaignDraft: CommunicationsQuery): Promise<ActionResult> {
    return this.request(`/notifications/campaigns`, {
      method: "POST",
      body: JSON.stringify(campaignDraft),
    });
  }

  async actOnCampaign(campaignId: string, actionRequest: TicketActionRequest): Promise<ActionResult> {
    return this.request(`/notifications/campaigns/${campaignId}/actions`, {
      method: "POST",
      body: JSON.stringify(actionRequest),
    });
  }

  async getDeliveryLogs(params: CommunicationsQuery): Promise<CommunicationPage> {
    const queryString = this.encodeSearchParams(params);
    const endpoint = `/notifications/delivery-logs${queryString ? `?${queryString}` : ""}`;
    
    return this.request(endpoint);
  }

  async getSupportCategories(params: CommunicationsQuery): Promise<CommunicationPage> {
    const queryString = this.encodeSearchParams(params);
    return this.request(`/support/categories${queryString ? `?${queryString}` : ""}`);
  }

  async createSupportCategory(input: CommunicationsQuery): Promise<ActionResult> {
    return this.request("/support/categories", { method: "POST", body: JSON.stringify(input) });
  }

  async actOnSupportCategory(categoryId: string, actionRequest: TicketActionRequest): Promise<ActionResult> {
    return this.request(`/support/categories/${categoryId}/actions`, { method: "POST", body: JSON.stringify(actionRequest) });
  }

  async getTemplates(params: CommunicationsQuery): Promise<CommunicationPage> {
    const queryString = this.encodeSearchParams(params);
    return this.request(`/communications/templates${queryString ? `?${queryString}` : ""}`);
  }

  async getTransactionalTemplates(params: CommunicationsQuery): Promise<CommunicationPage> {
    const queryString = this.encodeSearchParams(params);
    return this.request(`/notifications/transactional${queryString ? `?${queryString}` : ""}`);
  }

  async createTemplate(input: CommunicationsQuery): Promise<ActionResult> {
    return this.request("/communications/templates", { method: "POST", body: JSON.stringify(input) });
  }

  async actOnTemplate(templateId: string, actionRequest: TicketActionRequest): Promise<ActionResult> {
    return this.request(`/communications/templates/${templateId}/actions`, { method: "POST", body: JSON.stringify(actionRequest) });
  }

  async previewAudience(input: CommunicationsQuery): Promise<AudiencePreview> {
    return this.request("/notifications/audience-preview", { method: "POST", body: JSON.stringify(input) });
  }
}

export const communicationsRepository = new CommunicationsRepository();
