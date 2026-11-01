import { assertBenchmarkRead } from '@/config/client-runtime';
import { randomUUID } from 'expo-crypto';
import { AppState } from 'react-native';
import { z } from 'zod';
import { sha256 } from '@noble/hashes/sha256';
import { bytesToHex } from '@noble/hashes/utils';

import {
  matchesFilters,
  safeMinorSum,
  transactionInputSchema,
  type Transaction,
  type TransactionDraft,
  type TransactionFilterSet,
  type TransactionInput
} from '@/domain/core-finance';
import type {
  CoreFinanceService,
  DeleteResult,
  MutationResult,
  TransactionPage
} from '@/services/contracts/core-finance-service';
import { CoreFinanceError } from '@/services/contracts/core-finance-service';
import { CoreFinanceRepository } from '@/storage/core-finance-repository';
import { useAppShellStore } from '@/state/app-shell';
import { readRecoveryNetwork } from '@/services/platform/read-recovery-network';
import {
  assertNoQueuedTransactionMutation,
  readTransactionEditJournal,
  writeTransactionEditJournal,
  deleteTransactionEditJournal,
  uncertainEdit,
  type TransactionEditJournal,
  type TransactionEditGuard
} from '@/storage/transaction-edit-journal';
import type { DraftOwner } from '@/storage/transaction-draft-snapshots';
import {
  readTransactionDraft,
  writeTransactionDraft,
  deleteTransactionDraft
} from '@/storage/core-finance-draft-storage';
import { CoreFinanceSyncAdapter } from '@/storage/core-finance-sync-adapter';
import { openDatabase } from '@/storage/database';
import { SyncRepository } from '@/storage/sync-repository';
import { SyncHttpService, SyncServiceError } from '@/services/contracts/sync-service';
import {
  captureLiveClerkIdentity,
  captureLiveClerkOwner,
  captureLiveReadClerkIdentity
} from './auth-service';
import {
  HttpError,
  requestJson,
  requestRecentAuthentication
} from './http-client';
import {
  ledgerDetailSchema as detailSchema,
  ledgerSummarySchema as summarySchema,
  serverKind,
  serverStatus
} from './ledger-api-contract';
import { readHomeTodayActivity } from '@/services/home-today-activity';
import { measurePerformance } from '@/services/platform/performance-timing';
import { SharedReadPool } from './shared-read';
import {
  registerRuntimeIdentityReset,
  registerRuntimeUserDataReset
} from '@/storage/runtime-user-data-reset';

const uuid = z.string().uuid();
const instant = z.string().datetime({ offset: true });
const nullableInstant = instant.nullable();
const safeMinor = z.number().int().safe();
const pageSchema = z
  .object({
    items: z.array(summarySchema).max(100),
    nextCursor: z.string().max(512).nullable(),
    ledgerVersion: z.number().int().safe().nonnegative(),
    requestId: z.string().min(1).max(128)
  })
  .strict();
const balanceSchema = z
  .object({
    accountId: uuid,
    currency: z.string().regex(/^[A-Z]{3}$/u),
    confirmedMinor: safeMinor,
    pendingMinor: safeMinor,
    ledgerVersion: z.number().int().safe().nonnegative(),
    reconciledAt: nullableInstant.optional().default(null)
  })
  .strict();
const mutationSchema = z
  .object({
    transaction: detailSchema,
    balances: z.array(balanceSchema).min(1).max(3),
    ledgerVersion: z.number().int().safe().positive(),
    requestId: z.string().min(1).max(128)
  })
  .strict();
const linkedMutationSchema = mutationSchema
  .extend({ original: summarySchema })
  .strict();
const deleteSchema = z
  .object({
    transactionId: uuid,
    deletedAt: instant,
    undoExpiresAt: instant,
    version: z.number().int().safe().positive(),
    balances: z.array(balanceSchema).min(1).max(3),
    ledgerVersion: z.number().int().safe().positive(),
    requestId: z.string().min(1).max(128)
  })
  .strict();
const syncCursor = z
  .string()
  .min(45)
  .max(256)
  .regex(/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]{43}$/u);
const syncDomain = z.enum(['accounts', 'categories', 'transactions']);
const syncMeta = z.object({ requestId: z.string().min(1) }).strict();
const bootstrapSchema = z
  .object({
    data: z
      .object({
        domains: z.array(
          z
            .object({
              domain: syncDomain,
              cursor: syncCursor,
              items: z.array(z.record(z.unknown())),
              hasMore: z.boolean(),
              nextPage: syncCursor.nullable()
            })
            .strict()
        )
      })
      .strict(),
    meta: syncMeta
  })
  .strict();
const deltaSchema = z
  .object({
    data: z
      .object({
        domain: syncDomain,
        changes: z.array(
          z
            .object({
              cursor: syncCursor.optional(),
              resourceId: z.string().min(1),
              resourceType: z.string().min(1),
              operation: z.enum(['upsert', 'delete']),
              version: z.number().int().safe().nonnegative(),
              snapshot: z.record(z.unknown()).optional(),
              deletedAt: nullableInstant.optional().default(null)
            })
            .strict()
        ),
        nextCursor: syncCursor,
        hasMore: z.boolean()
      })
      .strict(),
    meta: syncMeta
  })
  .strict();
const receiptSchema = z
  .object({
    operationId: uuid,
    status: z.enum([
      'received',
      'processing',
      'applied',
      'conflict',
      'rejected'
    ]),
    resourceId: z.string().min(1).optional(),
    result: z.record(z.unknown()).optional(),
    conflictId: uuid.optional(),
    error: z
      .object({
        code: z.string().regex(/^[A-Z][A-Z0-9_]{0,79}$/u),
        message: z.string().min(1).max(200).optional()
      })
      .strip()
      .optional()
  })
  .strict();
const mutationBatchSchema = z
  .object({
    data: z
      .object({ receipts: z.array(receiptSchema).min(1).max(100) })
      .strict(),
    meta: syncMeta
  })
  .strict();
const conflictSchema = z
  .object({
    id: uuid,
    transactionId: uuid,
    clientMutationId: uuid,
    serverVersion: z.number().int().safe().nonnegative(),
    clientVersion: z.number().int().safe().nonnegative(),
    conflictFields: z.array(z.string()),
    serverSnapshot: z.record(z.unknown()),
    clientSnapshot: z.record(z.unknown()),
    status: z.enum(['open', 'resolved', 'rejected']),
    resolution: z
      .enum(['server', 'client', 'merged', 'duplicate'])
      .nullable()
      .optional()
      .default(null),
    createdAt: instant,
    resolvedAt: nullableInstant.optional().default(null)
  })
  .strict();
const conflictListSchema = z
  .object({
    data: z
      .object({
        items: z.array(conflictSchema),
        nextCursor: z.string().nullable().optional().default(null)
      })
      .strict(),
    meta: syncMeta
  })
  .strict();
const conflictResponseSchema = z
  .object({ data: conflictSchema, meta: syncMeta })
  .strict();
const devicePageSchema = z
  .object({
    items: z.array(z.object({ id: uuid, current: z.boolean() }).passthrough()),
    nextCursor: z.string().nullable()
  })
  .passthrough();

type LedgerService = Pick<
  CoreFinanceService,
  | 'getHomeTodayActivity'
  | 'listTransactions'
  | 'getTransaction'
  | 'getRemainingRefundableMinor'
  | 'createTransaction'
  | 'createCardPayoff'
  | 'createTransactionsAtomically'
  | 'updateTransaction'
  | 'saveDraft'
  | 'loadDraft'
  | 'discardDraft'
  | 'deleteTransaction'
  | 'undoDelete'
  | 'getConflict'
  | 'resolveConflict'
>;

export function createLiveLedgerService({
  baseUrl = process.env.EXPO_PUBLIC_API_URL ?? '',
  request = fetch,
  drafts = new CoreFinanceRepository(),
  categoryIds,
  offlineUpdate
}: {
  baseUrl?: string;
  request?: typeof fetch;
  drafts?: CoreFinanceRepository;
  categoryIds?: {
    prepare(): Promise<void>;
    toServer(id: string): string;
    toLocal(id: string): string;
  };
  offlineUpdate?: (
    id: string,
    input: TransactionInput,
    owner: DraftOwner,
    assertSafe: TransactionEditGuard
  ) => Promise<MutationResult<Transaction> | null>;
} = {}): LedgerService {
  const ownerRepositories = new Map<
    string,
    { repository: CoreFinanceRepository; ready: Promise<void> | null }
  >();
  const ensureLocalReady = async () => {
    const owner = await captureLiveClerkOwner();
    let local = ownerRepositories.get(owner.userId);
    if (!local) {
      const repository =
        ownerRepositories.size === 0 ? drafts : new CoreFinanceRepository();
      repository.bindOwner(owner.userId);
      local = { repository, ready: null };
      ownerRepositories.set(owner.userId, local);
    }
    const ready = (local.ready ??= local.repository.hydrate({
      preserveDrafts: true
    }));
    try {
      await ready;
    } catch (error) {
      if (local.ready === ready) local.ready = null;
      throw error;
    }
    await owner.assertCurrent();
    return { ...local, owner };
  };
  const pending = new Map<
    string,
    { operationId: string; expectedVersion?: number; prepared?: boolean }
  >();
  const inFlight = new Map<string, Promise<unknown>>();
  const sharedReads = new SharedReadPool();
  registerRuntimeIdentityReset(() => sharedReads.clear());
  registerRuntimeUserDataReset(() => sharedReads.clear());
  const send = async <T>(
    method: string,
    path: string,
    schema: z.ZodType<T>,
    body?: Record<string, unknown>,
    operationId?: string,
    signal?: AbortSignal,
    capturedIdentity?: Awaited<ReturnType<typeof captureLiveClerkIdentity>>
  ): Promise<T> => {
    assertBenchmarkRead(method);
    if (method !== 'GET' && !operationId?.trim())
      throw new HttpError('validation_error', 400);
    const identity =
      capturedIdentity ??
      (await (method === 'GET'
        ? captureLiveReadClerkIdentity()
        : captureLiveClerkIdentity()));
    if (!capturedIdentity) await categoryIds?.prepare();
    await identity.assertCurrent();
    const serverBody =
      body && typeof body.categoryId === 'string'
        ? {
            ...body,
            categoryId:
              categoryIds?.toServer(body.categoryId) ?? body.categoryId
          }
        : body;
    const perform = (activeSignal?: AbortSignal) =>
      requestJson(path, schema, {
        baseUrl,
        request,
        method,
        signal: activeSignal,
        body: serverBody,
        token: identity.token,
        headers: operationId ? { 'Idempotency-Key': operationId } : undefined
      });
    const value =
      method === 'GET'
        ? await sharedReads.read(
            `${identity.userId}:${identity.token}:${path}`,
            signal,
            perform
          )
        : await perform(signal);
    try {
      await identity.assertCurrent();
    } catch (error) {
      if (method !== 'GET') throw new HttpError('provider_unavailable', 503);
      throw error;
    }
    return value;
  };
  const mutate = async <T>(
    key: string,
    prepare: () => Promise<number | undefined>,
    command: (
      state: {
        operationId: string;
        expectedVersion?: number;
      },
      identity: Awaited<ReturnType<typeof captureLiveClerkIdentity>>
    ) => Promise<T>,
    operationId?: string
  ): Promise<T> => {
    const identity = await captureLiveClerkIdentity();
    const scopedKey = `${identity.userId}:${operationId?.trim() ?? ''}:${key}`;
    const active = inFlight.get(scopedKey);
    if (active) return active as Promise<T>;
    const operation = (async () => {
      let state = pending.get(scopedKey);
      if (!state) {
        state = { operationId: operationId?.trim() || randomUUID() };
        pending.set(scopedKey, state);
      }
      try {
        if (!state.prepared) {
          state.expectedVersion = await prepare();
          state.prepared = true;
        }
        await identity.assertCurrent();
        const value = await command(state, identity);
        try {
          await identity.assertCurrent();
        } catch {
          throw new HttpError('provider_unavailable', 503);
        }
        pending.delete(scopedKey);
        return value;
      } catch (error) {
        if (
          !(error instanceof HttpError) ||
          (![
            'provider_unavailable',
            'internal_error',
            'contract_mismatch'
          ].includes(error.code) &&
            !['IDEMPOTENCY_IN_PROGRESS', 'LEDGER_BUSY'].includes(
              error.domainCode ?? ''
            ))
        )
          pending.delete(scopedKey);
        throw error;
      }
    })();
    inFlight.set(scopedKey, operation);
    try {
      return await operation;
    } finally {
      inFlight.delete(scopedKey);
    }
  };
  const localTransaction = (transaction: Transaction): Transaction => ({
    ...transaction,
    categoryId: transaction.categoryId
      ? (categoryIds?.toLocal(transaction.categoryId) ?? transaction.categoryId)
      : null
  });
  const detailTransaction = (value: unknown) =>
    localTransaction(transactionFromDetail(value));
  const transactionIds = async (id: string, owner: DraftOwner) => {
    const queue = new SyncRepository(await openDatabase(owner.userId));
    const serverId = await queue.serverId('transactions', id);
    const localId = await queue.localId('transactions', serverId);
    await owner.assertCurrent();
    return { serverId, localId };
  };
  const mappedTransaction = async (transaction: Transaction, owner: DraftOwner) => {
    const ids = await transactionIds(transaction.id, owner);
    return { ...transaction, id: ids.localId };
  };
  const current = async (
    id: string,
    identity?: Awaited<ReturnType<typeof captureLiveClerkIdentity>>
  ) => {
    const owner = identity ?? (await captureLiveClerkOwner());
    const ids = await transactionIds(id, owner);
    const detail = await send(
      'GET',
      `/api/v1/transactions/${encodeURIComponent(ids.serverId)}`,
      detailSchema,
      undefined,
      undefined,
      undefined,
      identity
    );
    await owner.assertCurrent();
    if (detail.transaction.id !== ids.serverId) throw new HttpError('contract_mismatch', 502);
    return { ...detailTransaction(detail), id: ids.localId };
  };
  const mutationResult = (value: Transaction): MutationResult<Transaction> => ({
    value,
    affectedScopes: transactionScopes(value.id)
  });

  const listTransactions = async (
    filters: TransactionFilterSet,
    cursor: string | null = null,
    pageSize = 25,
    signal?: AbortSignal
  ): Promise<TransactionPage> => {
    if (!Number.isSafeInteger(pageSize) || pageSize < 1 || pageSize > 100)
      throw new CoreFinanceError('validation');
    const owner = await captureLiveReadClerkIdentity();
    const prepareCategories = () =>
      measurePerformance('ledger.categories', async () => {
        await categoryIds?.prepare();
      });
    const readPage = async () => {
      await owner.assertCurrent();
      const query = ledgerQuery(
        {
          ...filters,
          categoryIds: filters.categoryIds.map(
            (id) => categoryIds?.toServer(id) ?? id
          )
        },
        cursor,
        pageSize
      );
      return measurePerformance('ledger.read', () =>
        send(
          'GET',
          `/api/v1/transactions?${query.toString()}`,
          pageSchema,
          undefined,
          undefined,
          signal,
          owner
        )
      );
    };
    // Only category-filtered transport needs the mapping before it can start.
    let page: Awaited<ReturnType<typeof readPage>>;
    if (filters.categoryIds.length) {
      await prepareCategories();
      page = await readPage();
    } else {
      [, page] = await Promise.all([prepareCategories(), readPage()]);
    }
    await owner.assertCurrent();
    const accountId =
      filters.accountIds.length === 1 ? filters.accountIds[0] : undefined;
    const projected = await Promise.all(
      page.items.map(async (item) => {
        if (!['opening', 'adjustment', 'reversal'].includes(item.kind))
          return localTransaction(transactionFromSummary(item));
        const projectionAccountId = accountId ?? item.sourceAccountId;
        const detail = await send(
          'GET',
          `/api/v1/transactions/${item.id}`,
          detailSchema,
          undefined,
          undefined,
          signal,
          owner
        );
        if (
          detail.transaction.id !== item.id ||
          detail.transaction.version !== item.version ||
          detail.transaction.kind !== item.kind ||
          detail.transaction.status !== item.status ||
          detail.transaction.currency !== item.currency ||
          detail.transaction.amountMinor !== item.amountMinor
        )
          throw new CoreFinanceError('conflict');
        const postings = detail.postings.filter(
          (posting) =>
            posting.accountId === projectionAccountId &&
            posting.clearingState === 'confirmed'
        );
        if (!postings.length) throw new CoreFinanceError('conflict');
        const signedAmount = postings.reduce((total, posting) => {
          const sum = safeMinorSum(total, posting.amountMinor);
          if (sum === null) throw new CoreFinanceError('unknown');
          return sum;
        }, 0);
        return localTransaction(
          transactionFromSummary(
            item,
            projectionAccountId,
            undefined,
            signedAmount
          )
        );
      })
    );
    await owner.assertCurrent();
    const localFilters = {
      ...filters,
      categoryIds: filters.categoryIds.map(
        (id) => categoryIds?.toLocal(id) ?? id
      )
    };
    const stable = await Promise.all(projected.map(transaction => mappedTransaction(transaction, owner)));
    const items = stable.filter((item) =>
      matchesFilters(item, localFilters)
    );
    return { items, nextCursor: page.nextCursor };
  };
  return {
    listTransactions,
    async getHomeTodayActivity(filters, signal) {
      return measurePerformance('ledger.today', async () => {
        const owner = await captureLiveReadClerkIdentity();
        const activity = await readHomeTodayActivity({
          filters,
          signal,
          listTransactions,
          readSignedEffect: async (transaction) => {
            const ids = await transactionIds(transaction.id, owner);
            const detail = await send(
              'GET',
              `/api/v1/transactions/${ids.serverId}`,
              detailSchema,
              undefined,
              undefined,
              signal
            );
            if (
              detail.transaction.version !== transaction.version ||
              detail.transaction.id !== ids.serverId ||
              detail.transaction.currency !== transaction.currencyCode ||
              detail.postings.some(
                (posting) => posting.clearingState !== 'confirmed'
              )
            )
              throw new CoreFinanceError('conflict');
            if (detail.transaction.kind === 'opening') return null;
            if (
              detail.transaction.kind === 'reversal' &&
              detail.transaction.originalTransactionId
            ) {
              const original = await send(
                'GET',
                `/api/v1/transactions/${detail.transaction.originalTransactionId}`,
                detailSchema,
                undefined,
                undefined,
                signal
              );
              if (
                original.transaction.kind === 'transfer' ||
                original.transaction.kind === 'opening'
              )
                return null;
            }
            return detail.postings
              .filter((posting) => posting.clearingState === 'confirmed')
              .reduce((total, posting) => {
                const sum = safeMinorSum(total, posting.amountMinor);
                if (sum === null) throw new CoreFinanceError('unknown');
                return sum;
              }, 0);
          }
        });
        await owner.assertCurrent();
        return activity;
      });
    },
    getTransaction: current,
    async getRemainingRefundableMinor(originalTransactionId, excludedRefundId) {
      const owner = await captureLiveClerkOwner();
      const originalIds = await transactionIds(originalTransactionId, owner);
      const excludedIds = excludedRefundId ? await transactionIds(excludedRefundId, owner) : null;
      const original = await current(originalTransactionId);
      if (original.type !== 'expense') throw new CoreFinanceError('validation');
      let refunded = 0;
      let cursor: string | null = null;
      const seen = new Set<string>();
      do {
        const query = new URLSearchParams({ kind: 'refund', limit: '100' });
        if (cursor) query.set('cursor', cursor);
        const page = await send(
          'GET',
          `/api/v1/transactions?${query.toString()}`,
          pageSchema
        );
        for (const item of page.items)
          if (
            item.id !== excludedIds?.serverId &&
            item.originalTransactionId === originalIds.serverId &&
            item.status !== 'deleted'
          ) {
            refunded += item.amountMinor;
            if (!Number.isSafeInteger(refunded))
              throw new HttpError('contract_mismatch', 502);
          }
        cursor = page.nextCursor;
        if (cursor && seen.has(cursor))
          throw new HttpError('contract_mismatch', 502);
        if (cursor) seen.add(cursor);
      } while (cursor);
      return Math.max(0, original.amountMinor - refunded);
    },
    async createTransaction(input, operationId, source, preparedVersion) {
      assertBenchmarkRead('POST');
      const value = transactionInputSchema.parse(input);
      if (value.type === 'transfer') {
        const result = await mutate(
          `transaction:transfer:${JSON.stringify(value)}`,
          async () => undefined,
          ({ operationId: key }) => createTransfer(send, value, key),
          operationId
        );
        return mutationResult(result);
      }
      if (value.type === 'refund' || value.type === 'reversal') {
        const owner = await captureLiveClerkOwner();
        const { serverId: originalId } = await transactionIds(value.originalTransactionId!, owner);
        const result = await mutate(
          `${value.type}:${originalId}:${JSON.stringify(value)}:${preparedVersion ?? ''}`,
          async () => preparedVersion ?? (await current(originalId)).version,
          async ({ operationId: key, expectedVersion }) => {
            const path =
              value.type === 'refund'
                ? `/api/v1/transactions/${encodeURIComponent(originalId)}/refunds`
                : `/api/v1/transactions/${encodeURIComponent(originalId)}/reverse`;
            const body =
              value.type === 'refund'
                ? {
                    expectedVersion,
                    amountMinor: value.amountMinor,
                    occurredAt: new Date(value.occurredAt).toISOString(),
                    reason: value.notes || value.title
                  }
                : {
                    expectedVersion,
                    occurredAt: new Date(value.occurredAt).toISOString(),
                    reason: value.notes || value.title
                  };
            return send('POST', path, linkedMutationSchema, body, key);
          },
          operationId
        );
        return mutationResult(detailTransaction(result.transaction));
      }
      if (value.type !== 'income' && value.type !== 'expense')
        throw new CoreFinanceError('validation');
      const creatingOwner = await captureLiveClerkOwner();
      const body = {
        kind: value.type,
        amountMinor: value.amountMinor,
        currency: value.currencyCode,
        accountId: value.accountId,
        categoryId: value.categoryId,
        title: value.title,
        merchant: value.merchant,
        note: value.notes,
        occurredAt: new Date(value.occurredAt).toISOString(),
        source: source ?? 'manual'
      };
      const result = await mutate(
        `transaction:create:${JSON.stringify(body)}`,
        async () => undefined,
        async ({ operationId: key }, identity) => {
          await creatingOwner.assertCurrent();
          if (identity.userId !== creatingOwner.userId) throw new HttpError('session_expired', 401);
          await categoryIds?.prepare();
          return send(
            'POST',
            '/api/v1/transactions',
            mutationSchema,
            body,
            key,
            undefined,
            identity
          );
        },
        operationId
      );
      await creatingOwner.assertCurrent();
      return mutationResult(await mappedTransaction(detailTransaction(result.transaction), creatingOwner));
    },
    async createCardPayoff(input, operationId) {
      assertBenchmarkRead('POST');
      const transfer: TransactionInput = {
        type: 'transfer',
        amountMinor: input.amountMinor,
        currencyCode: input.currencyCode,
        accountId: input.fundingAccountId,
        destinationAccountId: input.cardAccountId,
        transferPurpose: 'card_payoff',
        feeMinor: 0,
        categoryId: null,
        title: input.title,
        occurredAt: input.occurredAt,
        notes: input.notes ?? null
      };
      const value = await createTransfer(
        send,
        transactionInputSchema.parse(transfer),
        operationId
      );
      return mutationResult({ ...value, transferPurpose: 'card_payoff' });
    },
    async createTransactionsAtomically(inputs, operationId, source) {
      assertBenchmarkRead('POST');
      const { repository: drafts } = await ensureLocalReady();
      const replay = drafts.batchOperationResult(operationId);
      if (replay)
        return {
          value: replay,
          affectedScopes: replay.flatMap((item) => transactionScopes(item.id))
        };
      const groupId = uuid.safeParse(operationId);
      if (!groupId.success || inputs.length < 1 || inputs.length > 100)
        throw new CoreFinanceError('validation');
      const values = inputs.map((input) => transactionInputSchema.parse(input));
      if (
        values.some(
          (input) => input.type !== 'income' && input.type !== 'expense'
        )
      )
        throw new CoreFinanceError('validation');
      const owner = await captureLiveClerkIdentity();
      await categoryIds?.prepare();
      await owner.assertCurrent();
      const deviceId = await currentDeviceId(baseUrl, request, owner.token);
      const client = new SyncHttpService(
        baseUrl,
        async () => owner.token,
        async () => deviceId,
        request
      );
      const operationIds = values.map((_, index) =>
        index === 0 ? groupId.data : derivedOperationId(groupId.data, index)
      );
      const batch = mutationBatchSchema.parse(
        await client.mutations(
          values.map((input, index) => ({
            operationId: operationIds[index]!,
            domain: 'transactions' as const,
            resourceType: 'transaction' as const,
            schemaVersion: 1 as const,
            dependsOn: index === 0 ? [] : [operationIds[index - 1]!],
            operation: 'create' as const,
            payload: {
              kind: input.type as 'income' | 'expense',
              amountMinor: input.amountMinor,
              currency: input.currencyCode,
              accountId: input.accountId,
              categoryId: input.categoryId
                ? (categoryIds?.toServer(input.categoryId) ?? input.categoryId)
                : null,
              title: input.title,
              merchant: input.merchant,
              note: input.notes,
              occurredAt: new Date(input.occurredAt).toISOString(),
              source
            }
          })),
          groupId.data
        )
      );
      if (
        batch.data.receipts.length !== operationIds.length ||
        batch.data.receipts.some(
          (receipt, index) =>
            receipt.operationId !== operationIds[index] ||
            receipt.status !== 'applied' ||
            !receipt.result
        )
      )
        throw new CoreFinanceError('conflict');
      const transactions = batch.data.receipts.map((receipt) =>
        detailTransaction(mutationSchema.parse(receipt.result).transaction)
      );
      await owner.assertCurrent();
      await drafts.persistBatchOperationResult(operationId, transactions);
      return {
        value: transactions,
        affectedScopes: transactions.flatMap((item) =>
          transactionScopes(item.id)
        )
      };
    },
    async updateTransaction(id, input) {
      assertBenchmarkRead('POST');
      const next = transactionInputSchema.parse(input);
      const initiatingUserId = useAppShellStore.getState().session?.userId;
      const owner = await captureLiveClerkOwner();
      if (initiatingUserId && initiatingUserId !== owner.userId)
        throw new HttpError('session_expired', 401);
      let ids: Awaited<ReturnType<typeof transactionIds>>;
      try { ids = await transactionIds(id, owner); }
      catch { throw uncertainEdit(); }
      id = ids.localId;
      const resourceKey = `${owner.userId}:transaction:update:${id}`;
      if (inFlight.has(resourceKey)) throw uncertainEdit();
      const operation = (async () => {
        let journal: TransactionEditJournal | null;
        try {
          journal = await readTransactionEditJournal(owner, id);
        } catch {
          throw uncertainEdit();
        }
        const replaying = journal !== null;
        const assertSafe: TransactionEditGuard = async (database) => {
          await owner.assertCurrent();
          if (
            journal ||
            pending.has(resourceKey) ||
            (await readTransactionEditJournal(owner, id, database))
          )
            throw uncertainEdit();
        };
        const queued = await offlineUpdate?.(id, next, owner, assertSafe);
        await owner.assertCurrent();
        if (queued) return queued;
        try {
          await assertNoQueuedTransactionMutation(owner, id);
        } catch {
          throw uncertainEdit();
        }
        if (journal && JSON.stringify(journal.input) !== JSON.stringify(next))
          throw uncertainEdit();
        let identity: Awaited<ReturnType<typeof captureLiveClerkIdentity>>;
        try {
          identity = await captureLiveClerkIdentity();
        } catch (error) {
          if (journal) throw uncertainEdit();
          throw error;
        }
        await owner.assertCurrent();
        if (identity.userId !== owner.userId) throw uncertainEdit();
        if (!journal) {
          await categoryIds?.prepare();
          await owner.assertCurrent();
          const prior = await current(id, identity);
          if (
            (prior.type !== next.type &&
              (prior.source !== 'manual' ||
                !['expense', 'income'].includes(prior.type) ||
                !['expense', 'income'].includes(next.type))) ||
            prior.currencyCode !== next.currencyCode ||
            prior.destinationAccountId !== next.destinationAccountId ||
            prior.feeMinor !== next.feeMinor ||
            prior.originalTransactionId !== next.originalTransactionId
          )
            throw new CoreFinanceError('validation');
          const body: Record<string, unknown> = {
            expectedVersion: prior.version,
            reason: 'Mobile edit'
          };
          if (prior.type !== next.type) body.kind = next.type;
          for (const [field, value] of [
            ['amountMinor', next.amountMinor],
            ['accountId', next.accountId],
            ['categoryId', next.categoryId],
            ['title', next.title],
            ['merchant', next.merchant],
            ['note', next.notes],
            ['occurredAt', new Date(next.occurredAt).toISOString()]
          ] as const)
            if (value !== prior[field === 'note' ? 'notes' : field])
              body[field] = value;
          if (typeof body.categoryId === 'string')
            body.categoryId =
              categoryIds?.toServer(body.categoryId) ?? body.categoryId;
          journal = {
            version: 1,
            resourceId: id,
            serverResourceId: ids.serverId,
            operationId: randomUUID(),
            input: next,
            body: body as TransactionEditJournal['body']
          };
          try {
            await writeTransactionEditJournal(owner, journal);
          } catch (error) {
            if (error instanceof CoreFinanceError || error instanceof HttpError)
              throw error;
            throw new CoreFinanceError('unknown', {
              domainCode: 'LOCAL_PERSISTENCE_FAILED',
              uncertain: false
            });
          }
        }
        pending.set(resourceKey, {
          operationId: journal.operationId,
          expectedVersion: journal.body.expectedVersion,
          prepared: true
        });
        try {
          await owner.assertCurrent();
          const receipt = await requestJson(
            `/api/v1/transactions/${encodeURIComponent(journal.serverResourceId ?? ids.serverId)}`,
            mutationSchema,
            {
              baseUrl,
              request,
              method: 'PATCH',
              body: journal.body,
              token: identity.token,
              headers: { 'Idempotency-Key': journal.operationId }
            }
          );
          const serverTransaction = detailTransaction(receipt.transaction);
          if (serverTransaction.id !== (journal.serverResourceId ?? ids.serverId)) throw new HttpError('contract_mismatch', 502);
          const updated = { ...serverTransaction, id };
          await owner.assertCurrent();
          await deleteTransactionEditJournal(owner, journal, (transaction) =>
            drafts.persistAcknowledgedTransaction(updated, transaction)
          );
          pending.delete(resourceKey);
          return mutationResult(updated);
        } catch (error) {
          if (
            error instanceof HttpError &&
            !replaying &&
            ![
              'provider_unavailable',
              'internal_error',
              'contract_mismatch'
            ].includes(error.code) &&
            !['IDEMPOTENCY_IN_PROGRESS', 'LEDGER_BUSY'].includes(
              error.domainCode ?? ''
            )
          ) {
            try {
              await deleteTransactionEditJournal(owner, journal);
            } catch {
              throw uncertainEdit();
            }
            pending.delete(resourceKey);
            throw error;
          }
          if (error instanceof HttpError)
            throw new CoreFinanceError('offline', {
              domainCode: error.domainCode ?? 'TRANSACTION_OUTCOME_UNCERTAIN',
              status: error.status,
              requestId: error.requestId,
              uncertain: true
            });
          throw uncertainEdit();
        }
      })();
      inFlight.set(resourceKey, operation);
      try {
        return await operation;
      } finally {
        inFlight.delete(resourceKey);
      }
    },
    async saveDraft(draft: TransactionDraft) {
      assertBenchmarkRead('POST');
      return writeTransactionDraft(await captureLiveClerkOwner(), draft);
    },
    async loadDraft(id: string) {
      return readTransactionDraft(await captureLiveClerkOwner(), id);
    },
    async discardDraft(id: string) {
      assertBenchmarkRead('POST');
      return deleteTransactionDraft(await captureLiveClerkOwner(), id);
    },
    async deleteTransaction(id): Promise<DeleteResult> {
      assertBenchmarkRead('POST');
      const owner = await captureLiveClerkOwner();
      const ids = await transactionIds(id, owner);
      id = ids.localId;
      const prior = await current(id);
      const deleted = await mutate(
        `transaction:delete:${id}`,
        async () => prior.version,
        ({ operationId, expectedVersion }) =>
          send(
            'DELETE',
            `/api/v1/transactions/${encodeURIComponent(ids.serverId)}`,
            deleteSchema,
            { expectedVersion, reason: 'Mobile delete' },
            operationId
          )
      );
      if (deleted.transactionId !== ids.serverId)
        throw new HttpError('contract_mismatch', 502);
      const value: Transaction = {
        ...prior,
        status: 'deleted',
        version: deleted.version,
        deletedAt: Date.parse(deleted.deletedAt),
        undoExpiresAt: Date.parse(deleted.undoExpiresAt),
        updatedAt: Date.parse(deleted.deletedAt)
      };
      return { ...mutationResult(value), undoExpiresAt: value.undoExpiresAt! };
    },
    async undoDelete(id) {
      assertBenchmarkRead('POST');
      const owner = await captureLiveClerkOwner();
      const ids = await transactionIds(id, owner);
      const result = await mutate(
        `transaction:restore:${id}`,
        async () => (await current(id)).version,
        ({ operationId, expectedVersion }) =>
          send(
            'POST',
            `/api/v1/transactions/${encodeURIComponent(ids.serverId)}/restore`,
            mutationSchema,
            { expectedVersion },
            operationId
          )
      );
      return mutationResult({ ...detailTransaction(result.transaction), id: ids.localId });
    },
    async getConflict(id) {
      try {
        const { conflict } = await remoteConflict(
          id,
          baseUrl,
          request,
          current
        );
        const { repository: drafts } = await ensureLocalReady();
        drafts.saveConflict(conflict);
        await drafts.persistConflictRecord(conflict);
        return conflict;
      } catch (error) {
        if (
          error instanceof HttpError &&
          ['provider_unavailable', 'rate_limited'].includes(error.code)
        ) {
          const { repository: drafts } = await ensureLocalReady();
          return drafts.requireConflict(id);
        }
        throw error;
      }
    },
    async resolveConflict(id, resolution) {
      assertBenchmarkRead('POST');
      if (resolution === 'keep_both') throw new CoreFinanceError('validation');
      const remote = await remoteConflict(id, baseUrl, request, current);
      const serverResolution =
        resolution === 'keep_local' ? 'client' : 'server';
      const payload =
        serverResolution === 'client'
          ? conflictResolutionPayload(remote.conflict, remote.conflictFields)
          : undefined;
      const resolved = conflictResponseSchema.parse(
        await remote.client.resolveConflict(
          id,
          serverResolution,
          randomUUID(),
          payload
        )
      );
      const conflict = conflictFromServer(
        resolved.data,
        remote.conflict.laterSnapshot
      );
      const selected = {
        ...(serverResolution === 'client'
          ? conflict.localSnapshot
          : conflict.laterSnapshot),
        syncStatus: 'synced' as const
      };
      await remote.owner.assertCurrent();
      const { repository: drafts } = await ensureLocalReady();
      drafts.saveConflict(conflict);
      await Promise.all([
        drafts.persistConflictRecord(conflict),
        drafts.persistTransaction(selected)
      ]);
      return mutationResult(selected);
    }
  };
}

export function createLiveCoreFinanceSync({
  baseUrl = process.env.EXPO_PUBLIC_API_URL ?? '',
  request = fetch,
  database,
  repository,
  adapter,
  sync,
  identity
}: {
  baseUrl?: string;
  request?: typeof fetch;
  database?: Awaited<ReturnType<typeof openDatabase>>;
  repository?: SyncRepository;
  adapter?: CoreFinanceSyncAdapter;
  sync?: SyncHttpService;
  identity?: typeof captureLiveClerkIdentity;
} = {}) {
  return {
    async synchronize() {
      // Sync replays mutations and acknowledges cursors; it is not a read bootstrap.
      assertBenchmarkRead('POST');
      const owner = await (identity ?? captureLiveReadClerkIdentity)();
      await owner.assertCurrent();
      let writeOwner:
        | Promise<Awaited<ReturnType<typeof captureLiveClerkIdentity>>>
        | undefined;
      let reverifiedToken: string | null = null;
      let verificationAttempted = false;
      let syncDeviceId: Promise<string> | undefined;
      const requestToken = async (readOnly?: boolean) => {
        await owner.assertCurrent();
        if (!readOnly && !identity) writeOwner ??= captureLiveClerkIdentity();
        const actor = !readOnly && writeOwner ? await writeOwner : owner;
        await owner.assertCurrent();
        await actor.assertCurrent();
        return !readOnly && reverifiedToken ? reverifiedToken : actor.token;
      };
      let ownerDatabase = database;
      if (!ownerDatabase && (!repository || !adapter))
        ownerDatabase = await openDatabase(owner.userId);
      const queue = repository ?? new SyncRepository(ownerDatabase!);
      const apply =
        adapter ?? new CoreFinanceSyncAdapter(ownerDatabase!, queue);
      let receiptFollowup:
        ReturnType<typeof observeSyncReceiptLifecycle> | undefined;
      const client =
        sync ??
        new SyncHttpService(
          baseUrl,
          requestToken,
          async () => {
            const actor = writeOwner ? await writeOwner : owner;
            await owner.assertCurrent();
            syncDeviceId ??= currentDeviceId(baseUrl, request, actor.token);
            const deviceId = await syncDeviceId;
            await owner.assertCurrent();
            return deviceId;
          },
          (input, init) => {
            if (
              receiptFollowup &&
              init?.method === 'POST' &&
              String(input).endsWith('/api/v1/sync/mutations')
            )
              assertSyncReceiptActive(receiptFollowup.signal);
            return request(input, init);
          }
        );
      let uploaded = 0;
      let receiptRetries = 0;
      let bootstrapped = 0;
      let deltas = 0;
      await queue.recoverSending();
      try {
        for (;;) {
          const available = await queue.ready(Date.now(), 100);
          if (!available.length) break;
          const batchEntries = available.some(entry => entry.dependsOn.length > 0)
            ? await queue.submissionBatch(available) : available;
          const selected = new Set(batchEntries.map(entry => entry.operationId));
          const ready = available.filter(entry => selected.has(entry.operationId));
          const operationIds = ready.map(entry => entry.operationId);
          await owner.assertCurrent();
          const targets = await queue.markSending(operationIds);
          await owner.assertCurrent();
          const mutations = batchEntries.map((entry) => ({
            operationId: uuid.parse(entry.operationId),
            domain: entry.domain,
            resourceType: entry.resourceType,
            schemaVersion: 1 as const,
            dependsOn: z.array(uuid).max(100).parse(entry.dependsOn),
            operation: z
              .enum(['create', 'update', 'archive', 'restore', 'delete'])
              .parse(entry.operation),
            ...(entry.resourceId ? { resourceId: targets?.[entry.operationId] ?? entry.resourceId } : {}),
            ...(entry.baseVersion === null
              ? {}
              : { baseVersion: entry.baseVersion }),
            payload: entry.payload
          }));
          let batch: z.output<typeof mutationBatchSchema>;
          try {
            if (receiptFollowup)
              assertSyncReceiptActive(receiptFollowup.signal);
            batch = mutationBatchSchema.parse(
              await client.mutations(mutations, randomUUID())
            );
          } catch (error) {
            await queue.recoverSending();
            throw error;
          }
          const receipts = new Map(
            batch.data.receipts.map((receipt) => [receipt.operationId, receipt])
          );
          if (
            receipts.size !== batchEntries.length ||
            batchEntries.some(entry => !receipts.has(entry.operationId)) ||
            batchEntries.some(entry => entry.status === 'applied' && receipts.get(entry.operationId)?.status !== 'applied')
          ) {
            await queue.recoverSending();
            throw new HttpError('contract_mismatch', 502);
          }
          let needsRecentAuth = false;
          let pendingReceipt = false;
          for (const entry of ready) {
            const receipt = receipts.get(entry.operationId)!;
            if (receipt.status === 'applied') {
              const created = entry.operation === 'create' && entry.domain === 'transactions'
                ? mutationSchema.parse(receipt.result).transaction.transaction : null;
              const canonicalId = created?.id ?? receipt.resourceId;
              if (entry.operation === 'create' && entry.resourceId && canonicalId)
                await queue.complete(entry.operationId, 'applied', null,
                  { domain: entry.domain, localId: entry.resourceId, serverId: canonicalId });
              else await queue.complete(entry.operationId, 'applied', null);
            } else if (receipt.status === 'conflict')
              await queue.complete(
                entry.operationId,
                'conflict',
                receipt.error?.code ?? 'SYNC_CONFLICT'
              );
            else if (
              receipt.status === 'rejected' &&
              receipt.error?.code === 'RECENT_AUTH_REQUIRED'
            ) {
              await queue.retry(
                entry.operationId,
                Date.now(),
                'RECENT_AUTH_REQUIRED'
              );
              needsRecentAuth = true;
            } else if (receipt.status === 'rejected')
              await queue.complete(
                entry.operationId,
                'rejected',
                receipt.error?.code ?? 'SYNC_REJECTED'
              );
            else {
              pendingReceipt = true;
              await queue.retry(
                entry.operationId,
                Date.now() + 1_000,
                `SYNC_${receipt.status.toUpperCase()}`
              );
            }
            uploaded += 1;
          }
          if (needsRecentAuth) {
            if (verificationAttempted)
              throw new HttpError(
                'recent_auth_required',
                403,
                'RECENT_AUTH_REQUIRED'
              );
            verificationAttempted = true;
            reverifiedToken = await requestRecentAuthentication();
            await owner.assertCurrent();
            if (!reverifiedToken)
              throw new HttpError(
                'recent_auth_required',
                403,
                'RECENT_AUTH_REQUIRED'
              );
          }
          if (pendingReceipt) {
            if (receiptRetries >= 3) break;
            receiptFollowup ??= observeSyncReceiptLifecycle();
            await waitForSyncReceipt(
              owner,
              1_000 * 2 ** receiptRetries,
              receiptFollowup.signal
            );
            receiptRetries += 1;
          }
        }
      } finally {
        receiptFollowup?.remove();
      }
      for (const domain of syncDomain.options) {
        if (domain === 'transactions') {
          const pending = await queue.hasPending(domain);
          await owner.assertCurrent();
          // Receipts establish aliases and settle local edits before server
          // projections can replace them or acknowledge their cursor.
          if (pending) continue;
        }
        const cursor = await queue.cursor(domain);
        const bootstrap = async () => {
          let after: string | undefined;
          for (;;) {
            const value = bootstrapSchema.parse(
              await client.bootstrap([domain], after, 500)
            );
            const page = value.data.domains.find(
              (item) => item.domain === domain
            );
            if (!page || value.data.domains.length !== 1)
              throw new HttpError('contract_mismatch', 502);
            const applied = await apply.applyBootstrap(
              domain,
              page.items,
              page.cursor,
              page.hasMore
            );
            if (applied === false) return;
            bootstrapped += 1;
            if (!page.hasMore) break;
            if (!page.nextPage || page.nextPage === after)
              throw new HttpError('contract_mismatch', 502);
            after = page.nextPage;
          }
        };
        if (!cursor) {
          await bootstrap();
          continue;
        }
        let next = syncCursor.parse(cursor);
        for (;;) {
          let value: z.infer<typeof deltaSchema>;
          try {
            value = deltaSchema.parse(await client.delta(domain, next, 500));
          } catch (error) {
            const cursorCode = error instanceof SyncServiceError
              ? error.code
              : error instanceof HttpError ? error.domainCode : undefined;
            if (
              !['SYNC_CURSOR_INVALID', 'SYNC_CURSOR_EXPIRED'].includes(
                cursorCode ?? ''
              )
            )
              throw error;
            await owner.assertCurrent();
            await queue.clearCursor(domain);
            await bootstrap();
            break;
          }
          if (value.data.domain !== domain)
            throw new HttpError('contract_mismatch', 502);
          const applied = await apply.applyDelta(
            domain,
            value.data.changes.map((change) => ({
              resourceId: change.resourceId,
              operation: change.operation,
              version: change.version,
              ...(change.snapshot ? { snapshot: change.snapshot } : {}),
              deletedAt: change.deletedAt
            })),
            value.data.nextCursor,
            null
          );
          if (applied === false) break;
          await client.acknowledge(domain, value.data.nextCursor);
          deltas += 1;
          if (!value.data.hasMore) break;
          if (value.data.nextCursor === next)
            throw new HttpError('contract_mismatch', 502);
          next = value.data.nextCursor;
        }
      }
      let after: string | undefined;
      for (;;) {
        const conflicts = conflictListSchema.parse(
          await client.conflicts('open', after, 100)
        );
        for (const conflict of conflicts.data.items)
          await apply.storeConflict(conflict);
        if (!conflicts.data.nextCursor) break;
        if (conflicts.data.nextCursor === after)
          throw new HttpError('contract_mismatch', 502);
        after = conflicts.data.nextCursor;
      }
      await owner.assertCurrent();
      return { uploaded, bootstrapped, deltas };
    }
  };
}

const pausedSyncReceipt = () =>
  new HttpError('provider_unavailable', 503, 'SYNC_RECEIPT_PAUSED');

function assertSyncReceiptActive(signal: AbortSignal): void {
  if (
    signal.aborted ||
    ['background', 'inactive'].includes(AppState.currentState)
  )
    throw pausedSyncReceipt();
}

function observeSyncReceiptLifecycle() {
  const controller = new AbortController();
  const subscription = AppState.addEventListener('change', (state) => {
    if (state !== 'active') controller.abort();
  });
  return { signal: controller.signal, remove: () => subscription.remove() };
}

async function waitForSyncReceipt(
  owner: DraftOwner,
  delay: number,
  signal: AbortSignal
): Promise<void> {
  await owner.assertCurrent();
  assertSyncReceiptActive(signal);
  let timer: ReturnType<typeof setTimeout> | undefined;
  let unregister = () => {};
  let cancel = () => {};
  try {
    await Promise.race([
      (async () => {
        await new Promise<void>((resolve) => {
          timer = setTimeout(resolve, delay);
        });
        await owner.assertCurrent();
        assertSyncReceiptActive(signal);
        let online = true;
        if (readRecoveryNetwork.available) {
          try {
            online = await readRecoveryNetwork.isOnline();
          } catch {
            /* An unavailable probe does not establish offline state. */
          }
        }
        if (!online)
          throw new HttpError(
            'provider_unavailable',
            503,
            undefined,
            undefined,
            'network'
          );
        await owner.assertCurrent();
        assertSyncReceiptActive(signal);
      })(),
      new Promise<void>((_resolve, reject) => {
        cancel = () => reject(pausedSyncReceipt());
        signal.addEventListener('abort', cancel);
        unregister = registerRuntimeIdentityReset(() =>
          reject(new HttpError('session_expired', 401))
        );
        if (signal.aborted) cancel();
      })
    ]);
  } finally {
    clearTimeout(timer);
    unregister();
    signal.removeEventListener('abort', cancel);
  }
}

async function currentDeviceId(
  baseUrl: string,
  request: typeof fetch,
  token: string
): Promise<string> {
  let cursor: string | null = null;
  const seen = new Set<string>();
  do {
    const page: z.output<typeof devicePageSchema> = await requestJson(
      `/api/v1/me/devices?limit=100${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`,
      devicePageSchema,
      { baseUrl, request, token, method: 'GET' }
    );
    const current = page.items.find((device) => device.current);
    if (current) return current.id;
    cursor = page.nextCursor;
    if (cursor && seen.has(cursor))
      throw new HttpError('contract_mismatch', 502);
    if (cursor) seen.add(cursor);
  } while (cursor);
  throw new HttpError('contract_mismatch', 502);
}

async function createTransfer(
  send: <T>(
    method: string,
    path: string,
    schema: z.ZodType<T>,
    body?: Record<string, unknown>,
    operationId?: string
  ) => Promise<T>,
  value: z.output<typeof transactionInputSchema>,
  operationId: string
): Promise<Transaction> {
  const result = await send(
    'POST',
    '/api/v1/transfers',
    mutationSchema,
    {
      sourceAccountId: value.accountId,
      destinationAccountId: value.destinationAccountId,
      amountMinor: value.amountMinor,
      currency: value.currencyCode,
      feeMinor: value.feeMinor,
      occurredAt: new Date(value.occurredAt).toISOString(),
      title: value.title,
      note: value.notes
    },
    operationId
  );
  return transactionFromDetail(result.transaction);
}

function transactionFromDetail(value: unknown): Transaction {
  const detail = detailSchema.parse(value);
  const source = detail.postings.find((posting) =>
    ['source', 'opening', 'refund', 'reversal', 'adjustment'].includes(
      posting.postingRole
    )
  );
  const destination = detail.postings.find(
    (posting) => posting.postingRole === 'destination'
  );
  return transactionFromSummary(
    detail.transaction,
    source?.accountId,
    destination?.accountId,
    source?.amountMinor
  );
}

function transactionFromSummary(
  input: unknown,
  mappedAccountId?: string,
  mappedDestinationAccountId?: string,
  signedAmount?: number
): Transaction {
  const value = summarySchema.parse(input);
  const accountId = mappedAccountId ?? value.sourceAccountId;
  const destinationAccountId =
    value.kind === 'transfer'
      ? (mappedDestinationAccountId ?? value.destinationAccountId ?? undefined)
      : undefined;
  if (!accountId || (value.kind === 'transfer' && !destinationAccountId))
    throw new HttpError('contract_mismatch', 502);
  return {
    id: value.id,
    type: value.kind === 'opening' ? 'adjustment' : value.kind,
    amountMinor: value.amountMinor,
    currencyCode: value.currency,
    accountId,
    destinationAccountId: destinationAccountId ?? null,
    transferPurpose: value.kind === 'transfer' ? 'internal' : null,
    feeMinor: value.feeMinor,
    categoryId: value.kind === 'transfer' ? null : value.categoryId,
    title: value.title,
    merchant: value.merchant,
    paymentMethod: value.paymentMethod,
    occurredAt: Date.parse(value.occurredAt),
    source: value.kind === 'opening' ? 'adjustment' : value.source,
    status:
      value.status === 'confirmed'
        ? 'posted'
        : value.status === 'draft'
          ? 'pending'
          : value.status,
    reviewStatus: 'none',
    syncStatus: 'synced',
    originalTransactionId: value.originalTransactionId,
    obligationId: null,
    notes: value.note,
    version: value.version,
    adjustmentSign: signedAmount !== undefined && signedAmount < 0 ? -1 : 1,
    deletedAt: value.deletedAt === null ? null : Date.parse(value.deletedAt),
    undoExpiresAt:
      value.undoExpiresAt === null ? null : Date.parse(value.undoExpiresAt),
    createdAt: Date.parse(value.occurredAt),
    updatedAt: Date.parse(value.occurredAt)
  };
}

function ledgerQuery(
  filters: TransactionFilterSet,
  cursor: string | null,
  pageSize: number
): URLSearchParams {
  const query = new URLSearchParams({ limit: String(pageSize) });
  if (cursor) query.set('cursor', cursor);
  if (filters.accountIds.length === 1)
    query.set('accountId', filters.accountIds[0]!);
  if (filters.categoryIds.length === 1)
    query.set('categoryId', filters.categoryIds[0]!);
  const kind = filters.types[0];
  if (
    filters.types.length === 1 &&
    kind !== undefined &&
    serverKind.options.includes(kind as z.infer<typeof serverKind>)
  )
    query.set('kind', kind);
  if (filters.sources.length === 1) query.set('source', filters.sources[0]!);
  if (filters.statuses.length === 1) {
    const status = filters.statuses[0]!;
    const mapped = status === 'posted' ? 'confirmed' : status;
    if (serverStatus.options.includes(mapped as z.infer<typeof serverStatus>))
      query.set('status', mapped);
  }
  if (filters.periodStart !== null)
    query.set('from', new Date(filters.periodStart).toISOString());
  if (filters.periodEnd !== null)
    query.set('to', new Date(filters.periodEnd).toISOString());
  if (filters.search.trim()) query.set('query', filters.search.trim());
  return query;
}

function transactionScopes(id: string): readonly string[] {
  return [
    'home.summary',
    'accounts.list',
    'accounts.balances',
    'transactions.list',
    `transactions.detail.${id}`,
    'reports.live',
    'assistant.context'
  ];
}

async function remoteConflict(
  id: string,
  baseUrl: string,
  request: typeof fetch,
  current: (id: string) => Promise<Transaction>
) {
  const owner = await captureLiveClerkIdentity();
  const deviceId = await currentDeviceId(baseUrl, request, owner.token);
  const client = new SyncHttpService(
    baseUrl,
    async () => owner.token,
    async () => deviceId,
    request
  );
  const value = conflictResponseSchema.parse(await client.conflict(id));
  const latest = await current(value.data.transactionId);
  await owner.assertCurrent();
  return {
    owner,
    client,
    conflictFields: value.data.conflictFields,
    conflict: conflictFromServer(value.data, latest)
  };
}

function conflictFromServer(
  value: z.output<typeof conflictSchema>,
  current: Transaction
) {
  const laterSnapshot = applyConflictSnapshot(
    current,
    value.serverSnapshot,
    value.serverVersion,
    'synced'
  );
  const localSnapshot = applyConflictSnapshot(
    laterSnapshot,
    value.clientSnapshot,
    value.clientVersion,
    'conflict'
  );
  return {
    id: value.id,
    transactionId: value.transactionId,
    localSnapshot,
    laterSnapshot,
    resolution:
      value.resolution === 'client' || value.resolution === 'merged'
        ? ('keep_local' as const)
        : value.resolution === 'server' || value.resolution === 'duplicate'
          ? ('keep_later' as const)
          : null,
    status:
      value.status === 'open' ? ('pending' as const) : ('resolved' as const),
    createdAt: Date.parse(value.createdAt),
    resolvedAt: value.resolvedAt ? Date.parse(value.resolvedAt) : null
  };
}

function applyConflictSnapshot(
  base: Transaction,
  snapshot: Record<string, unknown>,
  version: number,
  syncStatus: Transaction['syncStatus']
): Transaction {
  const next = { ...base, version, syncStatus };
  const amount = snapshot.amountMinor ?? snapshot.amount_minor;
  if (amount !== undefined) {
    if (
      typeof amount !== 'number' ||
      !Number.isSafeInteger(amount) ||
      amount < 1
    )
      throw new HttpError('contract_mismatch', 502);
    next.amountMinor = amount;
  }
  for (const field of ['accountId', 'categoryId', 'title', 'merchant'] as const)
    if (field in snapshot) {
      const value = snapshot[field];
      if (
        (field === 'accountId' && !uuid.safeParse(value).success) ||
        (field === 'categoryId' &&
          value !== null &&
          !uuid.safeParse(value).success) ||
        ((field === 'title' || field === 'merchant') &&
          value !== null &&
          typeof value !== 'string')
      )
        throw new HttpError('contract_mismatch', 502);
      Object.assign(next, { [field]: value });
    }
  const note = snapshot.note ?? snapshot.notes;
  if (note !== undefined) {
    if (note !== null && typeof note !== 'string')
      throw new HttpError('contract_mismatch', 502);
    next.notes = note;
  }
  const occurredAt = snapshot.occurredAt ?? snapshot.occurred_at;
  if (occurredAt !== undefined) {
    const parsed =
      typeof occurredAt === 'number'
        ? occurredAt
        : Date.parse(String(occurredAt));
    if (!Number.isSafeInteger(parsed) || parsed < 0)
      throw new HttpError('contract_mismatch', 502);
    next.occurredAt = parsed;
  }
  return next;
}

function conflictResolutionPayload(
  conflict: ReturnType<typeof conflictFromServer>,
  fields: readonly string[]
) {
  const payload: Record<string, unknown> = {};
  for (const field of fields) {
    const key = field === 'note' ? 'notes' : field;
    if (!(key in conflict.localSnapshot)) continue;
    const value = conflict.localSnapshot[key as keyof Transaction];
    payload[field] =
      key === 'occurredAt'
        ? new Date(conflict.localSnapshot.occurredAt).toISOString()
        : value;
  }
  return payload;
}

function derivedOperationId(operationId: string, index: number): string {
  const bytes = sha256(
    new TextEncoder().encode(`${operationId}:${String(index)}`)
  ).slice(0, 16);
  bytes[6] = (bytes[6]! & 0x0f) | 0x40;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const value = bytesToHex(bytes);
  return `${value.slice(0, 8)}-${value.slice(8, 12)}-${value.slice(12, 16)}-${value.slice(16, 20)}-${value.slice(20)}`;
}

let liveCoreFinanceSync: Promise<unknown> | null = null;

export async function hasPendingLiveCoreFinanceMutations(): Promise<boolean> {
  const owner = await captureLiveClerkOwner();
  const database = await openDatabase(owner.userId);
  const pending = await new SyncRepository(database).hasPending();
  await owner.assertCurrent();
  return pending;
}

export function synchronizeLiveCoreFinance(): Promise<unknown> {
  return (liveCoreFinanceSync ??= measurePerformance('sync.core', () =>
    createLiveCoreFinanceSync().synchronize()
  ).finally(() => {
    liveCoreFinanceSync = null;
  }));
}
