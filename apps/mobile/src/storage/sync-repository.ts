import type { SQLiteDatabase } from 'expo-sqlite';

import { openDatabase, runExclusiveDatabaseTransaction } from './database';

export type SyncDomain = 'accounts' | 'categories' | 'transactions';
export type SyncResourceType = 'account' | 'category' | 'transaction';
export type QueueStatus =
  'pending' | 'sending' | 'applied' | 'conflict' | 'rejected';

export interface LocalSyncMutation {
  operationId: string;
  domain: SyncDomain;
  resourceType: SyncResourceType;
  schemaVersion: 1;
  dependsOn: string[];
  operation: string;
  resourceId: string | null;
  baseVersion: number | null;
  payload: Record<string, unknown>;
}

export interface QueuedSyncMutation extends LocalSyncMutation {
  status: QueueStatus;
  attemptCount: number;
  nextAttemptAt: number | null;
  lastErrorCode: string | null;
}

interface StoredSyncMutation {
  operation_id: string; domain: SyncDomain; resource_type: SyncResourceType;
  schema_version: 1; depends_on: string; operation: string; resource_id: string | null;
  base_version: number | null; payload: string; status: QueueStatus;
  attempt_count: number; next_attempt_at: number | null; last_error_code: string | null;
}

function queuedMutation(row: StoredSyncMutation): QueuedSyncMutation {
  return {
    operationId: row.operation_id, domain: row.domain, resourceType: row.resource_type,
    schemaVersion: row.schema_version, dependsOn: JSON.parse(row.depends_on) as string[],
    operation: row.operation, resourceId: row.resource_id, baseVersion: row.base_version,
    payload: JSON.parse(row.payload) as Record<string, unknown>, status: row.status,
    attemptCount: row.attempt_count, nextAttemptAt: row.next_attempt_at, lastErrorCode: row.last_error_code
  };
}

export class SyncRepository {
  constructor(private readonly database?: SQLiteDatabase) {}

  private async db(): Promise<SQLiteDatabase> {
    return this.database ?? openDatabase();
  }

  async enqueue(mutation: LocalSyncMutation, now = Date.now()): Promise<void> {
    const database = await this.db();
    await database.runAsync(
      `INSERT OR IGNORE INTO sync_mutation_queue(
        operation_id,domain,resource_type,schema_version,depends_on,operation,
        resource_id,base_version,payload,status,
        attempt_count,next_attempt_at,last_error_code,created_at,updated_at
      ) VALUES(?,?,?,?,?,?,?,?,?,'pending',0,NULL,NULL,?,?)`,
      mutation.operationId,
      mutation.domain,
      mutation.resourceType,
      mutation.schemaVersion,
      JSON.stringify(mutation.dependsOn),
      mutation.operation,
      mutation.resourceId,
      mutation.baseVersion,
      JSON.stringify(mutation.payload),
      now,
      now
    );
  }

  async ready(now = Date.now(), limit = 100): Promise<QueuedSyncMutation[]> {
    if (!Number.isInteger(limit) || limit < 1 || limit > 100)
      throw new Error('SYNC_QUEUE_LIMIT_INVALID');
    const rows = await (
      await this.db()
    ).getAllAsync<StoredSyncMutation>(
      `SELECT q.* FROM sync_mutation_queue q
       WHERE q.status='pending' AND (q.next_attempt_at IS NULL OR q.next_attempt_at<=?)
         AND NOT EXISTS (
           SELECT 1 FROM json_each(q.depends_on) dependency
           LEFT JOIN sync_mutation_queue prerequisite
             ON prerequisite.operation_id=dependency.value
           WHERE prerequisite.status IS NULL OR prerequisite.status!='applied'
         )
       ORDER BY q.created_at,q.operation_id LIMIT ?`,
      now,
      limit
    );
    return rows.map(queuedMutation);
  }

  async submissionBatch(ready: QueuedSyncMutation[], limit = 100): Promise<QueuedSyncMutation[]> {
    if (!Number.isInteger(limit) || limit < 1 || limit > 100) throw new Error('SYNC_QUEUE_LIMIT_INVALID');
    const database = await this.db();
    const known = new Map(ready.map(row => [row.operationId, row]));
    const batch = new Map<string, QueuedSyncMutation>();
    for (const root of ready) {
      const closure = new Map<string, QueuedSyncMutation>();
      const visiting = new Set<string>();
      const discovered = new Set<string>();
      const reserve = (id: string) => {
        if (discovered.has(id)) return;
        if (discovered.size >= limit) throw new Error('SYNC_DEPENDENCY_LIMIT');
        discovered.add(id);
      };
      const visit = async (entry: QueuedSyncMutation): Promise<void> => {
        if (visiting.has(entry.operationId)) throw new Error('SYNC_DEPENDENCY_CYCLE');
        if (closure.has(entry.operationId)) return;
        reserve(entry.operationId);
        visiting.add(entry.operationId);
        for (const dependency of entry.dependsOn) {
          reserve(dependency);
          let parent = known.get(dependency);
          if (!parent) {
            const stored = await database.getFirstAsync<StoredSyncMutation>('SELECT * FROM sync_mutation_queue WHERE operation_id=?', dependency);
            if (!stored) throw new Error('SYNC_DEPENDENCY_MISSING');
            parent = queuedMutation(stored);
            known.set(dependency, parent);
          }
          if (parent.status !== 'applied') throw new Error('SYNC_DEPENDENCY_NOT_APPLIED');
          await visit(parent);
        }
        visiting.delete(entry.operationId);
        if (closure.size >= limit) throw new Error('SYNC_DEPENDENCY_LIMIT');
        closure.set(entry.operationId, entry);
      };
      await visit(root);
      const additional = [...closure.keys()].filter(id => !batch.has(id));
      if (batch.size + additional.length > limit) break;
      for (const [id, entry] of closure) batch.set(id, entry);
    }
    return [...batch.values()];
  }

  async markSending(operationIds: string[], now = Date.now()): Promise<Record<string, string>> {
    const database = await this.db();
    const targets: Record<string, string> = {};
    await runExclusiveDatabaseTransaction(database, async (transaction) => {
      for (const operationId of operationIds) {
        const queued = await transaction.getFirstAsync<{ domain: SyncDomain; operation: string; resource_id: string | null; attempt_count: number }>(
          "SELECT domain,operation,resource_id,attempt_count FROM sync_mutation_queue WHERE operation_id=? AND status='pending'", operationId
        );
        if (queued?.domain === 'transactions' && queued.operation !== 'create' && queued.resource_id) {
          const origin = await transaction.getFirstAsync<{ status: QueueStatus }>(
            "SELECT status FROM sync_mutation_queue WHERE domain='transactions' AND operation='create' AND resource_id=?", queued.resource_id
          );
          const mapped = await new SyncRepository(transaction).serverId('transactions', queued.resource_id);
          if (origin && (origin.status !== 'applied' || mapped === queued.resource_id))
            throw new Error('SYNC_CREATE_MAPPING_NOT_APPLIED');
          if (mapped !== queued.resource_id) {
            if (!origin || origin.status !== 'applied') throw new Error('SYNC_CREATE_MAPPING_NOT_APPLIED');
            if (queued.attempt_count !== 0) throw new Error('SYNC_SUBMITTED_TARGET_IMMUTABLE');
            await transaction.runAsync(
              "UPDATE sync_mutation_queue SET resource_id=? WHERE operation_id=? AND status='pending' AND attempt_count=0", mapped, operationId
            );
          }
          targets[operationId] = mapped;
        }
        await transaction.runAsync(
          `UPDATE sync_mutation_queue SET status='sending',attempt_count=attempt_count+1,
             updated_at=? WHERE operation_id=? AND status='pending'`,
          now,
          operationId
        );
      }
    });
    return targets;
  }

  async complete(
    operationId: string,
    status: 'applied' | 'conflict' | 'rejected',
    errorCode: string | null,
    mapping?: { domain: SyncDomain; localId: string; serverId: string }
  ): Promise<void> {
    if (mapping) {
      if (status !== 'applied' || !/^[0-9a-f-]{36}$/i.test(mapping.serverId)) throw new Error('SYNC_APPLIED_RESOURCE_INVALID');
      const database = await this.db();
      await runExclusiveDatabaseTransaction(database, async transaction => {
        const queue = new SyncRepository(transaction);
        const origin = await transaction.getFirstAsync<{ domain: SyncDomain; operation: string; resource_id: string }>(
          'SELECT domain,operation,resource_id FROM sync_mutation_queue WHERE operation_id=?', operationId
        );
        if (origin?.domain !== mapping.domain || origin.operation !== 'create' || origin.resource_id !== mapping.localId)
          throw new Error('SYNC_APPLIED_RESOURCE_INVALID');
        await queue.mapId(mapping.domain, mapping.localId, mapping.serverId);
        await queue.complete(operationId, status, errorCode);
      });
      return;
    }
    await (
      await this.db()
    ).runAsync(
      `UPDATE sync_mutation_queue SET status=?,last_error_code=?,next_attempt_at=NULL,
         updated_at=? WHERE operation_id=?`,
      status,
      errorCode,
      Date.now(),
      operationId
    );
  }

  async recoverSending(now = Date.now()): Promise<void> {
    await (
      await this.db()
    ).runAsync(
      `UPDATE sync_mutation_queue SET status='pending',next_attempt_at=?,updated_at=?
       WHERE status='sending'`,
      now,
      now
    );
  }

  async hasPending(domain?: SyncDomain): Promise<boolean> {
    const row = await (await this.db()).getFirstAsync<{ present: number }>(
      `SELECT 1 present FROM sync_mutation_queue WHERE status IN ('pending','sending')${domain ? ' AND domain=?' : ''} LIMIT 1`,
      ...(domain ? [domain] : [])
    );
    return Boolean(row);
  }

  async retry(
    operationId: string,
    nextAttemptAt: number,
    errorCode: string,
    now = Date.now()
  ): Promise<void> {
    const boundedNextAttemptAt = Math.min(
      Math.max(nextAttemptAt, now),
      now + 300_000
    );
    await (
      await this.db()
    ).runAsync(
      `UPDATE sync_mutation_queue SET status='pending',next_attempt_at=?,last_error_code=?,
         updated_at=? WHERE operation_id=?`,
      boundedNextAttemptAt,
      errorCode,
      now,
      operationId
    );
  }

  async cursor(domain: SyncDomain): Promise<string | null> {
    const row = await (
      await this.db()
    ).getFirstAsync<{ cursor: string }>(
      'SELECT cursor FROM sync_state WHERE domain=?',
      domain
    );
    return row?.cursor ?? null;
  }

  async saveCursor(
    transaction: SQLiteDatabase,
    domain: SyncDomain,
    cursor: string,
    lastMutationId: string | null,
    now = Date.now()
  ): Promise<void> {
    await transaction.runAsync(
      `INSERT INTO sync_state(domain,cursor,last_mutation_id,updated_at) VALUES(?,?,?,?)
       ON CONFLICT(domain) DO UPDATE SET cursor=excluded.cursor,
         last_mutation_id=excluded.last_mutation_id,updated_at=excluded.updated_at`,
      domain,
      cursor,
      lastMutationId,
      now
    );
  }

  async clearCursor(domain: SyncDomain): Promise<void> {
    await (
      await this.db()
    ).runAsync('DELETE FROM sync_state WHERE domain=?', domain);
  }

  async mapId(
    domain: SyncDomain,
    localId: string,
    serverId: string,
    now = Date.now()
  ): Promise<void> {
    await (
      await this.db()
    ).runAsync(
      `INSERT INTO sync_id_mappings(domain,local_id,server_id,updated_at) VALUES(?,?,?,?)
       ON CONFLICT(domain,local_id) DO UPDATE SET server_id=excluded.server_id,
         updated_at=excluded.updated_at`,
      domain,
      localId,
      serverId,
      now
    );
  }

  async serverId(domain: SyncDomain, localId: string): Promise<string> {
    const row = await (await this.db()).getFirstAsync<{ server_id: string }>(
      'SELECT server_id FROM sync_id_mappings WHERE domain=? AND local_id=?', domain, localId
    );
    return row?.server_id ?? localId;
  }

  async localId(domain: SyncDomain, serverId: string): Promise<string> {
    const row = await (await this.db()).getFirstAsync<{ local_id: string }>(
      'SELECT local_id FROM sync_id_mappings WHERE domain=? AND server_id=?', domain, serverId
    );
    return row?.local_id ?? serverId;
  }

  async resourceState(
    transaction: SQLiteDatabase,
    domain: SyncDomain,
    serverId: string
  ): Promise<{ version: number; deletedAt: number | null } | null> {
    const row = await transaction.getFirstAsync<{
      version: number;
      deleted_at: number | null;
    }>(
      'SELECT version,deleted_at FROM sync_resource_state WHERE domain=? AND server_id=?',
      domain,
      serverId
    );
    return row ? { version: row.version, deletedAt: row.deleted_at } : null;
  }

  async saveResourceState(
    transaction: SQLiteDatabase,
    domain: SyncDomain,
    serverId: string,
    version: number,
    deletedAt: number | null,
    now = Date.now()
  ): Promise<void> {
    await transaction.runAsync(
      `INSERT INTO sync_resource_state(domain,server_id,version,deleted_at,updated_at)
       VALUES(?,?,?,?,?) ON CONFLICT(domain,server_id) DO UPDATE SET
         version=excluded.version,deleted_at=excluded.deleted_at,updated_at=excluded.updated_at
       WHERE excluded.version>sync_resource_state.version`,
      domain,
      serverId,
      version,
      deletedAt,
      now
    );
  }
}
