grant masarifi_migration to current_user with set true, inherit false;
set local role masarifi_migration;

alter function private.finalize_import_session(uuid,uuid) rename to finalize_import_session_before_date_review;
revoke all on function private.finalize_import_session_before_date_review(uuid,uuid) from public,anon,authenticated,masarifi_api,masarifi_worker;

create function private.finalize_import_session(p_session_id uuid,p_fence_token uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare result jsonb; i public.import_items; moved integer:=0;
begin
  result:=private.finalize_import_session_before_date_review(p_session_id,p_fence_token);
  -- Preserve the captured identity and unresolved date; only the owner can resolve it.
  for i in select x.* from public.import_items x join public.import_sessions s on s.id=x.session_id
    where s.id=p_session_id and s.schema_version=3 and s.status='processing'
      and s.claim_token=p_fence_token and s.lease_until>clock_timestamp()
      and x.status='parsed' and x.normalized_payload->>'diagnosticReason'='date_ambiguous'
    order by x.id for update of x
  loop
    perform private.create_review_item(i.id,'date_ambiguous',i.normalized_payload);
    moved:=moved+1;
  end loop;
  return jsonb_set(result,'{deferredCount}',to_jsonb(greatest(0,coalesce((result->>'deferredCount')::integer,0)-moved)));
end $$;
revoke all on function private.finalize_import_session(uuid,uuid) from public,anon,authenticated,masarifi_api;
grant execute on function private.finalize_import_session(uuid,uuid) to masarifi_worker;

-- Complete the worker attempt but leave an actionable review receipt for the client.
do $migration$
declare definition text; updated text;
begin
  definition:=pg_get_functiondef('private.complete_import_attempt(uuid,uuid,text,text)'::regprocedure);
  updated:=replace(definition,
    'status=case when waiting then ''received'' else ''complete'' end',
    'status=case when waiting then ''received'' when exists(select 1 from public.import_items where session_id=s.id and status=''review'') then ''review'' else ''complete'' end');
  if updated=definition then raise exception 'TRACKING_DATE_REVIEW_COMPLETION_PRECONDITION'; end if;
  updated:=replace(updated,
    'completed_at=case when not waiting then clock_timestamp() end',
    'completed_at=case when not waiting and not exists(select 1 from public.import_items where session_id=s.id and status=''review'') then clock_timestamp() end');
  execute updated;
end $migration$;

reset role;
revoke masarifi_migration from current_user granted by current_user;
