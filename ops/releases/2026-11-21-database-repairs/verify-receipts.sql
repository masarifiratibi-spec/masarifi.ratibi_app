-- On an isolated empty queue, after install and index, wrapped by psql -1.
insert into private.report_receipt_consumer_start(singleton,activated_at) values(true, now()-interval '1 minute');
do $test$
declare
  id uuid := gen_random_uuid();
  aid uuid := gen_random_uuid();
  old_id uuid := gen_random_uuid();
  pending_id uuid := gen_random_uuid();
  posted timestamptz := now();
  env jsonb;
  payload jsonb;
  consumed int;
  late_msg bigint;
  old_msg bigint;
  other bigint;
  future_msg bigint;
begin
  payload := jsonb_build_object('type','report.delivery_succeeded','schemaVersion',1,'data',
    jsonb_build_object('attemptId',aid,'acceptedByServerAt','2026-11-21T07:00:00.000Z'));
  insert into private.outbox_events(id,event_type,aggregate_type,aggregate_id,payload,created_at,published_at)
    values(id,'report.delivery_succeeded','report_attempt',aid,payload,posted,posted),
          (old_id,'report.delivery_succeeded','report_attempt',aid,payload,posted-interval '2 days',posted);
  env := jsonb_build_object('schemaVersion',1,'producer','masarifi-api','eventType','report.delivery_succeeded',
    'eventId',id,'correlationId',id,'attempt',1,'aggregate',jsonb_build_object('type','report_attempt','id',aid),
    'occurredAt',to_char(posted at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),'payload',payload);
  perform pgmq.send('platform-events',env);
  perform pgmq.send('platform-events',env);
  perform pgmq.send('platform-events',env || '{"unexpected":true}');
  perform pgmq.send('platform-events',env || '{"eventId":"malformed"}');
  select pgmq.send('platform-events',env) into old_msg;
  update pgmq."q_platform-events" set enqueued_at=posted-interval '2 days' where msg_id=old_msg;
  select pgmq.send('platform-events',env || jsonb_build_object('eventId',old_id)) into late_msg;
  select pgmq.send('platform-events',env || '{"eventType":"report.requested"}') into other;
  select pgmq.send('platform-events',env,300) into future_msg;
  -- Model crash after the SQL operation, before the enclosing transaction commits.
  begin
    perform private.consume_report_delivery_receipts();
    raise exception using errcode='Z1234';
  exception when sqlstate 'Z1234' then null; end;
  if exists(select from private.report_delivery_receipts) or
     exists(select from pgmq."a_platform-events") or exists(select from private.report_receipt_issues) then
    raise exception 'rollback did not restore messages and receipts';
  end if;
  if private.consume_report_delivery_receipts() <> 4 then raise exception 'expected four archived messages'; end if;
  if private.consume_report_delivery_receipts() <> 0 then raise exception 'unexpected reprocessing'; end if;
  if (select count(*) from private.report_delivery_receipts) <> 1 or
     (select count(*) from private.report_receipt_issues where reason='invalid_receipt') <> 2 or
     (select count(*) from private.report_receipt_issues where reason='protected_source') <> 1 or
     (select count(*) from pgmq."a_platform-events") <> 4 or
     (select count(*) from pgmq."q_platform-events" where msg_id in (old_msg,late_msg,other,future_msg)) <> 4 then
     raise exception 'incorrect deduplication, isolation or protected boundaries';
  end if;
  insert into private.outbox_events(id,event_type,aggregate_type,aggregate_id,payload,created_at)
    values(pending_id,'report.delivery_succeeded','report_attempt',aid,payload,posted);
  select pgmq.send('platform-events',env || jsonb_build_object('eventId',pending_id)) into late_msg;
  consumed := private.consume_report_delivery_receipts();
  if consumed <> 0 or not exists(
    select from pgmq."q_platform-events" where msg_id=late_msg and vt > clock_timestamp()) then
    raise exception 'Unconfirmed publication consumed'; end if;
  update private.outbox_events set published_at=clock_timestamp(),attempt_count=1 where private.outbox_events.id=pending_id;
  update pgmq."q_platform-events" set vt=posted where msg_id=late_msg;
  consumed := private.consume_report_delivery_receipts();
  if consumed <> 1 or not exists(
    select from private.report_delivery_receipts where event_id=pending_id) then
    raise exception 'Early delivery lost after publication'; end if;
end $test$;
