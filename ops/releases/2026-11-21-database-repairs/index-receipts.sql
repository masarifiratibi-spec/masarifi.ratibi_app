-- Run outside a transaction. Check indisvalid before activating.
set lock_timeout = '1s';
create index concurrently masarifi_report_receipt_queue_idx
on pgmq."q_platform-events"(enqueued_at,msg_id) where message->>'eventType' = 'report.delivery_succeeded';
