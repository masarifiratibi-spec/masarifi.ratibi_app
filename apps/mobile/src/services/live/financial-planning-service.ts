import { Platform } from 'react-native';
import { z } from 'zod';

import { getCurrencyMinorUnitScale } from '@/domain/currencies';
import { safeMinorSum } from '@/domain/core-finance';
import {
  localDateInTimeZone,
  localDateTimeInstant
} from '@/domain/financial-period';
import { usePreferenceStore } from '@/state/preferences';
import {
  available,
  daysBetween,
  deriveObligationStatus,
  FinancialPlanningError,
  money,
  unavailable,
  type Budget,
  type BudgetProgress,
  type CategoryBudget,
  type GoalMovement,
  type LocalDate,
  type Obligation,
  type ObligationPayment,
  type ObligationScheduleItem,
  type PaymentMatch,
  type SalaryCycle,
  type SalaryReceiptLink
} from '@/domain/financial-planning';
import type { MutationResult } from '@/services/contracts/core-finance-service';
import type { CoreFinanceService } from '@/services/contracts/core-finance-service';
import {
  financialPlanningServiceCapability,
  type BudgetDetail,
  type BudgetInput,
  type BudgetMovePreview,
  type FinancialPlanningService,
  type GoalMovementInput,
  type ObligationDetail,
  type ObligationInput,
  type ObligationPaymentPreview,
  type SavingsGoalDetail,
  type SavingsGoalInput
} from '@/services/contracts/financial-planning-service';
import type { CapabilityProviderHandle } from '@/services/contracts/capability-contract';
import { FinancialPlanningRepository } from '@/storage/financial-planning-repository';
import {
  readPlanningDraft,
  listPlanningDrafts,
  writePlanningDraft,
  deletePlanningDraft
} from '@/storage/planning-draft-storage';
import {
  registerRuntimeIdentityReset,
  registerRuntimeUserDataReset
} from '@/storage/runtime-user-data-reset';
import {
  captureLiveClerkIdentity,
  captureLiveReadClerkIdentity,
  captureLiveClerkOwner
} from './auth-service';
import {
  assertReadActive,
  withReadContext,
  type ReadContext
} from './read-context';
import { measurePerformance } from '../platform/performance-timing';
import {
  mapBudgetFromApi,
  mapSalaryProfileFromApi,
  mapSavingsGoalFromApi,
  parsePlanningMinor
} from './financial-planning-api-mapping';
import {
  configureMobileApiTokenProvider,
  HttpError,
  requestJson
} from './http-client';

const uuid = z.string().uuid();
const instant = z.string().datetime({ offset: true });
// PostgreSQL date columns may arrive serialized as UTC-midnight timestamps.
const date = z.union([
  z.string().regex(/^\d{4}-\d{2}-\d{2}$/u),
  z
    .string()
    .datetime()
    .regex(/T00:00:00\.000Z$/u)
    .transform((value) => value.slice(0, 10))
]);
const minor = z.string().regex(/^-?(?:0|[1-9]\d*)$/u);
const metadata = {
  id: uuid,
  version: z.number().int().safe().positive(),
  createdAt: instant,
  updatedAt: instant
};
const requestId = z.string().min(1).max(128).optional();

const salarySchema = z
  .object({
    ...metadata,
    name: z.string(),
    amountMinor: minor,
    currencyCode: z.string().regex(/^[A-Z]{3}$/u),
    frequency: z.enum(['monthly', 'weekly', 'biweekly', 'custom']),
    expectedDay: z.number().int().min(0).max(31).nullable(),
    customIntervalDays: z.number().int().min(1).max(366).nullable(),
    accountId: uuid.nullable(),
    automaticDetectionEnabled: z.boolean(),
    status: z.enum(['active', 'paused', 'archived']),
    deletedAt: instant.nullable().optional(),
    requestId
  })
  .strict();
const receiptSchema = z
  .object({
    ...metadata,
    salaryProfileId: uuid,
    transactionId: uuid.nullable(),
    expectedAt: instant,
    receivedAt: instant.nullable(),
    amountMinor: minor,
    status: z.enum([
      'expected',
      'received',
      'missed',
      'ignored',
      'corrected',
      'undone'
    ]),
    operationId: uuid.nullable(),
    replacesReceiptId: uuid.nullable(),
    requestId
  })
  .strict();
const budgetSchema = z
  .object({
    ...metadata,
    name: z.string(),
    currencyCode: z.string().regex(/^[A-Z]{3}$/u),
    periodStart: date,
    periodEnd: date,
    totalMinor: minor,
    incomeTargetMinor: minor,
    savingsTargetMinor: minor,
    rolloverEnabled: z.boolean(),
    rolloverMinor: minor,
    status: z.enum(['draft', 'active', 'paused', 'closed', 'deleted']),
    copiedFromBudgetId: uuid.nullable(),
    deletedAt: instant.nullable().optional(),
    requestId
  })
  .strict();
const categorySchema = z
  .object({
    ...metadata,
    categoryId: uuid,
    limitMinor: minor,
    rolloverMinor: minor,
    alertThresholds: z.array(z.number().int().min(1).max(200)).max(8),
    status: z.enum(['active', 'paused', 'deleted'])
  })
  .strict();
const budgetDetailSchema = budgetSchema.extend({
  categories: z.array(categorySchema).max(100)
});
const budgetSummarySchema = z
  .object({
    budgetId: uuid,
    currencyCode: z.string().regex(/^[A-Z]{3}$/u),
    periodStart: date,
    periodEnd: date,
    totalMinor: minor,
    spentMinor: minor,
    remainingMinor: minor,
    dataState: z.enum(['complete', 'partial']),
    unavailableReason: z.enum(['missing_rate']).nullable(),
    ledgerVersion: z.number().int().safe().nonnegative(),
    items: z.array(z.unknown()).max(100),
    requestId
  })
  .strict();
const summaryCategorySchema = categorySchema.extend({ budgetId: uuid });

const obligationSchema = z
  .object({
    ...metadata,
    name: z.string(),
    direction: z.enum(['payable', 'receivable']),
    type: z.enum([
      'bill',
      'debt',
      'installment',
      'subscription',
      'other',
      'car_installment',
      'personal_loan',
      'buy_now_pay_later',
      'credit_card_installment',
      'rent',
      'utility',
      'custom'
    ]),
    scheduleKind: z.enum(['fixed_term', 'open_ended', 'irregular']),
    currencyCode: z.string().regex(/^[A-Z]{3}$/u),
    principalMinor: minor,
    openingPaidMinor: minor,
    installmentAmountMinor: minor.nullable(),
    installmentCount: z.number().int().positive().nullable(),
    frequency: z.enum([
      'monthly',
      'weekly',
      'biweekly',
      'quarterly',
      'yearly',
      'custom',
      'irregular'
    ]),
    expectedDay: z.number().int().min(0).max(31).nullable(),
    customIntervalDays: z.number().int().positive().nullable(),
    startDate: date.nullable(),
    endDate: date.nullable(),
    status: z.enum(['active', 'paused', 'completed', 'closed', 'archived']),
    defaultAccountId: uuid.nullable(),
    automaticMatchingEnabled: z.boolean(),
    provider: z.string().nullable(),
    providerKeywords: z.array(z.string()).max(20),
    reminderTiming: z.string().nullable(),
    notes: z.string().nullable(),
    deletedAt: instant.nullable().optional(),
    requestId
  })
  .strict();
const obligationSummarySchema = z
  .object({
    direction: z.enum(['payable', 'receivable']),
    currencyCode: z.string().regex(/^[A-Z]{3}$/u),
    scheduledMinor: minor,
    allocatedMinor: minor,
    paidMinor: minor,
    remainingMinor: minor,
    overdueMinor: minor,
    nextDueAt: instant.nullable(),
    nextDueAmountMinor: minor.nullable().optional(),
    completedInstallmentCount: z.number().int().safe().nonnegative(),
    status: z.enum(['active', 'paused', 'completed', 'closed', 'archived']),
    ledgerVersion: z.number().int().safe().nonnegative()
  })
  .strict();
const obligationDetailSchema = obligationSchema.extend({
  summary: obligationSummarySchema.nullable()
});
const scheduleSchema = z
  .object({
    ...metadata,
    obligationId: uuid,
    dueAt: instant,
    amountMinor: minor,
    paidMinor: minor,
    status: z.enum([
      'expected',
      'due',
      'partial',
      'paid',
      'overdue',
      'cancelled'
    ]),
    sequenceNo: z.number().int().safe().positive(),
    kind: z.enum(['installment', 'balloon', 'confirmed_occurrence'])
  })
  .strict();
const paymentSchema = z
  .object({
    ...metadata,
    obligationId: uuid,
    transactionId: uuid,
    amountMinor: minor,
    paidAt: instant,
    paymentMethod: z.string().nullable(),
    paymentCase: z.enum([
      'partial',
      'full',
      'over',
      'early',
      'settlement',
      'correction'
    ]),
    allocationIntent: z.enum([
      'current',
      'later_installments',
      'principal',
      'correction',
      'settlement',
      'prepayment'
    ]),
    source: z.enum(['manual', 'automatic', 'voice', 'platform_assisted']),
    operationId: uuid,
    transactionOwnership: z.enum(['created', 'linked_existing']).optional(),
    status: z.enum([
      'pending',
      'confirmed',
      'posted',
      'reversed',
      'undone',
      'conflict'
    ]),
    obligationVersion: z.number().int().safe().positive()
  })
  .strict();
const paymentHistorySchema = paymentSchema
  .omit({ obligationVersion: true })
  .extend({
    operationId: uuid.nullable(),
    currencyCode: z.string().regex(/^[A-Z]{3}$/u),
    principalReductionMinor: minor,
    settlementAdjustmentMinor: minor,
    transactionOwnership: z.enum(['created', 'linked_existing']),
    replacesPaymentId: uuid.nullable(),
    allocations: z.array(
      z.object({ scheduleItemId: uuid, amountMinor: minor }).strict()
    )
  });

const paymentMatchSchema = z
  .object({
    ...metadata,
    transactionId: uuid,
    obligationId: uuid.nullable(),
    scheduleItemId: uuid.nullable(),
    advisoryConfidence: z.string().regex(/^(?:0(?:\.\d+)?|1(?:\.0+)?)$/u),
    reasonCodes: z.array(z.enum(['amount_match', 'keyword_match'])),
    status: z.enum(['proposed', 'accepted', 'rejected']),
    reviewedAt: instant.nullable(),
    requestId
  })
  .strict();
const paymentMatchDetailSchema = paymentMatchSchema
  .extend({
    transaction: z
      .object({
        id: uuid,
        amountMinor: minor,
        currencyCode: z.string().regex(/^[A-Z]{3}$/u),
        occurredAt: instant,
        title: z.string(),
        merchant: z.string().nullable(),
        sourceAccountId: uuid.nullable(),
        sourceAccountName: z.string().nullable()
      })
      .strict(),
    candidate: z
      .object({
        id: uuid,
        title: z.string(),
        provider: z.string().nullable(),
        type: obligationSchema.shape.type,
        direction: z.enum(['payable', 'receivable']),
        currencyCode: z.string().regex(/^[A-Z]{3}$/u),
        remainingMinor: minor,
        nextDueAt: instant.nullable(),
        nextDueAmountMinor: minor.nullable(),
        obligationVersion: z.number().int().safe().positive()
      })
      .strict()
      .nullable(),
    suggestedAllocation: z
      .object({
        scheduleItemId: uuid,
        amountMinor: minor
      })
      .strict()
      .nullable()
  })
  .superRefine((value, context) => {
    if (
      value.candidate &&
      value.transaction.currencyCode !== value.candidate.currencyCode
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'currency mismatch'
      });
    }
  });
const paymentMatchMutationSchema = z
  .object({
    ...metadata,
    transactionId: uuid,
    obligationId: uuid.nullable(),
    scheduleItemId: uuid.nullable(),
    status: z.enum(['accepted', 'rejected']),
    reviewedAt: instant,
    payment: z.unknown().nullable()
  })
  .strict();
const goalSchema = z
  .object({
    ...metadata,
    name: z.string(),
    currencyCode: z.string().regex(/^[A-Z]{3}$/u),
    targetMinor: minor,
    openingTrackedMinor: minor,
    progressMinor: minor,
    remainingMinor: minor,
    progressBps: z.number().int().safe(),
    targetDate: date.nullable(),
    status: z.enum(['active', 'paused', 'completed', 'deleted']),
    linkedAccountId: uuid.nullable(),
    iconKey: z.string().nullable(),
    emergencyFund: z.boolean(),
    deletedAt: instant.nullable().optional(),
    requestId
  })
  .strict();
const movementSchema = z
  .object({
    id: uuid,
    goalId: uuid,
    transactionId: uuid,
    amountMinor: minor,
    occurredAt: instant,
    kind: z.enum(['contribution', 'withdrawal', 'adjustment', 'reversal']),
    operationId: uuid,
    replacesMovementId: uuid.nullable(),
    createdAt: instant
  })
  .strict();
const movementMutationSchema = movementSchema.extend({
  goalVersion: z.number().int().safe().positive(),
  progressMinor: minor
});
const categoryMutationSchema = z
  .object({
    id: uuid,
    version: z.number().int().safe().positive(),
    allocationCount: z.number().int().safe().nonnegative()
  })
  .strict();
const goalDetailSchema = goalSchema.extend({
  movements: z.array(movementSchema).max(100)
});

const summarySalarySchema = z
  .object({
    id: uuid,
    name: z.string(),
    currencyCode: z.string().regex(/^[A-Z]{3}$/u),
    expectedMinor: minor,
    actualIncomeMinor: minor,
    actualExpenseMinor: minor,
    reservedObligationMinor: minor,
    nextExpectedAt: instant.nullable(),
    startReceiptId: uuid.nullable().optional(),
    startAt: instant.nullable().optional()
  })
  .strict();
const summaryObligationSchema = obligationSummarySchema.extend({
  id: uuid,
  name: z.string()
});
const summarySchema = z
  .object({
    period: z.string().regex(/^\d{4}-(?:0[1-9]|1[0-2])$/u),
    dataState: z.enum(['ready', 'empty', 'partial', 'stale']),
    ledgerVersion: z.number().int().safe().nonnegative(),
    salary: summarySalarySchema.nullable(),
    budgets: z
      .array(
        z
          .object({
            id: uuid,
            name: z.string(),
            currencyCode: z.string().regex(/^[A-Z]{3}$/u),
            totalMinor: minor,
            spentMinor: minor,
            remainingMinor: minor,
            ledgerVersion: z.number().int().safe().nonnegative(),
            dataState: z.enum(['complete', 'partial']),
            categories: z.array(summaryCategorySchema).max(100)
          })
          .strict()
      )
      .max(100),
    obligations: z
      .object({
        payables: z.array(summaryObligationSchema).max(100),
        receivables: z.array(summaryObligationSchema).max(100)
      })
      .strict(),
    savings: z.array(goalSchema).max(100),
    requestId
  })
  .strict();

const page = <T extends z.ZodTypeAny>(item: T) =>
  z
    .object({
      items: z.array(item).max(100),
      nextCursor: z.string().nullable(),
      requestId
    })
    .strict();
const mutation = <T extends z.ZodTypeAny>(resource: T) =>
  z
    .object({
      operationId: uuid,
      replayed: z.boolean(),
      resource
    })
    .strict();

type Preview =
  | { kind: 'budget'; value: BudgetMovePreview; expectedVersion: number }
  | { kind: 'goal'; input: GoalMovementInput; expectedVersion: number }
  | {
      kind: 'payment';
      input: Parameters<
        FinancialPlanningService['previewObligationPayment']
      >[0];
      expectedVersion: number;
      value: ObligationPaymentPreview;
    };

const unsupported = (): never => {
  throw new FinancialPlanningError('offline_unavailable');
};

function apiPeriod(periodKey: string) {
  const [year, month] = periodKey.split('-').map(Number);
  const end = new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10);
  return { periodStart: `${periodKey}-01`, periodEnd: end };
}

function fromReceipt(
  value: z.infer<typeof receiptSchema>,
  timeZone = usePreferenceStore.getState().timeZone
): SalaryReceiptLink | null {
  if (
    !value.transactionId ||
    !value.operationId ||
    (!value.receivedAt && value.status !== 'undone') ||
    !['received', 'corrected', 'undone'].includes(value.status)
  )
    return null;
  return {
    id: value.id,
    salaryProfileId: value.salaryProfileId,
    transactionId: value.transactionId,
    expectedOccurrenceDate: localDateInTimeZone(
      Date.parse(value.expectedAt),
      timeZone
    ),
    receivedDate: value.receivedAt
      ? localDateInTimeZone(Date.parse(value.receivedAt), timeZone)
      : null,
    status:
      value.status === 'received'
        ? 'linked'
        : value.status === 'corrected'
          ? 'corrected'
          : 'undone',
    operationId: value.operationId,
    replacesReceiptId: value.replacesReceiptId,
    version: value.version,
    syncStatus: 'synced',
    createdAt: Date.parse(value.createdAt),
    updatedAt: Date.parse(value.updatedAt)
  };
}

function requireReceipt(
  value: z.infer<typeof receiptSchema>,
  timeZone = usePreferenceStore.getState().timeZone
): SalaryReceiptLink {
  const receipt = fromReceipt(value, timeZone);
  if (!receipt) throw new HttpError('contract_mismatch', 502);
  return receipt;
}

function fromCategory(
  value: z.infer<typeof categorySchema>,
  budgetId: string
): CategoryBudget {
  return {
    id: value.id,
    budgetId,
    categoryId: value.categoryId,
    limitMinor: parsePlanningMinor(value.limitMinor),
    alertThresholds: value.alertThresholds,
    status: value.status,
    version: value.version,
    syncStatus: 'synced',
    createdAt: Date.parse(value.createdAt),
    updatedAt: Date.parse(value.updatedAt)
  };
}

function fromObligation(value: z.infer<typeof obligationSchema>): Obligation {
  const mappedType =
    value.type === 'bill' || value.type === 'other'
      ? 'custom'
      : value.type === 'installment'
        ? 'debt'
        : value.type;
  return {
    id: value.id,
    direction: value.direction,
    type: mappedType,
    scheduleKind: value.scheduleKind,
    frequency: value.frequency,
    customIntervalDays: value.customIntervalDays,
    title: value.name,
    provider: value.provider,
    currencyCode: value.currencyCode,
    contractedTotalMinor: parsePlanningMinor(value.principalMinor),
    openingPaidMinor: parsePlanningMinor(value.openingPaidMinor),
    installmentAmountMinor:
      value.installmentAmountMinor === null
        ? null
        : parsePlanningMinor(value.installmentAmountMinor),
    installmentCount: value.installmentCount,
    dueDay: value.expectedDay,
    startDate: value.startDate as LocalDate | null,
    endDate: value.endDate as LocalDate | null,
    fundingAccountId: value.defaultAccountId,
    automaticMatchingEnabled: value.automaticMatchingEnabled,
    providerKeywords: value.providerKeywords,
    reminderTiming: value.reminderTiming,
    notes: value.notes,
    status: value.status,
    version: value.version,
    syncStatus: 'synced',
    createdAt: Date.parse(value.createdAt),
    updatedAt: Date.parse(value.updatedAt)
  };
}

function fromSchedule(
  value: z.infer<typeof scheduleSchema>
): ObligationScheduleItem {
  return {
    id: value.id,
    obligationId: value.obligationId,
    sequence: value.sequenceNo,
    dueDate: localDateInTimeZone(
      Date.parse(value.dueAt),
      usePreferenceStore.getState().timeZone
    ),
    scheduledMinor: parsePlanningMinor(value.amountMinor),
    kind: value.kind,
    status:
      value.status === 'expected' || value.status === 'due'
        ? 'upcoming'
        : value.status
  };
}

function fromMatch(
  value:
    | z.infer<typeof paymentMatchSchema>
    | z.infer<typeof paymentMatchDetailSchema>
): PaymentMatch {
  const transaction = 'transaction' in value ? value.transaction : null;
  const candidate = 'candidate' in value ? value.candidate : null;
  const suggestedAllocation =
    'suggestedAllocation' in value ? value.suggestedAllocation : null;
  return {
    id: value.id,
    transactionId: value.transactionId,
    candidateObligationIds: value.obligationId ? [value.obligationId] : [],
    duplicatePaymentIds: [],
    status:
      value.status === 'proposed'
        ? 'review_required'
        : value.status === 'accepted'
          ? 'resolved'
          : 'ignored',
    resolution:
      value.status === 'accepted'
        ? value.obligationId
        : value.status === 'rejected'
          ? 'ignored'
          : null,
    advisoryConfidence: Number(value.advisoryConfidence),
    reasonCodes: value.reasonCodes,
    version: value.version,
    transaction: transaction
      ? {
          id: transaction.id,
          amountMinor: parsePlanningMinor(transaction.amountMinor),
          currencyCode: transaction.currencyCode,
          occurredAt: Date.parse(transaction.occurredAt),
          title: transaction.title,
          merchant: transaction.merchant,
          sourceAccountId: transaction.sourceAccountId,
          sourceAccountName: transaction.sourceAccountName
        }
      : null,
    candidate: candidate
      ? {
          id: candidate.id,
          title: candidate.title,
          provider: candidate.provider,
          type:
            candidate.type === 'bill' || candidate.type === 'other'
              ? 'custom'
              : candidate.type === 'installment'
                ? 'debt'
                : candidate.type,
          direction: candidate.direction,
          currencyCode: candidate.currencyCode,
          remainingMinor: parsePlanningMinor(candidate.remainingMinor),
          nextDueDate: candidate.nextDueAt?.slice(0, 10) as LocalDate | null,
          nextDueAmountMinor:
            candidate.nextDueAmountMinor === null
              ? null
              : parsePlanningMinor(candidate.nextDueAmountMinor),
          obligationVersion: candidate.obligationVersion
        }
      : null,
    suggestedAllocation: suggestedAllocation
      ? {
          scheduleItemId: suggestedAllocation.scheduleItemId,
          amountMinor: parsePlanningMinor(suggestedAllocation.amountMinor)
        }
      : null
  };
}

function fromMovement(value: z.infer<typeof movementSchema>): GoalMovement {
  return {
    id: value.id,
    goalId: value.goalId,
    kind: value.kind === 'adjustment' ? 'correction' : value.kind,
    amountMinor:
      value.kind === 'withdrawal' || value.kind === 'reversal'
        ? Math.abs(parsePlanningMinor(value.amountMinor))
        : parsePlanningMinor(value.amountMinor),
    movementDate: value.occurredAt.slice(0, 10) as LocalDate,
    linkedTransactionId: value.transactionId,
    conversionEstimate: null,
    status: value.kind === 'reversal' ? 'reversed' : 'posted',
    operationId: value.operationId,
    replacesMovementId: value.replacesMovementId,
    version: null,
    syncStatus: 'synced',
    createdAt: Date.parse(value.createdAt),
    updatedAt: null
  };
}

function scopes<T>(
  value: T,
  affectedScopes: readonly string[]
): MutationResult<T> {
  return {
    value,
    affectedScopes: [
      ...new Set([...affectedScopes, 'reports.live', 'assistant.context'])
    ]
  };
}

function budgetProgress(
  budget: Budget,
  summary: Pick<
    z.infer<typeof budgetSummarySchema>,
    'spentMinor' | 'remainingMinor' | 'dataState'
  >
): BudgetProgress {
  const spent = parsePlanningMinor(summary.spentMinor);
  const remaining = parsePlanningMinor(summary.remainingMinor);
  const percentage =
    budget.configuredExpenseLimitMinor === 0
      ? 0
      : roundedPercentage(spent, budget.configuredExpenseLimitMinor);
  return {
    budgetId: budget.id,
    eligibleSpendMinor: available(spent),
    remainingMinor: available(remaining),
    percentage: available(percentage),
    forecastMinor: { status: 'unavailable', reason: 'insufficient_history' },
    comparison: { status: 'unavailable', reason: 'insufficient_history' },
    state:
      summary.dataState === 'partial'
        ? 'incomplete'
        : remaining < 0
          ? 'exceeded'
          : percentage >= 90
            ? 'near_limit'
            : percentage >= 80
              ? 'threshold'
              : 'healthy',
    excludedTransactionIds: []
  };
}

function goalProgress(
  wire: z.infer<typeof goalSchema>,
  today: LocalDate
): SavingsGoalDetail['progress'] {
  const current = parsePlanningMinor(wire.progressMinor);
  const remaining = Math.max(0, parsePlanningMinor(wire.remainingMinor));
  const months = wire.targetDate
    ? Math.max(
        1,
        Math.ceil(daysBetween(today, wire.targetDate as LocalDate) / 30)
      )
    : null;
  return {
    goalId: wire.id,
    currentMinor: available(current),
    remainingMinor: available(remaining),
    percentage: available(Math.min(100, Math.round(wire.progressBps / 100))),
    requiredMonthlyMinor:
      remaining === 0
        ? available(0)
        : months === null || (wire.targetDate as string) < today
          ? { status: 'unavailable', reason: 'missing_data' }
          : available(Math.ceil(remaining / months)),
    state:
      wire.status === 'completed'
        ? 'completed'
        : wire.status === 'deleted'
          ? 'archived'
          : current >= parsePlanningMinor(wire.targetMinor)
            ? 'target_reached'
            : wire.status
  };
}

function assertSafeFinancialBody(value: unknown): void {
  if (Array.isArray(value)) {
    value.forEach(assertSafeFinancialBody);
    return;
  }
  if (!value || typeof value !== 'object') return;
  for (const [childKey, child] of Object.entries(value)) {
    if (childKey.endsWith('Minor')) {
      const text = typeof child === 'number' ? String(child) : child;
      if (
        typeof text !== 'string' ||
        !/^-?(?:0|[1-9]\d*)$/u.test(text) ||
        BigInt(text) > BigInt(Number.MAX_SAFE_INTEGER) ||
        BigInt(text) < BigInt(Number.MIN_SAFE_INTEGER)
      )
        throw new FinancialPlanningError('validation');
    } else if (
      childKey === 'expectedVersion' &&
      (!Number.isSafeInteger(child) || (child as number) <= 0)
    ) {
      throw new FinancialPlanningError('validation');
    }
    assertSafeFinancialBody(child);
  }
}

function requireSafeMinorSum(values: readonly number[]): number {
  const total = values.reduce<number | null>(
    (sum, value) => (sum === null ? null : safeMinorSum(sum, value)),
    0
  );
  if (total === null) throw new HttpError('contract_mismatch', 502);
  return total;
}

function roundedPercentage(numerator: number, denominator: number): number {
  if (denominator === 0) return 0;
  const dividend = BigInt(numerator) * 100n;
  const divisor = BigInt(denominator);
  const rounded = (dividend + divisor / 2n) / divisor;
  const value = Number(rounded);
  if (!Number.isSafeInteger(value))
    throw new HttpError('contract_mismatch', 502);
  return value;
}

function salaryCycle(
  summary: z.infer<typeof summarySchema>,
  today: LocalDate,
  timeZone: string = usePreferenceStore.getState().timeZone
): SalaryCycle {
  const salary = summary.salary;
  if (!salary) {
    const unavailable = {
      status: 'unavailable' as const,
      reason: 'missing_data' as const
    };
    return {
      profileId: null,
      startReceiptId: null,
      startDate: null,
      projectedNextSalaryDate: null,
      daysRemaining: 0,
      income: unavailable,
      expenses: unavailable,
      reservedObligations: unavailable,
      remaining: unavailable,
      suggestedDaily: unavailable,
      previousCycleComparison: {
        status: 'unavailable',
        reason: 'insufficient_history'
      },
      salaryState: 'unconfigured',
      dataState: 'empty'
    };
  }
  const income = parsePlanningMinor(salary.actualIncomeMinor);
  const expenses = parsePlanningMinor(salary.actualExpenseMinor);
  const reserved = parsePlanningMinor(salary.reservedObligationMinor);
  const remaining = requireSafeMinorSum([income, -expenses, -reserved]);
  const next = salary.nextExpectedAt
    ? localDateInTimeZone(Date.parse(salary.nextExpectedAt), timeZone)
    : undefined;
  const daysRemaining = next ? Math.max(0, daysBetween(today, next)) : 0;
  const value = (minorUnits: number) =>
    available(money(minorUnits, salary.currencyCode));
  return {
    profileId: salary.id,
    startReceiptId: salary.startReceiptId ?? null,
    startDate: salary.startAt
      ? localDateInTimeZone(Date.parse(salary.startAt), timeZone)
      : null,
    projectedNextSalaryDate: next ?? null,
    daysRemaining,
    income: salary.startReceiptId ? value(income) : unavailable('missing_data'),
    expenses: salary.startReceiptId
      ? value(expenses)
      : unavailable('missing_data'),
    reservedObligations: salary.startReceiptId
      ? value(reserved)
      : unavailable('missing_data'),
    remaining: salary.startReceiptId
      ? value(remaining)
      : unavailable('missing_data'),
    suggestedDaily: !salary.startReceiptId
      ? unavailable('missing_data')
      : !next || next < today
        ? unavailable('salary_overdue')
        : remaining < 0
          ? unavailable('balance_negative')
          : daysRemaining > 0
            ? value(Math.floor(remaining / daysRemaining))
            : unavailable('cycle_elapsed'),
    previousCycleComparison: {
      status: 'unavailable',
      reason: 'insufficient_history'
    },
    salaryState: !next ? 'late' : next < today ? 'overdue' : 'on_time',
    dataState: summary.dataState
  };
}

function obligationInput(input: ObligationInput) {
  if (input.contractedTotalMinor == null || input.startDate == null)
    throw new FinancialPlanningError('validation');
  return {
    name: input.title,
    direction: input.direction,
    type: input.type,
    scheduleKind: input.scheduleKind,
    currencyCode: input.currencyCode,
    principalMinor: String(input.contractedTotalMinor),
    openingPaidMinor: String(input.openingPaidMinor ?? 0),
    installmentAmountMinor:
      input.installmentAmountMinor == null
        ? null
        : String(input.installmentAmountMinor),
    installmentCount: input.installmentCount ?? null,
    frequency:
      input.scheduleKind === 'irregular'
        ? 'irregular'
        : (input.frequency ?? 'monthly'),
    expectedDay: input.dueDay ?? null,
    customIntervalDays: input.customIntervalDays ?? null,
    startDate: input.startDate,
    endDate: input.endDate ?? null,
    defaultAccountId: input.fundingAccountId ?? null,
    automaticMatchingEnabled: input.automaticMatchingEnabled ?? false,
    provider: input.provider ?? null,
    providerKeywords: input.providerKeywords ?? [],
    reminderTiming: input.reminderTiming ?? null,
    notes: input.notes ?? null
  };
}

function goalInput(input: SavingsGoalInput) {
  return {
    name: input.title,
    targetMinor: String(input.targetMinor),
    openingTrackedMinor: String(input.openingTrackedMinor ?? 0),
    currencyCode: input.currencyCode,
    targetDate: input.targetDate,
    linkedAccountId: input.linkedAccountId ?? null,
    iconKey: input.iconKey ?? null,
    emergencyFund: input.emergencyFund ?? false
  };
}

function planningOverviewFromSummary(
  summary: z.infer<typeof summarySchema>,
  input: { currencyCode: string; today: LocalDate; timeZone?: string }
): import('../contracts/financial-planning-service').PlanningReadSnapshot['byCurrency'][string] {
  const salary = salaryCycle(summary, input.today, input.timeZone);
  const budget = summary.budgets.find(
    (item) => item.currencyCode === input.currencyCode
  );
  const payables = summary.obligations.payables.filter(
    (item) => item.currencyCode === input.currencyCode
  );
  const obligationTotal = requireSafeMinorSum(
    payables.map((item) => parsePlanningMinor(item.remainingMinor))
  );
  const budgetSpent = budget ? parsePlanningMinor(budget.spentMinor) : 0;
  const budgetTotal = budget ? parsePlanningMinor(budget.totalMinor) : 0;
  const budgetRemaining = budget
    ? parsePlanningMinor(budget.remainingMinor)
    : 0;
  const budgetPercentage = roundedPercentage(budgetSpent, budgetTotal);
  return {
    dataState: summary.dataState,
    salary,
    budget: budget
      ? {
          budgetId: budget.id,
          eligibleSpendMinor: available(budgetSpent),
          remainingMinor: available(budgetRemaining),
          percentage: available(budgetPercentage),
          forecastMinor: {
            status: 'unavailable',
            reason: 'insufficient_history'
          },
          comparison: {
            status: 'unavailable',
            reason: 'insufficient_history'
          },
          state:
            budget.dataState === 'partial'
              ? 'incomplete'
              : budgetRemaining < 0
                ? 'exceeded'
                : budgetPercentage >= 90
                  ? 'near_limit'
                  : budgetPercentage >= 80
                    ? 'threshold'
                    : 'healthy',
          excludedTransactionIds: []
        }
      : null,
    obligationsDueMinor: available({
      minorUnits: obligationTotal,
      currencyCode: input.currencyCode,
      scale: getCurrencyMinorUnitScale(input.currencyCode)
    }),
    savings: summary.savings
      .filter((item) => item.currencyCode === input.currencyCode)
      .map((item) => {
        return goalProgress(item, input.today);
      })
  };
}

export function createLiveFinancialPlanningService({
  baseUrl = process.env.EXPO_PUBLIC_API_URL ?? '',
  token,
  request = fetch,
  repository = new FinancialPlanningRepository(),
  persistent = Platform.OS !== 'web' && process.env.NODE_ENV !== 'test',
  now = Date.now,
  categoryIds
}: {
  baseUrl?: string;
  token?: () => Promise<string | null>;
  request?: typeof fetch;
  repository?: FinancialPlanningRepository;
  persistent?: boolean;
  now?: () => number;
  ledger?: Pick<CoreFinanceService, 'createTransaction'>;
  categoryIds?: {
    prepare(): Promise<void>;
    toServer(id: string): string;
    toLocal(id: string): string;
  };
} = {}): CapabilityProviderHandle<FinancialPlanningService> {
  if (token) configureMobileApiTokenProvider(token);
  let hydration: Promise<void> | null = null;
  const previews = new Map<string, Preview>();
  const payments = new Map<
    string,
    {
      obligationId: string;
      version: number;
      allocations: { scheduleItemId: string; amountMinor: number }[];
    }
  >();
  const movements = new Map<string, { goalId: string; version: number }>();
  const ensureLocal = async () => {
    if (persistent) hydration ??= repository.hydrate({ preserveDrafts: true });
    await hydration;
  };
  const persistLocal = async () => {
    if (persistent) await repository.persistAll({ preserveDrafts: true });
  };
  const resetRuntime = () => {
    repository.reset();
    previews.clear();
    payments.clear();
    movements.clear();
    hydration = null;
  };
  registerRuntimeIdentityReset(resetRuntime);
  registerRuntimeUserDataReset(resetRuntime);

  const send = async <T>(
    method: string,
    path: string,
    schema: z.ZodType<T>,
    options: {
      body?: Record<string, unknown>;
      operationId?: string;
      identity?: Awaited<ReturnType<typeof captureLiveClerkIdentity>>;
      signal?: AbortSignal;
      timeoutMs?: number;
    } = {}
  ) => {
    if (
      method !== 'GET' &&
      (!options.operationId?.trim() || options.operationId.length > 128)
    )
      throw new HttpError('validation_error', 400);
    assertSafeFinancialBody(options.body);
    if (method === 'GET')
      return withReadContext(options, async (signal) => {
        const identity =
          options.identity ??
          (await measurePerformance(
            'planning.auth',
            captureLiveReadClerkIdentity
          ));
        assertReadActive(signal);
        await identity.assertCurrent();
        assertReadActive(signal);
        const value = await measurePerformance('planning.read', () =>
          requestJson(path, schema, {
            baseUrl,
            request,
            method,
            signal,
            token: identity.token
          })
        );
        await identity.assertCurrent();
        assertReadActive(signal);
        return value;
      });
    const identity = options.identity ?? (await captureLiveClerkIdentity());
    await identity.assertCurrent();
    const value = await requestJson(path, schema, {
      baseUrl,
      request,
      method,
      body: options.body,
      headers: options.operationId
        ? { 'Idempotency-Key': options.operationId }
        : undefined,
      token: identity.token
    });
    await identity.assertCurrent();
    return value;
  };

  const allPages = <T>(
    path: string,
    schema: z.ZodType<T>,
    context?: ReadContext
  ) =>
    withReadContext(context, async (signal) => {
      const identity = await measurePerformance(
        'planning.auth',
        captureLiveReadClerkIdentity
      );
      assertReadActive(signal);
      const values: T[] = [];
      const seen = new Set<string>();
      let cursor: string | null = null;
      do {
        const separator = path.includes('?') ? '&' : '?';
        const suffix: string = `${separator}limit=100${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`;
        const response: {
          items: T[];
          nextCursor: string | null;
          requestId?: string;
        } = await send('GET', `${path}${suffix}`, page(schema), {
          identity,
          signal
        });
        values.push(...response.items);
        cursor = response.nextCursor;
        if (cursor && seen.has(cursor))
          throw new HttpError('contract_mismatch', 502);
        if (cursor) seen.add(cursor);
      } while (cursor);
      return values;
    });

  const readSummary = (
    period: string,
    asOf?: LocalDate,
    context?: ReadContext
  ) =>
    send(
      'GET',
      `/api/v1/planning/summary?period=${encodeURIComponent(period)}${asOf ? `&asOf=${asOf}` : ''}`,
      summarySchema,
      context
    );

  const readBudgetDetail = async (id: string): Promise<BudgetDetail> => {
    const owner = await captureLiveClerkOwner();
    await categoryIds?.prepare();
    await owner.assertCurrent();
    const [wire, summary] = await Promise.all([
      send(
        'GET',
        `/api/v1/budgets/${encodeURIComponent(id)}`,
        budgetDetailSchema
      ),
      send(
        'GET',
        `/api/v1/budgets/${encodeURIComponent(id)}/summary`,
        budgetSummarySchema
      )
    ]);
    await owner.assertCurrent();
    const budget = mapBudgetFromApi(wire);
    return {
      budget,
      categories: wire.categories.map((item) =>
        mapBudgetCategory(item, budget.id)
      ),
      progress: budgetProgress(budget, summary)
    };
  };

  const mapBudgetCategory = (
    item: z.infer<typeof categorySchema>,
    budgetId: string
  ): CategoryBudget => ({
    ...fromCategory(item, budgetId),
    categoryId: categoryIds?.toLocal(item.categoryId) ?? item.categoryId
  });

  const readSchedule = async (id: string, context?: ReadContext) =>
    (
      await allPages(
        `/api/v1/obligations/${encodeURIComponent(id)}/schedule`,
        scheduleSchema,
        context
      )
    ).map(fromSchedule);

  const readGoal = async (
    id: string,
    context?: ReadContext
  ): Promise<SavingsGoalDetail> => {
    const wire = await send(
      'GET',
      `/api/v1/savings-goals/${encodeURIComponent(id)}`,
      goalDetailSchema,
      context
    );
    const goal = mapSavingsGoalFromApi(wire);
    const goalMovements = wire.movements.map(fromMovement);
    for (const item of goalMovements)
      movements.set(item.id, { goalId: goal.id, version: goal.version });
    return {
      goal,
      movements: goalMovements,
      progress: goalProgress(
        wire,
        localDateInTimeZone(now(), usePreferenceStore.getState().timeZone)
      )
    };
  };

  const mapHistory = (
    id: string,
    currencyCode: string,
    history: z.infer<typeof paymentHistorySchema>[] | null
  ): ObligationPayment[] => {
    return (history ?? []).map((entry) => {
      if (entry.obligationId !== id || entry.currencyCode !== currencyCode)
        throw new HttpError('contract_mismatch', 502);
      const payment: ObligationPayment = {
        id: entry.id,
        obligationId: entry.obligationId,
        transactionId: entry.transactionId,
        amountMinor: parsePlanningMinor(entry.amountMinor),
        currencyCode: entry.currencyCode,
        paidDate: localDateInTimeZone(
          Date.parse(entry.paidAt),
          usePreferenceStore.getState().timeZone
        ),
        case: entry.paymentCase,
        allocationIntent:
          entry.allocationIntent === 'prepayment'
            ? 'principal'
            : entry.allocationIntent,
        allocations: entry.allocations.map((a) => ({
          scheduleItemId: a.scheduleItemId,
          amountMinor: parsePlanningMinor(a.amountMinor)
        })),
        principalReductionMinor: parsePlanningMinor(
          entry.principalReductionMinor
        ),
        settlementAdjustmentMinor: parsePlanningMinor(
          entry.settlementAdjustmentMinor
        ),
        source: entry.source,
        transactionOwnership: entry.transactionOwnership,
        status: entry.status === 'confirmed' ? 'posted' : entry.status,
        operationId: entry.operationId,
        replacesPaymentId: entry.replacesPaymentId,
        version: entry.version,
        createdAt: Date.parse(entry.createdAt),
        updatedAt: Date.parse(entry.updatedAt),
        syncStatus: 'synced'
      };
      payments.set(payment.id, {
        obligationId: id,
        version: payment.version,
        allocations: payment.allocations
      });
      return payment;
    });
  };

  const obligationDetailFromWire = (
    id: string,
    wire: z.infer<typeof obligationDetailSchema>,
    schedule: ObligationScheduleItem[],
    history: z.infer<typeof paymentHistorySchema>[] | null
  ): ObligationDetail => {
    const obligation = fromObligation(wire);
    const historyPayments = mapHistory(id, obligation.currencyCode, history);
    const fallback = deriveObligationStatus({
      obligation,
      schedule,
      payments: historyPayments,
      today: localDateInTimeZone(now(), usePreferenceStore.getState().timeZone)
    });
    return {
      obligation,
      schedule,
      payments: historyPayments,
      paymentHistoryState: history === null ? 'unavailable' : 'available',
      status: wire.summary
        ? {
            paidMinor: parsePlanningMinor(wire.summary.paidMinor),
            remainingMinor: available(
              parsePlanningMinor(wire.summary.remainingMinor)
            ),
            nextDueDate: wire.summary.nextDueAt
              ? localDateInTimeZone(
                  Date.parse(wire.summary.nextDueAt),
                  usePreferenceStore.getState().timeZone
                )
              : null,
            overdue: parsePlanningMinor(wire.summary.overdueMinor) > 0
          }
        : history === null
          ? {
              ...fallback,
              paidMinor: null,
              remainingMinor: unavailable('missing_data')
            }
          : fallback
    };
  };

  const service: CapabilityProviderHandle<FinancialPlanningService> = {
    metadata: {
      id: 'live-financial-planning',
      capability: financialPlanningServiceCapability.capability,
      majorVersion: financialPlanningServiceCapability.majorVersion,
      kind: 'live',
      availability: 'available'
    },

    async getReportingSnapshot(period) {
      const owner = await captureLiveClerkOwner();
      await categoryIds?.prepare();
      await owner.assertCurrent();
      const periodKey = period.startDate.slice(0, 7);
      const [summary, budgets, obligations, goals] = await Promise.all([
        readSummary(periodKey),
        allPages(
          `/api/v1/budgets?period=${encodeURIComponent(periodKey)}`,
          budgetSchema
        ),
        allPages('/api/v1/obligations', obligationSchema),
        allPages('/api/v1/savings-goals', goalSchema)
      ]);
      await owner.assertCurrent();
      return {
        salaryReceipts: [],
        budgets: budgets.map(mapBudgetFromApi),
        categoryBudgets: summary.budgets.flatMap((budget) =>
          budget.categories.map((category) =>
            mapBudgetCategory(category, budget.id)
          )
        ),
        obligations: obligations.map(fromObligation),
        obligationPayments: [],
        savingsGoals: goals.map(mapSavingsGoalFromApi),
        goalMovements: [],
        dataState: 'partial',
        completenessReasons: ['insufficient_history']
      };
    },

    async getPlanningSnapshot(input, context) {
      const summary = await readSummary(
        input.today.slice(0, 7),
        input.today,
        context
      );
      const currencies = new Set([
        'SAR',
        ...summary.budgets.map((item) => item.currencyCode),
        ...summary.obligations.payables.map((item) => item.currencyCode),
        ...summary.savings.map((item) => item.currencyCode)
      ]);
      return {
        salary: salaryCycle(summary, input.today, input.timeZone),
        dataState: summary.dataState,
        byCurrency: Object.fromEntries(
          [...currencies].map((currencyCode) => [
            currencyCode,
            planningOverviewFromSummary(summary, { ...input, currencyCode })
          ])
        )
      };
    },

    async getPlanningOverview(input, context) {
      return planningOverviewFromSummary(
        await readSummary(input.today.slice(0, 7), input.today, context),
        input
      );
    },

    async getSalaryOverview(input, context) {
      return salaryCycle(
        await readSummary(input.today.slice(0, 7), input.today, context),
        input.today,
        input.timeZone
      );
    },

    async getSalaryProfile(context) {
      const profiles = await allPages(
        '/api/v1/salary-profiles',
        salarySchema,
        context
      );
      const profile = profiles.find((item) => item.status === 'active');
      return profile ? mapSalaryProfileFromApi(profile) : null;
    },

    async getSalaryReceiptReview(transactionId) {
      const profiles = await allPages('/api/v1/salary-profiles', salarySchema);
      const profile = profiles.find((item) => item.status === 'active');
      if (!profile) return null;
      const query = `/api/v1/salary-profiles/${profile.id}/receipts`;
      const found = await allPages(query, receiptSchema);
      const match = found.find(
        (item) =>
          item.id === transactionId || item.transactionId === transactionId
      );
      return match ? fromReceipt(match) : null;
    },

    async listSalaryExpectedDates() {
      const profile = (
        await allPages('/api/v1/salary-profiles', salarySchema)
      ).find((item) => item.status === 'active');
      if (!profile) return [];
      return (
        await allPages(
          `/api/v1/salary-profiles/${profile.id}/receipts`,
          receiptSchema
        )
      )
        .filter((item) => ['expected', 'missed'].includes(item.status))
        .map((item) =>
          localDateInTimeZone(
            Date.parse(item.expectedAt),
            usePreferenceStore.getState().timeZone
          )
        );
    },

    async saveSalaryProfile(input, operationId) {
      const current = (
        await allPages('/api/v1/salary-profiles', salarySchema)
      ).find((item) => item.status === 'active');
      const body = {
        name: input.sourceName,
        amountMinor: String(input.expectedAmountMinor),
        currencyCode: input.currencyCode,
        frequency: 'monthly',
        expectedDay: input.salaryDay,
        customIntervalDays: null,
        accountId: input.receivingAccountId,
        automaticDetectionEnabled: input.automaticDetectionEnabled ?? false
      };
      const response = current
        ? await send(
            'PATCH',
            `/api/v1/salary-profiles/${current.id}`,
            mutation(salarySchema),
            {
              operationId,
              body: { expectedVersion: current.version, patch: body }
            }
          )
        : await send(
            'POST',
            '/api/v1/salary-profiles',
            mutation(salarySchema),
            { operationId, body }
          );
      return scopes(mapSalaryProfileFromApi(response.resource), [
        'planning.overview',
        'planning.salary.overview',
        'home.summary'
      ]);
    },

    async confirmSalaryReceipt(input, operationId) {
      const timeZone = input.timeZone ?? usePreferenceStore.getState().timeZone;
      const occurrences = await allPages(
        `/api/v1/salary-profiles/${input.salaryProfileId}/receipts`,
        receiptSchema
      );
      const occurrence = occurrences.find(
        (item) =>
          ['expected', 'missed'].includes(item.status) &&
          localDateInTimeZone(Date.parse(item.expectedAt), timeZone) ===
            input.expectedOccurrenceDate
      );
      const response = await send(
        'POST',
        `/api/v1/salary-profiles/${input.salaryProfileId}/receipts`,
        mutation(receiptSchema),
        {
          operationId,
          body: {
            transactionId: input.transactionId,
            expectedAt:
              occurrence?.expectedAt ??
              new Date(
                localDateTimeInstant(input.expectedOccurrenceDate, timeZone)
              ).toISOString(),
            replacesReceiptId: input.replacesReceiptId ?? null
          }
        }
      );
      const profile = mapSalaryProfileFromApi(
        await send(
          'GET',
          `/api/v1/salary-profiles/${input.salaryProfileId}`,
          salarySchema
        )
      );
      const receipt = requireReceipt(response.resource, timeZone);
      const cycle = await service.getSalaryOverview({
        today: input.receivedDate,
        timeZone: input.timeZone
      });
      return scopes({ profile, receipt, cycle }, [
        'planning.overview',
        'planning.salary.overview',
        'home.summary',
        `planning.salary.operation.${response.operationId}`
      ]);
    },

    async undoSalaryReceipt(receiptId, operationId, timeZone) {
      const profiles = await allPages('/api/v1/salary-profiles', salarySchema);
      const wire = profiles.find((item) => item.status === 'active');
      if (!wire) throw new FinancialPlanningError('not_found');
      const receipts = await allPages(
        `/api/v1/salary-profiles/${wire.id}/receipts`,
        receiptSchema
      );
      const current = receipts.find((item) => item.id === receiptId);
      if (!current) throw new FinancialPlanningError('not_found');
      const response = await send(
        'DELETE',
        `/api/v1/salary-profiles/${wire.id}/receipts/${receiptId}`,
        mutation(receiptSchema),
        { operationId, body: { expectedVersion: current.version } }
      );
      const profile = mapSalaryProfileFromApi(wire);
      const receipt = requireReceipt(response.resource, timeZone);
      const cycle = await service.getSalaryOverview({
        today: localDateInTimeZone(
          now(),
          timeZone ?? usePreferenceStore.getState().timeZone
        ),
        timeZone
      });
      return scopes({ profile, receipt, cycle }, [
        'planning.overview',
        'planning.salary.overview',
        'home.summary',
        `planning.salary.operation.${response.operationId}`
      ]);
    },

    async getBudget(periodKey) {
      const budgets = await allPages(
        `/api/v1/budgets?period=${encodeURIComponent(periodKey)}`,
        budgetSchema
      );
      const budget = budgets.find((item) => item.status !== 'deleted');
      return budget ? readBudgetDetail(budget.id) : null;
    },

    async listBudgets(periodKey) {
      const owner = await captureLiveClerkOwner();
      await categoryIds?.prepare();
      await owner.assertCurrent();
      const [budgets, summary] = await Promise.all([
        allPages(
          `/api/v1/budgets?period=${encodeURIComponent(periodKey)}`,
          budgetSchema
        ),
        readSummary(periodKey)
      ]);
      await owner.assertCurrent();
      return budgets
        .filter((item) => item.status !== 'deleted')
        .map((wire) => {
          const budget = mapBudgetFromApi(wire);
          const aggregate = summary.budgets.find((item) => item.id === wire.id);
          if (!aggregate) throw new HttpError('contract_mismatch', 502);
          return {
            budget,
            categories: aggregate.categories.map((item) =>
              mapBudgetCategory(item, budget.id)
            ),
            progress: budgetProgress(budget, aggregate)
          };
        });
    },

    getBudgetById: readBudgetDetail,

    async createBudgetDraftFromPrevious(periodKey) {
      const month = new Date(`${periodKey}-01T00:00:00.000Z`);
      month.setUTCMonth(month.getUTCMonth() - 1);
      const previous = await service.getBudget(month.toISOString().slice(0, 7));
      return service.saveDraft({
        id: `draft-budget-${periodKey}`,
        kind: 'budget',
        entityId: null,
        payload: previous
          ? {
              periodKey,
              configuredExpenseLimitMinor:
                previous.budget.configuredExpenseLimitMinor,
              incomeTargetMinor: previous.budget.incomeTargetMinor,
              savingsTargetMinor: previous.budget.savingsTargetMinor,
              rolloverEnabled: previous.budget.rolloverEnabled,
              copiedFromBudgetId: previous.budget.id,
              categories: previous.categories
            }
          : { periodKey },
        status: 'editing',
        updatedAt: now()
      });
    },

    async saveBudget(input: BudgetInput, operationId: string) {
      const identity = await captureLiveClerkIdentity();
      if (input.categories?.length) await categoryIds?.prepare();
      await identity.assertCurrent();
      const allocations = input.categories?.map((item) => ({
        categoryId: categoryIds?.toServer(item.categoryId) ?? item.categoryId,
        limitMinor: String(item.limitMinor),
        rolloverMinor: '0',
        alertThresholds: item.alertThresholds,
        status: item.status
      }));
      const period = apiPeriod(input.periodKey);
      const patch = {
        name: input.name,
        ...period,
        totalMinor: String(input.configuredExpenseLimitMinor),
        incomeTargetMinor: String(input.incomeTargetMinor),
        savingsTargetMinor: String(input.savingsTargetMinor),
        rolloverEnabled: input.rolloverEnabled ?? false,
        rolloverMinor: String(input.rolloverCreditMinor ?? 0)
      };
      const response = input.id
        ? await send(
            'PATCH',
            `/api/v1/budgets/${input.id}`,
            mutation(budgetSchema),
            {
              operationId,
              identity,
              body: { expectedVersion: input.expectedVersion, patch }
            }
          )
        : await send('POST', '/api/v1/budgets', mutation(budgetSchema), {
            operationId,
            identity,
            body: {
              ...patch,
              currencyCode: input.currencyCode,
              copiedFromBudgetId: input.copiedFromBudgetId ?? null
            }
          });
      let budget = mapBudgetFromApi(response.resource);
      if (input.categories) {
        await send(
          'PUT',
          `/api/v1/budgets/${budget.id}/categories`,
          mutation(categoryMutationSchema),
          {
            operationId: `${operationId}:categories`,
            identity,
            body: {
              expectedVersion: budget.version,
              allocations
            }
          }
        );
        budget = (await readBudgetDetail(budget.id)).budget;
        await identity.assertCurrent();
      }
      if (budget.status === 'draft') {
        const activated = await send(
          'PATCH',
          `/api/v1/budgets/${budget.id}`,
          mutation(budgetSchema),
          {
            operationId: `${operationId}:activate`,
            identity,
            body: {
              expectedVersion: budget.version,
              patch: { status: 'active' }
            }
          }
        );
        budget = mapBudgetFromApi(activated.resource);
      }
      return scopes(budget, [
        'planning.overview',
        'planning.budget',
        `planning.budget.${budget.id}`,
        'home.summary'
      ]);
    },

    async previewBudgetMove(input) {
      const detail = await readBudgetDetail(input.budgetId);
      if (
        input.amountMinor <= 0 ||
        input.fromCategoryId === input.toCategoryId ||
        !detail.categories.some(
          (item) => item.categoryId === input.fromCategoryId
        ) ||
        !detail.categories.some(
          (item) => item.categoryId === input.toCategoryId
        )
      )
        throw new FinancialPlanningError('validation');
      const categories = detail.categories.map((item) =>
        item.categoryId === input.fromCategoryId
          ? {
              ...item,
              limitMinor: requireSafeMinorSum([
                item.limitMinor,
                -input.amountMinor
              ])
            }
          : item.categoryId === input.toCategoryId
            ? {
                ...item,
                limitMinor: requireSafeMinorSum([
                  item.limitMinor,
                  input.amountMinor
                ])
              }
            : item
      );
      if (categories.some((item) => item.limitMinor < 0))
        throw new FinancialPlanningError('validation');
      const value = {
        previewId: `budget-move-${now()}`,
        budgetId: input.budgetId,
        categories
      };
      previews.set(value.previewId, {
        kind: 'budget',
        value,
        expectedVersion: detail.budget.version
      });
      return value;
    },

    async confirmBudgetMove(previewId, operationId) {
      const identity = await captureLiveClerkIdentity();
      const preview = previews.get(previewId);
      if (!preview || preview.kind !== 'budget')
        throw new FinancialPlanningError('stale_preview');
      const current = await readBudgetDetail(preview.value.budgetId);
      await identity.assertCurrent();
      if (current.budget.version !== preview.expectedVersion)
        throw new FinancialPlanningError('stale_preview');
      await send(
        'PUT',
        `/api/v1/budgets/${current.budget.id}/categories`,
        mutation(categoryMutationSchema),
        {
          operationId,
          identity,
          body: {
            expectedVersion: current.budget.version,
            allocations: preview.value.categories.map((item) => ({
              categoryId:
                categoryIds?.toServer(item.categoryId) ?? item.categoryId,
              limitMinor: String(item.limitMinor),
              rolloverMinor: '0',
              alertThresholds: item.alertThresholds,
              status: item.status
            }))
          }
        }
      );
      previews.delete(previewId);
      return scopes(await readBudgetDetail(current.budget.id), [
        'planning.overview',
        'planning.budget',
        `planning.budget.${current.budget.id}`,
        'home.summary'
      ]);
    },

    async setBudgetStatus(id, expectedVersion, status, operationId) {
      const response = await send(
        'PATCH',
        `/api/v1/budgets/${id}`,
        mutation(budgetSchema),
        { operationId, body: { expectedVersion, patch: { status } } }
      );
      return scopes(mapBudgetFromApi(response.resource), [
        'planning.overview',
        'planning.budget',
        `planning.budget.${id}`,
        'home.summary'
      ]);
    },

    async deleteBudget(id, expectedVersion, operationId) {
      const response = await send(
        'DELETE',
        `/api/v1/budgets/${id}`,
        mutation(budgetSchema),
        { operationId, body: { expectedVersion } }
      );
      return scopes(mapBudgetFromApi(response.resource), [
        'planning.overview',
        'planning.budget',
        `planning.budget.${id}`,
        'home.summary'
      ]);
    },

    async getObligationsOverview(input, context) {
      const [list, summary] = await Promise.all([
        service.listObligations(input, context),
        !input.status || input.status === 'active'
          ? readSummary(
              localDateInTimeZone(
                now(),
                usePreferenceStore.getState().timeZone
              ).slice(0, 7),
              undefined,
              context
            )
          : Promise.resolve(null)
      ]);
      const items = list.items;
      const result = {
        payablesByCurrency: {} as Record<string, number | null>,
        receivablesByCurrency: {} as Record<string, number | null>,
        remainingByObligationId: {} as Record<string, number | null>,
        nextDueDate: null as LocalDate | null,
        nextDueAmountMinor: null as number | null,
        nextDueObligationId: null as string | null,
        items
      };
      const summaries = summary
        ? [...summary.obligations.payables, ...summary.obligations.receivables]
        : [];
      const byId = new Map(summaries.map((item) => [item.id, item]));
      for (const obligation of items) {
        const detail = byId.get(obligation.id);
        const remaining = detail
          ? parsePlanningMinor(detail.remainingMinor)
          : null;
        result.remainingByObligationId[obligation.id] = remaining;
        if (obligation.status !== 'active') continue;
        const totals =
          obligation.direction === 'payable'
            ? result.payablesByCurrency
            : result.receivablesByCurrency;
        if (remaining === null) totals[obligation.currencyCode] = null;
        else if (totals[obligation.currencyCode] !== null)
          totals[obligation.currencyCode] = requireSafeMinorSum([
            totals[obligation.currencyCode] ?? 0,
            remaining
          ]);
        if (
          detail?.nextDueAt &&
          (!result.nextDueDate ||
            localDateInTimeZone(
              Date.parse(detail.nextDueAt),
              usePreferenceStore.getState().timeZone
            ) < result.nextDueDate)
        ) {
          result.nextDueDate = localDateInTimeZone(
            Date.parse(detail.nextDueAt),
            usePreferenceStore.getState().timeZone
          );
          result.nextDueAmountMinor = detail.nextDueAmountMinor
            ? parsePlanningMinor(detail.nextDueAmountMinor)
            : null;
          result.nextDueObligationId = obligation.id;
        }
      }
      return result;
    },

    async listObligations(input, context) {
      const query = input.status
        ? `?status=${encodeURIComponent(input.status)}`
        : '';
      const items = (
        await allPages(`/api/v1/obligations${query}`, obligationSchema, context)
      ).map(fromObligation);
      return { items, nextCursor: null, total: items.length };
    },

    async getObligationHeader(id, context) {
      const wire = await send(
        'GET',
        '/api/v1/obligations/' + encodeURIComponent(id),
        obligationDetailSchema,
        context
      );
      if (!wire.summary)
        return {
          ...(await service.getObligation(id, context)),
          sectionsState: 'complete'
        };
      return {
        ...obligationDetailFromWire(id, wire, [], null),
        sectionsState: 'pending'
      };
    },
    getObligationSchedule: readSchedule,
    async getObligationPayments(id, currencyCode, context) {
      const history = await allPages(
        '/api/v1/obligations/' + encodeURIComponent(id) + '/payments',
        paymentHistorySchema,
        context
      ).catch((error: unknown) => {
        if (
          !(error instanceof HttpError) ||
          ['session_expired', 'forbidden'].includes(error.code)
        )
          throw error;
        return null;
      });
      return {
        items: mapHistory(id, currencyCode, history),
        state: history === null ? 'unavailable' : 'available'
      };
    },

    async getObligation(id, context): Promise<ObligationDetail> {
      const [wire, schedule, history] = await Promise.all([
        send(
          'GET',
          `/api/v1/obligations/${encodeURIComponent(id)}`,
          obligationDetailSchema,
          context
        ),
        readSchedule(id, context),
        allPages(
          `/api/v1/obligations/${encodeURIComponent(id)}/payments`,
          paymentHistorySchema,
          context
        ).catch((error: unknown) => {
          if (
            !(error instanceof HttpError) ||
            ['session_expired', 'forbidden'].includes(error.code)
          )
            throw error;
          return null;
        })
      ]);
      return obligationDetailFromWire(id, wire, schedule, history);
    },

    async createObligation(input, operationId) {
      const response = await send(
        'POST',
        '/api/v1/obligations',
        mutation(obligationSchema),
        { operationId, body: obligationInput(input) }
      );
      const value = fromObligation(response.resource);
      return scopes(value, [
        'planning.overview',
        'planning.obligations',
        `planning.obligation.${value.id}`,
        'home.summary'
      ]);
    },

    async updateObligation(id, expectedVersion, input, operationId) {
      const patch = Object.fromEntries(
        Object.entries(obligationInput(input)).filter(
          ([key]) => key !== 'currencyCode'
        )
      );
      const response = await send(
        'PATCH',
        `/api/v1/obligations/${id}`,
        mutation(obligationSchema),
        {
          operationId,
          body: { expectedVersion, patch }
        }
      );
      return scopes(fromObligation(response.resource), [
        'planning.overview',
        'planning.obligations',
        `planning.obligation.${id}`,
        'home.summary'
      ]);
    },

    async setObligationStatus(id, expectedVersion, status, operationId) {
      const response =
        status === 'archived'
          ? await send(
              'DELETE',
              `/api/v1/obligations/${id}`,
              mutation(obligationSchema),
              { operationId, body: { expectedVersion } }
            )
          : await send(
              'PATCH',
              `/api/v1/obligations/${id}`,
              mutation(obligationSchema),
              { operationId, body: { expectedVersion, patch: { status } } }
            );
      return scopes(fromObligation(response.resource), [
        'planning.overview',
        'planning.obligations',
        `planning.obligation.${id}`,
        'home.summary'
      ]);
    },

    async previewObligationPayment(input) {
      if (!Number.isSafeInteger(input.amountMinor) || input.amountMinor <= 0)
        throw new FinancialPlanningError('validation');
      const [detail, wireSchedule] = await Promise.all([
        service.getObligation(input.obligationId),
        allPages(
          `/api/v1/obligations/${encodeURIComponent(input.obligationId)}/schedule`,
          scheduleSchema
        )
      ]);
      if (detail.obligation.currencyCode !== input.currencyCode)
        throw new FinancialPlanningError('validation');
      const outstanding = requireSafeMinorSum(
        wireSchedule.map((item) =>
          Math.max(
            0,
            requireSafeMinorSum([
              parsePlanningMinor(item.amountMinor),
              -parsePlanningMinor(item.paidMinor)
            ])
          )
        )
      );
      if (input.amountMinor > outstanding) return unsupported();
      let remaining = input.amountMinor;
      const allocations = wireSchedule
        .filter((item) => item.status !== 'paid' && item.status !== 'cancelled')
        .sort(
          (left, right) =>
            left.dueAt.localeCompare(right.dueAt) ||
            left.sequenceNo - right.sequenceNo
        )
        .flatMap((item) => {
          const availableMinor = requireSafeMinorSum([
            parsePlanningMinor(item.amountMinor),
            -parsePlanningMinor(item.paidMinor)
          ]);
          const amountMinor = Math.min(remaining, Math.max(0, availableMinor));
          remaining -= amountMinor;
          return amountMinor > 0
            ? [{ scheduleItemId: item.id, amountMinor }]
            : [];
        });
      const value: ObligationPaymentPreview = {
        previewId: `obligation-payment-${now()}`,
        obligationId: input.obligationId,
        amountMinor: input.amountMinor,
        allocations,
        case: input.amountMinor === outstanding ? 'full' : 'partial',
        expectedVersion: detail.obligation.version
      };
      previews.set(value.previewId, {
        kind: 'payment',
        input,
        expectedVersion: detail.obligation.version,
        value
      });
      return value;
    },

    async confirmObligationPayment(previewId, allocation, operationId) {
      const stored = previews.get(previewId);
      if (!stored || stored.kind !== 'payment')
        throw new FinancialPlanningError('stale_preview');
      const current = await service.getObligation(stored.input.obligationId);
      if (current.obligation.version !== stored.expectedVersion)
        throw new FinancialPlanningError('stale_preview');
      const transaction = stored.input.transaction;
      const created = transaction.kind === 'create';
      const kind =
        current.obligation.direction === 'payable' ? 'expense' : 'income';
      const transactionBody =
        transaction.kind === 'create'
          ? {
              transaction: {
                kind,
                amountMinor: transaction.input.amountMinor,
                currency: transaction.input.currencyCode,
                accountId: transaction.input.accountId,
                categoryId:
                  transaction.input.categoryId ??
                  (kind === 'expense'
                    ? '04000000-0000-4000-8000-000000000019'
                    : '04000000-0000-4000-8000-000000000017'),
                title: transaction.input.title,
                merchant: transaction.input.merchant ?? null,
                note: transaction.input.notes ?? null,
                occurredAt: new Date(
                  transaction.input.occurredAt
                ).toISOString(),
                source: 'manual'
              }
            }
          : { transactionId: transaction.transactionId };
      const response = await send(
        'POST',
        `/api/v1/obligations/${stored.input.obligationId}/payments`,
        mutation(paymentSchema),
        {
          operationId,
          body: {
            ...transactionBody,
            expectedVersion: stored.expectedVersion,
            paymentMethod: null,
            paymentCase: stored.value.case,
            allocationIntent:
              allocation.intent === 'settlement'
                ? 'settlement'
                : allocation.intent,
            source: stored.input.source,
            allocations: allocation.allocations.map((item) => ({
              scheduleItemId: item.scheduleItemId,
              amountMinor: String(item.amountMinor)
            }))
          }
        }
      );
      const wire = response.resource;
      const payment = {
        id: wire.id,
        obligationId: wire.obligationId,
        transactionId: wire.transactionId,
        amountMinor: parsePlanningMinor(wire.amountMinor),
        currencyCode: current.obligation.currencyCode,
        paidDate: localDateInTimeZone(
          Date.parse(wire.paidAt),
          usePreferenceStore.getState().timeZone
        ),
        case: wire.paymentCase,
        allocationIntent:
          wire.allocationIntent === 'prepayment'
            ? ('principal' as const)
            : wire.allocationIntent,
        allocations: allocation.allocations,
        principalReductionMinor:
          wire.allocationIntent === 'prepayment' ||
          wire.allocationIntent === 'principal'
            ? Math.max(
                0,
                stored.value.amountMinor -
                  allocation.allocations.reduce(
                    (sum, item) => sum + item.amountMinor,
                    0
                  )
              )
            : 0,
        settlementAdjustmentMinor: 0,
        source: wire.source,
        transactionOwnership:
          wire.transactionOwnership ??
          (created ? ('created' as const) : ('linked_existing' as const)),
        status: wire.status === 'confirmed' ? ('posted' as const) : wire.status,
        operationId: wire.operationId,
        replacesPaymentId: null,
        version: wire.version,
        syncStatus: 'synced' as const,
        createdAt: Date.parse(wire.createdAt),
        updatedAt: Date.parse(wire.updatedAt)
      };
      payments.set(payment.id, {
        obligationId: payment.obligationId,
        version: payment.version,
        allocations: payment.allocations
      });
      previews.delete(previewId);
      return scopes(
        {
          obligation: (await service.getObligation(payment.obligationId))
            .obligation,
          payment
        },
        [
          'planning.overview',
          'planning.obligations',
          `planning.obligation.${payment.obligationId}`,
          `planning.payment.${payment.id}`,
          'transactions.list',
          'accounts.balances',
          'home.summary'
        ]
      );
    },

    async reverseObligationPayment(paymentId, operationId) {
      const reference = payments.get(paymentId);
      if (!reference) return unsupported();
      const response = await send(
        'POST',
        `/api/v1/obligations/${reference.obligationId}/payments/${paymentId}/reverse`,
        mutation(paymentSchema),
        { operationId, body: { expectedVersion: reference.version } }
      );
      const wire = response.resource;
      const obligation = (await service.getObligation(reference.obligationId))
        .obligation;
      const payment = {
        id: wire.id,
        obligationId: wire.obligationId,
        transactionId: wire.transactionId,
        amountMinor: parsePlanningMinor(wire.amountMinor),
        currencyCode: obligation.currencyCode,
        paidDate: wire.paidAt.slice(0, 10) as LocalDate,
        case: wire.paymentCase,
        allocationIntent:
          wire.allocationIntent === 'prepayment'
            ? ('principal' as const)
            : wire.allocationIntent,
        allocations: reference.allocations,
        principalReductionMinor: 0,
        settlementAdjustmentMinor: 0,
        source: wire.source,
        transactionOwnership:
          wire.transactionOwnership ?? ('linked_existing' as const),
        status: wire.status === 'confirmed' ? ('posted' as const) : wire.status,
        operationId: wire.operationId,
        replacesPaymentId: null,
        version: wire.version,
        syncStatus: 'synced' as const,
        createdAt: Date.parse(wire.createdAt),
        updatedAt: Date.parse(wire.updatedAt)
      };
      return scopes({ obligation, payment }, [
        'planning.overview',
        'planning.obligations',
        `planning.obligation.${obligation.id}`,
        `planning.payment.${payment.id}`,
        'transactions.list',
        `transactions.detail.${payment.transactionId}`,
        'home.summary',
        'accounts.list',
        'accounts.balances'
      ]);
    },

    async previewEarlySettlement() {
      return unsupported();
    },
    async confirmEarlySettlement() {
      return unsupported();
    },

    async listPaymentMatches(input) {
      const status =
        input.status === 'review_required'
          ? 'proposed'
          : input.status === 'resolved'
            ? 'accepted'
            : input.status === 'ignored'
              ? 'rejected'
              : undefined;
      const query = status ? `?status=${status}` : '';
      const items = (
        await allPages(`/api/v1/payment-matches${query}`, paymentMatchSchema)
      ).map(fromMatch);
      return { items, nextCursor: null, total: items.length };
    },

    async getPaymentMatch(id) {
      return fromMatch(
        await send(
          'GET',
          `/api/v1/payment-matches/${id}`,
          paymentMatchDetailSchema
        )
      );
    },

    async resolvePaymentMatch(input, operationId) {
      const current = await send(
        'GET',
        `/api/v1/payment-matches/${input.matchId}`,
        paymentMatchDetailSchema
      );
      if (
        input.action === 'confirm' &&
        (!input.obligationId ||
          current.candidate?.id !== input.obligationId ||
          !current.suggestedAllocation)
      )
        throw new FinancialPlanningError('stale_preview');
      const accepted = input.action === 'confirm';
      const response = await send(
        'PATCH',
        `/api/v1/payment-matches/${input.matchId}`,
        mutation(paymentMatchMutationSchema),
        {
          operationId,
          body: {
            decision: accepted ? 'accepted' : 'rejected',
            expectedVersion: current.version,
            allocation: accepted
              ? {
                  transactionId: current.transaction.id,
                  expectedVersion: current.candidate!.obligationVersion,
                  paymentMethod: null,
                  paymentCase:
                    current.candidate!.nextDueAmountMinor !== null &&
                    parsePlanningMinor(
                      current.candidate!.nextDueAmountMinor
                    ) ===
                      parsePlanningMinor(
                        current.suggestedAllocation!.amountMinor
                      )
                      ? 'full'
                      : 'partial',
                  allocationIntent: 'current',
                  source: 'automatic',
                  allocations: [
                    {
                      scheduleItemId:
                        current.suggestedAllocation!.scheduleItemId,
                      amountMinor: current.suggestedAllocation!.amountMinor
                    }
                  ]
                }
              : null
          }
        }
      );
      return scopes(
        {
          match: fromMatch({
            ...current,
            id: response.resource.id,
            transactionId: response.resource.transactionId,
            obligationId: response.resource.obligationId,
            scheduleItemId: response.resource.scheduleItemId,
            advisoryConfidence: current.advisoryConfidence,
            reasonCodes: current.reasonCodes,
            status: response.resource.status,
            reviewedAt: response.resource.reviewedAt,
            createdAt: response.resource.createdAt,
            updatedAt: response.resource.updatedAt,
            version: response.resource.version
          })
        },
        [
          'planning.overview',
          'planning.obligations',
          ...(input.obligationId
            ? [`planning.obligation.${input.obligationId}`]
            : []),
          'planning.paymentMatches',
          `planning.paymentMatch.${input.matchId}`,
          'accounts.balances',
          'transactions.list',
          'home.summary'
        ]
      );
    },

    async listGoals(input, context) {
      const status = input.status === 'archived' ? 'deleted' : input.status;
      const query = status ? `?status=${status}` : '';
      return (
        await allPages(`/api/v1/savings-goals${query}`, goalSchema, context)
      ).map(mapSavingsGoalFromApi);
    },

    getGoal: readGoal,

    async createGoal(input, operationId) {
      const response = await send(
        'POST',
        '/api/v1/savings-goals',
        mutation(goalSchema),
        { operationId, body: goalInput(input) }
      );
      const goal = mapSavingsGoalFromApi(response.resource);
      return scopes(goal, [
        'planning.overview',
        'planning.goals',
        `planning.goal.${goal.id}`,
        'home.summary'
      ]);
    },

    async updateGoal(id, expectedVersion, input, operationId) {
      const body = goalInput(input);
      const {
        openingTrackedMinor: _opening,
        currencyCode: _currency,
        ...patch
      } = body;
      const response = await send(
        'PATCH',
        `/api/v1/savings-goals/${id}`,
        mutation(goalSchema),
        { operationId, body: { expectedVersion, patch } }
      );
      return scopes(mapSavingsGoalFromApi(response.resource), [
        'planning.overview',
        'planning.goals',
        `planning.goal.${id}`,
        'home.summary'
      ]);
    },

    async setGoalStatus(id, expectedVersion, status, operationId) {
      const response =
        status === 'archived'
          ? await send(
              'DELETE',
              `/api/v1/savings-goals/${id}`,
              mutation(goalSchema),
              { operationId, body: { expectedVersion } }
            )
          : await send(
              'PATCH',
              `/api/v1/savings-goals/${id}`,
              mutation(goalSchema),
              { operationId, body: { expectedVersion, patch: { status } } }
            );
      return scopes(mapSavingsGoalFromApi(response.resource), [
        'planning.overview',
        'planning.goals',
        `planning.goal.${id}`,
        'home.summary'
      ]);
    },

    async previewGoalMovement(input) {
      if (!input.linkedTransactionId || input.kind === 'correction')
        return unsupported();
      const detail = await readGoal(input.goalId);
      const value = {
        previewId: `goal-movement-${now()}`,
        goalId: input.goalId,
        kind: input.kind,
        amountMinor: input.amountMinor
      };
      previews.set(value.previewId, {
        kind: 'goal',
        input,
        expectedVersion: detail.goal.version
      });
      return value;
    },

    async confirmGoalMovement(previewId, operationId) {
      const preview = previews.get(previewId);
      if (
        !preview ||
        preview.kind !== 'goal' ||
        !preview.input.linkedTransactionId
      )
        throw new FinancialPlanningError('stale_preview');
      const current = await readGoal(preview.input.goalId);
      if (current.goal.version !== preview.expectedVersion)
        throw new FinancialPlanningError('stale_preview');
      const kind =
        preview.input.kind === 'correction' ? 'adjustment' : preview.input.kind;
      const response = await send(
        'POST',
        `/api/v1/savings-goals/${preview.input.goalId}/movements`,
        mutation(movementMutationSchema),
        {
          operationId,
          body: {
            transactionId: preview.input.linkedTransactionId,
            expectedVersion: preview.expectedVersion,
            kind,
            amountMinor: String(
              preview.input.kind === 'withdrawal'
                ? -Math.abs(preview.input.amountMinor)
                : preview.input.amountMinor
            ),
            replacesMovementId: null
          }
        }
      );
      const movement = fromMovement(response.resource);
      movements.set(movement.id, {
        goalId: movement.goalId,
        version: response.resource.goalVersion
      });
      previews.delete(previewId);
      return scopes(
        { goal: (await readGoal(movement.goalId)).goal, movement },
        [
          'planning.overview',
          'planning.goals',
          `planning.goal.${movement.goalId}`,
          'home.summary'
        ]
      );
    },

    async reverseGoalMovement(movementId, operationId) {
      const reference = movements.get(movementId);
      if (!reference) return unsupported();
      const response = await send(
        'POST',
        `/api/v1/savings-goals/${reference.goalId}/movements/${movementId}/reverse`,
        mutation(movementMutationSchema),
        { operationId, body: { expectedVersion: reference.version } }
      );
      const movement = fromMovement(response.resource);
      return scopes(
        { goal: (await readGoal(reference.goalId)).goal, movement },
        [
          'planning.overview',
          'planning.goals',
          `planning.goal.${reference.goalId}`,
          'home.summary'
        ]
      );
    },

    async saveDraft(draft) {
      if (!persistent) return repository.saveDraft(draft);
      const owner = await captureLiveClerkOwner();
      return measurePerformance('storage.draft.write', () =>
        writePlanningDraft(owner, draft)
      );
    },

    async loadDraft(id) {
      if (!persistent) return repository.loadDraft(id);
      const owner = await captureLiveClerkOwner();
      return measurePerformance('storage.draft.read', () =>
        readPlanningDraft(owner, id)
      );
    },

    async listDrafts(kind) {
      if (!persistent) return repository.listDrafts(kind);
      return listPlanningDrafts(await captureLiveClerkOwner(), kind);
    },

    async discardDraft(id) {
      if (!persistent) return repository.discardDraft(id);
      return deletePlanningDraft(await captureLiveClerkOwner(), id);
    },

    async getConflict(id) {
      await ensureLocal();
      return repository.requireConflict(id);
    },

    async resolveConflict(id, resolution) {
      await ensureLocal();
      const value = repository.resolveConflict(id, resolution);
      await persistLocal();
      return scopes(value, ['planning.conflict', 'planning.overview']);
    }
  };

  return service;
}
