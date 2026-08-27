\set ON_ERROR_STOP on

truncate table private.outbox_events;

insert into private.outbox_events (
  id,
  created_at,
  aggregate_type,
  aggregate_id,
  event_type,
  payload,
  available_at,
  published_at,
  attempt_count,
  locked_by,
  locked_until
)
select
  md5(i::text)::uuid,
  timestamptz '2026-01-01 00:00:00+00' + i * interval '1 millisecond',
  'fixture',
  null,
  'fixture.created',
  jsonb_build_object('sequence', i),
  now() - interval '1 hour',
  case when i <= 700000 then now() - interval '30 minutes' else null end,
  case when i % 20 = 0 then 1 else 0 end,
  case when i between 700001 and 710000 then 'fixture-worker' else null end,
  case when i between 700001 and 710000 then now() + interval '30 seconds' else null end
from generate_series(1, 1000000) as fixture(i);

do $assertions$
declare
  total_count bigint;
  published_count bigint;
  unpublished_count bigint;
  leased_count bigint;
begin
  select
    count(*),
    count(*) filter (where published_at is not null),
    count(*) filter (where published_at is null),
    count(*) filter (where published_at is null and locked_until > now())
  into total_count, published_count, unpublished_count, leased_count
  from private.outbox_events;

  if (total_count, published_count, unpublished_count, leased_count)
     <> (1000000, 700000, 300000, 10000) then
    raise exception 'OUTBOX_PERFORMANCE_FIXTURE_INVALID';
  end if;
end
$assertions$;
