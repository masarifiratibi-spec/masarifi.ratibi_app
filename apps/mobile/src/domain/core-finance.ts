import { z } from 'zod';

export const accountTypes = [
  'bank',
  'debit_card',
  'credit_card',
  'wallet',
  'cash',
  'savings',
  'other'
] as const;
export const transactionTypes = [
  'expense',
  'income',
  'transfer',
  'refund',
  'reversal',
  'adjustment',
  'obligation_payment',
  'recurring_payment'
] as const;
export const transactionSources = [
  'manual',
  'automatic',
  'voice',
  'platform_assisted',
  'adjustment'
] as const;
export const syncStatuses = [
  'pending',
  'syncing',
  'synced',
  'failed',
  'conflict'
] as const;

export interface MoneyValue {
  minorUnits: number;
  currencyCode: string;
  scale: number;
}

export type AccountType = (typeof accountTypes)[number];
export type TransactionType = (typeof transactionTypes)[number];
export type TransactionSource = (typeof transactionSources)[number];
export type SyncStatus = (typeof syncStatuses)[number];

export interface Account {
  id: string;
  name: string;
  type: AccountType;
  currencyCode: string;
  openingBalanceMinor: number;
  institution: string | null;
  lastFour: string | null;
  creditLimitMinor: number | null;
  isDefault: boolean;
  iconKey: string | null;
  colorKey: string | null;
  notes: string | null;
  status: 'active' | 'archived';
  createdAt: number;
  updatedAt: number;
}

export interface Category {
  id: string;
  kind: 'system' | 'custom';
  parentId: string | null;
  labelAr: string;
  labelEn: string;
  iconKey: string | null;
  colorKey: string | null;
  isFavorite: boolean;
  status: 'active' | 'archived' | 'merged';
  mergedIntoId: string | null;
  createdAt: number;
  updatedAt: number;
}

export interface Transaction {
  id: string;
  type: TransactionType;
  amountMinor: number;
  currencyCode: string;
  accountId: string;
  destinationAccountId: string | null;
  feeMinor: number;
  categoryId: string | null;
  title: string;
  merchant: string | null;
  paymentMethod: string | null;
  occurredAt: number;
  source: TransactionSource;
  status: 'pending' | 'posted' | 'failed' | 'refunded' | 'reversed' | 'deleted';
  reviewStatus: 'none' | 'required' | 'resolved';
  syncStatus: SyncStatus;
  originalTransactionId: string | null;
  obligationId: string | null;
  notes: string | null;
  version: number;
  adjustmentSign: -1 | 1;
  deletedAt: number | null;
  undoExpiresAt: number | null;
  createdAt: number;
  updatedAt: number;
}

export interface TransactionDraft {
  id: string;
  transactionType: TransactionType | null;
  amountText: string;
  accountId: string | null;
  destinationAccountId: string | null;
  categoryId: string | null;
  merchant: string | null;
  notes: string | null;
  occurredAt: number | null;
  status: 'editing' | 'valid' | 'saving' | 'saved' | 'discarded';
  updatedAt: number;
}

export interface TransactionFilterSet {
  search: string;
  periodStart: number | null;
  periodEnd: number | null;
  accountIds: string[];
  categoryIds: string[];
  types: TransactionType[];
  sources: TransactionSource[];
  statuses: Transaction['status'][];
  syncStatuses: SyncStatus[];
  reviewRequired: boolean | null;
  minMinor: number | null;
  maxMinor: number | null;
  sort: 'newest' | 'oldest' | 'amount_high' | 'amount_low';
}

export interface SyncConflict {
  id: string;
  transactionId: string;
  localSnapshot: Transaction;
  laterSnapshot: Transaction;
  resolution: 'keep_local' | 'keep_later' | 'keep_both' | null;
  status: 'pending' | 'resolving' | 'resolved' | 'failed';
  createdAt: number;
  resolvedAt: number | null;
}

export interface ExchangeRateEstimate {
  baseCurrencyCode: string;
  quoteCurrencyCode: string;
  rate: number;
  asOf: number;
  status: 'available' | 'stale' | 'unavailable';
}

export interface EstimatedComponent {
  accountId: string;
  originalMinor: number;
  currencyCode: string;
  convertedMinor: number;
  rate: number;
  asOf: number;
}

export interface HomeSummary {
  totalBalanceMinor: number;
  currencyCode: string;
  isEstimated: boolean;
  components: EstimatedComponent[];
  excludedAccountIds: string[];
  periodIncomeMinor: number;
  periodExpenseMinor: number;
  activeAccountCount: number;
  recentTransactions: Transaction[];
  reviewCount: number;
  pendingSyncCount: number;
  dataState: 'ready' | 'empty' | 'partial' | 'offline' | 'stale';
}

export const emptyTransactionFilters: TransactionFilterSet = {
  search: '',
  periodStart: null,
  periodEnd: null,
  accountIds: [],
  categoryIds: [],
  types: [],
  sources: [],
  statuses: [],
  syncStatuses: [],
  reviewRequired: null,
  minMinor: null,
  maxMinor: null,
  sort: 'newest'
};

const currencyCodeSchema = z
  .string()
  .trim()
  .regex(/^[A-Z]{3}$/);
const safeMinorSchema = z.number().int().safe();

export const accountInputSchema = z.object({
  name: z.string().trim().min(1),
  type: z.enum(accountTypes),
  currencyCode: currencyCodeSchema,
  openingBalanceMinor: safeMinorSchema,
  institution: z.string().trim().max(100).nullable().default(null),
  lastFour: z
    .string()
    .regex(/^\d{4}$/)
    .nullable()
    .default(null),
  creditLimitMinor: safeMinorSchema.nonnegative().nullable().default(null),
  isDefault: z.boolean().default(false),
  notes: z.string().trim().max(500).nullable().default(null)
});

export const categoryInputSchema = z
  .object({
    id: z.string().optional(),
    labelAr: z.string().trim().min(1),
    labelEn: z.string().trim().min(1),
    parentId: z.string().nullable().default(null),
    iconKey: z.string().nullable().default(null),
    colorKey: z.string().nullable().default(null),
    isFavorite: z.boolean().default(false)
  })
  .superRefine((value, context) => {
    if (value.id && value.parentId === value.id) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['parentId'],
        message: 'coreFinance.validation.categoryCycle'
      });
    }
  });

export const transactionInputSchema = z
  .object({
    type: z.enum(transactionTypes),
    amountMinor: safeMinorSchema.positive(),
    currencyCode: currencyCodeSchema,
    accountId: z.string().min(1),
    destinationAccountId: z.string().nullable().default(null),
    feeMinor: safeMinorSchema.nonnegative().default(0),
    categoryId: z.string().nullable().default(null),
    title: z.string().trim().min(1),
    merchant: z.string().trim().nullable().default(null),
    occurredAt: z.number().int().nonnegative(),
    notes: z.string().trim().max(500).nullable().default(null),
    originalTransactionId: z.string().nullable().default(null),
    obligationId: z.string().nullable().default(null)
  })
  .superRefine((value, context) => {
    if (
      value.type === 'transfer' &&
      (!value.destinationAccountId ||
        value.destinationAccountId === value.accountId)
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['destinationAccountId'],
        message: 'coreFinance.validation.transferAccounts'
      });
    }
    if (
      value.type !== 'transfer' &&
      value.type !== 'adjustment' &&
      !value.categoryId
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['categoryId'],
        message: 'coreFinance.validation.categoryRequired'
      });
    }
    if (
      (value.type === 'refund' || value.type === 'reversal') &&
      !value.originalTransactionId
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['originalTransactionId'],
        message: 'coreFinance.validation.originalRequired'
      });
    }
  });

export const draftInputSchema = z.object({
  id: z.string().min(1),
  transactionType: z.enum(transactionTypes).nullable(),
  amountText: z.string(),
  accountId: z.string().nullable(),
  destinationAccountId: z.string().nullable(),
  categoryId: z.string().nullable(),
  merchant: z.string().trim().nullable(),
  notes: z.string().trim().max(500).nullable(),
  occurredAt: z.number().int().nonnegative().nullable(),
  status: z.enum(['editing', 'valid', 'saving', 'saved', 'discarded']),
  updatedAt: z.number().int().nonnegative()
});

export const conflictResolutionSchema = z.enum([
  'keep_local',
  'keep_later',
  'keep_both'
]);

export type AccountInput = z.input<typeof accountInputSchema>;
export type CategoryInput = z.input<typeof categoryInputSchema>;
export type TransactionInput = z.input<typeof transactionInputSchema>;
export type DraftInput = z.input<typeof draftInputSchema>;
export type ConflictResolution = z.input<typeof conflictResolutionSchema>;

export function parseAmountToMinor(text: string, scale = 2): number | null {
  const normalized = text.trim().replaceAll(',', '');
  if (!/^\d+(?:\.\d+)?$/.test(normalized)) return null;
  const [whole, fraction = ''] = normalized.split('.');
  if (fraction.length > scale) return null;
  const value =
    Number(whole) * 10 ** scale + Number(fraction.padEnd(scale, '0'));
  return Number.isSafeInteger(value) ? value : null;
}

export function transactionEffectForAccount(
  transaction: Transaction,
  accountId: string
): number {
  if (
    transaction.syncStatus === 'conflict' ||
    transaction.status !== 'posted' &&
      transaction.status !== 'refunded' &&
      transaction.status !== 'reversed'
  )
    return 0;
  if (transaction.type === 'transfer') {
    if (transaction.accountId === accountId)
      return -(transaction.amountMinor + transaction.feeMinor);
    return transaction.destinationAccountId === accountId
      ? transaction.amountMinor
      : 0;
  }
  if (transaction.accountId !== accountId) return 0;
  if (transaction.type === 'income' || transaction.type === 'refund')
    return transaction.amountMinor;
  if (transaction.type === 'adjustment')
    return transaction.amountMinor * transaction.adjustmentSign;
  if (transaction.type === 'reversal')
    return transaction.amountMinor * transaction.adjustmentSign;
  return -transaction.amountMinor;
}

export function deriveAccountBalance(
  account: Account,
  transactions: readonly Transaction[]
): number {
  return transactions.reduce(
    (total, transaction) =>
      total + transactionEffectForAccount(transaction, account.id),
    account.openingBalanceMinor
  );
}

export function normalizeSearch(value: string): string {
  return value
    .trim()
    .toLocaleLowerCase('en')
    .normalize('NFKD')
    .replace(/[\u064B-\u065F\u0670]/g, '');
}

export function matchesFilters(
  transaction: Transaction,
  filters: TransactionFilterSet
): boolean {
  const query = normalizeSearch(filters.search);
  if (
    query &&
    !normalizeSearch(
      `${transaction.title} ${transaction.merchant ?? ''}`
    ).includes(query)
  )
    return false;
  if (
    filters.periodStart !== null &&
    transaction.occurredAt < filters.periodStart
  )
    return false;
  if (filters.periodEnd !== null && transaction.occurredAt > filters.periodEnd)
    return false;
  if (
    filters.accountIds.length &&
    !filters.accountIds.includes(transaction.accountId)
  )
    return false;
  if (
    filters.categoryIds.length &&
    (!transaction.categoryId ||
      !filters.categoryIds.includes(transaction.categoryId))
  )
    return false;
  if (filters.types.length && !filters.types.includes(transaction.type))
    return false;
  if (filters.sources.length && !filters.sources.includes(transaction.source))
    return false;
  if (filters.statuses.length && !filters.statuses.includes(transaction.status))
    return false;
  if (
    filters.syncStatuses.length &&
    !filters.syncStatuses.includes(transaction.syncStatus)
  )
    return false;
  if (
    filters.reviewRequired !== null &&
    (transaction.reviewStatus === 'required') !== filters.reviewRequired
  )
    return false;
  if (filters.minMinor !== null && transaction.amountMinor < filters.minMinor)
    return false;
  if (filters.maxMinor !== null && transaction.amountMinor > filters.maxMinor)
    return false;
  return true;
}
