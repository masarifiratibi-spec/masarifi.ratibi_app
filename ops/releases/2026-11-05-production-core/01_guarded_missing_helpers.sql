-- CLONE ONLY. Not a hosted migration or complete history reconciliation.
-- Requires external BEGIN READ WRITE and exact frozen 17.6 prerequisite metadata.
set local statement_timeout='5s';
set local lock_timeout='1s';
do $prerequisites$
declare actual jsonb;
begin
  execute $frozen_query$with targets(schema_name,relation_name,column_names) as (values
('public','import_sessions',array['id','user_id','claim_token','lease_until']),
('public','import_items',array['id','session_id','user_id']),
('private','account_upload_erasure_tombstones',array['user_id','request_id','next_attempt_at','lease_until']),
('private','account_deletion_requests',array['id','user_id','status']),
('public','profiles',array['id','status'])),
function_names(name) as (values ('set_tracking_worker_context'),('list_due_account_upload_erasure_owners'),('reminder_baseline'),('assert_active_profile'),('finalize_import_session'),('finalize_import_session_before_owner_context'),('list_reminder_candidates'),('reminder_delivery_eligible'))
select jsonb_build_object('observed_at',clock_timestamp(),'server_version_num',current_setting('server_version_num'),
'relations',(select jsonb_agg(jsonb_build_object('schema',t.schema_name,'name',t.relation_name,'present',c.oid is not null,'kind',c.relkind,'owner',pg_get_userbyid(c.relowner),'acl',c.relacl::text,'rls_enabled',c.relrowsecurity,'rls_forced',c.relforcerowsecurity,
'migration_select',case when c.oid is not null then has_table_privilege('masarifi_migration',c.oid,'SELECT') end,
'migration_update',case when c.oid is not null then has_table_privilege('masarifi_migration',c.oid,'UPDATE') end,
'columns',(select jsonb_agg(jsonb_build_object('name',wanted,'present',att.attnum is not null,'type',format_type(att.atttypid,att.atttypmod),'not_null',att.attnotnull) order by wanted) from unnest(t.column_names) wanted left join pg_attribute att on att.attrelid=c.oid and att.attname=wanted and att.attnum>0 and not att.attisdropped),
'policies',(select coalesce(jsonb_agg(jsonb_build_object('name',pol.polname,'command',pol.polcmd,'permissive',pol.polpermissive,'roles',(select array_agg(coalesce(r.rolname,'PUBLIC') order by coalesce(r.rolname,'PUBLIC')) from unnest(pol.polroles) role_oid left join pg_roles r on r.oid=role_oid),
'using_true',regexp_replace(coalesce(pg_get_expr(pol.polqual,pol.polrelid),''),'[()[:space:]]','','g')='true',
'check_true',regexp_replace(coalesce(pg_get_expr(pol.polwithcheck,pol.polrelid),''),'[()[:space:]]','','g')='true',
'using_md5',md5(pg_get_expr(pol.polqual,pol.polrelid)),'check_md5',md5(pg_get_expr(pol.polwithcheck,pol.polrelid))) order by pol.polname),'[]'::jsonb) from pg_policy pol where pol.polrelid=c.oid)) order by t.schema_name,t.relation_name)
from targets t left join pg_namespace n on n.nspname=t.schema_name left join pg_class c on c.relnamespace=n.oid and c.relname=t.relation_name),
'functions',(select jsonb_agg(jsonb_build_object('name',f.name,'present',p.oid is not null,'identity_arguments',pg_get_function_identity_arguments(p.oid),'result',pg_get_function_result(p.oid),'language',l.lanname,'owner',pg_get_userbyid(p.proowner),'security_definer',p.prosecdef,'strict',p.proisstrict,'volatility',p.provolatile,'search_path',(select array_agg(setting) from unnest(p.proconfig) setting where setting like 'search_path=%'),'execute_acl',p.proacl::text,'body_md5_lf',md5(replace(p.prosrc,E'\r\n',E'\n'))) order by f.name,p.oid)
from function_names f left join pg_namespace n on n.nspname='private' left join pg_proc p on p.pronamespace=n.oid and p.proname=f.name left join pg_language l on l.oid=p.prolang),
'roles',(select jsonb_agg(jsonb_build_object('name',rolname,'superuser',rolsuper,'bypass_rls',rolbypassrls,'login',rolcanlogin) order by rolname) from pg_roles where rolname in ('masarifi_migration','masarifi_worker')))$frozen_query$ into actual;
  if jsonb_build_object('relations',actual->'relations','functions',actual->'functions',
    'roles',actual->'roles','server_version_num',actual->'server_version_num')
    is distinct from $frozen_expected${"relations":[{"acl":"{masarifi_migration=arwdDxtm/masarifi_migration,masarifi_api=arw/masarifi_migration,masarifi_worker=rw/masarifi_migration}","kind":"r","name":"account_deletion_requests","owner":"masarifi_migration","schema":"private","columns":[{"name":"id","type":"uuid","present":true,"not_null":true},{"name":"status","type":"text","present":true,"not_null":true},{"name":"user_id","type":"text","present":true,"not_null":true}],"present":true,"policies":[{"name":"deletion_requests_api_insert","roles":["masarifi_api"],"command":"a","check_md5":"4f05dbb61050f2d5e89b064cfd82aa07","using_md5":null,"check_true":false,"permissive":true,"using_true":false},{"name":"deletion_requests_api_select","roles":["masarifi_api"],"command":"r","check_md5":null,"using_md5":"bc87194e7258c319f1a88cba7193d4b4","check_true":false,"permissive":true,"using_true":false},{"name":"deletion_requests_api_update","roles":["masarifi_api"],"command":"w","check_md5":"a02b139aaa186b3012d826fbdd14242b","using_md5":"a02b139aaa186b3012d826fbdd14242b","check_true":false,"permissive":true,"using_true":false},{"name":"deletion_requests_migration_all","roles":["masarifi_migration"],"command":"*","check_md5":"b326b5062b2f0e69046810717534cb09","using_md5":"b326b5062b2f0e69046810717534cb09","check_true":true,"permissive":true,"using_true":true},{"name":"deletion_requests_worker_select","roles":["masarifi_worker"],"command":"r","check_md5":null,"using_md5":"b326b5062b2f0e69046810717534cb09","check_true":false,"permissive":true,"using_true":true},{"name":"deletion_requests_worker_update","roles":["masarifi_worker"],"command":"w","check_md5":"b326b5062b2f0e69046810717534cb09","using_md5":"b326b5062b2f0e69046810717534cb09","check_true":true,"permissive":true,"using_true":true}],"rls_forced":true,"rls_enabled":true,"migration_select":true,"migration_update":true},{"acl":"{masarifi_migration=arwdDxtm/masarifi_migration}","kind":"r","name":"account_upload_erasure_tombstones","owner":"masarifi_migration","schema":"private","columns":[{"name":"lease_until","type":"timestamp with time zone","present":true,"not_null":false},{"name":"next_attempt_at","type":"timestamp with time zone","present":true,"not_null":true},{"name":"request_id","type":"uuid","present":true,"not_null":true},{"name":"user_id","type":"text","present":true,"not_null":true}],"present":true,"policies":[{"name":"account_upload_erasure_migration","roles":["masarifi_migration"],"command":"*","check_md5":"b326b5062b2f0e69046810717534cb09","using_md5":"b326b5062b2f0e69046810717534cb09","check_true":true,"permissive":true,"using_true":true}],"rls_forced":true,"rls_enabled":true,"migration_select":true,"migration_update":true},{"acl":"{masarifi_migration=arwdDxtm/masarifi_migration,masarifi_api=r/masarifi_migration}","kind":"r","name":"import_items","owner":"masarifi_migration","schema":"public","columns":[{"name":"id","type":"uuid","present":true,"not_null":true},{"name":"session_id","type":"uuid","present":true,"not_null":true},{"name":"user_id","type":"text","present":true,"not_null":true}],"present":true,"policies":[{"name":"tracking_import_items_migration_all","roles":["masarifi_migration"],"command":"*","check_md5":"b326b5062b2f0e69046810717534cb09","using_md5":"b326b5062b2f0e69046810717534cb09","check_true":true,"permissive":true,"using_true":true},{"name":"tracking_items_owner_read","roles":["authenticated","masarifi_api"],"command":"r","check_md5":null,"using_md5":"22cfdac76cccefc55597c14887e9121a","check_true":false,"permissive":true,"using_true":false}],"rls_forced":true,"rls_enabled":true,"migration_select":true,"migration_update":true},{"acl":"{masarifi_migration=arwdDxtm/masarifi_migration,masarifi_api=r/masarifi_migration}","kind":"r","name":"import_sessions","owner":"masarifi_migration","schema":"public","columns":[{"name":"claim_token","type":"uuid","present":true,"not_null":false},{"name":"id","type":"uuid","present":true,"not_null":true},{"name":"lease_until","type":"timestamp with time zone","present":true,"not_null":false},{"name":"user_id","type":"text","present":true,"not_null":true}],"present":true,"policies":[{"name":"tracking_import_sessions_migration_all","roles":["masarifi_migration"],"command":"*","check_md5":"b326b5062b2f0e69046810717534cb09","using_md5":"b326b5062b2f0e69046810717534cb09","check_true":true,"permissive":true,"using_true":true},{"name":"tracking_sessions_owner_read","roles":["authenticated","masarifi_api"],"command":"r","check_md5":null,"using_md5":"66b237a0c7917b56954474ba9e9bce4a","check_true":false,"permissive":true,"using_true":false}],"rls_forced":true,"rls_enabled":true,"migration_select":true,"migration_update":true},{"acl":"{masarifi_migration=arwdDxtm/masarifi_migration,masarifi_api=r/masarifi_migration,masarifi_worker=ar/masarifi_migration}","kind":"r","name":"profiles","owner":"masarifi_migration","schema":"public","columns":[{"name":"id","type":"text","present":true,"not_null":true},{"name":"status","type":"text","present":true,"not_null":true}],"present":true,"policies":[{"name":"profiles_api_admin_governance_select","roles":["masarifi_api"],"command":"r","check_md5":null,"using_md5":"456f901ff6c561ba2463d42fd396a3bf","check_true":false,"permissive":true,"using_true":false},{"name":"profiles_api_select","roles":["masarifi_api"],"command":"r","check_md5":null,"using_md5":"c5bad29667424f599fa4cfade134759e","check_true":false,"permissive":true,"using_true":false},{"name":"profiles_api_update","roles":["masarifi_api"],"command":"w","check_md5":"c5bad29667424f599fa4cfade134759e","using_md5":"c5bad29667424f599fa4cfade134759e","check_true":false,"permissive":true,"using_true":false},{"name":"profiles_authenticated_select","roles":["authenticated"],"command":"r","check_md5":null,"using_md5":"c5bad29667424f599fa4cfade134759e","check_true":false,"permissive":true,"using_true":false},{"name":"profiles_migration_owner_all","roles":["masarifi_migration"],"command":"*","check_md5":"b326b5062b2f0e69046810717534cb09","using_md5":"b326b5062b2f0e69046810717534cb09","check_true":true,"permissive":true,"using_true":true},{"name":"profiles_worker_insert","roles":["masarifi_worker"],"command":"a","check_md5":"b326b5062b2f0e69046810717534cb09","using_md5":null,"check_true":true,"permissive":true,"using_true":false},{"name":"profiles_worker_select","roles":["masarifi_worker"],"command":"r","check_md5":null,"using_md5":"b326b5062b2f0e69046810717534cb09","check_true":false,"permissive":true,"using_true":true},{"name":"profiles_worker_update","roles":["masarifi_worker"],"command":"w","check_md5":"b326b5062b2f0e69046810717534cb09","using_md5":"b326b5062b2f0e69046810717534cb09","check_true":true,"permissive":true,"using_true":true}],"rls_forced":true,"rls_enabled":true,"migration_select":true,"migration_update":true}],"functions":[{"name":"assert_active_profile","owner":"masarifi_migration","result":"void","strict":false,"present":true,"language":"plpgsql","volatility":"v","body_md5_lf":"1ffdad9399e4fcceeed4d475f9ae6cc9","execute_acl":"{masarifi_migration=X/masarifi_migration,masarifi_api=X/masarifi_migration}","search_path":["search_path=\"\""],"security_definer":true,"identity_arguments":"p_user_id text"},{"name":"finalize_import_session","owner":"masarifi_migration","result":"jsonb","strict":false,"present":true,"language":"plpgsql","volatility":"v","body_md5_lf":"9f19a8e2d79483b9695bebc213367ec9","execute_acl":"{masarifi_migration=X/masarifi_migration,masarifi_worker=X/masarifi_migration}","search_path":["search_path=\"\""],"security_definer":true,"identity_arguments":"p_session_id uuid, p_fence_token uuid"},{"name":"finalize_import_session_before_owner_context","owner":null,"result":null,"strict":null,"present":false,"language":null,"volatility":null,"body_md5_lf":null,"execute_acl":null,"search_path":null,"security_definer":null,"identity_arguments":null},{"name":"list_due_account_upload_erasure_owners","owner":null,"result":null,"strict":null,"present":false,"language":null,"volatility":null,"body_md5_lf":null,"execute_acl":null,"search_path":null,"security_definer":null,"identity_arguments":null},{"name":"list_reminder_candidates","owner":"masarifi_migration","result":"TABLE(kind text, user_id text, locale text, time_zone text, baseline_at text, evaluated_at text, inactive_days integer)","strict":false,"present":true,"language":"plpgsql","volatility":"v","body_md5_lf":"d7cd86354a2874061f56dcd5b8d4298a","execute_acl":"{masarifi_migration=X/masarifi_migration,masarifi_worker=X/masarifi_migration}","search_path":["search_path=\"\""],"security_definer":true,"identity_arguments":"p_limit integer"},{"name":"reminder_baseline","owner":null,"result":null,"strict":null,"present":false,"language":null,"volatility":null,"body_md5_lf":null,"execute_acl":null,"search_path":null,"security_definer":null,"identity_arguments":null},{"name":"reminder_delivery_eligible","owner":"masarifi_migration","result":"boolean","strict":false,"present":true,"language":"sql","volatility":"s","body_md5_lf":"83199fbdaf861c948ed87ac5df3c982e","execute_acl":"{masarifi_migration=X/masarifi_migration,masarifi_worker=X/masarifi_migration}","search_path":["search_path=\"\""],"security_definer":true,"identity_arguments":"p_event_id uuid, p_user_id text"},{"name":"set_tracking_worker_context","owner":null,"result":null,"strict":null,"present":false,"language":null,"volatility":null,"body_md5_lf":null,"execute_acl":null,"search_path":null,"security_definer":null,"identity_arguments":null}],"roles":[{"name":"masarifi_migration","login":false,"superuser":false,"bypass_rls":false},{"name":"masarifi_worker","login":false,"superuser":false,"bypass_rls":false}],"server_version_num":"170006"}$frozen_expected$::jsonb then
    raise exception 'CLONE_HELPER_PREREQUISITES_DRIFT';
  end if;
  perform set_config('masarifi.compat.executor_role', current_setting('role'), true);
  perform set_config('masarifi.compat.memberships_before',(select md5(coalesce(string_agg(to_jsonb(m)::text,'' order by m.oid),'')) from pg_auth_members m),true);
  perform set_config('masarifi.compat.own_membership',coalesce((select jsonb_build_object(
    'admin',m.admin_option,'inherit',m.inherit_option,'set',m.set_option)::text from pg_auth_members m
    where m.roleid='masarifi_migration'::regrole and m.member=current_user::regrole and m.grantor=current_user::regrole),'null'),true);
  if pg_has_role(current_user,'masarifi_migration','SET') then
    perform set_config('masarifi.compat.granted','false',true);
  else
    execute 'grant masarifi_migration to current_user with set true granted by current_user';
    perform set_config('masarifi.compat.granted','true',true);
  end if;
end $prerequisites$;
set local role masarifi_migration;
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

create function private.list_due_account_upload_erasure_owners(p_limit integer)
returns table(user_id text)
language plpgsql security definer set search_path='' as $$
begin
  if p_limit is null or p_limit not between 1 and 16 then
    raise exception using errcode='42501',message='ERASURE_PURGE_FORBIDDEN';
  end if;
  return query select t.user_id
    from private.account_upload_erasure_tombstones t
    join private.account_deletion_requests d on d.id=t.request_id and d.user_id=t.user_id
    join public.profiles p on p.id=t.user_id
    where d.status in ('processing','completed','failed') and p.status in ('deletion_pending','deleted')
      and t.next_attempt_at<=clock_timestamp() and (t.lease_until is null or t.lease_until<=clock_timestamp())
    group by t.user_id order by min(t.next_attempt_at),t.user_id limit p_limit;
end $$;

create function private.reminder_baseline(p_value text)
returns timestamptz language plpgsql stable strict set search_path='' as $$
begin
  if p_value !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}[T ][0-9]{2}:[0-9]{2}:[0-9]{2}(\.[0-9]{1,6})?(Z|[+-][0-9]{2}(:?[0-9]{2})?)$' then
    return null;
  end if;
  return p_value::timestamptz;
exception when invalid_datetime_format or datetime_field_overflow or invalid_time_zone_displacement_value then
  return null;
end $$;

alter function private.set_tracking_worker_context(text,uuid,uuid) owner to masarifi_migration;
revoke all on function private.set_tracking_worker_context(text,uuid,uuid) from public,anon,authenticated,service_role,masarifi_api,masarifi_worker;
grant execute on function private.set_tracking_worker_context(text,uuid,uuid) to masarifi_worker;
alter function private.list_due_account_upload_erasure_owners(integer) owner to masarifi_migration;
revoke all on function private.list_due_account_upload_erasure_owners(integer) from public,anon,authenticated,service_role,masarifi_api,masarifi_worker;
grant execute on function private.list_due_account_upload_erasure_owners(integer) to masarifi_worker;
alter function private.reminder_baseline(text) owner to masarifi_migration;
revoke all on function private.reminder_baseline(text) from public,anon,authenticated,service_role,masarifi_api,masarifi_worker;
grant execute on function private.reminder_baseline(text) to masarifi_worker;

do $restore_executor$ begin
  perform set_config('role',current_setting('masarifi.compat.executor_role'),true);
end $restore_executor$;
do $restore_membership$
declare prior jsonb:=current_setting('masarifi.compat.own_membership')::jsonb;
begin
  if current_setting('masarifi.compat.granted')='true' then
    if prior='null'::jsonb then execute 'revoke masarifi_migration from current_user granted by current_user';
    else execute format('grant masarifi_migration to current_user with admin %s, inherit %s, set %s granted by current_user',
      prior->>'admin',prior->>'inherit',prior->>'set'); end if;
  end if;
  if (select md5(coalesce(string_agg(to_jsonb(m)::text,'' order by m.oid),'')) from pg_auth_members m)
    is distinct from current_setting('masarifi.compat.memberships_before') then
    raise exception 'EXACT_MEMBERSHIP_RESTORATION_FAILED';
  end if;
end $restore_membership$;
