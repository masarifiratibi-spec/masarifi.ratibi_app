grant masarifi_migration to current_user with set true, inherit false;
set local role masarifi_migration;

-- Bind a single worker transaction to the owner of its live, server-issued lease.
-- Both kinds resolve through import_sessions; caller-supplied owner IDs are never accepted.
create function private.set_tracking_worker_context(p_kind text,p_id uuid,p_fence_token uuid) returns void
language plpgsql security definer set search_path='' as $$
declare s public.import_sessions; prior_claims text;
begin
  if p_kind not in ('session','item') or p_kind is null then
    raise exception using errcode='22023',message='IMPORT_CLAIM_INVALID';
  end if;
  select x.* into s from public.import_sessions x
    where x.claim_token=p_fence_token and x.lease_until>clock_timestamp()
      and ((p_kind='session' and x.id=p_id) or (p_kind='item' and exists(
        select 1 from public.import_items i where i.id=p_id and i.session_id=x.id and i.user_id=x.user_id)))
    for update of x;
  if not found then raise exception using errcode='40001',message='IMPORT_LEASE_STALE'; end if;
  prior_claims:=current_setting('request.jwt.claims',true);
  perform set_config('request.jwt.claims',jsonb_build_object(
    'role','authenticated','sub',s.user_id,'sid','tracking-worker:'||s.id::text)::text,true);
  begin
    perform private.assert_active_profile(s.user_id);
  exception when others then
    perform set_config('request.jwt.claims',coalesce(prior_claims,''),true);
    raise;
  end;
end $$;
alter function private.set_tracking_worker_context(text,uuid,uuid) owner to masarifi_migration;
revoke all on function private.set_tracking_worker_context(text,uuid,uuid) from public,anon,authenticated,masarifi_api;
grant execute on function private.set_tracking_worker_context(text,uuid,uuid) to masarifi_worker;

reset role;
revoke masarifi_migration from current_user granted by current_user;
