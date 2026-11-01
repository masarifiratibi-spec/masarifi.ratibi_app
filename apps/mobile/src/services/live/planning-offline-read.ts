import { z } from 'zod';
import {
  daysBetween,
  parseLocalDate,
  unavailable,
  type SalaryCycle,
  type LocalDate
} from '@/domain/financial-planning';
import type { StoredRead } from '@/services/local-read-cache';
import { readRecoveryNetwork } from '@/services/platform/read-recovery-network';
import { HttpError } from './http-client';

export async function isPlanningOffline(): Promise<boolean> {
  if (!readRecoveryNetwork.available) return false;
  try {
    return (await readRecoveryNetwork.isOnline()) === false;
  } catch {
    return false;
  }
}

const localDate = z
  .string()
  .refine((value) => {
    try {
      parseLocalDate(value);
      return true;
    } catch {
      return false;
    }
  })
  .transform((value) => value as LocalDate);
const minor = z.number().int().safe();
const currency = z.string().regex(/^[A-Z]{3}$/u);
const metadata = {
  id: z.string().min(1),
  version: minor.positive(),
  syncStatus: z.enum(['synced', 'pending', 'syncing', 'failed', 'conflict']),
  createdAt: z.number().finite(),
  updatedAt: z.number().finite()
};
const reason = z.enum([
  'missing_data',
  'missing_rate',
  'insufficient_history',
  'salary_overdue',
  'cycle_elapsed',
  'balance_negative'
]);
const calculation = <T extends z.ZodTypeAny>(value: T) =>
  z.union([
    z.object({
      status: z.literal('available'),
      value,
      estimated: z.boolean(),
      asOf: z.number().finite().nullable()
    }),
    z.object({ status: z.literal('unavailable'), reason })
  ]);
const amount = calculation(
  z.object({
    minorUnits: minor,
    currencyCode: currency,
    scale: minor.min(0).max(6)
  })
);
export const offlineSalarySchema = z.object({
  profileId: z.string().nullable(),
  startReceiptId: z.string().nullable(),
  startDate: localDate.nullable(),
  projectedNextSalaryDate: localDate.nullable(),
  daysRemaining: minor.nonnegative(),
  income: amount,
  expenses: amount,
  reservedObligations: amount,
  remaining: amount,
  suggestedDaily: amount,
  previousCycleComparison: calculation(z.object({ deltaMinor: minor })),
  salaryState: z.enum(['on_time', 'early', 'late', 'overdue', 'unconfigured']),
  dataState: z.enum(['ready', 'empty', 'partial', 'stale', 'offline'])
});
export const offlineProfileSchema = z
  .object({
    ...metadata,
    expectedAmountMinor: minor.nonnegative(),
    currencyCode: currency,
    salaryDay: minor.min(1).max(31),
    sourceName: z.string(),
    receivingAccountId: z.string().nullable(),
    nextExpectedDate: localDate,
    automaticDetectionEnabled: z.boolean(),
    status: z.enum(['active', 'paused', 'archived'])
  })
  .nullable();
const obligation = z.object({
  ...metadata,
  direction: z.enum(['payable', 'receivable']),
  type: z.enum([
    'car_installment',
    'personal_loan',
    'buy_now_pay_later',
    'credit_card_installment',
    'rent',
    'utility',
    'subscription',
    'debt',
    'custom'
  ]),
  scheduleKind: z.enum(['fixed_term', 'open_ended', 'irregular']),
  frequency: z
    .enum([
      'monthly',
      'weekly',
      'biweekly',
      'quarterly',
      'yearly',
      'custom',
      'irregular'
    ])
    .optional(),
  customIntervalDays: minor.nullable().optional(),
  title: z.string(),
  provider: z.string().nullable(),
  currencyCode: currency,
  contractedTotalMinor: minor.nullable(),
  openingPaidMinor: minor.nonnegative(),
  installmentAmountMinor: minor.nullable(),
  installmentCount: minor.nullable(),
  dueDay: minor.nullable(),
  startDate: localDate.nullable(),
  endDate: localDate.nullable(),
  fundingAccountId: z.string().nullable(),
  automaticMatchingEnabled: z.boolean(),
  providerKeywords: z.array(z.string()),
  reminderTiming: z.string().nullable(),
  notes: z.string().nullable(),
  status: z.enum(['active', 'paused', 'completed', 'closed', 'archived'])
});
export const offlineObligationsSchema = z.object({
  payablesByCurrency: z.record(currency, minor.nullable()),
  receivablesByCurrency: z.record(currency, minor.nullable()),
  remainingByObligationId: z.record(minor.nullable()),
  nextDueDate: localDate.nullable(),
  nextDueAmountMinor: minor.nullable(),
  nextDueObligationId: z.string().nullable(),
  items: z.array(obligation)
});

export function assertPlanningCacheReadable(
  reads: StoredRead[],
  family: 'salary' | 'obligations'
) {
  if (reads.some((read) => read.key[1] === family && read.key[2] === 'denied'))
    throw new HttpError('forbidden', 403);
}

/** Last-known amounts retain their timestamp; a new day's allowance is unknown. */
export function offlineSalary(
  cycle: SalaryCycle,
  today: LocalDate,
  updatedAt: number
): SalaryCycle {
  const stamp = (value: SalaryCycle['income']) =>
    value.status === 'available'
      ? { ...value, asOf: value.asOf ?? updatedAt }
      : value;
  return {
    ...cycle,
    dataState: 'offline',
    daysRemaining: cycle.projectedNextSalaryDate
      ? Math.max(0, daysBetween(today, cycle.projectedNextSalaryDate))
      : 0,
    income: stamp(cycle.income),
    expenses: stamp(cycle.expenses),
    reservedObligations: stamp(cycle.reservedObligations),
    remaining: stamp(cycle.remaining),
    suggestedDaily: unavailable('insufficient_history')
  };
}
