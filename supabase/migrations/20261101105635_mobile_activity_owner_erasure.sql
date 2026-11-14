-- Profiles remain as tombstones, so activity rows need explicit owner erasure.
grant masarifi_migration to current_user with set true, inherit false;
set local role masarifi_migration;

do $$
declare body text; marker constant text := '(''public'',''salary_profiles'')';
begin
  select pg_catalog.pg_get_functiondef('private.erase_account_owner_payload(uuid,text)'::regprocedure) into body;
  if position('(''private'',''mobile_activity_buckets'')' in body)>0 then return; end if;
  if position(marker in body)=0 then
    raise exception using errcode='55000',message='ACTIVITY_ERASURE_REGISTRY_DEFINITION_CHANGED';
  end if;
  body:=replace(body,marker,'(''private'',''mobile_activity_buckets''),'||marker);
  execute body;
end $$;

reset role;
revoke masarifi_migration from current_user granted by current_user;
