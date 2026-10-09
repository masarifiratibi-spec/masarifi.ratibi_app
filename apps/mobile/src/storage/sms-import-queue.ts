import AsyncStorage from '@react-native-async-storage/async-storage';
import { z } from 'zod';
import {
  validateClassification,
  validateRuleSnapshot,
  type RuleSnapshot
} from '@masarifi/transaction-parser';
import type { KeywordRule } from '@/domain/app-shell';
import { openDatabase, runExclusiveDatabaseTransaction } from './database';

import type {
  TrackingImportEvent,
  TrackingImportSubmission,
  TrackingMode
} from '@/domain/automatic-tracking';

const storageKey = 'masarifi.tracking.smsImportQueue.v1';

interface StorageLike {
  getItem(key: string): Promise<string | null>;
  removeItem(key: string): Promise<void>;
}

export interface SmsImportQueueEntry {
  idempotencyKey: string;
  submission: TrackingImportSubmission;
  sessionId: string | null;
}

export interface SmsRuleSnapshot {
  keywords: ({ value: string; enabled: boolean } & Partial<KeywordRule>)[];
  senders: {
    normalizedSender: string;
    enabled: boolean;
    trusted: boolean;
  }[];
  snapshot?: RuleSnapshot;
  configurationRevision?: string;
  bindings?: {
    provider: string;
    role: 'card' | 'account';
    suffix: string;
    accountId: string;
  }[];
  rolloutMode?: 'shadow' | 'review' | 'automatic';
}

export interface SmsImportQueueState {
  version: 1;
  ownerId: string;
  pending: SmsImportQueueEntry[];
  cursor: number | null;
  cursorId?: string;
  fingerprints: string[];
  mode: TrackingMode | null;
  rules: SmsRuleSnapshot;
}

export class SmsImportQueue {
  constructor(private readonly storage: StorageLike = AsyncStorage) {}

  async load(ownerId: string): Promise<SmsImportQueueState> {
    return this.update(ownerId);
  }

  async enqueue(
    ownerId: string,
    input: {
      idempotencyKey: string;
      submission: TrackingImportSubmission;
      cursor: number;
      cursorId?: string;
      fingerprints: readonly string[];
      mode?: TrackingMode;
    }
  ): Promise<SmsImportQueueState> {
    return this.update(ownerId, (state) => {
      if (
        !state.pending.some(
          (item) => item.idempotencyKey === input.idempotencyKey
        )
      ) {
        if (state.pending.length >= 100) throw new Error('sms_queue_full');
        state.pending.push({
          idempotencyKey: input.idempotencyKey,
          submission: minimize(input.submission),
          sessionId: null
        });
      }
      state.cursor = Math.max(state.cursor ?? 0, input.cursor);
      if (input.cursorId) state.cursorId = input.cursorId;
      state.fingerprints = [
        ...new Set([...state.fingerprints, ...input.fingerprints])
      ].slice(-500);
      if (input.mode) state.mode = input.mode;
    });
  }

  async checkpoint(
    ownerId: string,
    cursor: number,
    fingerprints: readonly string[],
    mode?: TrackingMode,
    cursorId?: string
  ): Promise<SmsImportQueueState> {
    return this.update(ownerId, (state) => {
      state.cursor = Math.max(state.cursor ?? 0, cursor);
      if (cursorId) state.cursorId = cursorId;
      state.fingerprints = [
        ...new Set([...state.fingerprints, ...fingerprints])
      ].slice(-500);
      if (mode) state.mode = mode;
    });
  }

  async markSubmitted(
    ownerId: string,
    idempotencyKey: string,
    sessionId: string
  ): Promise<SmsImportQueueState> {
    return this.update(ownerId, (state) => {
      const entry = state.pending.find(
        (item) => item.idempotencyKey === idempotencyKey
      );
      if (!entry) throw new Error('sms_queue_item_not_found');
      entry.sessionId = sessionId;
    });
  }

  async markTerminal(
    ownerId: string,
    idempotencyKey: string
  ): Promise<SmsImportQueueState> {
    return this.update(ownerId, (state) => {
      state.pending = state.pending.filter(
        (item) => item.idempotencyKey !== idempotencyKey
      );
    });
  }

  async saveRules(
    ownerId: string,
    rules: SmsRuleSnapshot
  ): Promise<SmsImportQueueState> {
    return this.update(ownerId, (state) => {
      if (rules.snapshot) validateRuleSnapshot(rules.snapshot);
      state.rules = rules;
    });
  }

  async clear(ownerId?: string): Promise<void> {
    try {
      const database = await openDatabase(ownerId);
      await runExclusiveDatabaseTransaction(database, async (transaction) => {
        await transaction.runAsync('DELETE FROM sms_import_queue');
      });
    } finally {
      await this.storage.removeItem(storageKey);
    }
  }

  private async update(
    ownerId: string,
    mutate?: (state: SmsImportQueueState) => void
  ): Promise<SmsImportQueueState> {
    const database = await openDatabase(ownerId);
    let state = empty(ownerId);
    let legacy: string | null = null;
    await runExclusiveDatabaseTransaction(database, async (transaction) => {
      const row = await transaction.getFirstAsync<{ payload: string }>(
        'SELECT payload FROM sms_import_queue WHERE id = ?',
        'singleton'
      );
      legacy = await this.storage.getItem(storageKey);
      const stored = row
        ? parseState(row.payload, ownerId)
        : parseLegacyState(legacy, ownerId);
      state = stored ?? empty(ownerId);
      if (mutate) mutate(state);
      if (mutate || (!row && stored)) {
        state = queueSchema.parse(state);
        state.pending = state.pending.map((entry) => ({
          ...entry,
          submission: minimize(entry.submission)
        }));
        await transaction.runAsync(
          'INSERT INTO sms_import_queue (id, payload) VALUES (?, ?) ON CONFLICT(id) DO UPDATE SET payload = excluded.payload',
          'singleton',
          JSON.stringify(state)
        );
      } else if (row && !stored) {
        await transaction.runAsync('DELETE FROM sms_import_queue');
      }
    });
    // Only remove a valid legacy copy after the encrypted transaction commits.
    if (legacy !== null) await this.storage.removeItem(storageKey);
    return state;
  }
}

export function clearLegacySmsImportQueue(): Promise<void> {
  return AsyncStorage.removeItem(storageKey);
}

const boundedText = z.string().min(1).max(200);
const timestamp = z.string().max(40).datetime({ offset: true });
const eventSchema = z
  .object({
    sourceItemKey: z.string().min(1).max(160),
    sender: boundedText.optional(),
    body: z.string().min(1).max(2000).optional(),
    amountMinor: z
      .number()
      .int()
      .safe()
      .refine((value) => value !== 0)
      .optional(),
    currency: z
      .string()
      .regex(/^[A-Z]{3}$/u)
      .optional(),
    merchant: boundedText.optional(),
    receivedAt: timestamp,
    occurredAt: timestamp.optional(),
    metadata: z
      .record(
        z.string().min(1).max(40),
        z.union([
          z.string().max(200),
          z.number().int().safe(),
          z.boolean(),
          z.null()
        ])
      )
      .refine((value) => Object.keys(value).length <= 12)
      .optional(),
    kind: z.enum(['income', 'expense', 'transfer', 'refund', 'fee']).optional(),
    accountId: z.string().uuid().optional(),
    categoryId: z.string().uuid().optional(),
    classification: z
      .unknown()
      .transform((value) => validateClassification(value))
      .optional(),
    transport: z
      .object({
        deviceId: boundedText,
        channel: z.enum(['android_sms', 'android_notification']),
        nativeIdDigest: boundedText,
        revisionDigest: boundedText
      })
      .strict()
      .optional(),
    providerReferenceDigest: boundedText.optional()
  })
  .strict()
  .refine(
    (value) =>
      value.body !== undefined ||
      value.amountMinor !== undefined ||
      value.classification !== undefined
  );
const queueSchema = z
  .object({
    version: z.literal(1),
    ownerId: boundedText,
    pending: z
      .array(
        z
          .object({
            idempotencyKey: boundedText,
            sessionId: boundedText.nullable(),
            submission: z
              .object({
                schemaVersion: z.union([z.literal(1), z.literal(2)]),
                sourceType: z.enum(['sms', 'provider', 'manual']),
                sourceChannel: z
                  .enum([
                    'android_sms',
                    'android_notification',
                    'ios_shortcut',
                    'ios_app_intent',
                    'ios_share_extension',
                    'manual'
                  ])
                  .optional(),
                events: z.array(eventSchema).min(1).max(100)
              })
              .strict()
          })
          .strict()
      )
      .max(100)
      .refine(
        (items) =>
          new Set(items.map((item) => item.idempotencyKey)).size ===
          items.length
      ),
    cursor: z.number().int().safe().nonnegative().nullable(),
    cursorId: z.string().max(80).optional(),
    fingerprints: z.array(boundedText).max(500),
    mode: z.enum(['automatic_clear', 'review_all', 'paused']).nullable(),
    rules: z
      .object({
        keywords: z
          .array(
            z
              .object({
                value: boundedText,
                enabled: z.boolean(),
                id: boundedText.optional(),
                group: z
                  .enum([
                    'expense',
                    'income',
                    'transfer',
                    'withdrawal',
                    'deposit',
                    'refund',
                    'subscription',
                    'installment',
                    'fee',
                    'financial',
                    'failed_transaction',
                    'reversal'
                  ])
                  .optional(),
                language: z.enum(['ar', 'en']).optional(),
                normalizedValue: z.string().optional(),
                origin: z.enum(['default', 'custom']).optional()
              })
              .passthrough()
          )
          .max(1000),
        senders: z
          .array(
            z
              .object({
                normalizedSender: boundedText,
                enabled: z.boolean(),
                trusted: z.boolean()
              })
              .passthrough()
          )
          .max(1000),
        snapshot: z
          .unknown()
          .transform((value) => validateRuleSnapshot(value))
          .optional(),
        bindings: z
          .array(
            z.object({
              provider: boundedText,
              role: z.enum(['card', 'account']),
              suffix: boundedText,
              accountId: z.string().uuid()
            })
          )
          .max(1000)
          .optional(),
        rolloutMode: z.enum(['shadow', 'review', 'automatic']).optional(),
        configurationRevision: z
          .string()
          .regex(/^[a-f0-9]{64}$/)
          .optional()
      })
      .strict()
  })
  .strict();

function parseState(
  raw: string | null,
  ownerId: string
): SmsImportQueueState | null {
  if (!raw || raw.length > 64 * 1024 * 1024) return null;
  try {
    const state = queueSchema.parse(JSON.parse(raw));
    return state.ownerId === ownerId ? state : null;
  } catch {
    throw new Error('sms_queue_corrupt');
  }
}
// Legacy AsyncStorage is unencrypted and has no reliable owner fence; invalid legacy data is purged.
function parseLegacyState(
  raw: string | null,
  ownerId: string
): SmsImportQueueState | null {
  try {
    return parseState(raw, ownerId);
  } catch (error) {
    if (error instanceof Error && error.message === 'sms_queue_corrupt')
      return null;
    throw error;
  }
}

function empty(ownerId: string): SmsImportQueueState {
  return {
    version: 1,
    ownerId,
    pending: [],
    cursor: null,
    fingerprints: [],
    mode: null,
    rules: { keywords: [], senders: [] }
  };
}

function minimize(input: TrackingImportSubmission): TrackingImportSubmission {
  return {
    schemaVersion: input.schemaVersion,
    sourceType: input.sourceType,
    ...(input.sourceChannel ? { sourceChannel: input.sourceChannel } : {}),
    events: input.events.map(minimizeEvent)
  };
}

function minimizeEvent(event: TrackingImportEvent): TrackingImportEvent {
  return {
    sourceItemKey: event.sourceItemKey,
    ...(event.sender ? { sender: event.sender } : {}),
    ...(event.amountMinor === undefined
      ? event.body
        ? { body: event.body }
        : {}
      : { amountMinor: event.amountMinor }),
    ...(event.currency ? { currency: event.currency } : {}),
    ...(event.merchant ? { merchant: event.merchant } : {}),
    receivedAt: event.receivedAt,
    ...(event.occurredAt ? { occurredAt: event.occurredAt } : {}),
    ...(event.metadata ? { metadata: event.metadata } : {}),
    ...(event.kind ? { kind: event.kind } : {}),
    ...(event.accountId ? { accountId: event.accountId } : {}),
    ...(event.categoryId ? { categoryId: event.categoryId } : {}),
    ...(event.classification ? { classification: event.classification } : {}),
    ...(event.transport ? { transport: event.transport } : {}),
    ...(event.providerReferenceDigest
      ? { providerReferenceDigest: event.providerReferenceDigest }
      : {})
  };
}
