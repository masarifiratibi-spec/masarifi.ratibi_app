grant masarifi_migration to current_user with set true, inherit false;
set local role masarifi_migration;

create function private.fail_operating_voice_event(p_batch uuid,p_token uuid,p_event uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare b private.voice_batches; epoch_id uuid;
begin
  select x.* into b from private.voice_batches x join public.voice_sessions s
    on s.id=x.session_id and s.user_id=x.user_id where x.id=p_batch;
  if b.id is null then raise exception 'VOICE_SCOPE_INVALID'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(b.user_id,0));
  select e.id into epoch_id from private.staging_voice_epochs e
    join private.staging_voice_members m on m.epoch_id=e.id and m.user_id=b.user_id and m.session_id=b.session_id
    where e.mode='operating' for update of e;
  if epoch_id is null or not private.voice_epoch_open(epoch_id) then raise exception 'VOICE_SCOPE_INVALID'; end if;
  perform 1 from public.voice_sessions where id=b.session_id for update;
  select * into b from private.voice_batches where id=p_batch and lease_token=p_token
    and lease_until>clock_timestamp() and status='finalizing' for update;
  if not found then raise exception 'VOICE_EXECUTION_FENCE_INVALID'; end if;
  update private.voice_events set status='execution_failed',attempt_count=attempt_count+1,completed_at=clock_timestamp()
    where id=p_event and batch_id=b.id and user_id=b.user_id and status='eligible';
  if not found then return jsonb_build_object('settled',false); end if;
  delete from private.voice_event_commands where event_id=p_event;
  if not exists(select 1 from private.voice_events where batch_id=b.id and status='eligible') then
    update private.voice_batches set status='failed',completed_at=clock_timestamp(),lease_token=null,lease_until=null where id=b.id;
    update public.voice_sessions set status='failed',failure_code='VOICE_FINALIZATION_FAILED' where id=b.session_id;
  end if;
  return jsonb_build_object('settled',true);
end $$;
revoke all on function private.fail_operating_voice_event(uuid,uuid,uuid)
  from public,anon,authenticated,service_role,masarifi_api;
grant execute on function private.fail_operating_voice_event(uuid,uuid,uuid) to masarifi_worker;
reset role;
revoke masarifi_migration from current_user granted by current_user;
