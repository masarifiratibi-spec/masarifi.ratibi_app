-- psql -1 -v ON_ERROR_STOP=1 as the install/maintenance owner; requires pg_cron.
do $$ begin
  if row_security_active('private.outbox_events') or not (
      has_table_privilege(current_user,'private.outbox_events','SELECT')
      and has_column_privilege(current_user,'pgmq."a_platform-events"','msg_id','SELECT')
      and has_table_privilege(current_user,'pgmq."q_platform-events"','SELECT')
      and has_table_privilege(current_user,'pgmq."q_platform-events"','UPDATE')
      and has_table_privilege(current_user,'pgmq."q_platform-events"','DELETE')
      and has_table_privilege(current_user,'pgmq."a_platform-events"','INSERT')
      and has_function_privilege(current_user,'pgmq.archive(text,bigint)','EXECUTE')
      and has_function_privilege(current_user,'pgmq.set_vt(text,bigint,integer)','EXECUTE')) then
    raise exception 'REPORT_RECEIPT_MAINTENANCE_IDENTITY_REQUIRED';
  end if;
  if not exists (select from pg_index where indexrelid = to_regclass('pgmq.masarifi_report_receipt_queue_idx')
      and indrelid = 'pgmq."q_platform-events"'::regclass and indisvalid) then
    raise exception 'REPORT_RECEIPT_INDEX_REQUIRED';
  end if;
end $$;
insert into private.report_receipt_consumer_start(singleton) values(true) on conflict do nothing;
select cron.schedule('masarifi-report-delivery-receipts','*/5 * * * *',
  $job$set local lock_timeout='500ms'; set local statement_timeout='3s'; select private.consume_report_delivery_receipts();$job$);
