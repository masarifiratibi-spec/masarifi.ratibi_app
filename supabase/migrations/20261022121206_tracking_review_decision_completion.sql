grant masarifi_migration to current_user with set true,inherit false;
set local role masarifi_migration;

-- A resolved review must close its import in the same transaction, even when maintenance is delayed.
do $migration$
declare definition text; updated text;
  anchor text:='perform private.enqueue_outbox_event(''tracking.review.resolved.v1''';
begin
  definition:=pg_get_functiondef('private.decide_review_item(text,uuid,text,jsonb,uuid,uuid,uuid)'::regprocedure);
  updated:=replace(definition,anchor,
    'perform private.reconcile_import_session_counts(i.session_id);'||chr(10)||'  '||anchor);
  if updated=definition then raise exception 'TRACKING_REVIEW_DECISION_COMPLETION_PRECONDITION'; end if;
  execute updated;
end $migration$;

-- Repair terminal review receipts only. This function updates counts/status and never replays financial items.
select private.reconcile_import_sessions(1000);

reset role;
revoke masarifi_migration from current_user granted by current_user;
