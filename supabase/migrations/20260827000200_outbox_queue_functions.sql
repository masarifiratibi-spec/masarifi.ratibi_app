set local role masarifi_migration;

create table private.outbox_events (
  id uuid primary key default extensions.gen_random_uuid(),
  created_at timestamptz not null default now(),
  aggregate_type text not null,
  aggregate_id uuid,
  event_type text not null,
  payload jsonb not null,
  available_at timestamptz not null default now(),
  published_at timestamptz,
  attempt_count integer not null default 0,
  last_error_code text,
  locked_by text,
  locked_until timestamptz,
  constraint outbox_events_aggregate_type_length_check
    check (char_length(btrim(aggregate_type)) between 1 and 64),
  constraint outbox_events_aggregate_type_format_check
    check (aggregate_type ~ '^[a-z][a-z0-9_-]*$'),
  constraint outbox_events_event_type_length_check
    check (char_length(btrim(event_type)) between 3 and 128),
  constraint outbox_events_event_type_format_check
    check (event_type ~ '^[a-z][a-z0-9_-]*(\.[a-z][a-z0-9_-]*)+$'),
  constraint outbox_events_payload_object_check check (jsonb_typeof(payload) = 'object'),
  constraint outbox_events_payload_size_check check (octet_length(payload::text) <= 65536),
  constraint outbox_events_attempt_count_check check (attempt_count >= 0),
  constraint outbox_events_last_error_code_check check (
    last_error_code is null or (
      char_length(last_error_code) between 1 and 64
      and last_error_code ~ '^[A-Z][A-Z0-9_]*$'
    )
  ),
  constraint outbox_events_lease_pair_check check ((locked_by is null) = (locked_until is null)),
  constraint outbox_events_locked_by_check check (
    locked_by is null or char_length(locked_by) between 1 and 128
  ),
  constraint outbox_events_published_lease_check check (
    published_at is null or (locked_by is null and locked_until is null)
  )
);

alter table private.outbox_events owner to masarifi_migration;
alter table private.outbox_events enable row level security;
alter table private.outbox_events force row level security;

create index outbox_events_claim_idx
  on private.outbox_events (published_at, available_at)
  where published_at is null;
create index outbox_events_claim_order_idx
  on private.outbox_events (available_at, id)
  where published_at is null;
create index outbox_events_aggregate_history_idx
  on private.outbox_events (aggregate_type, aggregate_id, created_at);
create index outbox_events_lease_recovery_idx
  on private.outbox_events (locked_until)
  where published_at is null;

create function private.set_updated_at_and_version()
returns trigger
language plpgsql
set search_path = pg_catalog
as $function$
begin
  new.updated_at = now();
  new.version = old.version + 1;
  return new;
end
$function$;

alter function private.set_updated_at_and_version() owner to masarifi_migration;
revoke all on function private.set_updated_at_and_version() from public;

create function private.enqueue_outbox_event(
  p_event_type text,
  p_aggregate_type text,
  p_aggregate_id uuid,
  p_payload jsonb
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog
as $function$
declare
  event_id uuid;
begin
  if p_event_type is null
    or char_length(btrim(p_event_type)) not between 3 and 128
    or p_event_type !~ '^[a-z][a-z0-9_-]*(\.[a-z][a-z0-9_-]*)+$' then
    raise exception using errcode = '22023', message = 'OUTBOX_EVENT_TYPE_INVALID';
  end if;
  if p_aggregate_type is null
    or char_length(btrim(p_aggregate_type)) not between 1 and 64
    or p_aggregate_type !~ '^[a-z][a-z0-9_-]*$' then
    raise exception using errcode = '22023', message = 'OUTBOX_AGGREGATE_TYPE_INVALID';
  end if;
  if p_payload is null
    or jsonb_typeof(p_payload) <> 'object'
    or octet_length(p_payload::text) > 65536 then
    raise exception using errcode = '22023', message = 'OUTBOX_PAYLOAD_INVALID';
  end if;
  if p_payload::text ~* '"[^"}]*(authorization|cookie|credential|password|secret|token|connection[_ -]?string|provider[_ -]?(request|response))[^"}]*"\s*:' then
    raise exception using errcode = '22023', message = 'OUTBOX_PAYLOAD_SENSITIVE';
  end if;

  insert into private.outbox_events (event_type, aggregate_type, aggregate_id, payload)
  values (btrim(p_event_type), btrim(p_aggregate_type), p_aggregate_id, p_payload)
  returning id into event_id;
  return event_id;
end
$function$;

alter function private.enqueue_outbox_event(text, text, uuid, jsonb) owner to masarifi_migration;
revoke all on function private.enqueue_outbox_event(text, text, uuid, jsonb) from public;

create function private.claim_outbox_batch(
  p_worker_id text,
  p_limit_count integer,
  p_lease_seconds integer
)
returns setof private.outbox_events
language plpgsql
security definer
set search_path = pg_catalog
as $function$
begin
  if p_worker_id is null or char_length(btrim(p_worker_id)) not between 1 and 128 then
    raise exception using errcode = '22023', message = 'OUTBOX_WORKER_ID_INVALID';
  end if;
  if p_limit_count is null or p_limit_count not between 1 and 100 then
    raise exception using errcode = '22023', message = 'OUTBOX_CLAIM_LIMIT_INVALID';
  end if;
  if p_lease_seconds is null or p_lease_seconds not between 1 and 300 then
    raise exception using errcode = '22023', message = 'OUTBOX_LEASE_INVALID';
  end if;

  return query
  with eligible as (
    select id
    from private.outbox_events
    where published_at is null
      and available_at <= now()
      and (locked_until is null or locked_until <= now())
    order by available_at, id
    for update skip locked
    limit p_limit_count
  )
  update private.outbox_events as event
  set locked_by = btrim(p_worker_id),
      locked_until = now() + make_interval(secs => p_lease_seconds)
  from eligible
  where event.id = eligible.id
  returning event.*;
end
$function$;

alter function private.claim_outbox_batch(text, integer, integer) owner to masarifi_migration;
revoke all on function private.claim_outbox_batch(text, integer, integer) from public;

reset role;

select pgmq.create('platform-events');
