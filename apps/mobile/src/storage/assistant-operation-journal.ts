import { sha256 } from '@noble/hashes/sha256';
import { bytesToHex, utf8ToBytes } from '@noble/hashes/utils';
import { z } from 'zod';

const requestSchema = z
  .object({
    question: z.string().min(1).max(1000).optional(),
    intent: z.string().optional(),
    conversationId: z.string().nullable().optional(),
    previewId: z.string().optional(),
    expectedVersion: z.number().int().positive().optional()
  })
  .strict();
const operationSchema = z
  .object({
    operationId: z.string().min(16).max(120),
    request: requestSchema,
    fingerprint: z.string(),
    phase: z.enum(['prepared', 'created', 'accepted', 'completed', 'failed']),
    conversationId: z.string().nullable(),
    messageId: z.string().nullable(),
    createdAt: z.number().int().nonnegative()
  })
  .strict();
export type AssistantOperation = z.infer<typeof operationSchema>;
export interface AssistantJournalStore {
  read(key: string): Promise<string | null>;
  write(key: string, value: string): Promise<void>;
}
const hash = (value: string) => bytesToHex(sha256(utf8ToBytes(value)));
const queues = new Map<string, Promise<unknown>>();

/** Owner-hashed secure storage; uncertain entries are never silently overwritten or replayed. */
export class AssistantOperationJournal {
  constructor(private readonly store: AssistantJournalStore) {}
  private key(owner: string, slot: string) {
    return `masarifi.assistant.operation.${hash(`${owner}:${slot}`)}`;
  }
  private async serial<T>(key: string, run: () => Promise<T>): Promise<T> {
    const previous = queues.get(key) ?? Promise.resolve();
    const current = previous.catch(() => undefined).then(run);
    queues.set(key, current);
    try {
      return await current;
    } finally {
      if (queues.get(key) === current) queues.delete(key);
    }
  }
  async read(owner: string, slot: string): Promise<AssistantOperation | null> {
    const value = await this.store.read(this.key(owner, slot));
    if (value === null) return null;
    try {
      return operationSchema.parse(JSON.parse(value));
    } catch {
      throw new Error('operation_journal_corrupt');
    }
  }
  async reserve(
    owner: string,
    slot: string,
    input: z.input<typeof requestSchema>,
    operationId: string
  ): Promise<AssistantOperation> {
    return this.serial(this.key(owner, slot), async () => {
      const request = requestSchema.parse(input);
      const fingerprint = hash(
        JSON.stringify(
          Object.fromEntries(
            Object.entries(request).sort(([a], [b]) => a.localeCompare(b))
          )
        )
      );
      const saved = await this.read(owner, slot);
      if (saved && !['completed', 'failed'].includes(saved.phase)) {
        if (saved.fingerprint === fingerprint) return saved;
        throw new Error('operation_unresolved');
      }
      const acknowledgedEmpty =
        slot === 'question' &&
        saved?.phase === 'failed' &&
        saved.request.conversationId === null &&
        !saved.messageId
          ? saved.conversationId
          : null;
      const value = operationSchema.parse({
        operationId,
        request,
        fingerprint,
        phase: 'prepared',
        conversationId: request.conversationId ?? acknowledgedEmpty,
        messageId: null,
        createdAt: Date.now()
      });
      await this.store.write(this.key(owner, slot), JSON.stringify(value));
      return value;
    });
  }
  async update(
    owner: string,
    slot: string,
    operationId: string,
    patch: Partial<
      Pick<AssistantOperation, 'phase' | 'conversationId' | 'messageId'>
    >
  ) {
    return this.serial(this.key(owner, slot), async () => {
      const saved = await this.read(owner, slot);
      if (!saved || saved.operationId !== operationId)
        throw new Error('operation_conflict');
      if (
        (saved.conversationId &&
          patch.conversationId !== undefined &&
          patch.conversationId !== saved.conversationId) ||
        (saved.messageId &&
          patch.messageId !== undefined &&
          patch.messageId !== saved.messageId)
      )
        throw new Error('operation_conflict');
      const phaseOrder = {
        prepared: 0,
        created: 1,
        accepted: 2,
        completed: 3,
        failed: 3
      };
      if (
        patch.phase &&
        (phaseOrder[patch.phase] < phaseOrder[saved.phase] ||
          (['completed', 'failed'].includes(saved.phase) &&
            patch.phase !== saved.phase))
      )
        throw new Error('operation_conflict');
      const value = operationSchema.parse({ ...saved, ...patch });
      await this.store.write(this.key(owner, slot), JSON.stringify(value));
      return value;
    });
  }
}

export function createMemoryAssistantJournal() {
  const rows = new Map<string, string>();
  return new AssistantOperationJournal({
    read: async (key) => rows.get(key) ?? null,
    write: async (key, value) => {
      rows.set(key, value);
    }
  });
}
