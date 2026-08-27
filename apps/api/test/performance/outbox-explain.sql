\set ON_ERROR_STOP on

explain (analyze, buffers, format text)
select id
from private.outbox_events
where published_at is null
  and available_at <= now()
  and (locked_until is null or locked_until <= now())
order by available_at, id
for update skip locked
limit 100;

do $budget$
declare
  samples double precision[] := '{}';
  started_at timestamptz;
  p95_ms double precision;
begin
  for sample in 1..100 loop
    started_at := clock_timestamp();
    perform id
    from private.outbox_events
    where published_at is null
      and available_at <= now()
      and (locked_until is null or locked_until <= now())
    order by available_at, id
    limit 100;
    samples := array_append(
      samples,
      extract(epoch from clock_timestamp() - started_at) * 1000
    );
  end loop;

  select percentile_cont(0.95) within group (order by value)
  into p95_ms
  from unnest(samples) as measured(value);

  if p95_ms >= 50 then
    raise exception 'OUTBOX_CLAIM_P95_BUDGET_EXCEEDED: % ms', round(p95_ms::numeric, 3);
  end if;
end
$budget$;
