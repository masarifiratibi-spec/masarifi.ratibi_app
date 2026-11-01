import { randomUUID } from 'node:crypto';
import type { PoolClient, QueryResultRow } from 'pg';

import { PoolService } from '../src/platform/database/pool.service';

export const describeLiveDatabase =
  process.env.MASARIFI_LIVE_DATABASE_TESTS === '1' ? describe : describe.skip;

export function createLivePool(max = 10): PoolService {
  return new PoolService({
    get: (key: string) => {
      if (key === 'DATABASE_URL') return process.env.DATABASE_URL;
      if (key === 'MASARIFI_DATABASE_POOL_MAX') return max;
      if (key === 'MASARIFI_PROCESS_KIND') return undefined;
      throw new Error(`UNEXPECTED_CONFIG_KEY:${key}`);
    },
  } as never);
}

export async function seedOutbox(pool: PoolService, count: number): Promise<string> {
  const aggregateId = randomUUID();
  await pool.query(
    `select private.enqueue_outbox_event(
       'spec_be_001.integration',
       'spec_be_001',
       $1::uuid,
       jsonb_build_object('sequence', sequence)
     )
     from generate_series(1, $2::integer) as sequence`,
    [aggregateId, count],
  );
  return aggregateId;
}

export async function removeOutbox(pool: PoolService, aggregateId: string): Promise<void> {
  await pool.query('delete from private.outbox_events where aggregate_id = $1', [aggregateId]);
}

// Direct SQL fixtures still provide the same owner claims as repository commands.
export async function withFixtureOwner<T>(
  pool: PoolService,
  owner: string,
  action: (client: PoolClient) => Promise<T>,
): Promise<T> {
  return pool.withClient(async (client) => {
    await client.query('begin');
    try {
      await client.query("select set_config('request.jwt.claims',$1,true)", [
        JSON.stringify({ role: 'authenticated', sub: owner, sid: 'integration-fixture' }),
      ]);
      const result = await action(client);
      await client.query('commit');
      return result;
    } catch (error) {
      await client.query('rollback');
      throw error;
    }
  });
}
export function fixtureOwnerQuery<T extends QueryResultRow = QueryResultRow>(
  pool: PoolService,
  owner: string,
  text: string,
  values: readonly unknown[] = [],
) {
  return withFixtureOwner(pool, owner, (client) => client.query<T>(text, [...values]));
}

// Retained fixtures must not consume another owner's bounded worker claim batch.
export function withFixtureImportWork<T>(
  pool: PoolService,
  owner: string,
  action: () => Promise<T>,
) {
  return withFixtureOwner(pool, owner, async (client) => {
    await client.query(
      "select id from public.import_sessions where user_id<>$1 and status in ('received','processing') order by id for update",
      [owner],
    );
    return action();
  });
}

// A real, explicitly activated disposable epoch keeps public runtime fences enabled.
export async function prepareFixtureVoiceEpoch(pool: PoolService) {
  const target = new URL(process.env.DATABASE_URL ?? '');
  if (
    !['127.0.0.1', 'localhost'].includes(target.hostname) ||
    target.pathname !== `/${process.env.CROSS_FEATURE_DISPOSABLE_DATABASE_NAME ?? ''}`
  )
    throw new Error('EXPLICIT_DISPOSABLE_VOICE_DATABASE_REQUIRED');
  const original = (
    await pool.query<{ enforced: boolean; current_epoch: string | null }>(
      'select enforced,current_epoch from private.staging_voice_runtime_control',
    )
  ).rows[0];
  const posting = (
    await pool.query<{ enabled: boolean }>('select enabled from private.voice_automatic_policy')
  ).rows[0];
  if (!original || !posting) throw new Error('VOICE_FIXTURE_POLICY_MISSING');
  const manifest = {
    version: 1,
    mode: 'operating',
    sourceSha: 'a'.repeat(40),
    imageDigest: 'b'.repeat(64),
    apkHash: 'c'.repeat(64),
    controlHash: 'd'.repeat(64),
  };
  const prepared = (
    await pool.query<{ result: { epochId: string; manifestHash: string } }>(
      'select private.prepare_staging_voice_epoch($1,$2::jsonb) result',
      ['qcffvfbpzvpwcwxwjyro', JSON.stringify(manifest)],
    )
  ).rows[0]?.result;
  if (!prepared) throw new Error('VOICE_FIXTURE_EPOCH_MISSING');
  await pool.query(
    "select private.activate_staging_voice_epoch($1,$2,clock_timestamp()+interval '10 minutes')",
    [prepared.epochId, prepared.manifestHash],
  );
  return {
    id: prepared.epochId,
    async register(session: string) {
      await pool.query(
        "update public.voice_sessions set content_hash=repeat('a',64) where id=$1 and content_hash is null",
        [session],
      );
      await pool.query(
        "insert into private.staging_voice_members(session_id,epoch_id,user_id,locale,capture_at,content_hash) select s.id,$2::uuid,s.user_id,s.locale,s.capture_at,coalesce(s.content_hash,repeat('a',64)) from public.voice_sessions s where s.id=$1 on conflict(session_id) do nothing",
        [session, prepared.epochId],
      );
    },
    async close() {
      await pool.query("select private.close_staging_voice_epoch($1,'test_finished')", [
        prepared.epochId,
      ]);
      await pool.query(
        'update private.staging_voice_runtime_control set enforced=$1,current_epoch=$2',
        [original.enforced, original.current_epoch],
      );
      await pool.query('update private.voice_automatic_policy set enabled=$1', [posting.enabled]);
    },
  };
}
export function withFixtureVoiceWork<T>(
  pool: PoolService,
  owner: string,
  action: () => Promise<T>,
  includeExpired = false,
) {
  return pool.withClient(async (locker) => {
    await locker.query('begin');
    try {
      await locker.query(
        'select id from public.voice_sessions where user_id<>$1 and ($2::boolean or expires_at>clock_timestamp()) order by id for update',
        [owner, includeExpired],
      );
      await locker.query(
        'select b.id from private.voice_batches b join public.voice_sessions s on s.id=b.session_id where b.user_id<>$1 and ($2::boolean or s.expires_at>clock_timestamp()) order by b.id for update of b',
        [owner, includeExpired],
      );
      if (includeExpired)
        // Deleted-session tombstones contain no owner identifier.
        await locker.query('select id from private.voice_media_tombstones order by id for update');
      return await action();
    } finally {
      await locker.query('rollback');
    }
  });
}
