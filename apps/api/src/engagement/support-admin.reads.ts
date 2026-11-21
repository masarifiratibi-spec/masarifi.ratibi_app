import type { PoolClient } from 'pg';

// Customer identity stays a stable pseudonym; Admin assignment is an operational reference.
export const SUPPORT_ADMIN_REFERENCE = `jsonb_build_object(
  'assignedAdminId',t.assigned_admin_id,
  'customerReference','CUS-'||substr(encode(sha256(convert_to(t.user_id,'UTF8')),'hex'),1,16))`;
export const SUPPORT_TICKET_VALUE = `jsonb_build_object('id',t.id,'categoryId',t.category_id,
  'subject',t.subject,'status',t.status,'priority',t.priority,'lastMessageAt',t.last_message_at,
  'closedAt',t.closed_at,'version',t.version,'createdAt',t.created_at)`;

export async function readSupportWorkload(
  client: PoolClient,
  query: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const result = await client.query<{ value: Record<string, unknown> }>(
    'select private.support_admin_workload($1::jsonb) value',
    [JSON.stringify(query)],
  );
  if (!result.rows[0]) throw new Error('ENGAGEMENT_UNAVAILABLE');
  return result.rows[0].value;
}

export const supportFilter = `($1::text is null or position(lower($1) in lower(t.subject))>0 or t.id::text=$1)
  and ($2::text is null or t.status=$2) and ($3::text is null or t.priority=$3)
  and ($4::text is null or ($4='unassigned' and t.assigned_admin_id is null) or t.assigned_admin_id=$4)
  and ($5::uuid is null or t.category_id=$5)
  and ($6::date is null or t.created_at >= ($6::date::timestamp at time zone 'UTC'))
  and ($7::date is null or t.created_at < (($7::date + 1)::timestamp at time zone 'UTC'))`;

export function supportFilterValues(query: Record<string, unknown>): unknown[] {
  return [
    query.query ?? null,
    query.status ?? null,
    query.priority ?? null,
    query.assignee ?? null,
    query.categoryId ?? null,
    query.from ?? null,
    query.to ?? null,
  ];
}
