-- Selective forward repair for the frozen current partial-state chain, not canonical history.
-- Requires an external transaction; hosted execution requires concrete approval.
set local statement_timeout='5s';
set local lock_timeout='1s';
do $setup$
declare actual jsonb;
begin
  if current_user<>'postgres' or session_user<>'postgres' or (select rolsuper from pg_roles where rolname=current_user) then
    raise exception 'OWNER_CHAIN_ACTUAL_EXECUTOR_REQUIRED'; end if;
  if current_setting('server_version_num')<>'170006' then raise exception 'OWNER_CHAIN_SERVER_DRIFT'; end if;
  if not pg_try_advisory_xact_lock(5574319470126001) then raise exception 'MIGRATION_LOCK_UNAVAILABLE'; end if;
  select (SELECT jsonb_agg(jsonb_build_object('name',p.proname,'arguments',pg_get_function_identity_arguments(p.oid),
 'owner',pg_get_userbyid(p.proowner),'language',l.lanname,'securityDefiner',p.prosecdef,'strict',p.proisstrict,
 'volatility',p.provolatile,'configuration',p.proconfig,'acl',p.proacl::text,'bodyMd5Lf',md5(replace(p.prosrc,E'\r\n',E'\n')),'definitionMd5Lf',md5(replace(pg_get_functiondef(p.oid),E'\r\n',E'\n')))
 ORDER BY p.proname,pg_get_function_identity_arguments(p.oid)) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
 JOIN pg_language l ON l.oid=p.prolang WHERE n.nspname='private' AND p.proname LIKE 'finalize_import_session%') into actual;
  if actual is distinct from $expected$[{"name":"finalize_import_session","arguments":"p_session_id uuid, p_fence_token uuid","owner":"masarifi_migration","language":"plpgsql","securityDefiner":true,"strict":false,"volatility":"v","configuration":["search_path=\"\""],"acl":"{masarifi_migration=X/masarifi_migration,masarifi_worker=X/masarifi_migration}","bodyMd5Lf":"9f19a8e2d79483b9695bebc213367ec9","definitionMd5Lf":"8efc0fb95a6f77a7d176a08ceebc3f16"},{"name":"finalize_import_session_before_content_reference","arguments":"p_session_id uuid, p_fence_token uuid","owner":"masarifi_migration","language":"plpgsql","securityDefiner":true,"strict":false,"volatility":"v","configuration":["search_path=\"\""],"acl":"{masarifi_migration=X/masarifi_migration}","bodyMd5Lf":"763844471547938892f158db79eab2d6","definitionMd5Lf":"420d29faecad4826a1f8ede99cce59f9"},{"name":"finalize_import_session_before_correlation_review","arguments":"p_session_id uuid, p_fence_token uuid","owner":"masarifi_migration","language":"plpgsql","securityDefiner":true,"strict":false,"volatility":"v","configuration":["search_path=\"\""],"acl":"{masarifi_migration=X/masarifi_migration}","bodyMd5Lf":"e00e5e7789512e91d241e88dce1cd686","definitionMd5Lf":"0b2c6230975c6a17f120690e515da7f3"},{"name":"finalize_import_session_before_currency_accounts","arguments":"p_session_id uuid, p_fence_token uuid","owner":"masarifi_migration","language":"plpgsql","securityDefiner":true,"strict":false,"volatility":"v","configuration":["search_path=\"\""],"acl":"{masarifi_migration=X/masarifi_migration}","bodyMd5Lf":"452bf398d8c74e27e31a182c2e2a4f15","definitionMd5Lf":"9c14b9f4129ff6749f9081ce64a5a21d"},{"name":"finalize_import_session_before_date_review","arguments":"p_session_id uuid, p_fence_token uuid","owner":"masarifi_migration","language":"plpgsql","securityDefiner":true,"strict":false,"volatility":"v","configuration":["search_path=\"\""],"acl":"{masarifi_migration=X/masarifi_migration}","bodyMd5Lf":"be1865f8194cdc7674fd0edf45df2749","definitionMd5Lf":"57a2e5260f53dc84eb1416f05683d750"},{"name":"finalize_import_session_before_nominal","arguments":"p_session_id uuid, p_fence_token uuid","owner":"masarifi_migration","language":"plpgsql","securityDefiner":true,"strict":false,"volatility":"v","configuration":["search_path=\"\""],"acl":"{masarifi_migration=X/masarifi_migration}","bodyMd5Lf":"7d074d0ea4b2877c663b68867fd25de9","definitionMd5Lf":"607325149406ac26a9112660ea6ea571"},{"name":"finalize_import_session_before_notification_destination","arguments":"p_session uuid, p_fence uuid","owner":"masarifi_migration","language":"plpgsql","securityDefiner":true,"strict":false,"volatility":"v","configuration":["search_path=\"\""],"acl":"{masarifi_migration=X/masarifi_migration}","bodyMd5Lf":"f52cbb853bf277978f59a75c20429d09","definitionMd5Lf":"16084767dba6e0a03ea34274d9d955a4"},{"name":"finalize_import_session_legacy","arguments":"p_session_id uuid, p_fence_token uuid","owner":"masarifi_migration","language":"plpgsql","securityDefiner":true,"strict":false,"volatility":"v","configuration":["search_path=\"\""],"acl":"{masarifi_migration=X/masarifi_migration}","bodyMd5Lf":"9dbb0eb3e729d5dd6371359dfa39959b","definitionMd5Lf":"6a7b2395d021a239b88bfb31c8fdc815"},{"name":"finalize_import_session_rules_base","arguments":"p_session_id uuid, p_fence_token uuid","owner":"masarifi_migration","language":"plpgsql","securityDefiner":true,"strict":false,"volatility":"v","configuration":["search_path=\"\""],"acl":"{masarifi_migration=X/masarifi_migration}","bodyMd5Lf":"140d281b82f8f23d4fba74427838801e","definitionMd5Lf":"0c3067bf1c4897057dd7b6079ad41b82"}]$expected$::jsonb then
    raise exception 'OWNER_CHAIN_PREREQUISITES_DRIFT'; end if;
  if to_regprocedure('private.finalize_import_session_before_owner_context(uuid,uuid)') is not null then
    raise exception 'OWNER_CHAIN_INNER_ALREADY_PRESENT'; end if;
  perform set_config('masarifi.owner_chain.inner_definition',pg_get_functiondef('private.finalize_import_session_before_correlation_review(uuid,uuid)'::regprocedure),true);
  perform set_config('masarifi.owner_chain.executor_role', current_setting('role'), true);
  perform set_config('masarifi.owner_chain.memberships_before',(select md5(coalesce(string_agg(to_jsonb(m)::text,'' order by m.oid),'')) from pg_auth_members m),true);
  perform set_config('masarifi.owner_chain.own_membership',coalesce((select jsonb_build_object(
    'admin',m.admin_option,'inherit',m.inherit_option,'set',m.set_option)::text from pg_auth_members m
    where m.roleid='masarifi_migration'::regrole and m.member=current_user::regrole and m.grantor=current_user::regrole),'null'),true);
  if pg_has_role(current_user,'masarifi_migration','SET') then
    perform set_config('masarifi.owner_chain.granted','false',true);
  else
    execute 'grant masarifi_migration to current_user with set true granted by current_user';
    perform set_config('masarifi.owner_chain.granted','true',true);
  end if;
end $setup$;

set local role masarifi_migration;

alter function private.finalize_import_session_before_correlation_review(uuid,uuid) rename to finalize_import_session_before_owner_context;
create function private.finalize_import_session_before_correlation_review(p_session_id uuid,p_fence_token uuid) returns jsonb
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
alter function private.finalize_import_session_before_correlation_review(uuid,uuid) owner to masarifi_migration;
revoke all on function private.finalize_import_session_before_correlation_review(uuid,uuid) from public,anon,authenticated,masarifi_api,masarifi_worker;
do $restore_executor$ begin
  perform set_config('role',current_setting('masarifi.owner_chain.executor_role'),true);
end $restore_executor$;
do $restore_membership$
declare prior jsonb:=current_setting('masarifi.owner_chain.own_membership')::jsonb;
begin
  if current_setting('masarifi.owner_chain.granted')='true' then
    if prior='null'::jsonb then execute 'revoke masarifi_migration from current_user granted by current_user';
    else execute format('grant masarifi_migration to current_user with admin %s, inherit %s, set %s granted by current_user',
      prior->>'admin',prior->>'inherit',prior->>'set'); end if;
  end if;
  if (select md5(coalesce(string_agg(to_jsonb(m)::text,'' order by m.oid),'')) from pg_auth_members m)
    is distinct from current_setting('masarifi.owner_chain.memberships_before') then
    raise exception 'EXACT_MEMBERSHIP_RESTORATION_FAILED';
  end if;
end $restore_membership$;

do $postconditions$
declare actual jsonb;
begin
  select (SELECT jsonb_agg(jsonb_build_object('name',p.proname,'arguments',pg_get_function_identity_arguments(p.oid),
 'owner',pg_get_userbyid(p.proowner),'language',l.lanname,'securityDefiner',p.prosecdef,'strict',p.proisstrict,
 'volatility',p.provolatile,'configuration',p.proconfig,'acl',p.proacl::text,'bodyMd5Lf',md5(replace(p.prosrc,E'\r\n',E'\n')))
 ORDER BY p.proname,pg_get_function_identity_arguments(p.oid)) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
 JOIN pg_language l ON l.oid=p.prolang WHERE n.nspname='private' AND p.proname LIKE 'finalize_import_session%') into actual;
  if actual is distinct from $expected$[{"name":"finalize_import_session","arguments":"p_session_id uuid, p_fence_token uuid","owner":"masarifi_migration","language":"plpgsql","securityDefiner":true,"strict":false,"volatility":"v","configuration":["search_path=\"\""],"acl":"{masarifi_migration=X/masarifi_migration,masarifi_worker=X/masarifi_migration}","bodyMd5Lf":"9f19a8e2d79483b9695bebc213367ec9"},{"name":"finalize_import_session_before_content_reference","arguments":"p_session_id uuid, p_fence_token uuid","owner":"masarifi_migration","language":"plpgsql","securityDefiner":true,"strict":false,"volatility":"v","configuration":["search_path=\"\""],"acl":"{masarifi_migration=X/masarifi_migration}","bodyMd5Lf":"763844471547938892f158db79eab2d6"},{"name":"finalize_import_session_before_correlation_review","arguments":"p_session_id uuid, p_fence_token uuid","owner":"masarifi_migration","language":"plpgsql","securityDefiner":true,"strict":false,"volatility":"v","configuration":["search_path=\"\""],"acl":"{masarifi_migration=X/masarifi_migration}","bodyMd5Lf":"d63e554c1f83c4ccd9a57db153c294aa"},{"name":"finalize_import_session_before_currency_accounts","arguments":"p_session_id uuid, p_fence_token uuid","owner":"masarifi_migration","language":"plpgsql","securityDefiner":true,"strict":false,"volatility":"v","configuration":["search_path=\"\""],"acl":"{masarifi_migration=X/masarifi_migration}","bodyMd5Lf":"452bf398d8c74e27e31a182c2e2a4f15"},{"name":"finalize_import_session_before_date_review","arguments":"p_session_id uuid, p_fence_token uuid","owner":"masarifi_migration","language":"plpgsql","securityDefiner":true,"strict":false,"volatility":"v","configuration":["search_path=\"\""],"acl":"{masarifi_migration=X/masarifi_migration}","bodyMd5Lf":"be1865f8194cdc7674fd0edf45df2749"},{"name":"finalize_import_session_before_nominal","arguments":"p_session_id uuid, p_fence_token uuid","owner":"masarifi_migration","language":"plpgsql","securityDefiner":true,"strict":false,"volatility":"v","configuration":["search_path=\"\""],"acl":"{masarifi_migration=X/masarifi_migration}","bodyMd5Lf":"7d074d0ea4b2877c663b68867fd25de9"},{"name":"finalize_import_session_before_notification_destination","arguments":"p_session uuid, p_fence uuid","owner":"masarifi_migration","language":"plpgsql","securityDefiner":true,"strict":false,"volatility":"v","configuration":["search_path=\"\""],"acl":"{masarifi_migration=X/masarifi_migration}","bodyMd5Lf":"f52cbb853bf277978f59a75c20429d09"},{"name":"finalize_import_session_before_owner_context","arguments":"p_session_id uuid, p_fence_token uuid","owner":"masarifi_migration","language":"plpgsql","securityDefiner":true,"strict":false,"volatility":"v","configuration":["search_path=\"\""],"acl":"{masarifi_migration=X/masarifi_migration}","bodyMd5Lf":"e00e5e7789512e91d241e88dce1cd686"},{"name":"finalize_import_session_legacy","arguments":"p_session_id uuid, p_fence_token uuid","owner":"masarifi_migration","language":"plpgsql","securityDefiner":true,"strict":false,"volatility":"v","configuration":["search_path=\"\""],"acl":"{masarifi_migration=X/masarifi_migration}","bodyMd5Lf":"9dbb0eb3e729d5dd6371359dfa39959b"},{"name":"finalize_import_session_rules_base","arguments":"p_session_id uuid, p_fence_token uuid","owner":"masarifi_migration","language":"plpgsql","securityDefiner":true,"strict":false,"volatility":"v","configuration":["search_path=\"\""],"acl":"{masarifi_migration=X/masarifi_migration}","bodyMd5Lf":"140d281b82f8f23d4fba74427838801e"}]$expected$::jsonb then
    raise exception 'OWNER_CHAIN_POSTCONDITIONS_FAILED'; end if;
  if pg_get_functiondef('private.finalize_import_session_before_owner_context(uuid,uuid)'::regprocedure)
    is distinct from replace(current_setting('masarifi.owner_chain.inner_definition'),
      'FUNCTION private.finalize_import_session_before_correlation_review(',
      'FUNCTION private.finalize_import_session_before_owner_context(') then
    raise exception 'OWNER_CHAIN_INNER_DEFINITION_CHANGED'; end if;
end $postconditions$;
