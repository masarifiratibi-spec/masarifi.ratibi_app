begin;
create extension if not exists pgtap with schema extensions;
select plan(21);

grant authenticated, masarifi_api, masarifi_worker, masarifi_migration to current_user with inherit true, set true;
set local role masarifi_migration;

select has_table('private', 'owner_bootstrap_state', 'owner bootstrap consumption is persisted privately');
select col_is_pk('private', 'owner_bootstrap_state', array['singleton'], 'bootstrap state is a singleton');
select ok(
  (select relrowsecurity and relforcerowsecurity from pg_class where oid='private.owner_bootstrap_state'::regclass),
  'bootstrap state forces RLS'
);
select ok(not has_table_privilege('masarifi_api', 'private.owner_bootstrap_state', 'SELECT'), 'API cannot read bootstrap state');
select ok(not has_function_privilege('public', 'private.is_active_super_admin(text)', 'EXECUTE'), 'PUBLIC cannot inspect owner status');
select ok(not has_function_privilege('public', 'private.is_super_admin_role(uuid)', 'EXECUTE'), 'PUBLIC cannot inspect owner roles');

insert into public.profiles(id,primary_email,status) values
  ('owner-rbac-a','owner-a@example.test','active'),
  ('owner-rbac-b','owner-b@example.test','active'),
  ('owner-rbac-custom','custom@example.test','active'),
  ('owner-rbac-invitee','invitee@example.test','active');
insert into public.admin_profiles(user_id,status) values
  ('owner-rbac-a','active'),('owner-rbac-b','active'),('owner-rbac-custom','active');
insert into public.admin_role_assignments(user_id,role_id,assigned_by,reason)
select 'owner-rbac-a',id,'owner-rbac-a','Initial owner test assignment' from public.roles where key='super-admin';
insert into public.admin_role_assignments(user_id,role_id,assigned_by,reason)
select 'owner-rbac-custom',id,'owner-rbac-a','Custom admin test assignment' from public.roles where key='security-administrator';
insert into private.owner_bootstrap_state(singleton,user_id,assignment_id)
select true,'owner-rbac-a',a.id from public.admin_role_assignments a
join public.roles r on r.id=a.role_id where a.user_id='owner-rbac-a' and r.key='super-admin';
insert into public.admin_invitations(email,role_id,token_hash,invited_by,expires_at)
select 'invitee@example.test',id,'h1:'||repeat('2',64),'owner-rbac-a',clock_timestamp()+interval '1 hour'
from public.roles where key='support-agent';

select throws_ok(
  $$update private.owner_bootstrap_state set user_id='owner-rbac-b'$$,
  '23514','OWNER_BOOTSTRAP_STATE_IMMUTABLE','bootstrap marker cannot be updated'
);
select throws_ok(
  $$delete from private.owner_bootstrap_state$$,
  '23514','OWNER_BOOTSTRAP_STATE_IMMUTABLE','bootstrap marker cannot be deleted'
);
select throws_ok(
  $$insert into private.owner_bootstrap_state(singleton,user_id,assignment_id)
    select true,'owner-rbac-b',a.id from public.admin_role_assignments a limit 1$$,
  '23505',null,'bootstrap marker cannot be consumed twice'
);
select throws_ok(
  $$update public.admin_role_assignments set revoked_at=clock_timestamp()
    where user_id='owner-rbac-a' and role_id=(select id from public.roles where key='super-admin')$$,
  '23514','LAST_SUPER_ADMIN_REQUIRED','last owner assignment cannot be revoked'
);
select throws_ok(
  $$delete from public.admin_role_assignments
    where user_id='owner-rbac-a' and role_id=(select id from public.roles where key='super-admin')$$,
  '23514','LAST_SUPER_ADMIN_REQUIRED','last owner assignment cannot be deleted'
);
select throws_ok(
  $$delete from public.admin_profiles where user_id='owner-rbac-a'$$,
  '23514','LAST_SUPER_ADMIN_REQUIRED','last owner profile cannot be deleted'
);
select throws_ok(
  $$delete from public.roles where key='super-admin'$$,
  '23514','LAST_SUPER_ADMIN_REQUIRED','the active owner role cannot be deleted'
);

select set_config('request.jwt.claims','{"role":"authenticated","sub":"owner-rbac-custom","sid":"sess"}',true);
set local role masarifi_api;
select throws_ok(
  $$insert into public.admin_role_assignments(user_id,role_id,assigned_by,reason)
    select 'owner-rbac-b',id,'owner-rbac-custom','Unauthorized owner role assignment' from public.roles where key='super-admin'$$,
  '42501','SUPER_ADMIN_TARGET_REQUIRES_SUPER_ADMIN','ordinary admins cannot assign owner privileges'
);
select throws_ok(
  $$insert into public.admin_invitations(email,role_id,token_hash,invited_by,expires_at)
    select 'invitee@example.test',id,'h1:'||repeat('1',64),'owner-rbac-custom',clock_timestamp()+interval '1 hour'
    from public.roles where key='super-admin'$$,
  '42501','SUPER_ADMIN_TARGET_REQUIRES_SUPER_ADMIN','ordinary admins cannot invite owner privileges'
);
select throws_ok(
  $$insert into public.admin_role_assignments(user_id,role_id,assigned_by,reason)
    select 'owner-rbac-custom',id,'owner-rbac-custom','Unauthorized self role assignment' from public.roles where key='content-manager'$$,
  '42501',null,'admins cannot assign roles to themselves'
);

reset role;
select set_config('request.jwt.claims','{"role":"authenticated","sub":"owner-rbac-a","sid":"sess"}',true);
set local role masarifi_api;
select lives_ok(
  $$insert into public.admin_role_assignments(user_id,role_id,assigned_by,reason)
    select 'owner-rbac-b',id,'owner-rbac-a','Authorized backup owner assignment' from public.roles where key='super-admin'$$,
  'an active owner can assign owner privileges to another admin'
);
select lives_ok(
  $$update public.admin_role_assignments set revoked_at=clock_timestamp()
    where user_id='owner-rbac-a' and role_id=(select id from public.roles where key='super-admin')$$,
  'an owner can be revoked after another active owner exists'
);

reset role;
select set_config('request.jwt.claims','{"role":"authenticated","sub":"owner-rbac-invitee","sid":"sess"}',true);
set local role masarifi_api;
select lives_ok(
  $$select private.accept_admin_invitation('h1:'||repeat('2',64),'invitee@example.test','owner-rbac-accept')$$,
  'an invited verified identity can accept its invitation'
);
reset role;
select is(
  (select count(*)::integer from audit.audit_events where action='admin.invitation_accepted' and actor_id='owner-rbac-invitee'),
  1,
  'invitation acceptance emits one audit event'
);
select is(
  (select count(*)::integer from private.outbox_events where event_type='admin.role_assigned'
    and payload->>'adminId'='owner-rbac-invitee'),
  1,
  'invitation acceptance emits one role-assigned outbox event'
);

select * from finish();
rollback;
