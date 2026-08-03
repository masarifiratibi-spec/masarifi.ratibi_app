"use client";

import { useQuery, useQueryClient, type QueryKey, type UseQueryOptions } from "@tanstack/react-query";
import { useLockedMutation } from "@/features/foundation/useLockedMutation";
import {
  communicationsRepository,
  type ActionResult,
  type CommunicationsQuery,
  type SupportTicketPage,
  type SupportTicketQuery,
  type TicketActionRequest,
} from "./repository";
import type { AudiencePreview, CommunicationDetail, CommunicationOverview, CommunicationPage } from "./contracts";

type QueryOptions<TData> = Omit<UseQueryOptions<TData, Error, TData, QueryKey>, "enabled" | "queryFn" | "queryKey">;
type ResourceAction<TAction> = { resourceId: string; action: TAction };
type TicketActionVariables = { ticketId: string; action: TicketActionRequest };

const rootKey = ["phase6-communications"] as const;

export const communicationsQueryKeys = {
  support: {
    all: [...rootKey, "support"] as const,
    overview: (filters: CommunicationsQuery) => [...rootKey, "support", "overview", filters] as const,
    tickets: (filters: SupportTicketQuery) => [...rootKey, "support", "tickets", filters] as const,
    ticket: (ticketId: string) => [...rootKey, "support", "tickets", ticketId] as const,
    categories: (filters: CommunicationsQuery) => [...rootKey, "support", "categories", filters] as const,
  },
  feedback: {
    all: [...rootKey, "feedback"] as const,
    list: (filters: CommunicationsQuery) => [...rootKey, "feedback", "list", filters] as const,
    detail: (feedbackId: string) => [...rootKey, "feedback", feedbackId] as const,
    abuse: (filters: CommunicationsQuery) => [...rootKey, "feedback", "abuse", filters] as const,
  },
  content: {
    all: [...rootKey, "content"] as const,
    collection: (collection: string, filters: CommunicationsQuery) => [...rootKey, "content", collection, filters] as const,
    item: (collection: string, contentId: string) => [...rootKey, "content", collection, contentId] as const,
  },
  notifications: {
    all: [...rootKey, "notifications"] as const,
    overview: (filters: CommunicationsQuery) => [...rootKey, "notifications", "overview", filters] as const,
    campaigns: (filters: CommunicationsQuery) => [...rootKey, "notifications", "campaigns", filters] as const,
    campaign: (campaignId: string) => [...rootKey, "notifications", "campaigns", campaignId] as const,
    transactional: (filters: CommunicationsQuery) => [...rootKey, "notifications", "transactional", filters] as const,
    deliveryLogs: (filters: CommunicationsQuery) => [...rootKey, "notifications", "delivery-logs", filters] as const,
  },
} as const;

export const communicationMutationInvalidations = {
  supportTicket: (ticketId: string): QueryKey[] => [
    communicationsQueryKeys.support.all,
    communicationsQueryKeys.support.ticket(ticketId),
  ],
};

export function isEnabledId(id: string, enabled = true): boolean {
  return enabled && id.trim().length > 0;
}

export function ticketActionLockKey(variables: TicketActionVariables): string {
  return `support-ticket:${variables.ticketId}:${variables.action.action}`;
}

function resourceActionLockKey<TAction extends { action: string }>(variables: ResourceAction<TAction>): string {
  return `communications:${variables.resourceId}:${variables.action.action}`;
}

export function useSupportTickets(
  filters: SupportTicketQuery,
  enabled = true,
  options?: QueryOptions<SupportTicketPage>,
) {
  return useQuery({
    queryKey: communicationsQueryKeys.support.tickets(filters),
    queryFn: () => communicationsRepository.getSupportTickets(filters),
    enabled,
    ...options,
  });
}

export function useSupportTicketDetail(ticketId: string, enabled = true, options?: QueryOptions<CommunicationDetail>) {
  return useQuery({
    queryKey: communicationsQueryKeys.support.ticket(ticketId),
    queryFn: () => communicationsRepository.getSupportTicket(ticketId),
    enabled: isEnabledId(ticketId, enabled),
    ...options,
  });
}

export function useSupportOverview(filters: CommunicationsQuery, enabled = true, options?: QueryOptions<CommunicationOverview>) {
  return useQuery({
    queryKey: communicationsQueryKeys.support.overview(filters),
    queryFn: () => communicationsRepository.getSupportOverview(filters),
    enabled,
    ...options,
  });
}

export function useSupportCategories(filters: CommunicationsQuery, enabled = true, options?: QueryOptions<CommunicationPage>) {
  return useQuery({
    queryKey: communicationsQueryKeys.support.categories(filters),
    queryFn: () => communicationsRepository.getSupportCategories(filters),
    enabled,
    ...options,
  });
}

export function useLockedTicketAction() {
  const queryClient = useQueryClient();

  return useLockedMutation({
    lockKey: ticketActionLockKey,
    mutationFn: ({ ticketId, action }: TicketActionVariables) => communicationsRepository.actOnSupportTicket(ticketId, action),
    onSuccess: async (_actionResult: ActionResult, variables: TicketActionVariables) => {
      await Promise.all(
        communicationMutationInvalidations.supportTicket(variables.ticketId).map((queryKey) =>
          queryClient.invalidateQueries({ queryKey }),
        ),
      );
    },
  });
}

export function useTicketAction() {
  return useLockedTicketAction();
}

export function useFeedback(filters: CommunicationsQuery, enabled = true, options?: QueryOptions<CommunicationPage>) {
  return useQuery({
    queryKey: communicationsQueryKeys.feedback.list(filters),
    queryFn: () => communicationsRepository.getFeedback(filters),
    enabled,
    ...options,
  });
}

export function useFeedbackDetail(feedbackId: string, enabled = true, options?: QueryOptions<CommunicationDetail>) {
  return useQuery({
    queryKey: communicationsQueryKeys.feedback.detail(feedbackId),
    queryFn: () => communicationsRepository.getFeedbackDetail(feedbackId),
    enabled: isEnabledId(feedbackId, enabled),
    ...options,
  });
}

export function useAbuseReports(filters: CommunicationsQuery, enabled = true, options?: QueryOptions<CommunicationPage>) {
  return useQuery({
    queryKey: communicationsQueryKeys.feedback.abuse(filters),
    queryFn: () => communicationsRepository.getAbuseReports(filters),
    enabled,
    ...options,
  });
}

export function useFeedbackAction() {
  const queryClient = useQueryClient();

  return useLockedMutation({
    lockKey: resourceActionLockKey,
    mutationFn: ({ resourceId, action }: ResourceAction<TicketActionRequest>) => communicationsRepository.actOnFeedback(resourceId, action),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: communicationsQueryKeys.feedback.all }),
  });
}

export function useContent(collection: string, filters: CommunicationsQuery, enabled = true, options?: QueryOptions<CommunicationPage>) {
  return useQuery({
    queryKey: communicationsQueryKeys.content.collection(collection, filters),
    queryFn: () => communicationsRepository.getContent(collection, filters),
    enabled,
    ...options,
  });
}

export function useContentItem(collection: string, contentId: string, enabled = true, options?: QueryOptions<CommunicationDetail>) {
  return useQuery({
    queryKey: communicationsQueryKeys.content.item(collection, contentId),
    queryFn: () => communicationsRepository.getContentItem(collection, contentId),
    enabled: isEnabledId(contentId, enabled),
    ...options,
  });
}

export function useContentAction(collection: string) {
  const queryClient = useQueryClient();

  return useLockedMutation({
    lockKey: resourceActionLockKey,
    mutationFn: ({ resourceId, action }: ResourceAction<TicketActionRequest>) => communicationsRepository.actOnContent(collection, resourceId, action),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: communicationsQueryKeys.content.all }),
  });
}

export function useTemplates(filters: CommunicationsQuery, enabled = true, options?: QueryOptions<CommunicationPage>) {
  return useQuery({
    queryKey: communicationsQueryKeys.content.collection("templates", filters),
    queryFn: () => communicationsRepository.getTemplates(filters),
    enabled,
    ...options,
  });
}

export function useTransactionalTemplates(filters: CommunicationsQuery, enabled = true, options?: QueryOptions<CommunicationPage>) {
  return useQuery({
    queryKey: communicationsQueryKeys.notifications.transactional(filters),
    queryFn: () => communicationsRepository.getTransactionalTemplates(filters),
    enabled,
    ...options,
  });
}

export function useTemplateAction() {
  const queryClient = useQueryClient();

  return useLockedMutation({
    lockKey: resourceActionLockKey,
    mutationFn: ({ resourceId, action }: ResourceAction<TicketActionRequest>) => communicationsRepository.actOnTemplate(resourceId, action),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: communicationsQueryKeys.content.all }),
  });
}

export function useNotificationOverview(filters: CommunicationsQuery, enabled = true, options?: QueryOptions<CommunicationOverview>) {
  return useQuery({
    queryKey: communicationsQueryKeys.notifications.overview(filters),
    queryFn: () => communicationsRepository.getNotificationOverview(filters),
    enabled,
    ...options,
  });
}

export function useCampaigns(filters: CommunicationsQuery, enabled = true, options?: QueryOptions<CommunicationPage>) {
  return useQuery({
    queryKey: communicationsQueryKeys.notifications.campaigns(filters),
    queryFn: () => communicationsRepository.getCampaigns(filters),
    enabled,
    ...options,
  });
}

export function useCampaignDetail(campaignId: string, enabled = true, options?: QueryOptions<CommunicationDetail>) {
  return useQuery({
    queryKey: communicationsQueryKeys.notifications.campaign(campaignId),
    queryFn: () => communicationsRepository.getCampaign(campaignId),
    enabled: isEnabledId(campaignId, enabled),
    ...options,
  });
}

export function useCampaignAction() {
  const queryClient = useQueryClient();

  return useLockedMutation({
    lockKey: resourceActionLockKey,
    mutationFn: ({ resourceId, action }: ResourceAction<TicketActionRequest>) => communicationsRepository.actOnCampaign(resourceId, action),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: communicationsQueryKeys.notifications.all }),
  });
}

export function useDeliveryLogs(filters: CommunicationsQuery, enabled = true, options?: QueryOptions<CommunicationPage>) {
  return useQuery({
    queryKey: communicationsQueryKeys.notifications.deliveryLogs(filters),
    queryFn: () => communicationsRepository.getDeliveryLogs(filters),
    enabled,
    ...options,
  });
}

export function useAudiencePreview(filters: CommunicationsQuery, enabled = true, options?: QueryOptions<AudiencePreview>) {
  return useQuery({
    queryKey: [...communicationsQueryKeys.notifications.all, "audience-preview", filters],
    queryFn: () => communicationsRepository.previewAudience(filters),
    enabled,
    ...options,
  });
}
