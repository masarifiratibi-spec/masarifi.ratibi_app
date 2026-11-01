import { createHash } from 'node:crypto';

import { Injectable } from '@nestjs/common';
import type { PoolClient, QueryResultRow } from 'pg';

import { hashIdempotencyKey, hashNormalizedCommand } from '../ledger/idempotency';
import type { ClerkPrincipal } from '../identity/clerk-auth.guard';
import { PoolService } from '../platform/database/pool.service';
import { permissionManifestHash } from './permission-manifest';
import { buildSecurityEventPayload, type SecurityEventType } from './security.events';
import type { SecurityOperation } from './security.service';

type Operation = SecurityOperation & {
  body: Record<string, unknown>;
  prepareProviderBody?: () => Record<string, unknown>;
};

export interface ProviderMutation {
  outcome: 'new' | 'completed';
  value: unknown;
}

function invalid(): never {
  throw Object.assign(new Error('INPUT_INVALID'), { code: '22023' });
}

function requiredText(value: unknown, maximum = 1000): string {
  if (
    typeof value !== 'string' ||
    value.trim() !== value ||
    value.length < 1 ||
    value.length > maximum
  )
    invalid();
  return value;
}

function requiredInteger(value: unknown, minimum = 1, maximum = Number.MAX_SAFE_INTEGER): number {
  const parsed = typeof value === 'string' ? Number(value) : value;
  if (!Number.isSafeInteger(parsed) || (parsed as number) < minimum || (parsed as number) > maximum)
    invalid();
  return parsed as number;
}

function optionalText(value: unknown, maximum = 160): string | null {
  if (value === undefined || value === null) return null;
  if (
    typeof value !== 'string' ||
    value.trim() !== value ||
    value.length < 1 ||
    value.length > maximum
  )
    invalid();
  return value;
}

function optionalEnum(value: unknown, allowed: readonly string[]): string | null {
  const parsed = optionalText(value, 64);
  if (parsed !== null && !allowed.includes(parsed)) invalid();
  return parsed;
}

function optionalBoolean(value: unknown): boolean | null {
  const parsed = optionalEnum(value, ['true', 'false']);
  return parsed === null ? null : parsed === 'true';
}

function optionalEnabledStatus(value: unknown): boolean | null {
  const parsed = optionalEnum(value, ['enabled', 'disabled']);
  return parsed === null ? null : parsed === 'enabled';
}

function optionalInstant(value: unknown): string | null {
  const parsed = optionalText(value, 40);
  if (
    parsed !== null &&
    (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?Z$/.test(parsed) ||
      !Number.isFinite(Date.parse(parsed)))
  )
    invalid();
  return parsed;
}

function evidenceHash(value: Record<string, unknown>): string {
  return `sha256:${createHash('sha256').update(JSON.stringify(value)).digest('hex')}`;
}

function cursorOffset(value: unknown): number {
  if (value === undefined || value === null) return 0;
  if (
    typeof value !== 'string' ||
    value.length < 1 ||
    value.length > 16 ||
    !/^[A-Za-z0-9_-]+$/.test(value)
  ) {
    throw Object.assign(new Error('INVALID_CURSOR'), { code: 'INVALID_CURSOR' });
  }
  const decoded = Buffer.from(value, 'base64url').toString('utf8');
  if (
    !/^(0|[1-9][0-9]{0,6})$/.test(decoded) ||
    Buffer.from(decoded).toString('base64url') !== value
  ) {
    throw Object.assign(new Error('INVALID_CURSOR'), { code: 'INVALID_CURSOR' });
  }
  const offset = Number(decoded);
  if (offset > 1_000_000)
    throw Object.assign(new Error('INVALID_CURSOR'), { code: 'INVALID_CURSOR' });
  return offset;
}

interface EventCursor {
  occurredAt: string;
  id: string;
}

function eventCursor(value: unknown): EventCursor | null {
  if (value === undefined || value === null) return null;
  if (
    typeof value !== 'string' ||
    value.length < 1 ||
    value.length > 256 ||
    !/^[A-Za-z0-9_-]+$/.test(value)
  ) {
    throw Object.assign(new Error('INVALID_CURSOR'), { code: 'INVALID_CURSOR' });
  }
  try {
    const decoded = Buffer.from(value, 'base64url').toString('utf8');
    if (Buffer.from(decoded).toString('base64url') !== value) throw new Error('NON_CANONICAL');
    const parsed = JSON.parse(decoded) as unknown;
    if (
      !Array.isArray(parsed) ||
      parsed.length !== 2 ||
      typeof parsed[0] !== 'string' ||
      typeof parsed[1] !== 'string' ||
      !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?Z$/.test(parsed[0]) ||
      !Number.isFinite(Date.parse(parsed[0])) ||
      parsed[1].length < 1 ||
      parsed[1].length > 128
    )
      throw new Error('INVALID_EVENT_CURSOR');
    return { occurredAt: parsed[0], id: parsed[1] };
  } catch {
    throw Object.assign(new Error('INVALID_CURSOR'), { code: 'INVALID_CURSOR' });
  }
}

@Injectable()
export class SecurityRepository {
  constructor(private readonly pool: PoolService) {}

  async withPrincipalTransaction<T>(
    principal: ClerkPrincipal,
    action: (client: PoolClient) => Promise<T>,
  ): Promise<T> {
    return this.pool.withClient(async (client) => {
      await client.query('begin');
      try {
        await client.query("select set_config('request.jwt.claims', $1, true)", [
          JSON.stringify({
            role: 'authenticated',
            sub: principal.userId,
            sid: principal.sessionId,
          }),
        ]);
        await client.query('set local role masarifi_api');
        const result = await action(client);
        await client.query('commit');
        return result;
      } catch (error) {
        await client.query('rollback');
        throw error;
      }
    });
  }

  async assertAdminPermission(principal: ClerkPrincipal, permission: string): Promise<void> {
    await this.withPrincipalTransaction(principal, async (client) => {
      await client.query('select private.assert_admin_permission($1)', [permission]);
    });
  }

  async execute(input: Operation): Promise<unknown> {
    return this.withPrincipalTransaction(input.principal, async (client) => {
      if (input.permission)
        await client.query('select private.assert_admin_permission($1)', [input.permission]);
      else await client.query('select private.assert_active_profile($1)', [input.principal.userId]);
      return input.idempotencyKey
        ? this.executeIdempotently(client, input)
        : this.executeInTransaction(client, input);
    });
  }

  async executeProviderMutation(
    input: Operation,
    prepareBody: () => Record<string, unknown>,
  ): Promise<ProviderMutation> {
    return this.execute({
      ...input,
      prepareProviderBody: prepareBody,
    }) as Promise<ProviderMutation>;
  }

  async finishProviderMutation(
    input: SecurityOperation,
    status: 'completed' | 'failed',
    value: unknown,
  ): Promise<void> {
    await this.withPrincipalTransaction(input.principal, async (client) => {
      await client.query('select private.finish_security_provider_outcome($1,$2,$3,$4,$5::jsonb)', [
        input.principal.userId,
        `security.${input.operation.toLowerCase()}`,
        hashIdempotencyKey(requiredText(input.idempotencyKey)),
        status,
        JSON.stringify(value),
      ]);
    });
  }

  private async executeIdempotently(client: PoolClient, input: Operation): Promise<unknown> {
    const scope = `security.${input.operation.toLowerCase()}`;
    const keyHash = hashIdempotencyKey(requiredText(input.idempotencyKey));
    const requestHash =
      input.commandHash ??
      hashNormalizedCommand({ operation: input.operation, body: input.body, params: input.params });
    const claim = (
      await client.query<{
        outcome: string;
        response_body: { value: unknown };
        lease_token: string;
      }>('select * from private.claim_security_idempotency($1,$2,$3,$4,$5::interval)', [
        input.principal.userId,
        scope,
        keyHash,
        requestHash,
        '2 minutes',
      ])
    ).rows[0];
    if (!claim) throw new Error('SECURITY_REPLAY_UNAVAILABLE');
    if (claim.outcome === 'hash_mismatch')
      throw Object.assign(new Error('IDEMPOTENCY_KEY_REUSED'), { code: 'IDEMPOTENCY_KEY_REUSED' });
    if (claim.outcome === 'in_progress')
      throw Object.assign(new Error('IDEMPOTENCY_IN_PROGRESS'), {
        code: 'IDEMPOTENCY_IN_PROGRESS',
      });
    if (claim.outcome === 'replay') {
      if (!input.prepareProviderBody) return claim.response_body.value;
      const receipt = (
        await client.query<{ status: string; result: unknown }>(
          'select * from private.read_security_provider_outcome($1,$2,$3)',
          [input.principal.userId, scope, keyHash],
        )
      ).rows[0];
      if (receipt?.status !== 'completed')
        throw Object.assign(new Error('PROVIDER_UNAVAILABLE'), { code: 'PROVIDER_UNAVAILABLE' });
      return { outcome: 'completed', value: receipt.result };
    }
    const value = await this.executeInTransaction(
      client,
      input.prepareProviderBody ? { ...input, body: input.prepareProviderBody() } : input,
    );
    await client.query(
      'select private.complete_security_idempotency($1,$2,$3,$4,$5,$6,$7::jsonb,$8)',
      [
        input.principal.userId,
        scope,
        keyHash,
        requestHash,
        claim.lease_token,
        200,
        JSON.stringify({ value: value ?? null }),
        null,
      ],
    );
    if (!input.prepareProviderBody) return value;
    await client.query('select private.start_security_provider_outcome($1,$2,$3)', [
      input.principal.userId,
      scope,
      keyHash,
    ]);
    return { outcome: 'new', value };
  }

  async revokeUndeliveredInvitation(
    principal: ClerkPrincipal,
    invitationId: string,
    requestId: string,
  ): Promise<void> {
    await this.withPrincipalTransaction(principal, async (client) => {
      await client.query("select private.assert_admin_permission('access.invites.write')");
      await client.query(
        'update public.admin_invitations set revoked_at=clock_timestamp() where id=$1 and accepted_at is null',
        [invitationId],
      );
      await client.query('select audit.append_event($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)', [
        principal.userId,
        'admin',
        'security.admin-invitation-delivery-failed',
        'admin_invitation',
        invitationId,
        null,
        null,
        'Invitation delivery failed',
        requestId,
        JSON.stringify({ operation: 'createAdminInvitation' }),
      ]);
    });
  }

  async getReadyExportReference(
    principal: ClerkPrincipal,
    exportId: string,
  ): Promise<string | null> {
    return this.withPrincipalTransaction(principal, async (client) => {
      await client.query('select private.assert_active_profile($1)', [principal.userId]);
      const row = (
        await client.query<{ storage_ref: string }>(
          `select storage_ref from private.privacy_export_requests
        where id=$1 and user_id=$2 and status='ready' and expires_at>clock_timestamp()`,
          [exportId, principal.userId],
        )
      ).rows[0];
      return row?.storage_ref ?? null;
    });
  }

  async getDeletionRequestForWorker(userId: string, deletionId: string): Promise<unknown> {
    return this.withWorkerTransaction((client) =>
      this.one(
        client,
        `select id,status,requested_at as "requestedAt",cooling_off_ends_at as "coolingOffEndsAt",
        completed_at as "completedAt",error_code as "errorCode",retention_result as "retainedCategories",version::int
        from private.account_deletion_requests where id=$1 and user_id=$2`,
        [deletionId, userId],
      ),
    );
  }

  async getDeletionCompletion(
    operationId: string,
    tokenHash: string,
    networkHash: string,
  ): Promise<{ rateLimited: boolean; value: unknown }> {
    return this.withWorkerTransaction(async (client) => {
      await client.query(
        "delete from private.deletion_completion_rate_buckets where bucket_at<clock_timestamp()-interval '5 minutes'",
      );
      const rate = await client.query<{ attempts: number }>(
        `insert into private.deletion_completion_rate_buckets(network_hash,bucket_at,attempts)
         values($1,date_trunc('minute',clock_timestamp()),1)
         on conflict(network_hash,bucket_at) do update set attempts=least(deletion_completion_rate_buckets.attempts+1,61)
         returning attempts`,
        [networkHash],
      );
      if ((rate.rows[0]?.attempts ?? 61) > 60) return { rateLimited: true, value: null };
      const result = await client.query<Record<string, unknown>>(
        `select d.id,d.status,d.cooling_off_ends_at as "coolingOffEndsAt",d.completed_at as "completedAt",d.error_code as "errorCode",d.version::int
         from private.account_deletion_receipts r join private.account_deletion_requests d
           on d.id=r.request_id and d.user_id=r.user_id
         where r.operation_id=$1 and r.token_hash=$2 and r.expires_at>clock_timestamp()`,
        [operationId, tokenHash],
      );
      return { rateLimited: false, value: result.rows[0] ?? null };
    });
  }

  async consumeRateLimit(
    principal: ClerkPrincipal,
    category: string,
    limit: number,
    windowSeconds: number,
    ipHash: string | null,
  ): Promise<boolean> {
    return this.withPrincipalTransaction(principal, async (client) => {
      await client.query('select private.assert_active_profile($1)', [principal.userId]);
      const locks = [
        `${principal.userId}:${category}`,
        ...(ipHash ? [`${ipHash}:${category}`] : []),
      ].sort();
      for (const lock of locks)
        await client.query('select pg_advisory_xact_lock(hashtextextended($1,0))', [lock]);
      const count = Number(
        (
          await client.query<{ count: string }>(
            `select count(*)::text count from public.security_events
        where (user_id=$1 or ($4::text is not null and ip_hash=$4)) and event_type='security.request_attempt' and metadata->>'category'=$2
          and occurred_at>clock_timestamp()-make_interval(secs=>$3)`,
            [principal.userId, category, windowSeconds, ipHash],
          )
        ).rows[0]?.count ?? '0',
      );
      if (count >= limit) return false;
      await client.query(
        `insert into public.security_events(user_id,event_type,severity,ip_hash,metadata)
        values($1,'security.request_attempt','info',$3,jsonb_build_object('category',$2::text))`,
        [principal.userId, category, ipHash],
      );
      return true;
    });
  }

  private async executeInTransaction(client: PoolClient, input: Operation): Promise<unknown> {
    const limit = requiredInteger(input.query.limit ?? 50, 1, 100);
    const eventList =
      input.operation === 'listMySecurityEvents' || input.operation === 'listAdminSecurityEvents';
    const offset = eventList ? 0 : cursorOffset(input.query.cursor);
    switch (input.operation) {
      case 'getAdminSelf':
        return this.one(
          client,
          `select id,display_name as "displayName",role_keys as "roleKeys",
          effective_permission_keys as "effectivePermissionKeys",
          active_session_count as "activeSessionCount",version
          from private.get_admin_self_context()`,
          [],
        );
      case 'listAdmins':
        return this.list(
          client,
          `select a.user_id as id,coalesce(p.display_name,'Administrator') as "displayName",
        case when p.primary_email is null then null else left(p.primary_email,2)||'***@'||split_part(p.primary_email,'@',2) end as "emailMasked",
        a.status,a.department,coalesce((select array_agg(distinct r.key order by r.key) from public.admin_role_assignments x join public.roles r on r.id=x.role_id
          where x.user_id=a.user_id and x.revoked_at is null and x.starts_at<=clock_timestamp() and (x.ends_at is null or x.ends_at>clock_timestamp())),'{}') as "roleKeys",
        'unknown' as "mfaStatus",private.admin_active_session_count(a.user_id) as "activeSessionCount",a.version::int from public.admin_profiles a join public.profiles p on p.id=a.user_id
        where ($1::text is null or a.status=$1) and ($2::text is null or p.display_name ilike '%'||$2||'%' or p.primary_email ilike '%'||$2||'%')
        order by a.created_at desc,a.user_id`,
          limit,
          offset,
          [
            optionalEnum(input.query.status, ['active', 'suspended']),
            optionalText(input.query.search, 100),
          ],
        );
      case 'getAdmin':
        return this.one(
          client,
          `select a.user_id as id,coalesce(p.display_name,'Administrator') as "displayName",
        case when p.primary_email is null then null else left(p.primary_email,2)||'***@'||split_part(p.primary_email,'@',2) end as "emailMasked",a.status,a.department,
        coalesce((select array_agg(distinct r.key order by r.key) from public.admin_role_assignments x join public.roles r on r.id=x.role_id
          where x.user_id=a.user_id and x.revoked_at is null and x.starts_at<=clock_timestamp() and (x.ends_at is null or x.ends_at>clock_timestamp())),'{}') as "roleKeys",
        'unknown' as "mfaStatus",private.admin_active_session_count(a.user_id) as "activeSessionCount",
        coalesce((select jsonb_agg(jsonb_build_object('id',x.id,'userId',x.user_id,'roleId',x.role_id,'startsAt',x.starts_at,'endsAt',x.ends_at,'revokedAt',x.revoked_at,'version',x.version) order by x.starts_at,x.id)
          from public.admin_role_assignments x where x.user_id=a.user_id),'[]') as assignments,
        coalesce((select array_agg(distinct permission.key order by permission.key) from public.admin_role_assignments x join public.role_permissions rp on rp.role_id=x.role_id
          join public.permissions permission on permission.id=rp.permission_id where x.user_id=a.user_id and x.revoked_at is null and x.starts_at<=clock_timestamp()
          and (x.ends_at is null or x.ends_at>clock_timestamp())),'{}') as "effectivePermissionKeys",
        array_remove(array[
          case when a.user_id<>public.current_clerk_user_id() and a.status='active'
            and private.admin_has_permission(public.current_clerk_user_id(),'access.assignments.write',clock_timestamp()) then 'assign_roles'::text end,
          case when a.user_id<>public.current_clerk_user_id() and a.status='active'
            and private.admin_active_session_count(a.user_id)>0
            and private.admin_has_permission(public.current_clerk_user_id(),'admin-team.sessions.revoke',clock_timestamp()) then 'revoke_sessions'::text end,
          case when a.user_id<>public.current_clerk_user_id() and a.status='active'
            and private.admin_has_permission(public.current_clerk_user_id(),'admin-team.disable',clock_timestamp()) then 'disable'::text end
        ],null) as "eligibleActions",a.version::int
        from public.admin_profiles a join public.profiles p on p.id=a.user_id where a.user_id=$1`,
          [requiredText(input.params.userId, 128)],
        );
      case 'listAdminInvitations':
        return this.list(
          client,
          `select id,"emailMasked","roleId",department,status,"expiresAt",version from (select id,concat(left(email,2),'***@',split_part(email,'@',2)) as "emailMasked",role_id as "roleId",department,
        case when accepted_at is not null then 'accepted' when revoked_at is not null then 'revoked' when expires_at<=clock_timestamp() then 'expired' else 'pending' end status,
        expires_at as "expiresAt",created_at,version::int from public.admin_invitations) invitation
        where ($1::text is null or invitation.status=$1) order by created_at desc,id desc`,
          limit,
          offset,
          [optionalEnum(input.query.status, ['pending', 'accepted', 'revoked', 'expired'])],
        );
      case 'listRoles':
        return this.list(
          client,
          `select r.id,r.key,r.name,r.description,r.system_role as "systemRole",r.enabled,r.version::int,
        (select count(*)::int from public.admin_role_assignments x where x.role_id=r.id and x.revoked_at is null) as "assignmentCount",
        coalesce(array_agg(p.key order by p.key) filter(where p.key is not null),'{}') as "permissionKeys" from public.roles r
        left join public.role_permissions rp on rp.role_id=r.id left join public.permissions p on p.id=rp.permission_id
        where ($1::text is null or r.key ilike '%'||$1||'%' or r.name ilike '%'||$1||'%') and ($2::boolean is null or r.enabled=$2) and ($3::boolean is null or r.system_role=$3)
        group by r.id order by r.key`,
          limit,
          offset,
          [
            optionalText(input.query.search, 100),
            optionalBoolean(input.query.enabled),
            optionalBoolean(input.query.systemRole),
          ],
        );
      case 'getRole':
        return this.one(
          client,
          `select r.id,r.key,r.name,r.description,r.system_role as "systemRole",r.enabled,r.version::int,
        (select count(*)::int from public.admin_role_assignments x where x.role_id=r.id and x.revoked_at is null) as "assignmentCount",
        coalesce(array_agg(p.key order by p.key) filter(where p.key is not null),'{}') as "permissionKeys" from public.roles r
        left join public.role_permissions rp on rp.role_id=r.id left join public.permissions p on p.id=rp.permission_id where r.id=$1 group by r.id`,
          [requiredText(input.params.roleId)],
        );
      case 'listPermissions':
        return {
          ...(await this.list(
            client,
            `select id,key,resource,action,description from public.permissions
        where ($1::text is null or resource=$1) and ($2::text is null or key ilike '%'||$2||'%' or description ilike '%'||$2||'%') order by key`,
            limit,
            offset,
            [optionalText(input.query.resource, 64), optionalText(input.query.search, 100)],
          )),
          manifestHash: permissionManifestHash,
        };
      case 'listMySecurityEvents':
      case 'listAdminSecurityEvents': {
        const cursor = eventCursor(input.query.cursor);
        return this.listEvents(
          client,
          `select id,event_type as "eventType",severity,occurred_at as "occurredAt",metadata as "safeMetadata"
          from public.security_events where ($1::text is null or event_type=$1) and ($2::text is null or severity=$2) and ($3::text is null or user_id=$3)
            and ($4::timestamptz is null or (occurred_at,id)<($4::timestamptz,$5::uuid))
          order by occurred_at desc,id desc`,
          limit,
          [
            optionalText(input.query.type, 80),
            optionalEnum(input.query.severity, ['info', 'low', 'medium', 'high', 'critical']),
            input.operation === 'listAdminSecurityEvents'
              ? optionalText(input.query.userId, 128)
              : input.principal.userId,
            cursor?.occurredAt ?? null,
            cursor?.id ?? null,
          ],
        );
      }
      case 'getSecurityOverview': {
        const period = optionalEnum(input.query.period, ['24h', '7d', '30d']) ?? '24h';
        const platform = optionalText(input.query.platform, 64);
        const rows = (
          await client.query(
            `select severity as key,initcap(severity) as label,count(*)::int value from public.security_events
          where occurred_at>=clock_timestamp()-case $1 when '7d' then interval '7 days' when '30d' then interval '30 days' else interval '24 hours' end
            and ($2::text is null or metadata->>'platform'=$2) group by severity`,
            [period, platform],
          )
        ).rows;
        return { freshness: new Date().toISOString(), partial: false, metrics: rows };
      }
      case 'listAuditEvents':
        return this.list(
          client,
          `select id,actor_id as actor,actor_type as "actorType",action,resource_type as "resourceType",resource_id as "resourceId",
        request_id as "requestId",occurred_at as "occurredAt",coalesce(metadata->>'result','success') as result,metadata as "safeMetadata" from audit.audit_events
        where ($1::text is null or actor_id=$1) and ($2::text is null or action=$2) and ($3::text is null or resource_type=$3)
          and ($4::text is null or coalesce(metadata->>'result','success')=$4) and ($5::text is null or coalesce(metadata->>'severity','info')=$5)
          and ($6::timestamptz is null or occurred_at>=$6) and ($7::timestamptz is null or occurred_at<$7)
        order by occurred_at desc,id desc`,
          limit,
          offset,
          [
            optionalText(input.query.actor, 128),
            optionalText(input.query.action, 128),
            optionalText(input.query.resource, 64),
            optionalEnum(input.query.result, ['success', 'failure', 'blocked']),
            optionalEnum(input.query.severity, ['info', 'low', 'medium', 'high', 'critical']),
            optionalInstant(input.query.from),
            optionalInstant(input.query.to),
          ],
        );
      case 'getAuditEvent':
        return this.one(
          client,
          `select id,actor_id as actor,actor_type as "actorType",action,resource_type as "resourceType",resource_id as "resourceId",
        request_id as "requestId",occurred_at as "occurredAt",coalesce(metadata->>'result','success') as result,metadata as "safeMetadata" from audit.audit_events where id=$1`,
          [requiredText(input.params.eventId)],
        );
      case 'listSecurityIncidents':
        return this.list(
          client,
          `select id,title,severity,status,detected_at as "detectedAt",owner_id as owner,summary_redacted as "summaryRedacted",version::int
        from private.security_incidents where ($1::text is null or status=$1) and ($2::text is null or severity=$2) and ($3::text is null or owner_id=$3)
        order by detected_at desc,id desc`,
          limit,
          offset,
          [
            optionalEnum(input.query.status, ['open', 'investigating', 'contained', 'resolved']),
            optionalEnum(input.query.severity, ['info', 'low', 'medium', 'high', 'critical']),
            optionalText(input.query.owner, 128),
          ],
        );
      case 'getSecurityIncident':
        return this.one(
          client,
          `select i.id,i.title,i.severity,i.status,i.detected_at as "detectedAt",i.owner_id as owner,i.summary_redacted as "summaryRedacted",
        coalesce((select jsonb_agg(jsonb_build_object('id',t.id,'eventType',t.event_type,'detailsRedacted',t.details_redacted,'occurredAt',t.occurred_at) order by t.occurred_at,t.id)
          from private.security_incident_timeline t where t.incident_id=i.id),'[]') as timeline,i.version::int from private.security_incidents i where i.id=$1`,
          [requiredText(input.params.incidentId)],
        );
      case 'listSupportAccessRequests':
      case 'listMySupportAccessRequests':
        return this.list(
          client,
          `select id,user_id as "userId",requested_by as requester,assignee,support_ticket_id as "supportTicketId",scope as scopes,status,
        customer_approval_required as "customerApprovalRequired",customer_approved_at as "customerApprovedAt",expires_at as "expiresAt",version::int
        from private.support_access_requests where ($1::text is null or status=$1) and ($2::text is null or assignee=$2)
          and ($3::text is null or support_ticket_id ilike '%'||$3||'%' or user_id ilike '%'||$3||'%') order by created_at desc,id desc`,
          limit,
          offset,
          [
            optionalEnum(input.query.status, [
              'pending',
              'approved',
              'denied',
              'expired',
              'revoked',
            ]),
            input.operation === 'listSupportAccessRequests'
              ? optionalText(input.query.assignee, 128)
              : null,
            input.operation === 'listSupportAccessRequests'
              ? optionalText(input.query.search, 128)
              : null,
          ],
        );
      case 'getSupportAccessRequest':
        return this.one(
          client,
          `select id,user_id as "userId",requested_by as requester,assignee,support_ticket_id as "supportTicketId",scope as scopes,status,
        customer_approval_required as "customerApprovalRequired",customer_approved_at as "customerApprovedAt",expires_at as "expiresAt",version::int
        from private.support_access_requests where id=$1`,
          [requiredText(input.params.requestId)],
        );
      case 'listPrivacyExports':
        return this.list(
          client,
          `select id,status,scope,requested_at as "requestedAt",expires_at as "expiresAt",version::int
        from private.privacy_export_requests where ($1::text is null or status=$1) and ($2::timestamptz is null or requested_at>=$2) and ($3::timestamptz is null or requested_at<$3) and ($4::uuid is null or id=$4)
        order by requested_at desc,id desc`,
          limit,
          offset,
          [
            optionalEnum(input.query.status, [
              'requested',
              'verified',
              'processing',
              'ready',
              'expired',
              'failed',
            ]),
            optionalInstant(input.query.from),
            optionalInstant(input.query.to),
            optionalText(input.query.id, 36),
          ],
        );
      case 'getMyPrivacyExport':
        return this.one(
          client,
          `select id,status,scope,requested_at as "requestedAt",expires_at as "expiresAt",version::int
        from private.privacy_export_requests where id=$1`,
          [requiredText(input.params.exportId)],
        );
      case 'listDeletionRequests':
        return this.list(
          client,
          `select d.id,d.status,d.requested_at as "requestedAt",d.cooling_off_ends_at as "coolingOffEndsAt",d.completed_at as "completedAt",d.version::int
        from private.account_deletion_requests d where ($1::text is null or d.status=$1) and ($2::boolean is null or exists(select 1 from private.retention_holds h
          where h.resource_id=d.user_id and h.starts_at<=clock_timestamp() and (h.ends_at is null or h.ends_at>clock_timestamp()))=$2) and ($3::uuid is null or d.id=$3)
        order by d.requested_at desc,d.id desc`,
          limit,
          offset,
          [
            optionalEnum(input.query.status, [
              'requested',
              'verified',
              'cancelled',
              'processing',
              'completed',
              'failed',
            ]),
            optionalBoolean(input.query.hold),
            optionalText(input.query.id, 36),
          ],
        );
      case 'getMyDeletionRequest':
        return this.one(
          client,
          `select id,status,requested_at as "requestedAt",cooling_off_ends_at as "coolingOffEndsAt",completed_at as "completedAt",
        retention_result as "retainedCategories",version::int from private.account_deletion_requests where id=$1`,
          [requiredText(input.params.deletionId)],
        );
      case 'listRetentionPolicies':
        return this.list(
          client,
          `select id,resource_type as "resourceType",retention_days as "retentionDays",deletion_mode as "deletionMode",legal_basis as "legalBasis",enabled,version::int
        from private.retention_policies where ($1::text is null or resource_type=$1) and ($2::boolean is null or enabled=$2) and ($3::uuid is null or id=$3) order by resource_type`,
          limit,
          offset,
          [
            optionalText(input.query.resource, 64),
            optionalEnabledStatus(input.query.status),
            optionalText(input.query.id, 36),
          ],
        );
      default:
        return this.mutate(client, input);
    }
  }

  private async mutate(client: PoolClient, input: Operation): Promise<unknown> {
    const { body, params, principal } = input;
    let result: unknown;
    let resourceType = 'security_resource';
    let resourceId = 'none';
    switch (input.operation) {
      case 'disableAdmin': {
        resourceType = 'admin_profile';
        resourceId = requiredText(params.userId, 128);
        if (resourceId === principal.userId) invalid();
        result = await this.one(
          client,
          `update public.admin_profiles set status='suspended' where user_id=$1 and version=$2
          and (select count(*) from public.admin_profiles where status='active' and user_id<>$1)>0 returning user_id as id,status,version::int`,
          [resourceId, requiredInteger(body.expectedVersion)],
        );
        break;
      }
      case 'revokeAdminSessions':
        resourceType = 'admin_session';
        resourceId = requiredText(params.userId, 128);
        result = await this.one(
          client,
          `select user_id as id,version::int from public.admin_profiles where user_id=$1 and status='active' and version=$2`,
          [resourceId, requiredInteger(body.expectedVersion)],
        );
        break;
      case 'createAdminInvitation': {
        resourceType = 'admin_invitation';
        await this.assertMayTargetRole(client, principal.userId, requiredText(body.roleId));
        const row = await this.one<{ id: string }>(
          client,
          `insert into public.admin_invitations(email,role_id,token_hash,invited_by,expires_at,department)
          values(lower($1),$2,$3,$4,clock_timestamp()+make_interval(hours=>$5),$6)
          returning id,concat(left(email,2),'***@',split_part(email,'@',2)) as "emailMasked",role_id as "roleId",department,'pending' status,expires_at as "expiresAt",version::int`,
          [
            requiredText(body.email, 320).toLowerCase(),
            requiredText(body.roleId),
            requiredText(body.tokenHash),
            principal.userId,
            requiredInteger(body.expiresInHours, 1, 168),
            body.department ?? null,
          ],
        );
        resourceId = row.id;
        result = row;
        break;
      }
      case 'acceptAdminInvitation': {
        await client.query('select private.accept_admin_invitation($1,$2,$3)', [
          requiredText(body.tokenHash),
          requiredText(body.verifiedEmail, 320).toLowerCase(),
          input.requestId,
        ]);
        return { id: principal.userId, status: 'active' };
      }
      case 'createRole': {
        resourceType = 'role';
        const row = await this.one<{ id: string }>(
          client,
          `insert into public.roles(key,name,description) values($1,$2,$3)
          returning id,key,name,description,system_role as "systemRole",enabled,version::int`,
          [requiredText(body.key, 64), requiredText(body.name, 100), body.description ?? null],
        );
        await this.replacePermissions(client, row.id, body.permissionKeys);
        resourceId = row.id;
        result = { ...row, permissionKeys: body.permissionKeys };
        break;
      }
      case 'updateRole': {
        resourceType = 'role';
        resourceId = requiredText(params.roleId);
        await client.query('select pg_advisory_xact_lock(hashtextextended($1,0))', [
          `role:${resourceId}`,
        ]);
        const targetRole = await this.one<{ systemRole: boolean }>(
          client,
          'select system_role as "systemRole" from public.roles where id=$1',
          [resourceId],
        );
        if (targetRole.systemRole)
          throw Object.assign(new Error('SYSTEM_ROLE_PROTECTED'), {
            code: 'SYSTEM_ROLE_PROTECTED',
          });
        if (body.permissionKeys !== undefined || body.enabled === false) {
          const active = Number(
            (
              await client.query<{ count: string }>(
                `select count(*)::text count from public.admin_role_assignments
            where role_id=$1 and revoked_at is null and starts_at<=clock_timestamp() and (ends_at is null or ends_at>clock_timestamp())`,
                [resourceId],
              )
            ).rows[0]?.count ?? '0',
          );
          if (active > 0)
            throw Object.assign(new Error('ACTIVE_ASSIGNMENTS_EXIST'), {
              code: 'ACTIVE_ASSIGNMENTS_EXIST',
            });
        }
        const row = await this.one<Record<string, unknown>>(
          client,
          `update public.roles set name=coalesce($2,name),description=coalesce($3,description),enabled=coalesce($4,enabled)
          where id=$1 and version=$5 returning id,key,name,description,system_role as "systemRole",enabled,version::int`,
          [
            resourceId,
            body.name ?? null,
            body.description ?? null,
            body.enabled ?? null,
            requiredInteger(body.expectedVersion),
          ],
        );
        if (body.permissionKeys)
          await this.replacePermissions(client, resourceId, body.permissionKeys);
        result = {
          ...row,
          ...(body.permissionKeys ? { permissionKeys: body.permissionKeys } : {}),
        };
        break;
      }
      case 'assignAdminRole': {
        if (requiredText(body.userId, 128) === principal.userId) invalid();
        resourceType = 'admin_assignment';
        await this.assertMayTargetRole(client, principal.userId, requiredText(body.roleId));
        await client.query('select pg_advisory_xact_lock(hashtextextended($1,0))', [
          `role:${requiredText(body.roleId)}`,
        ]);
        await this.one(client, 'select id from public.roles where id=$1 and enabled', [
          body.roleId,
        ]);
        const row = await this.one<{ id: string }>(
          client,
          `insert into public.admin_role_assignments(user_id,role_id,assigned_by,starts_at,ends_at,reason)
          values($1,$2,$3,coalesce($4::timestamptz,clock_timestamp()),$5,$6) returning id,user_id as "userId",role_id as "roleId",starts_at as "startsAt",ends_at as "endsAt",revoked_at as "revokedAt",version::int`,
          [
            body.userId,
            body.roleId,
            principal.userId,
            body.startsAt ?? null,
            body.endsAt ?? null,
            requiredText(body.reason, 500),
          ],
        );
        resourceId = row.id;
        result = row;
        break;
      }
      case 'revokeAdminRole':
        resourceType = 'admin_assignment';
        resourceId = requiredText(params.assignmentId);
        await this.assertMayTargetAssignment(client, principal.userId, resourceId);
        result = await this.one(
          client,
          `update public.admin_role_assignments set revoked_at=clock_timestamp()
          where id=$1 and revoked_at is null and version=$2 and user_id<>$3 returning id,user_id as "userId",role_id as "roleId",version::int`,
          [
            resourceId,
            requiredInteger(body.expectedVersion ?? input.query.expectedVersion),
            principal.userId,
          ],
        );
        break;
      case 'createSupportAccessRequest': {
        resourceType = 'support_request';
        const duration = requiredInteger(body.durationMinutes, 5, 60);
        const row = await this.one<{ id: string }>(
          client,
          `insert into private.support_access_requests(user_id,requested_by,assignee,support_ticket_id,purpose,scope,customer_approval_required,expires_at)
          values($1,$2,$3,$4,$5,$6,$7,clock_timestamp()+make_interval(mins=>$8)) returning id,user_id as "userId",requested_by as requester,assignee,support_ticket_id as "supportTicketId",scope as scopes,status,customer_approval_required as "customerApprovalRequired",expires_at as "expiresAt",version::int`,
          [
            body.userId,
            principal.userId,
            body.assignee,
            requiredText(body.supportTicketId, 128),
            requiredText(body.purpose, 500),
            JSON.stringify(body.resourceScopes),
            body.customerApprovalRequired === true,
            duration,
          ],
        );
        resourceId = row.id;
        result = row;
        break;
      }
      case 'decideMySupportAccessRequest': {
        resourceType = 'support_request';
        resourceId = requiredText(params.requestId);
        const decision = requiredText(body.decision);
        if (!['approve', 'deny'].includes(decision)) invalid();
        await this.one(
          client,
          `update private.support_access_requests set customer_approved_at=case when $3='approve' then clock_timestamp() else null end,
          status=case when $3='deny' then 'denied' else status end,decided_at=case when $3='deny' then clock_timestamp() else decided_at end
          where id=$1 and user_id=$2 and status='pending' and version=$4 returning id`,
          [resourceId, principal.userId, decision, requiredInteger(body.expectedVersion)],
        );
        result = await this.supportRequest(client, resourceId);
        break;
      }
      case 'decideSupportAccessRequest': {
        resourceType = 'support_request';
        resourceId = requiredText(params.requestId);
        const decision = requiredText(body.decision);
        if (!['approve', 'deny'].includes(decision)) invalid();
        const approvedScope = body.approvedScope ?? null;
        const request = await this.one<{ assignee: string; scopes: unknown; expiresAt: Date }>(
          client,
          `update private.support_access_requests set status=case when $2='approve' then 'approved' else 'denied' end,approved_by=$3,decided_at=clock_timestamp()
          where id=$1 and status='pending' and requested_by<>$3 and version=$4 and ($5::jsonb is null or scope @> $5::jsonb)
          returning assignee,scope as scopes,expires_at as "expiresAt"`,
          [
            resourceId,
            decision,
            principal.userId,
            requiredInteger(body.expectedVersion),
            approvedScope === null ? null : JSON.stringify(approvedScope),
          ],
        );
        if (decision === 'approve') {
          const duration = requiredInteger(body.durationMinutes ?? 60, 5, 60);
          await client.query(
            `insert into private.support_access_grants(request_id,admin_id,scope,starts_at,ends_at)
            values($1,$2,$3,coalesce($4::timestamptz,clock_timestamp()),least($5,coalesce($4::timestamptz,clock_timestamp())+make_interval(mins=>$6)))`,
            [
              resourceId,
              request.assignee,
              JSON.stringify(approvedScope ?? request.scopes),
              body.startsAt ?? null,
              request.expiresAt,
              duration,
            ],
          );
        }
        result = await this.supportRequest(client, resourceId);
        break;
      }
      case 'revokeSupportAccess':
      case 'endSupportAccess':
        resourceType = 'support_request';
        resourceId = requiredText(params.requestId);
        await this.one(
          client,
          `select id from private.support_access_requests where id=$1 and status='approved' and version=$2 for update`,
          [resourceId, requiredInteger(body.expectedVersion)],
        );
        await client.query(
          'update private.support_access_grants set revoked_at=clock_timestamp() where request_id=$1 and revoked_at is null',
          [resourceId],
        );
        await client.query(
          "update private.support_access_requests set status='revoked',decided_at=coalesce(decided_at,clock_timestamp()) where id=$1",
          [resourceId],
        );
        result = await this.supportRequest(client, resourceId);
        break;
      case 'getSupportWorkspace': {
        resourceType = 'support_access';
        resourceId = requiredText(params.requestId);
        const workspace = await this.one<{ workspace: unknown }>(
          client,
          'select private.read_support_workspace($1) as workspace',
          [resourceId],
        );
        await this.audit(client, input, resourceType, resourceId, workspace.workspace, false);
        return workspace.workspace;
      }
      case 'createSecurityIncident': {
        resourceType = 'security_incident';
        const row = await this.one<{ id: string }>(
          client,
          `insert into private.security_incidents(title,severity,detected_at,owner_id,summary_redacted) values($1,$2,$3,$4,$5)
          returning id,title,severity,status,detected_at as "detectedAt",owner_id as owner,summary_redacted as "summaryRedacted",version::int`,
          [
            requiredText(body.title, 160),
            requiredText(body.severity),
            body.detectedAt,
            body.ownerId ?? null,
            body.summaryRedacted ?? null,
          ],
        );
        resourceId = row.id;
        await client.query(
          `insert into private.security_incident_timeline(incident_id,actor_id,event_type,details_redacted) values($1,$2,'incident_opened','Incident opened')`,
          [row.id, principal.userId],
        );
        result = { ...row, timeline: [] };
        break;
      }
      case 'updateSecurityIncident': {
        resourceType = 'security_incident';
        resourceId = requiredText(params.incidentId);
        const action = requiredText(body.action);
        const expectedVersion = requiredInteger(body.expectedVersion);
        const current = await this.one<{ status: string; version: number }>(
          client,
          'select status,version::int from private.security_incidents where id=$1',
          [resourceId],
        );
        const allowed: Record<string, readonly string[]> = {
          investigate: ['open'],
          contain: ['open', 'investigating'],
          resolve: ['contained'],
          reopen: ['resolved'],
          note: ['open', 'investigating', 'contained', 'resolved'],
        };
        const states: Record<string, string> = {
          investigate: 'investigating',
          contain: 'contained',
          resolve: 'resolved',
          reopen: 'open',
          note: current.status,
        };
        if (current.version !== expectedVersion)
          throw Object.assign(new Error('STALE_VERSION'), { code: 'STALE_VERSION' });
        if (!allowed[action]?.includes(current.status))
          throw Object.assign(new Error('INVALID_TRANSITION'), { code: 'INVALID_TRANSITION' });
        result = await this.one(
          client,
          `update private.security_incidents set status=$2,
          contained_at=case when $3='contain' then clock_timestamp() when $3='reopen' then null else contained_at end,
          resolved_at=case when $3='resolve' then clock_timestamp() when $3='reopen' then null else resolved_at end
          where id=$1 and version=$4 returning id,title,severity,status,detected_at as "detectedAt",owner_id as owner,summary_redacted as "summaryRedacted",version::int`,
          [resourceId, states[action], action, expectedVersion],
        );
        await client.query(
          'insert into private.security_incident_timeline(incident_id,actor_id,event_type,details_redacted) values($1,$2,$3,$4)',
          [
            resourceId,
            principal.userId,
            `incident_${action}`,
            typeof body.note === 'string' ? body.note : 'State changed',
          ],
        );
        break;
      }
      case 'createMyPrivacyExport': {
        const scope = Array.isArray(body.scope) ? body.scope : ['identity@1'];
        const inserted = await client.query(
          `insert into private.privacy_export_requests(user_id,status,scope,verified_at) values($1,'verified',$2,clock_timestamp())
          on conflict(user_id) where status in ('requested','verified','processing','ready') do nothing returning id,status,scope,requested_at as "requestedAt",expires_at as "expiresAt",version::int`,
          [principal.userId, JSON.stringify(scope)],
        );
        if (inserted.rows[0]) return inserted.rows[0];
        return this.one(
          client,
          `select id,status,scope,requested_at as "requestedAt",expires_at as "expiresAt",version::int from private.privacy_export_requests where user_id=$1 and status in ('requested','verified','processing','ready')`,
          [principal.userId],
        );
      }
      case 'actOnPrivacyExport': {
        resourceType = 'privacy_export';
        resourceId = requiredText(params.exportId);
        const action = requiredText(body.action);
        const expectedVersion = requiredInteger(body.expectedVersion);
        const current = await this.one<{ status: string; version: number }>(
          client,
          'select status,version::int from private.privacy_export_requests where id=$1',
          [resourceId],
        );
        const allowed: Record<string, readonly string[]> = {
          verify: ['requested'],
          retry: ['failed'],
          expire: ['ready'],
          fail: ['requested', 'verified', 'processing'],
        };
        const states: Record<string, string> = {
          verify: 'verified',
          retry: 'verified',
          expire: 'expired',
          fail: 'failed',
        };
        if (current.version !== expectedVersion)
          throw Object.assign(new Error('STALE_VERSION'), { code: 'STALE_VERSION' });
        if (!allowed[action]?.includes(current.status))
          throw Object.assign(new Error('INVALID_TRANSITION'), { code: 'INVALID_TRANSITION' });
        result = await this.one(
          client,
          `update private.privacy_export_requests set status=$2,error_code=case when $2='failed' then 'ADMIN_MARKED_FAILED' else null end,
          expires_at=case when $2='expired' then coalesce(expires_at,clock_timestamp()) else expires_at end where id=$1 and version=$3
          returning id,status,scope,requested_at as "requestedAt",expires_at as "expiresAt",version::int`,
          [resourceId, states[action], expectedVersion],
        );
        break;
      }
      case 'createMyDeletionRequest': {
        if (body.confirmation !== 'DELETE_MY_ACCOUNT') invalid();
        const hours = requiredInteger(body.coolingOffHours ?? 24, 0, 2_160);
        const tokenHash = body.completionTokenHash;
        const operationId = input.idempotencyKey;
        if (hours === 0 || tokenHash !== undefined) {
          if (
            typeof tokenHash !== 'string' ||
            !/^[0-9a-f]{64}$/.test(tokenHash) ||
            typeof operationId !== 'string' ||
            !/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(operationId)
          )
            invalid();
          await client.query('select pg_advisory_xact_lock(hashtextextended($1,0))', [
            `${principal.userId}:deletion:${operationId}`,
          ]);
          const replay = await client.query<{ request_id: string; token_hash: string }>(
            'select request_id,token_hash from private.account_deletion_receipts where user_id=$1 and operation_id=$2',
            [principal.userId, operationId],
          );
          if (replay.rows[0] && replay.rows[0].token_hash !== tokenHash)
            throw Object.assign(new Error('IDEMPOTENCY_KEY_REUSED'), {
              code: 'IDEMPOTENCY_KEY_REUSED',
            });
          if (hours === 0) {
            // Keep a receipt replay bound to its original request while removing an inherited delay.
            await client.query(
              `update private.account_deletion_requests
               set status='verified',verified_at=clock_timestamp(),cooling_off_ends_at=clock_timestamp()
               where user_id=$1 and ($2::uuid is null or id=$2)
                 and status in ('requested','verified')
                 and (status='requested' or cooling_off_ends_at>clock_timestamp())`,
              [principal.userId, replay.rows[0]?.request_id ?? null],
            );
          }
          if (replay.rows[0]) {
            return this.one(
              client,
              `select id,status,requested_at as "requestedAt",cooling_off_ends_at as "coolingOffEndsAt",
               completed_at as "completedAt",error_code as "errorCode",retention_result as "retainedCategories",version::int
               from private.account_deletion_requests where id=$1 and user_id=$2`,
              [replay.rows[0].request_id, principal.userId],
            );
          }
        }
        const inserted = await client.query<Record<string, unknown> & { id: string }>(
          `insert into private.account_deletion_requests(user_id,status,verified_at,cooling_off_ends_at) values($1,'verified',clock_timestamp(),clock_timestamp()+make_interval(hours=>$2))
          on conflict(user_id) where status in ('requested','verified','processing') do nothing returning id,status,requested_at as "requestedAt",cooling_off_ends_at as "coolingOffEndsAt",completed_at as "completedAt",version::int`,
          [principal.userId, hours],
        );
        if (inserted.rows[0]) {
          const created = inserted.rows[0] as { id: string };
          await this.enqueue(client, 'privacy.deletion_requested', 'deletion_request', created.id, {
            schemaVersion: 1,
            requestId: created.id,
            userId: principal.userId,
            occurredAt: new Date().toISOString(),
          });
        }
        const result =
          inserted.rows[0] ??
          (await this.one(
            client,
            `select id,status,requested_at as "requestedAt",cooling_off_ends_at as "coolingOffEndsAt",completed_at as "completedAt",version::int from private.account_deletion_requests where user_id=$1 and status in ('requested','verified','processing')`,
            [principal.userId],
          ));
        if (tokenHash !== undefined) {
          const deletionId = (result as { id: string }).id;
          await client.query(
            `insert into private.account_deletion_receipts(user_id,operation_id,request_id,token_hash,expires_at)
             values($1,$2,$3,$4,clock_timestamp()+make_interval(hours=>$5)+interval '24 hours')`,
            [principal.userId, operationId, deletionId, tokenHash, hours],
          );
        }
        return result;
      }
      case 'cancelMyDeletionRequest':
        await this.one(
          client,
          `update private.account_deletion_requests set status='cancelled' where id=$1 and user_id=$2 and status in ('requested','verified') and cooling_off_ends_at>clock_timestamp() returning id`,
          [requiredText(params.deletionId), principal.userId],
        );
        return undefined;
      case 'actOnDeletionRequest': {
        resourceType = 'deletion_request';
        resourceId = requiredText(params.deletionId);
        const action = requiredText(body.action);
        const expectedVersion = requiredInteger(body.expectedVersion);
        const current = await this.one<{ status: string; version: number }>(
          client,
          'select status,version::int from private.account_deletion_requests where id=$1',
          [resourceId],
        );
        const allowed: Record<string, readonly string[]> = {
          verify: ['requested'],
          schedule: ['verified'],
          retry: ['failed'],
          fail: ['requested', 'verified', 'processing'],
          cancel: ['requested', 'verified'],
        };
        const states: Record<string, string> = {
          verify: 'verified',
          schedule: 'verified',
          retry: 'verified',
          fail: 'failed',
          cancel: 'cancelled',
        };
        if (current.version !== expectedVersion)
          throw Object.assign(new Error('STALE_VERSION'), { code: 'STALE_VERSION' });
        if (!allowed[action]?.includes(current.status))
          throw Object.assign(new Error('INVALID_TRANSITION'), { code: 'INVALID_TRANSITION' });
        result = await this.one(
          client,
          `update private.account_deletion_requests set status=$2,error_code=case when $2='failed' then 'ADMIN_MARKED_FAILED' else null end where id=$1 and version=$3
          returning id,status,requested_at as "requestedAt",cooling_off_ends_at as "coolingOffEndsAt",completed_at as "completedAt",version::int`,
          [resourceId, states[action], expectedVersion],
        );
        break;
      }
      case 'updateRetentionPolicy':
        resourceType = 'retention_policy';
        resourceId = requiredText(params.policyId);
        result = await this.one(
          client,
          `update private.retention_policies set retention_days=$2,deletion_mode=coalesce($3,deletion_mode),legal_basis=coalesce($4,legal_basis),enabled=coalesce($5,enabled)
          where id=$1 and version=$6 returning id,resource_type as "resourceType",retention_days as "retentionDays",deletion_mode as "deletionMode",legal_basis as "legalBasis",enabled,version::int`,
          [
            resourceId,
            requiredInteger(body.retentionDays, 0, 36500),
            body.deletionMode ?? null,
            body.legalBasis ?? null,
            body.enabled ?? null,
            requiredInteger(body.expectedVersion),
          ],
        );
        break;
      case 'createRetentionHold': {
        resourceType = 'retention_hold';
        const row = await this.one<{ id: string }>(
          client,
          `insert into private.retention_holds(resource_type,resource_id,reason,starts_at,ends_at,created_by) values($1,$2,$3,coalesce($4::timestamptz,clock_timestamp()),$5,$6)
          returning id,resource_type as "resourceType",resource_id as "resourceId",starts_at as "startsAt",ends_at as "endsAt",version::int`,
          [
            requiredText(body.resourceType, 64),
            requiredText(body.resourceId, 128),
            requiredText(body.reason, 500),
            body.startsAt ?? null,
            body.endsAt ?? null,
            principal.userId,
          ],
        );
        resourceId = row.id;
        result = row;
        break;
      }
      case 'releaseRetentionHold':
        resourceType = 'retention_hold';
        resourceId = requiredText(params.holdId);
        await this.one(
          client,
          `update private.retention_holds set ends_at=least(coalesce(ends_at,clock_timestamp()),clock_timestamp()) where id=$1 and version=$2 returning id`,
          [resourceId, requiredInteger(body.expectedVersion ?? input.query.expectedVersion)],
        );
        result = undefined;
        break;
      default:
        invalid();
    }
    await this.audit(client, input, resourceType, resourceId, result);
    await this.outboxForMutation(client, input, result, resourceId);
    return result;
  }

  private async list(
    client: PoolClient,
    sql: string,
    limit: number,
    offset: number,
    values: readonly unknown[] = [],
  ): Promise<{ items: QueryResultRow[]; nextCursor: string | null }> {
    const limitIndex = values.length + 1;
    const rows = (
      await client.query<QueryResultRow>(
        `${sql} limit $${String(limitIndex)} offset $${String(limitIndex + 1)}`,
        [...values, limit + 1, offset],
      )
    ).rows;
    return {
      items: rows.slice(0, limit),
      nextCursor:
        rows.length > limit ? Buffer.from(String(offset + limit)).toString('base64url') : null,
    };
  }

  private async listEvents(
    client: PoolClient,
    sql: string,
    limit: number,
    values: readonly unknown[],
  ): Promise<{ items: QueryResultRow[]; nextCursor: string | null }> {
    const rows = (
      await client.query<QueryResultRow>(`${sql} limit $${String(values.length + 1)}`, [
        ...values,
        limit + 1,
      ])
    ).rows;
    const items = rows.slice(0, limit);
    const last = items.at(-1);
    const cursor =
      last && typeof last.occurredAt !== 'undefined' && typeof last.id === 'string'
        ? Buffer.from(
            JSON.stringify([
              new Date(last.occurredAt as string | number | Date).toISOString(),
              last.id,
            ]),
          ).toString('base64url')
        : null;
    return { items, nextCursor: rows.length > limit ? cursor : null };
  }

  private supportRequest(client: PoolClient, requestId: string): Promise<QueryResultRow> {
    return this.one(
      client,
      `select id,user_id as "userId",requested_by as requester,assignee,support_ticket_id as "supportTicketId",scope as scopes,status,
      customer_approval_required as "customerApprovalRequired",customer_approved_at as "customerApprovedAt",expires_at as "expiresAt",version::int
      from private.support_access_requests where id=$1`,
      [requestId],
    );
  }

  private async one<T extends QueryResultRow = QueryResultRow>(
    client: PoolClient,
    sql: string,
    values: readonly unknown[],
  ): Promise<T> {
    const row = (await client.query<T>(sql, [...values])).rows[0];
    if (!row) throw Object.assign(new Error('NOT_FOUND'), { code: 'P0002' });
    return row;
  }

  private async assertMayTargetRole(
    client: PoolClient,
    actorId: string,
    roleId: string,
  ): Promise<void> {
    const role = await this.one<{ targetIsSuper: boolean; actorIsSuper: boolean }>(
      client,
      `select private.is_super_admin_role($1) as "targetIsSuper",
        private.is_active_super_admin($2) as "actorIsSuper"`,
      [roleId, actorId],
    );
    if (role.targetIsSuper && !role.actorIsSuper)
      throw Object.assign(new Error('SUPER_ADMIN_TARGET_REQUIRES_SUPER_ADMIN'), {
        code: 'SUPER_ADMIN_TARGET_REQUIRES_SUPER_ADMIN',
      });
  }

  private async assertMayTargetAssignment(
    client: PoolClient,
    actorId: string,
    assignmentId: string,
  ): Promise<void> {
    const assignment = await this.one<{ roleId: string }>(
      client,
      'select role_id as "roleId" from public.admin_role_assignments where id=$1',
      [assignmentId],
    );
    await this.assertMayTargetRole(client, actorId, assignment.roleId);
  }

  private async replacePermissions(
    client: PoolClient,
    roleId: string,
    value: unknown,
  ): Promise<void> {
    if (
      !Array.isArray(value) ||
      value.length < 1 ||
      value.length > 200 ||
      value.some((key) => typeof key !== 'string')
    )
      invalid();
    await client.query('delete from public.role_permissions where role_id=$1', [roleId]);
    const inserted = await client.query(
      'insert into public.role_permissions(role_id,permission_id) select $1,id from public.permissions where key=any($2::text[])',
      [roleId, value],
    );
    if (inserted.rowCount !== new Set(value).size) invalid();
  }

  private async audit(
    client: PoolClient,
    input: Operation,
    resourceType: string,
    resourceId: string,
    result: unknown,
    stateChange = true,
  ): Promise<void> {
    const action = `security.${input.operation.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}`;
    const reason = typeof input.body.reason === 'string' ? input.body.reason : null;
    const expectedVersion =
      typeof input.body.expectedVersion === 'number' ? input.body.expectedVersion : null;
    const row =
      typeof result === 'object' && result !== null ? (result as Record<string, unknown>) : {};
    const beforeHash =
      stateChange && expectedVersion !== null
        ? evidenceHash({ resourceType, resourceId, version: expectedVersion })
        : null;
    const afterHash = stateChange
      ? evidenceHash({
          resourceType,
          resourceId,
          version: row.version ?? (expectedVersion === null ? 1 : expectedVersion + 1),
          status: row.status ?? null,
        })
      : null;
    await client.query('select audit.append_event($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)', [
      input.principal.userId,
      input.permission ? 'admin' : 'user',
      action,
      resourceType,
      resourceId,
      beforeHash,
      afterHash,
      reason,
      input.requestId,
      JSON.stringify({ operation: input.operation }),
    ]);
  }

  private async outboxForMutation(
    client: PoolClient,
    input: Operation,
    result: unknown,
    resourceId: string,
  ): Promise<void> {
    const row =
      typeof result === 'object' && result !== null ? (result as Record<string, unknown>) : {};
    const occurredAt = new Date().toISOString();
    if (input.operation === 'assignAdminRole')
      await this.enqueue(client, 'admin.role_assigned', 'admin_assignment', resourceId, {
        schemaVersion: 1,
        adminId: row.userId,
        roleId: row.roleId,
        assignmentId: resourceId,
        occurredAt,
        requestId: input.requestId,
      });
    if (input.operation === 'revokeAdminRole')
      await this.enqueue(client, 'admin.role_revoked', 'admin_assignment', resourceId, {
        schemaVersion: 1,
        adminId: row.userId,
        roleId: row.roleId,
        assignmentId: resourceId,
        occurredAt,
        requestId: input.requestId,
      });
    if (input.operation === 'createSupportAccessRequest')
      await this.enqueue(client, 'support_access.requested', 'support_request', resourceId, {
        schemaVersion: 1,
        requestId: resourceId,
        adminId: input.principal.userId,
        userId: row.userId,
        scopeKeys: this.scopeKeys(row.scopes),
        occurredAt,
      });
    if (input.operation === 'decideSupportAccessRequest' && row.status === 'approved') {
      const request = await this.one<Record<string, unknown>>(
        client,
        'select user_id as "userId",assignee,scope from private.support_access_requests where id=$1',
        [resourceId],
      );
      const grant = await this.one<{ id: string }>(
        client,
        'select id from private.support_access_grants where request_id=$1 and revoked_at is null',
        [resourceId],
      );
      await this.enqueue(client, 'support_access.granted', 'support_request', resourceId, {
        schemaVersion: 1,
        requestId: resourceId,
        grantId: grant.id,
        adminId: request.assignee,
        userId: request.userId,
        scopeKeys: this.scopeKeys(request.scope),
        occurredAt,
      });
    }
    if (['revokeSupportAccess', 'endSupportAccess'].includes(input.operation)) {
      const request = await this.one<Record<string, unknown>>(
        client,
        'select user_id as "userId",assignee,scope from private.support_access_requests where id=$1',
        [resourceId],
      );
      const grant = await this.one<{ id: string }>(
        client,
        'select id from private.support_access_grants where request_id=$1 order by created_at desc limit 1',
        [resourceId],
      );
      await this.enqueue(client, 'support_access.revoked', 'support_request', resourceId, {
        schemaVersion: 1,
        requestId: resourceId,
        grantId: grant.id,
        adminId: request.assignee,
        userId: request.userId,
        scopeKeys: this.scopeKeys(request.scope),
        occurredAt,
      });
    }
    if (input.operation === 'createSecurityIncident')
      await this.enqueue(client, 'security.incident_opened', 'security_incident', resourceId, {
        schemaVersion: 1,
        incidentId: resourceId,
        severity: row.severity,
        occurredAt,
        requestId: input.requestId,
      });
  }

  private scopeKeys(value: unknown): string[] {
    if (!Array.isArray(value)) return [];
    return value
      .flatMap((entry) =>
        typeof entry === 'object' &&
        entry !== null &&
        typeof (entry as { resource?: unknown }).resource === 'string' &&
        Array.isArray((entry as { actions?: unknown }).actions)
          ? (entry as { actions: unknown[]; resource: string }).actions.flatMap((action) =>
              typeof action === 'string'
                ? [`${(entry as { resource: string }).resource}:${action}`]
                : [],
            )
          : [],
      )
      .sort()
      .slice(0, 18);
  }

  private async enqueue(
    client: PoolClient,
    eventType: string,
    aggregateType: string,
    aggregateId: string,
    payload: Record<string, unknown>,
  ): Promise<void> {
    const { schemaVersion, ...input } = payload;
    if (schemaVersion !== 1) throw new Error('SECURITY_EVENT_PAYLOAD_INVALID');
    const validated = buildSecurityEventPayload(eventType as SecurityEventType, input);
    await client.query('select private.enqueue_outbox_event($1,$2,$3,$4)', [
      eventType,
      aggregateType,
      aggregateId,
      JSON.stringify(validated),
    ]);
  }

  async queryAsPrincipal<T extends QueryResultRow>(
    principal: ClerkPrincipal,
    text: string,
    values: readonly unknown[] = [],
  ): Promise<T[]> {
    return this.withPrincipalTransaction(principal, async (client) => {
      const result = await client.query<T>(text, [...values]);
      return result.rows;
    });
  }

  async withWorkerTransaction<T>(action: (client: PoolClient) => Promise<T>): Promise<T> {
    return this.pool.withClient(async (client) => {
      await client.query('begin');
      try {
        await client.query('set local role masarifi_worker');
        const result = await action(client);
        await client.query('commit');
        return result;
      } catch (error) {
        await client.query('rollback');
        throw error;
      }
    });
  }
}
