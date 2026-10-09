grant masarifi_migration to current_user with set true, inherit false;
set local role masarifi_migration;

-- API-only first-login reconciliation. It cannot update or reactivate an existing profile.
create function private.ensure_authenticated_profile(p_user_id text, p_identity jsonb)
returns boolean language plpgsql security definer set search_path='' as $$
declare existing_status text;
  claims jsonb := coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb;
begin
  if p_user_id is null or char_length(p_user_id) not between 1 and 128
    or p_user_id is distinct from public.current_clerk_user_id()
    or claims->>'role' is distinct from 'authenticated'
    or nullif(btrim(claims->>'sid'),'') is null then
    raise exception using errcode='28000',message='AUTH_TOKEN_INVALID';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_user_id,0));
  select status into existing_status from public.profiles where id=p_user_id for update;
  if found then
    if existing_status<>'active' then
      raise exception using errcode='42501',message='PROFILE_INACTIVE';
    end if;
    return true;
  end if;
  if p_identity is null then return false; end if;
  if jsonb_typeof(p_identity) is distinct from 'object'
    or p_identity->>'id' is distinct from p_user_id
    or (p_identity->>'banned')::boolean is distinct from false
    or (p_identity->>'locked')::boolean is distinct from false
    or (p_identity->>'primaryEmail' is not null
        and (p_identity->>'primaryEmailVerified')::boolean is distinct from true) then
    raise exception using errcode='28000',message='AUTH_TOKEN_INVALID';
  end if;
  insert into public.profiles(id,primary_email,phone_e164,display_name,status)
    values(p_user_id,p_identity->>'primaryEmail',p_identity->>'primaryPhone',p_identity->>'displayName','active');
  insert into public.user_preferences(user_id) values(p_user_id);
  insert into public.onboarding_progress(user_id) values(p_user_id);
  perform private.enqueue_outbox_event('profile.created','profile',null,jsonb_build_object(
    'payloadVersion',1,'profileId',p_user_id,'profileVersion',1,
    'source','clerk_reconciliation','sourceEventId',null));
  return true;
end
$$;
alter function private.ensure_authenticated_profile(text,jsonb) owner to masarifi_migration;
revoke all on function private.ensure_authenticated_profile(text,jsonb) from public,anon,authenticated,masarifi_worker;
grant execute on function private.ensure_authenticated_profile(text,jsonb) to masarifi_api;
reset role;
revoke masarifi_migration from current_user granted by current_user;
