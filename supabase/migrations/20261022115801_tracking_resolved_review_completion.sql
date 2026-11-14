grant masarifi_migration to current_user with set true,inherit false;
set local role masarifi_migration;

-- Normal maintenance can close a resolved review, including one whose counters already agree.
do $migration$
declare definition text; updated text;
  receipt text:='return to_jsonb(s)-''user_id''-''request_hash''-''claim_token''-''claimed_by''-''lease_until''-''last_error_code'';';
begin
  definition:=pg_get_functiondef('private.reconcile_import_session_counts(uuid)'::regprocedure);
  updated:=replace(definition,receipt,$closure$
  if s.status='review' and not exists(select 1 from public.import_items where session_id=s.id and status in ('parsed','review')) then
    update public.import_sessions set status='complete',completed_at=clock_timestamp() where id=s.id returning * into s;
    perform private.enqueue_outbox_event('import.session.changed.v1','import-session',s.id,
      jsonb_build_object('sessionId',s.id,'status',s.status,'itemCount',s.item_count,'failedCount',0,'version',s.version,'occurredAt',clock_timestamp()));
  end if;
$closure$||receipt);
  if updated=definition then raise exception 'TRACKING_REVIEW_COUNTER_COMPLETION_PRECONDITION'; end if;
  execute updated;

  definition:=pg_get_functiondef('private.reconcile_import_sessions(integer)'::regprocedure);
  updated:=replace(definition,'where (x.item_count,x.accepted_count,x.rejected_count)<>(',
    'where (x.status=''review'' and not exists(select 1 from public.import_items i where i.session_id=x.id and i.status in (''parsed'',''review''))) or (x.item_count,x.accepted_count,x.rejected_count)<>(');
  if updated=definition then raise exception 'TRACKING_REVIEW_SCAN_COMPLETION_PRECONDITION'; end if;
  execute updated;
end $migration$;

reset role;
revoke masarifi_migration from current_user granted by current_user;
