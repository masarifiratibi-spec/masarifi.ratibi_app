"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLockedMutation } from "@/features/foundation/useLockedMutation";
import {
  subscriptionOverviewQuerySchema,
  subscriptionsQuerySchema,
  subscriptionDetailRequestSchema,
  promotionalCodesQuerySchema,
  paymentsOverviewQuerySchema,
  paymentEventsQuerySchema,
  paymentEventDetailRequestSchema,
  failedPaymentsQuerySchema,
  reconciliationQuerySchema,
  type SubscriptionOverviewQuery,
  type SubscriptionsQuery,
  type SubscriptionDetailRequest,
  type SubscriptionActionRequest,
  type PlanMutationRequest,
  type PromotionalCodeMutationRequest,
  type PromotionalCodesQuery,
  type PaymentsOverviewQuery,
  type PaymentEventsQuery,
  type PaymentEventDetailRequest,
  type FailedPaymentsQuery,
  type FailedPaymentActionRequest,
  type ReconciliationQuery,
  type ReconciliationActionRequest,
} from "@/features/billing/contracts";
import { billingRepository } from "./repository";

// ============================================================================
// Query Keys
// ============================================================================

export const billingQueryKeys = {
  // Subscription Overview
  overview: (input: SubscriptionOverviewQuery) => [
    "billing",
    "overview",
    subscriptionOverviewQuerySchema.parse(input),
  ],

  // Subscriptions List
  subscriptions: (input: SubscriptionsQuery) => [
    "billing",
    "subscriptions",
    subscriptionsQuerySchema.parse(input),
  ],

  // Subscription Detail
  subscription: (input: SubscriptionDetailRequest) => [
    "billing",
    "subscription",
    subscriptionDetailRequestSchema.parse(input),
  ],

  // Plans
  plans: () => ["billing", "plans"],

  // Promotional Codes
  promotionalCodes: (input: PromotionalCodesQuery) => [
    "billing",
    "promotionalCodes",
    promotionalCodesQuerySchema.parse(input),
  ],

  // Payments Overview
  paymentsOverview: (input: PaymentsOverviewQuery) => [
    "billing",
    "paymentsOverview",
    paymentsOverviewQuerySchema.parse(input),
  ],

  // Payment Events
  paymentEvents: (input: PaymentEventsQuery) => [
    "billing",
    "paymentEvents",
    paymentEventsQuerySchema.parse(input),
  ],

  // Payment Event Detail
  paymentEvent: (input: PaymentEventDetailRequest) => [
    "billing",
    "paymentEvent",
    paymentEventDetailRequestSchema.parse(input),
  ],

  // Failed Payments
  failedPayments: (input: FailedPaymentsQuery) => [
    "billing",
    "failedPayments",
    failedPaymentsQuerySchema.parse(input),
  ],

  // Reconciliation
  reconciliation: (input: ReconciliationQuery) => [
    "billing",
    "reconciliation",
    reconciliationQuerySchema.parse(input),
  ],
};

// ============================================================================
// Subscription Overview Hook
// ============================================================================

export function useSubscriptionOverview(input: SubscriptionOverviewQuery) {
  const query = subscriptionOverviewQuerySchema.parse(input);
  return useQuery({
    queryKey: billingQueryKeys.overview(query),
    queryFn: () => billingRepository.getSubscriptionOverview(query),
    placeholderData: (previous) => previous,
  });
}

// ============================================================================
// Subscriptions List Hook
// ============================================================================

export function useSubscriptions(input: SubscriptionsQuery) {
  const query = subscriptionsQuerySchema.parse(input);
  return useQuery({
    queryKey: billingQueryKeys.subscriptions(query),
    queryFn: () => billingRepository.getSubscriptions(query),
    placeholderData: (previous, previousQuery) => {
      const previousInput = previousQuery?.queryKey.at(-1);
      if (!previousInput) return undefined;

      const currentInput = query;
      const prevInput = previousInput as SubscriptionsQuery;

      return (
        currentInput.page !== prevInput.page &&
        currentInput.search === prevInput.search &&
        currentInput.platform === prevInput.platform &&
        currentInput.status === prevInput.status
      )
        ? previous
        : undefined;
    },
  });
}

// ============================================================================
// Subscription Detail Hook
// ============================================================================

export function useSubscription(input: SubscriptionDetailRequest) {
  const request = subscriptionDetailRequestSchema.parse(input);
  return useQuery({
    queryKey: billingQueryKeys.subscription(request),
    queryFn: () => billingRepository.getSubscription(request),
  });
}

// ============================================================================
// Subscription Action Hook
// ============================================================================

export const subscriptionMutationLockKeys = {
  action: (subscriptionId: string, action: string) =>
    `subscription:action:${subscriptionId}:${action}`,
};

export function useSubscriptionAction(subscriptionId: string) {
  const client = useQueryClient();

  return useLockedMutation({
    lockKey: (request: SubscriptionActionRequest) =>
      subscriptionMutationLockKeys.action(subscriptionId, request.action),
    mutationFn: (request: SubscriptionActionRequest) =>
      billingRepository.actOnSubscription(subscriptionId, request),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ["billing", "overview"] });
      await client.invalidateQueries({ queryKey: ["billing", "subscriptions"] });
      await client.invalidateQueries({ queryKey: ["billing", "subscription"] });
    },
  });
}

// ============================================================================
// Plans Hooks
// ============================================================================

export function usePlans() {
  return useQuery({
    queryKey: billingQueryKeys.plans(),
    queryFn: () => billingRepository.getPlans(),
  });
}

export function useUpdatePlan(planId: string) {
  const client = useQueryClient();

  return useLockedMutation({
    lockKey: () => `plan:update:${planId}`,
    mutationFn: (request: PlanMutationRequest) =>
      billingRepository.updatePlan(planId, request),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ["billing", "plans"] });
    },
  });
}

// ============================================================================
// Promotional Codes Hooks
// ============================================================================

export function usePromotionalCodes(input: PromotionalCodesQuery) {
  const query = promotionalCodesQuerySchema.parse(input);
  return useQuery({
    queryKey: billingQueryKeys.promotionalCodes(query),
    queryFn: () => billingRepository.getPromotionalCodes(query),
  });
}

export function useCreatePromotionalCode() {
  const client = useQueryClient();

  return useLockedMutation({
    lockKey: () => "promotionalCode:create",
    mutationFn: (request: PromotionalCodeMutationRequest) =>
      billingRepository.createPromotionalCode(request),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ["billing", "promotionalCodes"] });
    },
  });
}

export function useUpdatePromotionalCode(codeId: string) {
  const client = useQueryClient();

  return useLockedMutation({
    lockKey: () => `promotionalCode:update:${codeId}`,
    mutationFn: (request: PromotionalCodeMutationRequest) =>
      billingRepository.updatePromotionalCode(codeId, request),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ["billing", "promotionalCodes"] });
    },
  });
}

// ============================================================================
// Payments Overview Hook
// ============================================================================

export function usePaymentsOverview(input: PaymentsOverviewQuery) {
  const query = paymentsOverviewQuerySchema.parse(input);
  return useQuery({
    queryKey: billingQueryKeys.paymentsOverview(query),
    queryFn: () => billingRepository.getPaymentsOverview(query),
    placeholderData: (previous) => previous,
  });
}

// ============================================================================
// Payment Events Hooks
// ============================================================================

export function usePaymentEvents(input: PaymentEventsQuery) {
  const query = paymentEventsQuerySchema.parse(input);
  return useQuery({
    queryKey: billingQueryKeys.paymentEvents(query),
    queryFn: () => billingRepository.getPaymentEvents(query),
    placeholderData: (previous, previousQuery) => {
      const previousInput = previousQuery?.queryKey.at(-1);
      if (!previousInput) return undefined;

      const currentInput = query;
      const prevInput = previousInput as PaymentEventsQuery;

      return (
        currentInput.page !== prevInput.page &&
        currentInput.search === prevInput.search &&
        currentInput.platform === prevInput.platform &&
        currentInput.status === prevInput.status
      )
        ? previous
        : undefined;
    },
  });
}

export function usePaymentEvent(input: PaymentEventDetailRequest) {
  const request = paymentEventDetailRequestSchema.parse(input);
  return useQuery({
    queryKey: billingQueryKeys.paymentEvent(request),
    queryFn: () => billingRepository.getPaymentEvent(request),
  });
}

// ============================================================================
// Failed Payments Hooks
// ============================================================================

export function useFailedPayments(input: FailedPaymentsQuery) {
  const query = failedPaymentsQuerySchema.parse(input);
  return useQuery({
    queryKey: billingQueryKeys.failedPayments(query),
    queryFn: () => billingRepository.getFailedPayments(query),
    placeholderData: (previous, previousQuery) => {
      const previousInput = previousQuery?.queryKey.at(-1);
      if (!previousInput) return undefined;

      const currentInput = query;
      const prevInput = previousInput as FailedPaymentsQuery;

      return (
        currentInput.page !== prevInput.page &&
        currentInput.platform === prevInput.platform &&
        currentInput.status === prevInput.status
      )
        ? previous
        : undefined;
    },
  });
}

export const failedPaymentMutationLockKeys = {
  action: (failureId: string, action: string) =>
    `failedPayment:action:${failureId}:${action}`,
};

export function useFailedPaymentAction(failureId: string) {
  const client = useQueryClient();

  return useLockedMutation({
    lockKey: (request: FailedPaymentActionRequest) =>
      failedPaymentMutationLockKeys.action(failureId, request.action),
    mutationFn: (request: FailedPaymentActionRequest) =>
      billingRepository.actOnFailedPayment(failureId, request),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ["billing", "failedPayments"] });
      await client.invalidateQueries({ queryKey: ["billing", "paymentsOverview"] });
    },
  });
}

// ============================================================================
// Reconciliation Hooks
// ============================================================================

export function useReconciliationIssues(input: ReconciliationQuery) {
  const query = reconciliationQuerySchema.parse(input);
  return useQuery({
    queryKey: billingQueryKeys.reconciliation(query),
    queryFn: () => billingRepository.getReconciliationIssues(query),
    placeholderData: (previous, previousQuery) => {
      const previousInput = previousQuery?.queryKey.at(-1);
      if (!previousInput) return undefined;

      const currentInput = query;
      const prevInput = previousInput as ReconciliationQuery;

      return (
        currentInput.page !== prevInput.page &&
        currentInput.platform === prevInput.platform &&
        currentInput.severity === prevInput.severity &&
        currentInput.status === prevInput.status
      )
        ? previous
        : undefined;
    },
  });
}

export const reconciliationMutationLockKeys = {
  action: (issueId: string, decision: string) =>
    `reconciliation:action:${issueId}:${decision}`,
};

export function useReconciliationAction(issueId: string) {
  const client = useQueryClient();

  return useLockedMutation({
    lockKey: (request: ReconciliationActionRequest) =>
      reconciliationMutationLockKeys.action(issueId, request.decision),
    mutationFn: (request: ReconciliationActionRequest) =>
      billingRepository.actOnReconciliationIssue(issueId, request),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ["billing", "reconciliation"] });
      await client.invalidateQueries({ queryKey: ["billing", "paymentsOverview"] });
    },
  });
}
