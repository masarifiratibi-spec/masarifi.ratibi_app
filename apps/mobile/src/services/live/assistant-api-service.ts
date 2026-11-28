import { AiTrafficBackoff, AiTrafficBusy } from './ai-traffic-backoff';
import { captureWriteGeneration, financialMutation, generationHeaders } from '@/services/financial-generation-gate';
import { assertBenchmarkRead } from '@/config/client-runtime';
import Constants from 'expo-constants';
import { z } from 'zod';
import { sha256 } from '@noble/hashes/sha256';
import { bytesToHex, utf8ToBytes } from '@noble/hashes/utils';
import { optionalSpendingPresentationSchema } from '@/domain/assistant-presentation';
import { hasCompleteAssistantEffect } from '@/domain/assistant-action-effect';
import {
  buildAssistantActionDisclosure,
  type AssistantActionDisclosureContext
} from '@/domain/assistant-action-disclosure';
import {
  createMemoryAssistantJournal,
  type AssistantOperationJournal
} from '@/storage/assistant-operation-journal';
import type {
  AssistantActionPreview,
  AssistantConsent,
  AssistantConversation,
  AssistantResponse
} from '@/domain/assistant';
import {
  assistantActionPreviewSchema,
  createImmutableSnapshot
} from '@/domain/assistant';
import type { CapabilityProviderHandle } from '@/services/contracts/capability-contract';
import {
  assistantServiceCapability,
  type AssistantFinancialInsight,
  type AssistantService
} from '@/services/contracts/assistant-notifications-service';

export interface TextConsentStore {
  read(key: string): Promise<string | null>;
  write(key: string, value: string | null): Promise<void>;
}
const textPolicy = 'assistant-privacy-v1';
// Changing the disclosure requires a new explicit acknowledgement on this iPhone.
const disclosureKey = (owner: string) =>
  'masarifi.ios.text-consent.v1.' + bytesToHex(sha256(utf8ToBytes(owner)));
const grantReceipt = (row: z.infer<typeof consentSchema>) =>
  JSON.stringify([row.policyVersion, row.version, row.grantedAt]);

type TokenProvider = () => Promise<string>;
let tokenProvider: TokenProvider = () =>
  Promise.reject(new Error('assistant_unavailable'));
let tokenProviderConfigured = false;

export function configureAssistantApiTokenProvider(
  provider: TokenProvider
): void {
  tokenProvider = provider;
  tokenProviderConfigured = true;
}

class AssistantApiError extends Error {
  constructor(
    readonly code: string,
    readonly affectedScopes: readonly string[] = [],
    readonly definitiveRejection = false,
    readonly questionOperationId?: string
  ) {
    super(code);
  }
}

const dateTime = z.string().datetime({ offset: true });
// Older getters exposed pg bigint text. Preserve its exact concurrency fence during alignment.
const conversationVersion = z
  .union([z.number(), z.string().regex(/^[1-9]\d*$/u)])
  .transform(Number)
  .pipe(z.number().int().positive().safe());
const conversationSchema = z
  .object({
    id: z.string().uuid(),
    title: z.string().min(1).max(120).nullable(),
    status: z.enum(['active', 'archived']),
    lastMessageAt: dateTime,
    version: conversationVersion,
    createdAt: dateTime,
    updatedAt: dateTime
  })
  .strict();
const evidenceSchema = z
  .object({
    kind: z.enum([
      'transaction',
      'budget',
      'obligation',
      'goal',
      'report',
      'ledger'
    ]),
    alias: z
      .string()
      .regex(
        /^(?:EVIDENCE|ACCOUNT|CATEGORY|TRANSACTION|BUDGET|OBLIGATION|GOAL|SCHEDULE|REVIEW|REPORT|LEDGER)-[1-9]\d{0,2}$/u
      ),
    version: z.number().int().nonnegative(),
    asOf: dateTime.optional()
  })
  .strict();
const snapshotSchema = z
  .object({
    id: z.string().uuid(),
    schemaVersion: z.literal(1),
    evidenceRefs: z.array(evidenceSchema),
    model: z.string().min(1),
    provider: z.string().min(1),
    createdAt: dateTime
  })
  .strict();
const previewSchema = z
  .object({
    id: z.string().uuid(),
    messageId: z.string().uuid(),
    schemaVersion: z.literal(1),
    actionType: z.string().min(1),
    payload: z.record(z.unknown()),
    status: z.enum([
      'draft',
      'validated',
      'confirmed',
      'executed',
      'rejected',
      'expired'
    ]),
    expiresAt: dateTime.nullable(),
    confirmedAt: dateTime.nullable(),
    executedResourceId: z.string().uuid().nullable(),
    confirmationOperationId: z.string().min(1).nullable(),
    createdAt: dateTime,
    updatedAt: dateTime,
    version: z.number().int().positive()
  })
  .strict();
const messageSchema = z
  .object({
    id: z.string().uuid(),
    conversationId: z.string().uuid(),
    replyToMessageId: z.string().uuid().nullable(),
    role: z.enum(['user', 'assistant']),
    content: z.string(),
    status: z.string().nullable(),
    failureCode: z.string().nullable(),
    snapshot: snapshotSchema.nullable(),
    preview: previewSchema.nullable(),
    createdAt: dateTime,
    actionTimezone: z.string().min(1).nullable().optional(),
    metadata: z
      .object({
        schemaVersion: z.literal(1),
        promptSha256: z
          .string()
          .regex(/^[a-f0-9]{64}$/u)
          .optional(),
        locale: z.enum(['ar', 'en']),
        timezone: z.string().min(1),
        startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/u),
        endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/u),
        currencies: z.array(z.string().regex(/^[A-Z]{3}$/u)),
        responseType: z.enum([
          'fact',
          'estimate',
          'suggestion',
          'missing',
          'redirect'
        ]),
        scope: z
          .enum([
            'all_history',
            'selected_period',
            'multiple_periods',
            'current_state'
          ])
          .optional(),
        generatedAt: dateTime,
        values: z
          .array(
            z
              .object({
                key: z.string(),
                minor: z.string().regex(/^-?\d+$/u),
                currency: z.string().regex(/^[A-Z]{3}$/u),
                status: z.enum(['available', 'estimated'])
              })
              .strict()
          )
          .optional(),
        reasons: z.array(z.string()).optional(),
        spendingSummary: optionalSpendingPresentationSchema
      })
      .strict()
      .nullable()
      .optional()
  })
  .strict();
const insightSchema = z
  .object({
    id: z.string().uuid(),
    signalKey: z.string(),
    kind: z.literal('budget_threshold'),
    payload: z
      .object({
        budgetName: z.string(),
        currency: z.string().regex(/^[A-Z]{3}$/u),
        budgetMinor: z.string().regex(/^-?\d+$/u),
        spentMinor: z.string().regex(/^-?\d+$/u),
        remainingMinor: z.string().regex(/^-?\d+$/u),
        utilizationBps: z.number().int().nonnegative()
      })
      .strict(),
    sourceVersion: z.number().int().nonnegative(),
    status: z.literal('active'),
    expiresAt: dateTime,
    createdAt: dateTime
  })
  .strict();
const consentSchema = z
  .object({
    policyVersion: z.string(),
    granted: z.boolean(),
    grantedAt: dateTime.nullable(),
    revokedAt: dateTime.nullable(),
    version: z.number().int().positive()
  })
  .strict();
const page = <T extends z.ZodTypeAny>(item: T) =>
  z
    .object({ items: z.array(item), nextCursor: z.string().nullable() })
    .strict();

function parse<T extends z.ZodTypeAny>(schema: T, value: unknown): z.output<T> {
  const result = schema.safeParse(value);
  if (!result.success) throw new AssistantApiError('representative_failure');
  return result.data;
}

function epoch(value: string): number {
  const result = Date.parse(value);
  if (!Number.isFinite(result))
    throw new AssistantApiError('representative_failure');
  return result;
}

function mutation<T>(value: T, affectedScopes: readonly string[]) {
  return { value, affectedScopes };
}

function mapConversation(value: unknown): AssistantConversation {
  const row = parse(conversationSchema, value);
  return {
    id: row.id,
    title: row.title ?? 'Conversation',
    status: row.status,
    createdAt: epoch(row.createdAt),
    updatedAt: epoch(row.updatedAt),
    lastResponseId: null,
    version: row.version
  };
}

function mapConsent(value: unknown): AssistantConsent {
  const row = parse(consentSchema, value);
  return {
    status: row.granted
      ? 'enabled'
      : row.revokedAt
        ? 'disabled'
        : 'not_requested',
    disclosedDataCategories: ['transactions', 'planning', 'reports'],
    consentedAt: row.grantedAt ? epoch(row.grantedAt) : null,
    disabledAt: row.revokedAt ? epoch(row.revokedAt) : null,
    version: row.version
  };
}

function amount(value: unknown): number {
  const result =
    typeof value === 'string' && /^-?\d+$/u.test(value) ? Number(value) : value;
  if (typeof result !== 'number' || !Number.isSafeInteger(result))
    throw new AssistantApiError('representative_failure');
  return result;
}

function mapPreview(
  value: unknown,
  responseId: string,
  evidence: readonly z.infer<typeof evidenceSchema>[]
): AssistantActionPreview {
  const row = parse(previewSchema, value);
  if (row.messageId !== responseId)
    throw new AssistantApiError('representative_failure');
  const action = mapAction(row.actionType, row.payload, row.id);
  const states: Record<typeof row.status, AssistantActionPreview['status']> = {
    draft: 'draft',
    validated: 'ready',
    confirmed: 'confirming',
    executed: 'succeeded',
    rejected: 'cancelled',
    expired: 'expired'
  };
  const status = states[row.status];
  if (status === 'confirming' && !row.confirmationOperationId)
    throw new AssistantApiError('representative_failure');
  if (
    status === 'succeeded' &&
    (!row.confirmationOperationId || !row.executedResourceId)
  )
    throw new AssistantApiError('representative_failure');
  return assistantActionPreviewSchema.parse({
    id: row.id,
    responseId,
    ...action,
    effect: row.payload,
    confirmationAllowed:
      evidence.length > 0 &&
      hasCompleteAssistantEffect(row.actionType, row.payload),
    sourceVersions: evidence.map(({ alias: id, version }) => ({ id, version })),
    status,
    operationId: row.confirmationOperationId,
    expiresAt: row.expiresAt === null ? null : epoch(row.expiresAt),
    resultReference: row.executedResourceId,
    safeFailure: null,
    version: row.version
  });
}

function mapAction(
  actionType: string,
  payload: Record<string, unknown>,
  previewId: string
) {
  if (actionType === 'savings_goal.create')
    return {
      kind: 'create_goal',
      input: moneyInput(
        payload.targetMinor ?? payload.amountMinor,
        payload.currencyCode ?? payload.currency
      ),
      affectedDestination: { kind: 'goal', goalId: previewId }
    };
  if (actionType === 'transaction.create')
    return {
      kind: 'create_transaction',
      input: moneyInput(payload.amountMinor, payload.currency),
      affectedDestination: { kind: 'transactions' }
    };
  if (actionType === 'transaction.update')
    return {
      kind: 'update_transaction',
      input: {},
      affectedDestination: { kind: 'transactions' }
    };
  if (actionType === 'budget.update')
    return {
      kind: 'update_budget',
      input: {},
      affectedDestination: {
        kind: 'budget',
        budgetId: requiredId(payload.budgetId)
      }
    };
  if (actionType === 'obligation.payment.record')
    return {
      kind: 'record_obligation_payment',
      input: {},
      affectedDestination: {
        kind: 'obligation',
        obligationId: requiredId(payload.obligationId)
      }
    };
  if (actionType === 'tracking.review.resolve')
    return {
      kind: 'resolve_tracking_review',
      input: {},
      affectedDestination: { kind: 'transactions' }
    };
  throw new AssistantApiError('assistant_disabled');
}

function moneyInput(amountMinor: unknown, currency: unknown) {
  if (typeof currency !== 'string' || !/^[A-Z]{3}$/u.test(currency))
    throw new AssistantApiError('representative_failure');
  return { amountMinor: amount(amountMinor), currency };
}

function requiredId(value: unknown): string {
  const result = z.string().uuid().safeParse(value);
  if (!result.success) throw new AssistantApiError('representative_failure');
  return result.data;
}

export function assistantPollDelay(attempt: number): number {
  return Math.min(250 * 2 ** Math.floor(attempt / 5), 2000);
}

export function createLiveAssistantApiService(
  options: {
    baseUrl?: string;
    token?: TokenProvider;
    request?: typeof fetch;
    sleep?: (milliseconds: number) => Promise<void>;
    identity?: () => Promise<{
      userId: string;
      token: string;
      assertCurrent(): Promise<void>;
    }>;
    journal?: AssistantOperationJournal;
    consentStore?: TextConsentStore;
    requestTimeoutMs?: number;
    now?: () => number;
  } = {}
): CapabilityProviderHandle<AssistantService> {
  const baseUrl = options.baseUrl ?? process.env.EXPO_PUBLIC_API_URL ?? '';
  const token = options.token ?? (() => tokenProvider());
  const request = options.request ?? fetch;
  const traffic = new AiTrafficBackoff();
  const stagingDevelopment =
    __DEV__ &&
    Constants.expoConfig?.android?.package === 'com.masarifi.mobile.dev' &&
    baseUrl.replace(/\/$/u, '') === 'https://api.staging.masarifiratibi.com';
  const sleep =
    options.sleep ??
    ((milliseconds: number) =>
      new Promise<void>((resolve) => setTimeout(resolve, milliseconds)));
  const consentStore = options.consentStore;
  const consentChanges = new Map<string, symbol>();
  const pendingWithdrawals = new Map<string, number>();
  let consentRevision = 0;
  const consentRequired = () => new AssistantApiError('consent_required', ['assistant.consent'], true);
  const reviewedDisclosures = new Map<string, string>();
  const journal = options.journal ?? createMemoryAssistantJournal();
  const now = options.now ?? Date.now;
  const captureIdentity =
    options.identity ??
    (async () => ({
      userId: 'inert-adapter-owner',
      token: await token(),
      assertCurrent: async () => {}
    }));
  // Authentication is part of the request boundary. A late token must never
  // resume a question after the caller has already entered recovery.
  const identity = async () => {
    let deadline: ReturnType<typeof setTimeout> | undefined;
    try {
      return await Promise.race([
        captureIdentity(),
        new Promise<never>((_resolve, reject) => {
          deadline = setTimeout(
            () => reject(new AssistantApiError('offline')),
            Math.min(options.requestTimeoutMs ?? 15000, 15000)
          );
        })
      ]);
    } finally {
      if (deadline) clearTimeout(deadline);
    }
  };

  const questionIdentity = async (origin?: string | null) => {
    const actor = await identity();
    if (origin !== undefined && actor.userId !== origin)
      throw new AssistantApiError('session_expired', [], true);
    await actor.assertCurrent();
    return actor;
  };

  const send = async (
    method: string,
    path: string,
    body?: unknown,
    key?: string,
    expectedOwner?: string,
    timeoutMs?: number,
    prepareDefault = true
  ): Promise<unknown> => {
    assertBenchmarkRead(method);
    const binding = financialMutation(path,method) ? await captureWriteGeneration() : undefined;
    if (!baseUrl) throw new AssistantApiError('assistant_disabled');
    const actor = await identity();
    if (expectedOwner && actor.userId !== expectedOwner)
      throw new AssistantApiError('session_expired');
    const questionRequest = method === 'POST' && (
      path === '/api/v1/assistant/conversations' ||
      /^\/api\/v1\/assistant\/conversations\/[^/]+\/messages$/u.test(path)
    );
    const questionRevision = consentRevision;
    if (consentStore && questionRequest) {
      const consent = await currentConsent(actor.userId);
      await actor.assertCurrent();
      if (questionRevision !== consentRevision || consent.status !== 'enabled' || consentChanges.has(actor.userId)) throw consentRequired();
    }
    const controller = new AbortController();
    let deadline: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<never>((_resolve, reject) => {
      deadline = setTimeout(
        () => {
          controller.abort();
          reject(
            new AssistantApiError(
              method === 'GET' ? 'offline' : 'outcome_unknown'
            )
          );
        },
        Math.min(options.requestTimeoutMs ?? 15000, timeoutMs ?? 15000)
      );
    });
    let response: Response;
    try {
      response = await Promise.race([
        traffic.request(actor.userId, method, path, controller.signal, () => actor.assertCurrent(), async () => {
          await actor.assertCurrent();
          // Backoff may delay or retry a question after the owner withdraws.
          // Recheck immediately before every POST; Android has no disclosure store.
          if (consentStore && questionRequest && (
            questionRevision !== consentRevision || consentChanges.has(actor.userId) || pendingWithdrawals.has(actor.userId)
          )) throw consentRequired();
          return request(`${baseUrl.replace(/\/$/u, '')}${path}`, {
          method,
          signal: controller.signal,
          headers: {
            ...generationHeaders(binding),
            Authorization: `Bearer ${actor.token}`,
            ...(stagingDevelopment
              ? { 'X-Masarifi-Client-Variant': 'staging-development' }
              : {}),
            ...(body === undefined
              ? {}
              : { 'Content-Type': 'application/json' }),
            ...(key ? { 'Idempotency-Key': key } : {})
          },
          body: body === undefined ? undefined : JSON.stringify(body)
          });
        }),
        timeout
      ]);
    } catch (error) {
      if (deadline) clearTimeout(deadline);
      if (error instanceof AiTrafficBusy) throw new AssistantApiError('traffic_busy');
      throw error instanceof AssistantApiError
        ? error
        : new AssistantApiError(
            method === 'GET' ? 'offline' : 'outcome_unknown'
          );
    }
    let value: unknown = null;
    if (response.status !== 204) {
      try {
        value = await Promise.race([response.json(), timeout]);
      } catch (error) {
        if (deadline) clearTimeout(deadline);
        throw error instanceof AssistantApiError
          ? error
          : new AssistantApiError('representative_failure');
      }
    }
    if (deadline) clearTimeout(deadline);
    await actor.assertCurrent();
    if (!response.ok) {
      const ownerCode =
        value && typeof value === 'object' && 'code' in value
          ? Reflect.get(value, 'code')
          : null;
      if (!consentStore && prepareDefault && key && questionRequest && response.status === 403 && ownerCode === 'AI_CONSENT_REQUIRED') {
        // Only an explicit question prepares the legacy setting. Keep its owner,
        // payload and idempotency key through the single definitive-rejection retry.
        const readSetting = async () => parse(consentSchema, await send(
          'GET', '/api/v1/assistant/consent', undefined, undefined, actor.userId, undefined, false
        ));
        let setting = await readSetting();
        if (setting.policyVersion !== 'assistant-privacy-v1')
          throw new AssistantApiError('consent_required', [], true);
        if (!setting.granted) {
          const activationKey = 'assistant-default-' + bytesToHex(sha256(utf8ToBytes(`${key}:${setting.version}`)));
          try {
            setting = parse(consentSchema, await send('PUT', '/api/v1/assistant/consent', {
              policyVersion: setting.policyVersion, accepted: true, expectedVersion: setting.version
            }, activationKey, actor.userId, undefined, false));
          } catch (error) {
            if (!(error instanceof AssistantApiError) || !['conflict', 'outcome_unknown'].includes(error.code)) throw error;
            setting = await readSetting();
            if (!setting.granted) throw error;
          }
        }
        if (!setting.granted || setting.policyVersion !== 'assistant-privacy-v1')
          throw new AssistantApiError('consent_required', [], true);
        await actor.assertCurrent();
        return send(method, path, body, key, actor.userId, timeoutMs, false);
      }
      const mapped =
        response.status === 401
          ? 'session_expired'
          : ownerCode === 'AI_CONSENT_REQUIRED' ||
              ownerCode === 'AI_CONSENT_POLICY_STALE'
            ? 'consent_required'
            : response.status === 403
              ? 'forbidden'
              : ownerCode === 'AI_QUOTA_EXCEEDED' ||
                  ownerCode === 'AI_BUDGET_EXHAUSTED'
                ? 'limit_reached'
                : ownerCode === 'AI_ACTION_CONFLICT' ||
                    ownerCode === 'AI_CONVERSATION_CONFLICT' ||
                    response.status === 409
                  ? 'conflict'
                  : ownerCode === 'AI_UNAVAILABLE' ||
                      ownerCode === 'AI_TEMPORARILY_UNAVAILABLE' ||
                      response.status === 503
                    ? 'assistant_disabled'
                    : response.status === 404
                      ? 'not_found'
                      : 'representative_failure';
      if (consentStore && questionRequest && mapped === 'consent_required') {
        if (questionRevision === consentRevision) {
          consentRevision++;
          await consentStore.write(disclosureKey(actor.userId), null);
        }
        throw consentRequired();
      }
      throw new AssistantApiError(
        mapped,
        [],
        [
          'AI_CONSENT_REQUIRED',
          'AI_CONSENT_POLICY_STALE',
          'AI_QUOTA_EXCEEDED',
          'AI_BUDGET_EXHAUSTED',
          'AI_UNAVAILABLE',
          'AI_TEMPORARILY_UNAVAILABLE',
          'VALIDATION_FAILED',
          'AI_CONTEXT_STALE',
          'AI_EVIDENCE_INCOMPLETE'
        ].includes(String(ownerCode))
      );
    }
    return value;
  };

  function withdrawalState(version: number): AssistantConsent {
    return {
      status: 'withdrawal_pending', version, consentedAt: null, disabledAt: null,
      disclosedDataCategories: ['transactions', 'planning', 'reports']
    };
  }

  async function pendingWithdrawal(owner: string): Promise<AssistantConsent | null> {
    const inMemory = pendingWithdrawals.get(owner);
    if (inMemory !== undefined) return withdrawalState(inMemory);
    if (!consentStore) return null;
    const key = disclosureKey(owner);
    const markers = await Promise.allSettled([
      consentStore.read(key), consentStore.read(key + '.withdrawal')
    ]);
    for (const marker of markers) {
      if (marker.status !== 'fulfilled' || !marker.value?.startsWith('withdraw:')) continue;
      const version = Number(marker.value.slice('withdraw:'.length));
      if (!Number.isSafeInteger(version) || version < 1) throw consentRequired();
      return withdrawalState(version);
    }
    if (markers.some(marker => marker.status === 'rejected')) throw consentRequired();
    return null;
  }

  async function currentConsent(owner: string): Promise<AssistantConsent> {
    const pending = await pendingWithdrawal(owner);
    if (pending) return pending;
    const row = parse(consentSchema, await send('GET', '/api/v1/assistant/consent', undefined, undefined, owner));
    const consent = mapConsent(row);
    if (!consentStore) return consent;
    if (row.policyVersion !== textPolicy) throw consentRequired();
    if (row.granted && (!row.grantedAt || consentChanges.has(owner) ||
        await consentStore.read(disclosureKey(owner)) !== grantReceipt(row))) {
      return { ...consent, status: 'not_requested', consentedAt: null };
    }
    return consent;
  }


  const listMessages = async (id: string, cursor?: string, owner?: string) =>
    parse(
      page(messageSchema).extend({
        questions: z.array(messageSchema).optional()
      }),
      await send(
        'GET',
        `/api/v1/assistant/conversations/${encodeURIComponent(id)}/messages?limit=99&includeQuestions=true${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`,
        undefined,
        undefined,
        owner
      )
    );
  const mapResponse = (
    row: z.infer<typeof messageSchema>,
    rows: readonly z.infer<typeof messageSchema>[]
  ): AssistantResponse => {
    if (
      row.role !== 'assistant' ||
      row.status !== 'completed' ||
      !row.replyToMessageId ||
      !row.snapshot ||
      !row.content
    )
      throw new AssistantApiError('representative_failure');
    const question = rows.find(
      (item) =>
        item.id === row.replyToMessageId &&
        item.role === 'user' &&
        item.conversationId === row.conversationId
    );
    if (!question?.content)
      throw new AssistantApiError('representative_failure');
    const mapped: AssistantResponse = {
      requestMessageId: question.id,
      requestCreatedAt: epoch(question.createdAt),
      ...(question.metadata
        ? {
            timezone: question.metadata.timezone,
            currencies: question.metadata.currencies
          }
        : {}),
      id: row.id,
      conversationId: row.conversationId,
      question: question.content,
      ...(question.metadata?.spendingSummary
        ? { spendingSummary: question.metadata.spendingSummary }
        : {}),
      responseType:
        question.metadata?.responseType === 'redirect'
          ? 'safe_redirect'
          : question.metadata?.responseType === 'missing'
            ? 'insufficient_data'
            : 'direct',
      blocks: [
        {
          label:
            question.metadata?.responseType === 'redirect'
              ? 'scope'
              : question.metadata?.responseType === 'missing'
                ? 'clarification'
                : question.metadata?.responseType === 'estimate'
                  ? 'estimate'
                  : question.metadata?.responseType === 'suggestion'
                    ? 'suggestion'
                    : 'fact',
          key: row.content.replace(/\u2028/gu, '\n'),
          values: {}
        }
      ],
      period:
        question.metadata &&
        (!question.metadata.scope ||
          question.metadata.scope === 'selected_period')
          ? `${question.metadata.startDate}/${question.metadata.endDate}`
          : null,
      dataAsOf: Math.min(
        ...row.snapshot.evidenceRefs.map((ref) =>
          epoch(ref.asOf ?? row.snapshot!.createdAt)
        ),
        epoch(row.snapshot.createdAt)
      ),
      snapshot: createImmutableSnapshot({
        sources: row.snapshot.evidenceRefs.map(
          ({ kind, alias: id, version, asOf }) => ({
            kind,
            id,
            version,
            ...(asOf ? { asOf } : {})
          })
        ),
        values: (question.metadata?.values ?? []).map(
          ({ minor, ...value }) => ({
            ...value,
            exactMinor: minor,
            ...(Number.isSafeInteger(Number(minor))
              ? { minor: Number(minor) }
              : {})
          })
        ),
        completeness: {
          confirmed: row.snapshot.evidenceRefs.length,
          reviewRequired: 0,
          conflicts: 0,
          reasons: question.metadata?.reasons ?? []
        },
        reportReference: null
      }),
      limitations:
        question.metadata?.responseType === 'redirect'
          ? []
          : [
              ...(question.metadata ? [] : ['answer_metadata_unavailable']),
              ...(row.snapshot.evidenceRefs.length &&
              row.snapshot.evidenceRefs.every((ref) => ref.asOf)
                ? []
                : ['source_time_unavailable']),
              ...(question.metadata?.reasons ?? [])
            ],
      proposedActionIds: row.preview ? [row.preview.id] : [],
      feedback: null,
      createdAt: epoch(row.createdAt)
    };
    return mapped;
  };
  const loadAnswer = async (
    kind: 'response' | 'preview',
    id: string,
    actor: Awaited<ReturnType<typeof identity>>
  ) => {
    const path = kind === 'response' ? 'messages' : 'previews';
    const { items } = parse(
      page(messageSchema),
      await send(
        'GET',
        `/api/v1/assistant/${path}/${encodeURIComponent(id)}`,
        undefined,
        undefined,
        actor.userId
      )
    );
    await actor.assertCurrent();
    const answer = items.find(
      (row) =>
        row.role === 'assistant' &&
        row.status === 'completed' &&
        (kind === 'response' ? row.id === id : row.preview?.id === id)
    );
    if (!answer) throw new AssistantApiError('not_found');
    const response = mapResponse(answer, items);
    const question = items.find((row) => row.id === response.requestMessageId);
    const preview =
      answer.preview && answer.snapshot
        ? {
            ...mapPreview(
              answer.preview,
              answer.id,
              answer.snapshot.evidenceRefs
            ),
            ...(question?.actionTimezone
              ? { effectTimezone: question.actionTimezone }
              : {})
          }
        : null;
    return { response, preview };
  };
  const loadPreview = async (
    id: string,
    actor: Awaited<ReturnType<typeof identity>>
  ) => {
    const { preview } = await loadAnswer('preview', id, actor);
    if (!preview) throw new AssistantApiError('not_found');
    return preview;
  };
  const ask = async (
    conversationId: string,
    question: string,
    operationId: string,
    intent?: import('../contracts/assistant-notifications-service').AssistantQuestionIntent,
    ownerId?: string | null
  ): Promise<AssistantResponse> => {
    const actor = await questionIdentity(ownerId).catch((error: unknown) => {
      if (error instanceof AssistantApiError)
        throw new AssistantApiError(error.code, error.affectedScopes, true);
      throw error;
    });
    const previous = await journal.read(actor.userId, 'question');
    await actor.assertCurrent();
    const operation = await journal.reserve(
      actor.userId,
      'question',
      { conversationId, question, ...(intent ? { intent } : {}) },
      operationId
    );
    try {
      await actor.assertCurrent();
      const recovered =
        operation.messageId ??
        (previous?.operationId === operation.operationId
          ? await acceptance(
              conversationId,
              operation.operationId,
              actor.userId
            )
          : null);
      const messageId =
        recovered ??
        (
          await accept(
            conversationId,
            question,
            operation.operationId,
            intent,
            actor.userId
          )
        ).id;
      await actor.assertCurrent();
      await journal.update(actor.userId, 'question', operation.operationId, {
        phase: 'accepted',
        messageId
      });
      const answer = await wait(conversationId, messageId, actor.userId);
      await actor.assertCurrent();
      await journal.update(actor.userId, 'question', operation.operationId, {
        phase: 'completed'
      });
      return answer;
    } catch (error) {
      if (error instanceof AssistantApiError)
        throw new AssistantApiError(
          error.code,
          error.affectedScopes,
          error.definitiveRejection,
          operation.operationId
        );
      throw error;
    }
  };
  const acceptance = async (
    conversationId: string,
    operationId: string,
    owner: string
  ): Promise<string | null> => {
    try {
      return parse(
        z.object({ id: z.string().uuid(), status: z.string() }).strict(),
        await send(
          'GET',
          `/api/v1/assistant/conversations/${encodeURIComponent(conversationId)}/messages/acceptance`,
          undefined,
          operationId,
          owner
        )
      ).id;
    } catch (error) {
      if (error instanceof AssistantApiError && error.code === 'not_found')
        return null;
      throw error;
    }
  };
  const accept = async (
    conversationId: string,
    question: string,
    operationId: string,
    intent?: import('../contracts/assistant-notifications-service').AssistantQuestionIntent,
    owner?: string
  ) => {
    try {
      return parse(
        z
          .object({
            id: z.string().uuid(),
            status: z.string(),
            replayed: z.boolean().optional()
          })
          .strict(),
        await send(
          'POST',
          `/api/v1/assistant/conversations/${encodeURIComponent(conversationId)}/messages`,
          {
            content: question,
            ...(intent ? { intent } : {}),
            responseMode: 'async'
          },
          operationId,
          owner
        )
      );
    } catch (error) {
      if (
        owner &&
        error instanceof AssistantApiError &&
        error.definitiveRejection
      ) {
        const actor = await identity();
        await actor.assertCurrent();
        if (actor.userId === owner) {
          const saved = await journal.read(owner, 'question');
          if (
            saved &&
            !saved.messageId &&
            [saved.operationId, `${saved.operationId}-message`].includes(
              operationId
            )
          )
            await journal.update(owner, 'question', saved.operationId, {
              phase: 'failed'
            });
        }
      }
      throw error;
    }
  };
  const wait = async (
    conversationId: string,
    messageId: string,
    owner: string
  ): Promise<AssistantResponse> => {
    const startedAt = now();
    for (
      let attempt = 0;
      attempt < 40 && now() - startedAt < 65000;
      attempt += 1
    ) {
      const remainingMs = 65000 - (now() - startedAt);
      // Keep one owned request open for completion instead of paying another
      // mobile round trip after each pending result. Legacy APIs may return early.
      const waitMs = Math.min(
        8000,
        Math.max(0, Math.floor(remainingMs - 1000))
      );
      const result = parse(
        z
          .object({
            id: z.string().uuid(),
            conversationId: z.string().uuid(),
            status: z.enum([
              'queued',
              'processing',
              'completed',
              'failed',
              'cancelled'
            ]),
            failureCode: z.string().nullable(),
            request: messageSchema,
            response: messageSchema.nullable()
          })
          .strict(),
        await send(
          'GET',
          `/api/v1/assistant/conversations/${encodeURIComponent(conversationId)}/messages/${encodeURIComponent(messageId)}/result?waitMs=${waitMs}`,
          undefined,
          undefined,
          owner,
          remainingMs
        )
      );
      if (
        result.id !== messageId ||
        result.conversationId !== conversationId ||
        result.request.id !== messageId ||
        result.request.conversationId !== conversationId ||
        result.request.role !== 'user'
      )
        throw new AssistantApiError('representative_failure');
      if (result.status === 'failed' || result.status === 'cancelled') {
        if (owner) {
          const operation = await journal.read(owner, 'question');
          if (
            operation?.conversationId === conversationId &&
            operation.messageId === messageId
          )
            await journal.update(owner, 'question', operation.operationId, {
              phase: 'failed'
            });
        }
        throw new AssistantApiError(
          result.failureCode === 'AI_QUOTA_EXCEEDED'
            ? 'limit_reached'
            : 'assistant_disabled'
        );
      }
      if (result.status === 'completed' && result.response) {
        if (
          result.response.conversationId !== conversationId ||
          result.response.replyToMessageId !== messageId
        )
          throw new AssistantApiError('representative_failure');
        return mapResponse(result.response, [result.request]);
      }
      if (result.status === 'completed')
        throw new AssistantApiError('representative_failure');
      await sleep(assistantPollDelay(attempt));
    }
    throw new AssistantApiError('still_processing');
  };

  return {
    metadata: {
      id: 'phase09-assistant-http',
      capability: assistantServiceCapability.capability,
      majorVersion: assistantServiceCapability.majorVersion,
      kind: 'live',
      availability:
        baseUrl &&
        (Boolean(options.identity) ||
          Boolean(options.token) ||
          tokenProviderConfigured)
          ? 'available'
          : 'unavailable'
    },
    async readQuestionOperation() {
      const actor = await identity();
      const operation = await journal.read(actor.userId, 'question');
      await actor.assertCurrent();
      return operation
        ? {
            operationId: operation.operationId,
            phase: operation.phase,
            conversationId: operation.conversationId,
            messageId: operation.messageId,
            question: operation.request.question,
            createdAt: operation.createdAt
          }
        : null;
    },
    async retryQuestionOperation(ownerId) {
      assertBenchmarkRead('POST');
      const actor = await questionIdentity(ownerId);
      const saved = await journal.read(actor.userId, 'question');
      await actor.assertCurrent();
      if (
        !saved?.request.question ||
        ['completed', 'failed'].includes(saved.phase)
      )
        throw new AssistantApiError('conflict');
      if (saved.messageId) {
        const recovered = await this.resumeQuestion!(actor.userId);
        return mutation(
          { conversationId: recovered.value.conversationId },
          recovered.affectedScopes
        );
      }
      const intent = saved.request.intent as
        | import('../contracts/assistant-notifications-service').AssistantQuestionIntent
        | undefined;
      if (saved.request.conversationId) {
        const recovered = await this.ask(
          saved.request.conversationId,
          saved.request.question,
          saved.operationId,
          intent,
          actor.userId
        );
        return mutation(
          { conversationId: recovered.value.conversationId },
          recovered.affectedScopes
        );
      }
      const recovered = await this.createConversation(
        { question: saved.request.question, intent },
        saved.operationId,
        actor.userId
      );
      return mutation(
        { conversationId: recovered.value.id },
        recovered.affectedScopes
      );
    },
    async resumeQuestion(ownerId) {
      assertBenchmarkRead('POST');
      const actor = await questionIdentity(ownerId);
      const operation = await journal.read(actor.userId, 'question');
      if (!operation?.conversationId)
        throw new AssistantApiError('outcome_unknown');
      const messageId =
        operation.messageId ??
        (await acceptance(
          operation.conversationId,
          operation.request.conversationId === null
            ? `${operation.operationId}-message`
            : operation.operationId,
          actor.userId
        ));
      if (!messageId) throw new AssistantApiError('outcome_unknown');
      await actor.assertCurrent();
      if (operation.phase !== 'completed' && operation.phase !== 'failed')
        await journal.update(actor.userId, 'question', operation.operationId, {
          phase: 'accepted',
          messageId
        });
      const response = await wait(
        operation.conversationId,
        messageId,
        actor.userId
      );
      await actor.assertCurrent();
      await journal.update(actor.userId, 'question', operation.operationId, {
        phase: 'completed',
        messageId
      });
      return mutation(response, [
        `assistant.conversation.${operation.conversationId}`,
        'assistant.conversations',
        'assistant.availability'
      ]);
    },
    async getConsent(ownerId) {
      if (!consentStore) return mapConsent(await send('GET', '/api/v1/assistant/consent'));
      // A retry must remain available before the identity provider can go online.
      if (ownerId) {
        const pending = await pendingWithdrawal(ownerId);
        if (pending) return pending;
      }
      const actor = await identity();
      if (ownerId && actor.userId !== ownerId) throw new AssistantApiError('session_expired');
      const consent = await currentConsent(actor.userId);
      await actor.assertCurrent();
      return consent;
    },
    async getAvailability() {
      const row = parse(
        z
          .object({
            status: z.enum(['available', 'disabled', 'limit_reached']),
            limit: z.number().int().nonnegative(),
            used: z.number().int().nonnegative(),
            remaining: z.number().int().nonnegative(),
            resetsAt: dateTime,
            schemaVersion: z.literal(1).optional(),
            checkedAt: dateTime.optional(),
            capabilities: z
              .object({
                directRead: z.enum(['available', 'disabled', 'unknown']),
                provider: z.enum([
                  'available',
                  'disabled',
                  'limit_reached',
                  'unknown'
                ]),
                actions: z.enum(['available', 'disabled', 'unknown'])
              })
              .strict()
              .optional(),
            worker: z
              .object({
                status: z.enum(['available', 'disabled', 'unknown']),
                lastSeenAt: dateTime.nullable()
              })
              .strict()
              .optional(),
            reasons: z.array(z.string()).optional()
          })
          .strict(),
        await send('GET', '/api/v1/assistant/availability')
      );
      return {
        status: row.status,
        remainingQuestions: row.remaining,
        limit: row.limit,
        used: row.used,
        resetsAt: row.resetsAt,
        ...(row.capabilities
          ? {
              capabilities: row.capabilities,
              worker: row.worker,
              checkedAt: row.checkedAt,
              reasons: row.reasons
            }
          : {})
      };
    },
    async listInsights(): Promise<AssistantFinancialInsight[]> {
      const result = parse(
        z.object({ items: z.array(insightSchema) }).strict(),
        await send('GET', '/api/v1/assistant/insights')
      );
      return result.items.map((row) => ({
        id: row.id,
        kind: row.kind,
        budgetName: row.payload.budgetName,
        currency: row.payload.currency,
        budgetMinor: amount(row.payload.budgetMinor),
        spentMinor: amount(row.payload.spentMinor),
        remainingMinor: amount(row.payload.remainingMinor),
        utilizationBps: row.payload.utilizationBps,
        createdAt: epoch(row.createdAt),
        expiresAt: epoch(row.expiresAt)
      }));
    },
    async setConsent(enabled, expectedVersion, operationId, ownerId) {
      assertBenchmarkRead('POST');
      const owner = ownerId ?? (consentStore ? (await identity()).userId : undefined);
      if (owner && consentStore && enabled) {
        const revision = consentRevision;
        if (await pendingWithdrawal(owner) || consentChanges.has(owner) || revision !== consentRevision)
          throw consentRequired();
      }
      const change = Symbol();
      const key = owner && consentStore ? disclosureKey(owner) : undefined;
      if (key && owner) {
        consentRevision++;
        consentChanges.set(owner, change);
      }
      try {
        if (consentStore && key && owner && !enabled) {
          pendingWithdrawals.set(owner, expectedVersion);
          const marker = 'withdraw:' + String(expectedVersion);
          // Each store can independently prevent the old receipt from admitting a question.
          await Promise.allSettled([
            consentStore.write(key, marker),
            consentStore.write(key + '.withdrawal', marker)
          ]);
          const path = '/api/v1/assistant/consent';
          // Recover a lost DELETE response or an intervening version change.
          const live = await send('GET', path, undefined, undefined, owner)
            .then(row => parse(consentSchema, row)).catch(() => null);
          const result = live && !live.granted ? live : parse(consentSchema, await send(
            'DELETE', path + '?expectedVersion=' + String(live?.version ?? expectedVersion),
            undefined, operationId, owner
          ));
          if (result.granted || consentChanges.get(owner) !== change) throw consentRequired();
          // Keep the independent denial marker until the old receipt has been cleared.
          await consentStore.write(key, null);
          await consentStore.write(key + '.withdrawal', null);
          pendingWithdrawals.delete(owner);
          return mutation(mapConsent(result), ['assistant.consent', 'assistant.availability', 'assistant.context']);
        }
        if (consentStore && key) await consentStore.write(key, null);
        const row = await send(
          enabled ? 'PUT' : 'DELETE',
          enabled
            ? '/api/v1/assistant/consent'
            : `/api/v1/assistant/consent?expectedVersion=${String(expectedVersion)}`,
          enabled
            ? {
                policyVersion: 'assistant-privacy-v1',
                accepted: true,
                expectedVersion
              }
            : undefined,
          operationId,
          owner
        );
        const result = parse(consentSchema, row);
        if (consentStore && owner && key && enabled) {
          if (!result.granted || !result.grantedAt || result.policyVersion !== textPolicy ||
              consentChanges.get(owner) !== change) throw consentRequired();
          await consentStore.write(key, grantReceipt(result));
        }
        return mutation(mapConsent(result), ['assistant.consent', 'assistant.availability', 'assistant.context']);
      } finally {
        if (owner && consentChanges.get(owner) === change) consentChanges.delete(owner);
      }
    },
    async listConversations(input) {
      const result = parse(
        page(conversationSchema),
        await send(
          'GET',
          `/api/v1/assistant/conversations?limit=${String(input.pageSize ?? 20)}${input.cursor ? `&cursor=${encodeURIComponent(input.cursor)}` : ''}`
        )
      );
      const items = result.items
        .map(mapConversation)
        .filter((item) => !input.status || item.status === input.status);
      return { items, nextCursor: result.nextCursor, total: items.length };
    },
    async createConversation(input, operationId, ownerId) {
      assertBenchmarkRead('POST');
      const actor = await questionIdentity(ownerId);
      const operation = await journal.reserve(
        actor.userId,
        'question',
        {
          conversationId: null,
          question: input.question,
          ...(input.intent ? { intent: input.intent } : {})
        },
        operationId
      );
      await actor.assertCurrent();
      let item: ReturnType<typeof mapConversation>;
      try {
        item = mapConversation(
          operation.conversationId
            ? await send(
                'GET',
                `/api/v1/assistant/conversations/${encodeURIComponent(operation.conversationId)}`,
                undefined,
                undefined,
                actor.userId
              )
            : await send(
                'POST',
                '/api/v1/assistant/conversations',
                { title: input.question.slice(0, 120) },
                operation.operationId,
                actor.userId
              )
        );
      } catch (error) {
        // Only a definite rejection of creation proves that no conversation was accepted.
        // Lost responses and malformed DTOs must retain the original retry identity.
        if (
          !operation.conversationId &&
          error instanceof AssistantApiError &&
          error.definitiveRejection
        ) {
          await actor.assertCurrent();
          await journal.update(
            actor.userId,
            'question',
            operation.operationId,
            { phase: 'failed' }
          );
        }
        throw error;
      }
      await actor.assertCurrent();
      if (operation.phase === 'prepared' || operation.phase === 'created') {
        await journal.update(actor.userId, 'question', operation.operationId, {
          phase: 'created',
          conversationId: item.id
        });
      }
      const recovered =
        operation.messageId ??
        (operation.conversationId
          ? await acceptance(
              item.id,
              `${operation.operationId}-message`,
              actor.userId
            )
          : null);
      const accepted = recovered
        ? { id: recovered }
        : await accept(
            item.id,
            input.question,
            `${operation.operationId}-message`,
            input.intent,
            actor.userId
          );
      await actor.assertCurrent();
      await journal.update(actor.userId, 'question', operation.operationId, {
        phase: 'accepted',
        conversationId: item.id,
        messageId: accepted.id
      });
      return mutation(item, [
        'assistant.conversations',
        `assistant.conversation.${item.id}`,
        'assistant.availability',
        'assistant.context'
      ]);
    },
    async getConversation(id, cursor) {
      const actor = await identity();
      const [detail, result] = await Promise.all([
        send(
          'GET',
          `/api/v1/assistant/conversations/${encodeURIComponent(id)}`,
          undefined,
          undefined,
          actor.userId
        ),
        listMessages(id, cursor, actor.userId)
      ]);
      const item = mapConversation(detail);
      const context = [...result.items, ...(result.questions ?? [])];
      const responses = result.items
        .filter((row) => row.role === 'assistant' && row.status === 'completed')
        .map((row) => mapResponse(row, context))
        .sort((a, b) => a.createdAt - b.createdAt || a.id.localeCompare(b.id));
      const saved = await journal.read(actor.userId, 'question');
      let savedRequest: z.infer<typeof messageSchema> | undefined;
      if (
        saved?.conversationId === id &&
        saved.messageId &&
        ['accepted', 'completed', 'failed'].includes(saved.phase)
      ) {
        const request =
          result.items.find(
            (row) => row.id === saved.messageId && row.role === 'user'
          ) ??
          parse(
            messageSchema,
            await send(
              'GET',
              `/api/v1/assistant/conversations/${encodeURIComponent(id)}/messages/${encodeURIComponent(saved.messageId)}`,
              undefined,
              undefined,
              actor.userId
            )
          );
        if (
          request.id !== saved.messageId ||
          request.conversationId !== id ||
          request.role !== 'user'
        )
          throw new AssistantApiError('representative_failure');
        savedRequest = request;
        if (
          saved.phase === 'accepted' &&
          request &&
          ['completed', 'failed', 'cancelled'].includes(request.status ?? '')
        ) {
          await actor.assertCurrent();
          await journal.update(actor.userId, 'question', saved.operationId, {
            phase: request.status === 'completed' ? 'completed' : 'failed'
          });
        }
      }
      await actor.assertCurrent();
      const userRows = [
        ...new Map(
          [...result.items, ...(savedRequest ? [savedRequest] : [])]
            .filter((row) => row.role === 'user')
            .map((row) => [row.id, row])
        ).values()
      ];
      const latestUser = userRows
        .slice()
        .sort(
          (a, b) =>
            epoch(b.createdAt) - epoch(a.createdAt) || b.id.localeCompare(a.id)
        )[0];
      return {
        conversation: {
          ...item,
          lastResponseId: responses[responses.length - 1]?.id ?? null
        },
        pendingMessageIds: [
          ...new Set(
            [...result.items, ...(savedRequest ? [savedRequest] : [])]
              .filter(
                (row) =>
                  row.role === 'user' &&
                  ['queued', 'processing'].includes(row.status ?? '')
              )
              .map((row) => row.id)
          )
        ],
        userTurns: userRows.map((row) => ({
          id: row.id,
          content: row.content,
          createdAt: epoch(row.createdAt),
          status: row.status ?? 'unknown',
          failureCode: row.failureCode
        })),
        failureCode: ['failed', 'cancelled'].includes(latestUser?.status ?? '')
          ? (latestUser?.failureCode ?? 'AI_PROCESSING_FAILED')
          : null,
        responses: {
          items: responses,
          nextCursor: result.nextCursor,
          total: responses.length
        }
      };
    },
    async getResponse(id) {
      return (await loadAnswer('response', id, await identity())).response;
    },
    async ask(conversationId, question, operationId, intent, ownerId) {
      assertBenchmarkRead('POST');
      return mutation(
        await ask(conversationId, question, operationId, intent, ownerId),
        [
          `assistant.conversation.${conversationId}`,
          'assistant.availability',
          'assistant.context'
        ]
      );
    },
    async renameConversation(id, title, expectedVersion, operationId) {
      assertBenchmarkRead('POST');
      return mutation(
        mapConversation(
          await send(
            'PATCH',
            `/api/v1/assistant/conversations/${encodeURIComponent(id)}`,
            { title, expectedVersion },
            operationId
          )
        ),
        ['assistant.conversations', `assistant.conversation.${id}`]
      );
    },
    async deleteConversation(id, expectedVersion, operationId) {
      assertBenchmarkRead('POST');
      await send(
        'DELETE',
        `/api/v1/assistant/conversations/${encodeURIComponent(id)}?expectedVersion=${String(expectedVersion)}`,
        undefined,
        operationId
      );
      return mutation({ id }, [
        'assistant.conversations',
        `assistant.conversation.${id}`
      ]);
    },
    async setResponseFeedback(responseId, feedback, operationId) {
      assertBenchmarkRead('POST');
      const current = await this.getResponse(responseId);
      await send(
        'PUT',
        `/api/v1/assistant/messages/${encodeURIComponent(responseId)}/feedback`,
        { rating: feedback === 'helpful' ? 1 : -1, reason: null },
        operationId
      );
      if (feedback === 'reported')
        await send(
          'POST',
          `/api/v1/assistant/messages/${encodeURIComponent(responseId)}/report`,
          {
            reportType: 'other',
            reason: 'Reported from the mobile assistant.'
          },
          `${operationId}-report`
        );
      const next = { ...current, feedback };
      return mutation(next, [
        `assistant.conversation.${current.conversationId}`
      ]);
    },
    async getActionPreview(id) {
      const actor = await identity();
      const value = await loadPreview(id, actor);
      if (value.status !== 'ready' || !value.effect) return value;
      const context: AssistantActionDisclosureContext = {};
      const read = (path: string) =>
        send('GET', `/api/v1/${path}`, undefined, undefined, actor.userId);
      const effect = value.effect;
      try {
        if (
          value.kind === 'create_transaction' &&
          typeof effect.accountId === 'string'
        )
          context.account = parse(
            z.record(z.unknown()),
            await read(
              `accounts/${encodeURIComponent(String(effect.accountId))}`
            )
          );
        if (value.confirmationAllowed) {
          if (value.kind === 'update_transaction')
            context.target = parse(
              z.object({ transaction: z.record(z.unknown()) }),
              await read(
                `transactions/${encodeURIComponent(String(effect.transactionId))}`
              )
            ).transaction;
          if (value.kind === 'update_budget')
            context.target = parse(
              z.record(z.unknown()),
              await read(
                `budgets/${encodeURIComponent(String(effect.budgetId))}`
              )
            );
          if (value.kind === 'resolve_tracking_review')
            context.target = parse(
              z.record(z.unknown()),
              await read(
                `reviews/${encodeURIComponent(String(effect.reviewId))}`
              )
            );
          if (value.kind === 'record_obligation_payment') {
            context.target = parse(
              z.record(z.unknown()),
              await read(
                `obligations/${encodeURIComponent(String(effect.obligationId))}`
              )
            );
            context.transaction = parse(
              z.object({ transaction: z.record(z.unknown()) }),
              await read(
                `transactions/${encodeURIComponent(String(effect.transactionId))}`
              )
            ).transaction;
            const items: Record<string, unknown>[] = [],
              seen = new Set<string>();
            let cursor: string | undefined;
            for (let attempt = 0; attempt < 20; attempt += 1) {
              const result = parse(
                page(z.record(z.unknown())),
                await read(
                  `obligations/${encodeURIComponent(String(effect.obligationId))}/schedule?limit=100${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`
                )
              );
              items.push(...result.items);
              if (
                (effect.allocations as { scheduleItemId: string }[]).every(
                  (allocation) =>
                    items.some((item) => item.id === allocation.scheduleItemId)
                )
              )
                break;
              if (!result.nextCursor || seen.has(result.nextCursor)) break;
              seen.add(result.nextCursor);
              cursor = result.nextCursor;
            }
            context.schedule = items;
          }
        }
      } catch (error) {
        if (
          error instanceof AssistantApiError &&
          error.code === 'session_expired'
        )
          throw error;
        // The preview can still be cancelled; no effect can be confirmed without complete context.
      }
      await actor.assertCurrent();
      const disclosure = buildAssistantActionDisclosure(value, context, 'en');
      reviewedDisclosures.set(
        `${actor.userId}:${id}`,
        JSON.stringify([value.version, value.effect, disclosure])
      );
      return {
        ...value,
        disclosure,
        confirmationAllowed:
          value.confirmationAllowed === true && disclosure.complete
      };
    },
    async updateActionPreview() {
      assertBenchmarkRead('POST');
      throw new AssistantApiError('assistant_disabled');
    },
    async confirmAction(id, expectedVersion, operationId) {
      assertBenchmarkRead('POST');
      const actor = await identity();
      const reviewed = reviewedDisclosures.get(`${actor.userId}:${id}`);
      const current = await this.getActionPreview(id);
      await actor.assertCurrent();
      const slot = `confirm:${id}`;
      const saved = await journal.read(actor.userId, slot);
      if (
        reviewed &&
        !saved &&
        current.status === 'ready' &&
        reviewed !== reviewedDisclosures.get(`${actor.userId}:${id}`)
      )
        throw new AssistantApiError('conflict');
      const scopes = [
        `assistant.actionPreview.${id}`,
        'assistant.context',
        'assistant.insights',
        'financial.live'
      ];
      if (current.status === 'succeeded' && saved) {
        await journal.update(actor.userId, slot, saved.operationId, {
          phase: 'completed'
        });
        return mutation(current, scopes);
      }
      if (
        (current.status !== 'ready' &&
          !(current.status === 'confirming' && saved)) ||
        current.confirmationAllowed === false ||
        (!saved && current.version !== expectedVersion)
      )
        throw new AssistantApiError('conflict');
      if (!saved && current.expiresAt !== null && current.expiresAt <= now())
        throw new AssistantApiError('conflict');
      const originalVersion = saved?.request.expectedVersion ?? expectedVersion;
      const operation = await journal.reserve(
        actor.userId,
        slot,
        { previewId: id, expectedVersion: originalVersion },
        operationId
      );
      await actor.assertCurrent();
      const executed = parse(
        z
          .object({
            sourceId: z.string().uuid(),
            actionType: z.string(),
            resourceId: z.string().uuid(),
            status: z.literal('executed'),
            replayed: z.boolean()
          })
          .strict(),
        await send(
          'POST',
          `/api/v1/assistant/previews/${encodeURIComponent(id)}/confirm`,
          { expectedVersion: originalVersion },
          operation.operationId,
          actor.userId
        )
      );
      if (executed.sourceId !== id)
        throw new AssistantApiError('representative_failure');
      let next: AssistantActionPreview;
      try {
        next = await loadPreview(id, actor);
      } catch {
        await actor.assertCurrent();
        throw new AssistantApiError('confirmation_result_pending', scopes);
      }
      await actor.assertCurrent();
      if (next.status !== 'succeeded')
        throw new AssistantApiError('outcome_unknown');
      await journal.update(actor.userId, slot, operation.operationId, {
        phase: 'completed'
      });
      return mutation(next, scopes);
    },
    async cancelAction(id, expectedVersion, operationId) {
      assertBenchmarkRead('POST');
      const actor = await identity();
      const current = await this.getActionPreview(id);
      await actor.assertCurrent();
      const slot = `cancel:${id}`;
      const saved = await journal.read(actor.userId, slot);
      if (current.status === 'cancelled' && saved)
        return mutation(current, [`assistant.actionPreview.${id}`]);
      if (
        !['ready', 'draft'].includes(current.status) ||
        current.version !== expectedVersion
      )
        throw new AssistantApiError('conflict');
      const operation = await journal.reserve(
        actor.userId,
        slot,
        { previewId: id, expectedVersion },
        operationId
      );
      await send(
        'POST',
        `/api/v1/assistant/previews/${encodeURIComponent(id)}/reject`,
        { expectedVersion, reason: 'Cancelled by user' },
        operation.operationId,
        actor.userId
      );
      const next = await loadPreview(id, actor);
      if (next.status !== 'cancelled')
        throw new AssistantApiError('outcome_unknown');
      await actor.assertCurrent();
      await journal.update(actor.userId, slot, operation.operationId, {
        phase: 'completed'
      });
      return mutation(next, [`assistant.actionPreview.${id}`]);
    }
  };
}
