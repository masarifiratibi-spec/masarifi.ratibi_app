import { apiClient } from "@/core/api/client";
import { z } from "zod";
import {
  subscriptionOverviewSchema,
  subscriptionOverviewQuerySchema,
  subscriptionsQuerySchema,
  subscriptionsPageSchema,
  subscriptionDetailRequestSchema,
  subscriptionDetailSchema,
  subscriptionActionRequestSchema,
  billingActionResultSchema,
  planMutationRequestSchema,
  planDetailSchema,
  promotionalCodeMutationRequestSchema,
  promotionalCodeDetailSchema,
  promotionalCodesQuerySchema,
  promotionalCodesPageSchema,
  paymentsOverviewQuerySchema,
  paymentsOverviewSchema,
  paymentEventsQuerySchema,
  paymentEventsPageSchema,
  paymentEventDetailRequestSchema,
  paymentEventDetailSchema,
  failedPaymentsQuerySchema,
  failedPaymentsPageSchema,
  failedPaymentActionRequestSchema,
  reconciliationQuerySchema,
  reconciliationPageSchema,
  reconciliationActionRequestSchema,
  safeIdSchema,
  type SubscriptionOverviewQuery,
  type SubscriptionOverview,
  type SubscriptionsQuery,
  type SubscriptionsPage,
  type SubscriptionDetailRequest,
  type SubscriptionDetail,
  type SubscriptionActionRequest,
  type BillingActionResult,
  type PlanMutationRequest,
  type PlanDetail,
  type PromotionalCodeMutationRequest,
  type PromotionalCodeDetail,
  type PromotionalCodesQuery,
  type PromotionalCodesPage,
  type PaymentsOverviewQuery,
  type PaymentsOverview,
  type PaymentEventsQuery,
  type PaymentEventsPage,
  type PaymentEventDetailRequest,
  type PaymentEventDetail,
  type FailedPaymentsQuery,
  type FailedPaymentsPage,
  type FailedPaymentActionRequest,
  type ReconciliationQuery,
  type ReconciliationPage,
  type ReconciliationActionRequest,
} from "@/features/billing/contracts";

export interface BillingRepository {
  // Subscription Overview
  getSubscriptionOverview(input: SubscriptionOverviewQuery): Promise<SubscriptionOverview>;

  // Subscriptions List
  getSubscriptions(input: SubscriptionsQuery): Promise<SubscriptionsPage>;
  
  // Subscription Detail
  getSubscription(input: SubscriptionDetailRequest): Promise<SubscriptionDetail>;
  
  // Subscription Actions
  actOnSubscription(subscriptionId: string, input: SubscriptionActionRequest): Promise<BillingActionResult>;

  // Plans
  getPlans(): Promise<PlanDetail[]>;
  updatePlan(planId: string, input: PlanMutationRequest): Promise<PlanDetail>;

  // Promotional Codes
  getPromotionalCodes(input: PromotionalCodesQuery): Promise<PromotionalCodesPage>;
  createPromotionalCode(input: PromotionalCodeMutationRequest): Promise<PromotionalCodeDetail>;
  updatePromotionalCode(codeId: string, input: PromotionalCodeMutationRequest): Promise<PromotionalCodeDetail>;

  // Payments Overview
  getPaymentsOverview(input: PaymentsOverviewQuery): Promise<PaymentsOverview>;

  // Payment Events
  getPaymentEvents(input: PaymentEventsQuery): Promise<PaymentEventsPage>;
  getPaymentEvent(input: PaymentEventDetailRequest): Promise<PaymentEventDetail>;

  // Failed Payments
  getFailedPayments(input: FailedPaymentsQuery): Promise<FailedPaymentsPage>;
  actOnFailedPayment(failureId: string, input: FailedPaymentActionRequest): Promise<BillingActionResult>;

  // Reconciliation
  getReconciliationIssues(input: ReconciliationQuery): Promise<ReconciliationPage>;
  actOnReconciliationIssue(issueId: string, input: ReconciliationActionRequest): Promise<BillingActionResult>;
}

function buildQueryString(params: Record<string, unknown>): string {
  const cleanParams = Object.fromEntries(
    Object.entries(params)
      .filter(([, value]) => value !== undefined && value !== null)
      .map(([key, value]) => [key === "scenario" ? "__scenario" : key, String(value)])
  );
  return new URLSearchParams(cleanParams).toString();
}

export const billingRepository: BillingRepository = {
  // Subscription Overview
  getSubscriptionOverview(input) {
    const query = subscriptionOverviewQuerySchema.parse(input);
    const params = buildQueryString(query);
    return apiClient.get(`/api/v1/admin/billing/subscriptions/overview?${params}`, subscriptionOverviewSchema);
  },

  // Subscriptions List
  getSubscriptions(input) {
    const query = subscriptionsQuerySchema.parse(input);
    const params = buildQueryString(query);
    return apiClient.get(`/api/v1/admin/billing/subscriptions?${params}`, subscriptionsPageSchema);
  },

  // Subscription Detail
  getSubscription(input) {
    const request = subscriptionDetailRequestSchema.parse(input);
    const params = buildQueryString(request);
    return apiClient.get(`/api/v1/admin/billing/subscriptions/${request.subscriptionId}?${params}`, subscriptionDetailSchema);
  },

  // Subscription Actions
  actOnSubscription(subscriptionId, input) {
    const safeId = safeIdSchema.parse(subscriptionId);
    const request = subscriptionActionRequestSchema.parse(input);
    return apiClient.post(
      `/api/v1/admin/billing/subscriptions/${safeId}/action`,
      request,
      billingActionResultSchema,
    );
  },

  // Plans
  getPlans() {
    return apiClient.get("/api/v1/admin/billing/plans", z.array(planDetailSchema));
  },

  updatePlan(planId, input) {
    const safeId = safeIdSchema.parse(planId);
    const request = planMutationRequestSchema.parse(input);
    return apiClient.post(
      `/api/v1/admin/billing/plans/${safeId}`,
      request,
      planDetailSchema,
    );
  },

  // Promotional Codes
  getPromotionalCodes(input) {
    const query = promotionalCodesQuerySchema.parse(input);
    const params = buildQueryString(query);
    return apiClient.get(`/api/v1/admin/billing/promotional-codes?${params}`, promotionalCodesPageSchema);
  },

  createPromotionalCode(input) {
    const request = promotionalCodeMutationRequestSchema.parse(input);
    return apiClient.post(
      "/api/v1/admin/billing/promotional-codes",
      request,
      promotionalCodeDetailSchema,
    );
  },

  updatePromotionalCode(codeId, input) {
    const safeId = safeIdSchema.parse(codeId);
    const request = promotionalCodeMutationRequestSchema.parse(input);
    return apiClient.post(
      `/api/v1/admin/billing/promotional-codes/${safeId}`,
      request,
      promotionalCodeDetailSchema,
    );
  },

  // Payments Overview
  getPaymentsOverview(input) {
    const query = paymentsOverviewQuerySchema.parse(input);
    const params = buildQueryString(query);
    return apiClient.get(`/api/v1/admin/billing/payments/overview?${params}`, paymentsOverviewSchema);
  },

  // Payment Events
  getPaymentEvents(input) {
    const query = paymentEventsQuerySchema.parse(input);
    const params = buildQueryString(query);
    return apiClient.get(`/api/v1/admin/billing/payment-events?${params}`, paymentEventsPageSchema);
  },

  getPaymentEvent(input) {
    const request = paymentEventDetailRequestSchema.parse(input);
    const params = buildQueryString(request);
    return apiClient.get(
      `/api/v1/admin/billing/payment-events/${request.eventId}?${params}`,
      paymentEventDetailSchema,
    );
  },

  // Failed Payments
  getFailedPayments(input) {
    const query = failedPaymentsQuerySchema.parse(input);
    const params = buildQueryString(query);
    return apiClient.get(`/api/v1/admin/billing/failed-payments?${params}`, failedPaymentsPageSchema);
  },

  actOnFailedPayment(failureId, input) {
    const safeId = safeIdSchema.parse(failureId);
    const request = failedPaymentActionRequestSchema.parse(input);
    return apiClient.post(
      `/api/v1/admin/billing/failed-payments/${safeId}/action`,
      request,
      billingActionResultSchema,
    );
  },

  // Reconciliation
  getReconciliationIssues(input) {
    const query = reconciliationQuerySchema.parse(input);
    const params = buildQueryString(query);
    return apiClient.get(`/api/v1/admin/billing/reconciliation?${params}`, reconciliationPageSchema);
  },

  actOnReconciliationIssue(issueId, input) {
    const safeId = safeIdSchema.parse(issueId);
    const request = reconciliationActionRequestSchema.parse(input);
    return apiClient.post(
      `/api/v1/admin/billing/reconciliation/${safeId}/action`,
      request,
      billingActionResultSchema,
    );
  },
};
