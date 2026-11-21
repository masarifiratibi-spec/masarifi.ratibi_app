-- psql -1 -v ON_ERROR_STOP=1; install after the queue exists. Activation is separate.
set local lock_timeout = '1s';
set local statement_timeout = '5s';

create table private.report_receipt_consumer_start (
  singleton boolean primary key check (singleton),
  activated_at timestamptz not null default clock_timestamp(),
  last_completed_at timestamptz
);
create table private.report_delivery_receipts (
  event_id uuid primary key,
  accepted_at timestamptz not null
);
create index report_delivery_receipts_accepted_idx on private.report_delivery_receipts(accepted_at);
create table private.report_receipt_issues (
  msg_id bigint primary key,
  reason text not null check (reason in ('invalid_receipt', 'protected_source', 'unconfirmed_publication')),
  detected_at timestamptz not null default clock_timestamp()
);
revoke all on private.report_delivery_receipts, private.report_receipt_issues,
  private.report_receipt_consumer_start from public, anon, authenticated, service_role, masarifi_api, masarifi_worker;

create function private.consume_report_delivery_receipts() returns integer
language plpgsql security invoker set search_path = '' set row_security = off as $$
declare
  boundary timestamptz;
  ready_until timestamptz := clock_timestamp();
  item record;
  src private.outbox_events%rowtype;
  msg jsonb;
  source_id uuid;
  stamp text;
  valid boolean;
  processed integer := 0;
begin
  select activated_at into strict boundary from private.report_receipt_consumer_start where singleton;
  for item in
    select q.msg_id, q.message, q.enqueued_at from pgmq."q_platform-events" q
    where q.message->>'eventType' = 'report.delivery_succeeded'
      and q.enqueued_at >= boundary and q.vt <= ready_until
      and not exists (select from private.report_receipt_issues i where i.msg_id = q.msg_id)
    order by q.enqueued_at, q.msg_id limit 32 for update of q skip locked
  loop
    msg := item.message;
    source_id := null;
    if pg_input_is_valid(msg->>'eventId', 'uuid') then
      source_id := (msg->>'eventId')::uuid;
    end if;
    select * into src from private.outbox_events where id = source_id;
    if src.created_at < boundary then
      insert into private.report_receipt_issues(msg_id,reason) values (item.msg_id,'protected_source');
      continue;
    end if;
    if src.id is not null and src.published_at is null then
      -- A publisher can commit its queue send before marking its outbox row.
      if item.enqueued_at > ready_until - interval '1 day' then
        perform pgmq.set_vt('platform-events',item.msg_id,60);
      else
        insert into private.report_receipt_issues(msg_id,reason) values (item.msg_id,'unconfirmed_publication');
      end if;
      continue;
    end if;
    stamp := msg #>> '{payload,data,acceptedByServerAt}';
    valid := src.published_at is not null and src.event_type = 'report.delivery_succeeded'
      and src.aggregate_type = 'report_attempt' and src.aggregate_id is not null
      and jsonb_typeof(msg->'correlationId') = 'string' and msg->>'correlationId' ~ '^[A-Za-z0-9._:-]{1,128}$'
      and jsonb_typeof(msg->'attempt') = 'number' and msg->>'attempt' ~ '^[1-9][0-9]{0,9}$'
      and msg->'attempt' <= to_jsonb(src.attempt_count::bigint + 1)
      and msg - 'correlationId' - 'attempt' = jsonb_build_object(
        'schemaVersion',1,'eventId',src.id,'producer','masarifi-api','eventType',src.event_type,
        'occurredAt',to_char(src.created_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
        'aggregate',jsonb_build_object('type',src.aggregate_type,'id',src.aggregate_id),
        'payload',src.payload - 'sync')
      and msg->'payload' = jsonb_build_object('type',src.event_type,'schemaVersion',1,'data',
        jsonb_build_object('attemptId',src.aggregate_id,'acceptedByServerAt',stamp))
      and stamp ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}\.[0-9]{3}Z$'
      and pg_input_is_valid(stamp,'timestamptz');
    if valid is true then
      insert into private.report_delivery_receipts(event_id,accepted_at) values(src.id,stamp::timestamptz)
        on conflict(event_id) do nothing;
    else
      -- Deterministic contract failures are isolated once and retained in the queue archive.
      insert into private.report_receipt_issues(msg_id,reason) values (item.msg_id,'invalid_receipt');
    end if;
    if pgmq.archive('platform-events',item.msg_id) is distinct from true then
      raise exception 'REPORT_RECEIPT_ARCHIVE_FAILED';
    end if;
    processed := processed + 1;
  end loop;
  update private.report_receipt_consumer_start set last_completed_at=clock_timestamp() where singleton;
  return processed;
end $$;
revoke all on function private.consume_report_delivery_receipts() from public, anon, authenticated, service_role, masarifi_api, masarifi_worker;
