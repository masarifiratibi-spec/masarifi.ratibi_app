grant masarifi_migration to current_user with set true, inherit false;
set local role masarifi_migration;

-- The worker derives owner context only from its valid server-side lease.
-- Older configuration readers now assert owner identity as well as active status.
alter function private.finalize_import_session(uuid,uuid) rename to finalize_import_session_before_owner_context;
revoke all on function private.finalize_import_session_before_owner_context(uuid,uuid)
  from public,anon,authenticated,masarifi_api,masarifi_worker;

create function private.finalize_import_session(p_session_id uuid,p_fence_token uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare s public.import_sessions; prior_claims text; result jsonb;
begin
  select * into s from public.import_sessions
    where id=p_session_id and claim_token=p_fence_token and lease_until>clock_timestamp()
    for update;
  if not found then raise exception using errcode='40001',message='IMPORT_LEASE_STALE'; end if;
  prior_claims:=current_setting('request.jwt.claims',true);
  perform set_config('request.jwt.claims',jsonb_build_object(
    'role','authenticated','sub',s.user_id,'sid','tracking-worker:'||s.id::text)::text,true);
  begin
    result:=private.finalize_import_session_before_owner_context(p_session_id,p_fence_token);
    perform set_config('request.jwt.claims',coalesce(prior_claims,''),true);
    return result;
  exception when others then
    perform set_config('request.jwt.claims',coalesce(prior_claims,''),true);
    raise;
  end;
end $$;
alter function private.finalize_import_session(uuid,uuid) owner to masarifi_migration;
revoke all on function private.finalize_import_session(uuid,uuid) from public,anon,authenticated,masarifi_api;
grant execute on function private.finalize_import_session(uuid,uuid) to masarifi_worker;

reset role;
revoke masarifi_migration from current_user granted by current_user;
